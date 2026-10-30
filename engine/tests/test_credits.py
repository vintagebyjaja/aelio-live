"""Usage limits, credit wallet, payments (spec tests 1-20)."""
import json
import threading
import time

import pytest

from aelio import db, payments, usage

SECRET = "whsec_test"


@pytest.fixture()
def u(env, monkeypatch):
    usage.seed()
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", SECRET)
    db.run("UPDATE plans SET allowance=10 WHERE id='free'")
    db.run("UPDATE plans SET allowance=30 WHERE id='live'")

    def mk(role="member", plan="free", unlimited=0):
        uid = db.new_id("usr")
        db.insert("users", {"id": uid, "email": uid + "@t.dev", "pw_hash": "x", "totp_secret": "A", "mfa_enabled": 1,
                            "role": role, "created_at": db.now(), "plan": plan, "unlimited": unlimited})
        return uid
    return mk


def use(uid, n=1):
    r = usage.reserve(uid, "chat_message", units=n)
    return usage.settle(r["id"])


def hook(event: dict):
    body = json.dumps(event).encode()
    return payments.handle_webhook(body, payments.sign_for_tests(body, SECRET))


def paid_purchase(uid, credits=100, cents=299, sid="cs_1", pi="pi_1", eid="evt_1"):
    pid = db.new_id("pay")
    db.insert("payments", {"id": pid, "user_id": uid, "package_id": "pkg_quick", "provider": "stripe", "session_id": sid,
                           "status": "pending", "amount_cents": cents, "currency": "usd", "credits": credits,
                           "created_at": db.now(), "updated_at": db.now()})
    r = hook({"id": eid, "type": "checkout.session.completed", "data": {"object": {"id": sid, "payment_status": "paid",
             "amount_total": cents, "currency": "usd", "payment_intent": pi}}})
    return pid, r


def test_01_quota_exhaustion(u):
    uid = u()
    for _ in range(10):
        use(uid)
    with pytest.raises(usage.LimitReached) as e:
        use(uid)
    assert e.value.info["resets_at"] > time.time()


def test_02_rolling_window_recovery(u):
    uid = u()
    for _ in range(10):
        use(uid)
    db.run("UPDATE usage_events SET ts=ts-6*3600 WHERE user_id=?", (uid,))
    assert usage.window_state(uid)["remaining"] == 10


def test_03_free_vs_live(u):
    assert usage.window_state(u(plan="free"))["allowance"] == 10
    assert usage.window_state(u(plan="live"))["allowance"] == 30


def test_04_founder_and_unlimited_exempt(u):
    for uid in (u(role="founder"), u(unlimited=1)):
        for _ in range(50):
            use(uid)
        assert usage.overview(uid)["exempt"] is True
        assert db.q1("SELECT COUNT(*) n FROM usage_events WHERE user_id=? AND source='exempt'", (uid,))["n"] == 50  # still metered


def test_05_unauthorized_founder_attempt(fbclient):
    c = fbclient
    r = c.get("/api/me", headers=c.tok("attacker", "jaja@vybr8.live")).json()
    assert r["role"] == "visitor" and r["destination"] == "game"


def test_06_09_10_purchase_allocation_consumption(u):
    uid = u()
    pid, r = paid_purchase(uid)
    assert r["status"] == "paid" and usage.balances(uid)["purchased"] == 100
    for _ in range(10):
        use(uid)                                  # allowance first
    assert usage.balances(uid)["purchased"] == 100
    use(uid, 5)                                   # then purchased
    assert usage.balances(uid)["purchased"] == 95


def test_07_failed_and_19_canceled_payment(u):
    uid = u()
    for sid, typ in (("cs_f", "checkout.session.async_payment_failed"), ("cs_c", "checkout.session.expired")):
        db.insert("payments", {"id": db.new_id("pay"), "user_id": uid, "package_id": "p", "provider": "stripe", "session_id": sid,
                               "status": "pending", "amount_cents": 299, "currency": "usd", "credits": 100,
                               "created_at": db.now(), "updated_at": db.now()})
        hook({"id": "evt_" + sid, "type": typ, "data": {"object": {"id": sid}}})
    assert usage.balances(uid)["purchased"] == 0
    assert {r["status"] for r in db.q("SELECT status FROM payments WHERE user_id=?", (uid,))} == {"failed", "canceled"}


