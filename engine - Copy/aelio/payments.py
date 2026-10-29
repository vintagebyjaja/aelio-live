"""Credit purchases through Stripe Checkout (test mode unless the founder explicitly enables live).

Flow
  1. The portal asks the engine for a checkout. The engine looks up the package price server-side,
     creates a pending payment row and a Stripe Checkout Session, and returns its URL.
  2. Stripe calls POST /webhooks/stripe. The engine verifies the Stripe-Signature (HMAC-SHA256, 5-minute
     tolerance), stores the event id (duplicates are ignored), checks the amount and currency against the
     pending row, and only then adds credits to the ledger.
  3. A browser landing on the success URL never grants anything by itself.

Refunds (charge.refunded) reverse credits proportionally, up to what is still unspent. If credits were
already spent, the shortfall is recorded and the account is set to 'review' for the founder. Balances
never go negative and history is never rewritten. Nothing ever charges a card automatically.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
import urllib.parse
import urllib.request

from . import db, usage


class PaymentError(Exception):
    status = 400


def configured() -> dict:
    key = os.environ.get("STRIPE_SECRET_KEY", "")
    live_ok = os.environ.get("AELIO_PAYMENTS_LIVE", "0") == "1"
    mode = "live" if key.startswith("sk_live_") else ("test" if key.startswith("sk_test_") else None)
    return {"provider": "stripe", "configured": bool(key) and bool(os.environ.get("STRIPE_WEBHOOK_SECRET")),
            "mode": mode, "live_enabled": live_ok, "usable": bool(mode) and (mode == "test" or live_ok)}


def available_packages(user_plan: str | None = None) -> list[dict]:
    t = time.time()
    rows = db.q("SELECT * FROM credit_packages WHERE active=1 AND approved=1 ORDER BY sort")
    out = []
    disc = usage.plan(user_plan)["member_discount_pct"] if user_plan else 0
    for r in rows:
        if (r["starts_at"] and r["starts_at"] > t) or (r["ends_at"] and r["ends_at"] < t):
            continue
        price = int(round(r["price_cents"] * (1 - (disc or 0) / 100)))
        out.append({"id": r["id"], "name": r["name"], "credits": r["credits"], "price_cents": price,
                    "list_price_cents": r["price_cents"], "currency": r["currency"], "promo": bool(r["promo"])})
    return out


def _stripe(path: str, params: dict) -> dict:
    data = urllib.parse.urlencode(params, doseq=True).encode()
    req = urllib.request.Request("https://api.stripe.com/v1/" + path, data=data, method="POST", headers={
        "Authorization": "Bearer " + os.environ["STRIPE_SECRET_KEY"], "Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())


def create_checkout(uid: str, package_id: str, return_to: str, site: str) -> dict:
    cfg = configured()
    if not cfg["configured"]:
        raise PaymentError("Payments aren't set up yet (founder: add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET).")
    if not cfg["usable"]:
        raise PaymentError("Live payments are disabled. Founder approval (AELIO_PAYMENTS_LIVE=1) is required.")
    u = usage.user(uid)
    pkg = next((p for p in available_packages(u["plan"]) if p["id"] == package_id), None)
    if not pkg:
        raise PaymentError("That credit package isn't available.")
    if not return_to.startswith("/"):
        return_to = "/brain/my/wallet"
    pid = db.new_id("pay")
    sess = _stripe("checkout/sessions", {
        "mode": "payment", "client_reference_id": pid,
        "success_url": f"{site}/brain/my/wallet?checkout=success&payment={pid}",
        "cancel_url": f"{site}/brain/my/wallet?checkout=canceled&payment={pid}",
        "line_items[0][quantity]": 1, "line_items[0][price_data][currency]": pkg["currency"],
        "line_items[0][price_data][unit_amount]": pkg["price_cents"],
        "line_items[0][price_data][product_data][name]": f"AELIO Credits: {pkg['name']} ({pkg['credits']})",
        "metadata[payment_id]": pid, "metadata[user_id]": uid, "metadata[package_id]": pkg["id"]})
    db.insert("payments", {"id": pid, "user_id": uid, "package_id": pkg["id"], "provider": "stripe",
                           "session_id": sess["id"], "status": "pending", "amount_cents": pkg["price_cents"],
                           "currency": pkg["currency"], "credits": pkg["credits"], "return_to": return_to,
                           "created_at": db.now(), "updated_at": db.now()})
    db.audit("member", uid, "payment.checkout_created", pid, {"package": pkg["id"], "amount_cents": pkg["price_cents"]})
    return {"payment_id": pid, "url": sess["url"]}


# ---------------------------------------------------------------- webhooks
def verify_signature(payload: bytes, header: str, secret: str, tolerance: int = 300, now: float | None = None) -> None:
    parts = dict(p.split("=", 1) for p in header.split(",") if "=" in p)
    sigs = [v for k, v in (p.split("=", 1) for p in header.split(",") if "=" in p) if k == "v1"]
    if "t" not in parts or not sigs:
        raise PaymentError("missing signature")
    ts = int(parts["t"])
    if abs((now or time.time()) - ts) > tolerance:
        raise PaymentError("signature timestamp outside tolerance")
    expected = hmac.new(secret.encode(), f"{ts}.".encode() + payload, hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(expected, s) for s in sigs):
        raise PaymentError("bad signature")


def handle_webhook(payload: bytes, sig_header: str) -> dict:
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    if not secret:
        raise PaymentError("webhook secret not configured")
    verify_signature(payload, sig_header or "", secret)
    ev = json.loads(payload)
    with db.tx() as c:
        if c.execute("SELECT 1 FROM webhook_events WHERE event_id=?", (ev["id"],)).fetchone():
            return {"duplicate": True}
        c.execute("INSERT INTO webhook_events(event_id,type,received_at) VALUES(?,?,?)", (ev["id"], ev["type"], time.time()))
    obj = ev["data"]["object"]
    result = {"ignored": ev["type"]}
    if ev["type"] in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        result = _complete(obj)
    elif ev["type"] in ("checkout.session.expired", "checkout.session.async_payment_failed"):
        result = _fail(obj, "canceled" if ev["type"].endswith("expired") else "failed")
    elif ev["type"] == "charge.refunded":
        result = _refund(obj)
    db.update("webhook_events", "event_id", ev["id"], result=db.dumps(result))
    return result


def _complete(s: dict) -> dict:
    if s.get("payment_status") != "paid":
        return {"status": "awaiting_payment"}
    with db.tx() as c:
        p = c.execute("SELECT * FROM payments WHERE session_id=?", (s["id"],)).fetchone()
        if not p:
            return {"error": "unknown session"}
        if p["status"] != "pending":
            return {"status": p["status"], "note": "already processed"}
        if int(s.get("amount_total", -1)) != p["amount_cents"] or (s.get("currency") or "").lower() != p["currency"]:
            c.execute("UPDATE payments SET status='amount_mismatch', updated_at=? WHERE id=?", (time.time(), p["id"]))
            return {"error": "amount mismatch; no credits granted"}
        receipt = {"payment_id": p["id"], "credits": p["credits"], "amount_cents": p["amount_cents"],
                   "currency": p["currency"], "paid_at": time.time(), "provider_session": s["id"]}
        c.execute("UPDATE payments SET status='paid', payment_intent=?, receipt=?, updated_at=? WHERE id=?",
                  (s.get("payment_intent"), json.dumps(receipt), time.time(), p["id"]))
        c.execute("INSERT INTO credit_ledger(user_id,ts,type,bucket,amount,ref,note,actor) VALUES(?,?,?,?,?,?,?,?)",
                  (p["user_id"], time.time(), "purchase", "purchased", p["credits"], p["id"], "Stripe checkout", "stripe-webhook"))
    db.audit("system", "stripe-webhook", "payment.paid", p["id"], {"credits": p["credits"]})
    return {"status": "paid", "credits": p["credits"]}


def _fail(s: dict, status: str) -> dict:
    db.run("UPDATE payments SET status=?, updated_at=? WHERE session_id=? AND status='pending'", (status, time.time(), s["id"]))
    return {"status": status}


def _refund(ch: dict) -> dict:
    with db.tx() as c:
        p = c.execute("SELECT * FROM payments WHERE payment_intent=?", (ch.get("payment_intent"),)).fetchone()
        if not p:
            return {"error": "unknown payment"}
        frac = min(1.0, int(ch.get("amount_refunded", 0)) / max(1, int(ch.get("amount", p["amount_cents"]))))
        target = int(round(p["credits"] * frac))
        need = target - p["credits_reversed"]
        if need <= 0:
            return {"status": "nothing to reverse"}
        bal = usage.balances(p["user_id"], c)["purchased"]
        take = max(0, min(need, bal))
        if take:
            c.execute("INSERT INTO credit_ledger(user_id,ts,type,bucket,amount,ref,note,actor) VALUES(?,?,?,?,?,?,?,?)",
                      (p["user_id"], time.time(), "refund_reversal", "purchased", -take, p["id"], "Stripe refund", "stripe-webhook"))
        short = need - take
        if short:
            c.execute("INSERT INTO credit_ledger(user_id,ts,type,bucket,amount,ref,note,actor) VALUES(?,?,?,?,?,?,?,?)",
                      (p["user_id"], time.time(), "refund_shortfall", "purchased", 0, p["id"],
                       f"{short} refunded credits were already spent", "stripe-webhook"))
            c.execute("UPDATE users SET status='review' WHERE id=? AND status='active'", (p["user_id"],))
        receipt = json.loads(p["receipt"] or "{}")
        receipt["amount_refunded"] = int(ch.get("amount_refunded", 0))
        c.execute("UPDATE payments SET status=?, credits_reversed=?, receipt=?, updated_at=? WHERE id=?",
                  ("refunded" if frac >= 1 else "partially_refunded", p["credits_reversed"] + need, json.dumps(receipt),
                   time.time(), p["id"]))
    db.audit("system", "stripe-webhook", "payment.refunded", p["id"], {"reversed": take, "shortfall": short})
    return {"status": "refunded", "reversed": take, "shortfall": short}


def sign_for_tests(payload: bytes, secret: str, ts: int | None = None) -> str:
    ts = ts or int(time.time())
    return f"t={ts},v1=" + hmac.new(secret.encode(), f"{ts}.".encode() + payload, hashlib.sha256).hexdigest()