def test_08_duplicate_webhook(u):
    uid = u()
    pid, _ = paid_purchase(uid)
    ev = {"id": "evt_1", "type": "checkout.session.completed", "data": {"object": {"id": "cs_1", "payment_status": "paid",
          "amount_total": 299, "currency": "usd"}}}
    assert hook(ev) == {"duplicate": True}
    assert usage.balances(uid)["purchased"] == 100


def test_webhook_signature_and_amount_checks(u):
    uid = u()
    body = b'{"id":"evt_x","type":"checkout.session.completed","data":{"object":{}}}'
    with pytest.raises(payments.PaymentError):
        payments.handle_webhook(body, "t=1,v1=deadbeef")
    with pytest.raises(payments.PaymentError):
        payments.handle_webhook(body, payments.sign_for_tests(body, SECRET, ts=int(time.time()) - 3600))
    pid, r = paid_purchase(uid, cents=299, sid="cs_m", eid="evt_m")
    db.run("UPDATE payments SET status='pending', amount_cents=999 WHERE id=?", (pid,))
    db.run("DELETE FROM credit_ledger WHERE user_id=?", (uid,))
    r = hook({"id": "evt_m2", "type": "checkout.session.completed", "data": {"object": {"id": "cs_m", "payment_status": "paid", "amount_total": 299, "currency": "usd"}}})
    assert "mismatch" in r["error"] and usage.balances(uid)["purchased"] == 0


def test_11_purchased_credits_survive_reset(u):
    uid = u()
    paid_purchase(uid)
    db.run("UPDATE credit_ledger SET ts=ts-10*3600 WHERE user_id=?", (uid,))
    assert usage.balances(uid)["purchased"] == 100


def test_12_insufficient_balance(u):
    uid = u()
    for _ in range(10):
        use(uid)
    usage.grant(uid, 3, "promo", "founder", "t")
    with pytest.raises(usage.LimitReached) as e:
        use(uid, 5)
    assert e.value.info["needed"] == 5 and e.value.info["available"] == 3
    assert usage.balances(uid)["promo"] == 3      # nothing taken on failure


def test_13_refund_reconciliation(u):
    uid = u()
    paid_purchase(uid, credits=100, cents=1000)
    for _ in range(10):
        use(uid)
    use(uid, 70)                                  # 30 purchased left
    r = hook({"id": "evt_r", "type": "charge.refunded", "data": {"object": {"payment_intent": "pi_1", "amount": 1000, "amount_refunded": 1000}}})
    assert r["reversed"] == 30 and r["shortfall"] == 70
    assert usage.balances(uid)["purchased"] == 0  # never negative
    assert db.q1("SELECT status FROM users WHERE id=?", (uid,))["status"] == "review"


def test_14_simultaneous_requests_no_double_spend(u):
    uid = u()
    usage.grant(uid, 5, "promo", "founder", "t")   # 10 allowance + 5 promo = 15 total
    ok, fail = [], []

    def worker():
        from aelio import db as d
        try:
            r = usage.reserve(uid, "chat_message"); usage.settle(r["id"]); ok.append(1)
        except usage.LimitReached:
            fail.append(1)
        finally:
            d.reset_connection_cache() if False else None
    ts = [threading.Thread(target=worker) for _ in range(25)]
    [t.start() for t in ts]; [t.join() for t in ts]
    assert len(ok) == 15 and len(fail) == 10
    assert usage.balances(uid)["promo"] == 0


def test_15_promo_grants_and_priority(u):
    uid = u()
    paid_purchase(uid)
    usage.grant(uid, 5, "promo", "founder", "welcome")
    for _ in range(10):
        use(uid)
    use(uid, 5)                                    # promo before purchased
    b = usage.balances(uid)
    assert b["promo"] == 0 and b["purchased"] == 100
    assert db.q1("SELECT COUNT(*) n FROM audit_log WHERE action='credits.promo_grant'")["n"] == 1


def test_16_plan_change(u):
    uid = u()
    for _ in range(10):
        use(uid)
    usage.set_plan(uid, "live", "founder")
    assert usage.window_state(uid)["remaining"] == 20
    usage.set_plan(uid, "free", "founder")
    assert usage.window_state(uid)["remaining"] == 0


def test_17_suspension(u):
    uid = u()
    paid_purchase(uid)
    usage.set_status(uid, "suspended", "founder")
    with pytest.raises(usage.Suspended):
        use(uid)


def test_18_guardians_emergency_restriction_applies_to_everyone(u):
    usage.set_restriction(True, "thermal critical", "guardian-thermal")
    for uid in (u(), u(role="founder")):
        with pytest.raises(usage.Restricted):
            use(uid)
    usage.set_restriction(False, "", "founder")
    use(u(role="founder"))


def test_release_refunds_reservation(u):
    uid = u()
    usage.grant(uid, 5, "promo", "founder", "t")
    for _ in range(10):
        use(uid)
    r = usage.reserve(uid, "chat_message", units=3)
    assert usage.balances(uid)["promo"] == 2
    usage.release(r["id"])
    assert usage.balances(uid)["promo"] == 5


def test_credits_dont_unlock_plan_features(u):
    uid = u()
    paid_purchase(uid)
    with pytest.raises(usage.FeatureUnavailable):
        usage.reserve(uid, "voice_minute")


def test_unapproved_packages_not_sold(u):
    uid = u()
    assert payments.available_packages("free") == []
    db.run("UPDATE credit_packages SET active=1 WHERE id='pkg_quick'")
    assert payments.available_packages("free") == []
    db.run("UPDATE credit_packages SET approved=1 WHERE id='pkg_quick'")
    assert [p["id"] for p in payments.available_packages("free")] == ["pkg_quick"]


def test_20_chat_after_purchase_keeps_conversation(fbclient, monkeypatch):
    from conftest import PERSONAL_EMAIL
    c = fbclient
    monkeypatch.setenv("AELIO_UNLIMITED_UIDS", ""); monkeypatch.setenv("AELIO_UNLIMITED_EMAILS", "")
    h = c.tok("member2", PERSONAL_EMAIL)
    monkeypatch.setenv("AELIO_MEMBER_UIDS", "member2")
    usage.seed(); db.run("UPDATE plans SET allowance=1 WHERE id='free'")
    # Chat now runs through the Intelligence Gateway; use the offline test provider (not AI).
    monkeypatch.setenv("AELIO_ALLOW_TEST_PROVIDER", "1")
    from aelio.intelligence import gateway, settings as ai
    ai.seed_models(); gateway.reset_limits()
    db.kv_set("intelligence_settings", {"tiers": {"standard": {"provider": "test", "model": "test-echo"},
                                                  "advanced": {"provider": "test", "model": "test-echo"}}})
    agents = c.get("/api/my/agents", headers=h).json()["agents"]
    aid = agents[0]["id"]
    r1 = c.post(f"/api/my/agents/{aid}/chat", headers=h, json={"message": "one"}).json()
    r2 = c.post(f"/api/my/agents/{aid}/chat", headers=h, json={"message": "two", "conversation_id": r1["conversation_id"]})
    assert r2.status_code == 402 and r2.json()["code"] == "limit_reached"
    usage.grant("sb_member2", 10, "purchased", "stripe-webhook", "test purchase", "purchase")
    r3 = c.post(f"/api/my/agents/{aid}/chat", headers=h, json={"message": "two", "conversation_id": r1["conversation_id"]})
    assert r3.status_code == 200 and r3.json()["conversation_id"] == r1["conversation_id"]
    conv = c.get(f"/api/my/conversations/{r1['conversation_id']}", headers=h).json()
    assert [m["text"] for m in conv["messages"]] == ["one", "[test provider, not AI] You said: one",
                                                     "two", "[test provider, not AI] You said: two"]
