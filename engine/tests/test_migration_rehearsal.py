"""Full Firebase -> Supabase migration rehearsal, including both rollback paths, with data-integrity checks.

  1 backup (verified)  2 map users (dry run, then import)  3 dual-run (both providers, same accounts)
  4 cutover (Supabase only)  5 rollback A: switch providers back  6 rollback B: restore the pre-migration backup
"""
from aelio import backup, db, identity
from conftest import FOUNDER_EMAIL, FOUNDER_UID, PERSONAL_EMAIL, PERSONAL_UID, founder_mfa
from test_identity import SB_FOUNDER, SB_PERSONAL, c, sb  # noqa: F401


def fingerprint() -> dict:
    """What must survive the migration unchanged: users, wallets, history, Studio security, audit trail length."""
    q = lambda sql: [tuple(r.values()) for r in db.q(sql)]  # noqa: E731
    return {"users": q("SELECT id, email, role, plan, unlimited, status FROM users ORDER BY id"),
            "credits": q("SELECT * FROM credit_ledger ORDER BY 1"),
            "agents": q("SELECT * FROM user_agents ORDER BY 1"),
            "conversations": q("SELECT * FROM conversations ORDER BY 1"),
            "messages": q("SELECT * FROM messages ORDER BY 1"),
            "settings": q("SELECT user_id, external_ai_consent_at FROM user_settings ORDER BY 1")}


def test_migration_rehearsal_with_both_rollbacks(c, monkeypatch):  # noqa: F811
    monkeypatch.setenv("AELIO_RECOVERY_EMAIL", PERSONAL_EMAIL)
    monkeypatch.setenv("AELIO_RECOVERY_UID", f"{PERSONAL_UID},{SB_PERSONAL}")
    monkeypatch.setenv("AELIO_AUTH_PROVIDERS", "firebase")                    # today: Firebase only
    # existing state on Firebase: founder (with MFA + consent) and the personal account
    h = founder_mfa(c)
    assert c.put("/api/my/settings", headers=h, json={"external_ai_consent": True}).status_code == 200
    c.get("/api/me", headers=c.tok(PERSONAL_UID, PERSONAL_EMAIL))
    assert c.get("/api/me", headers=c.sb()).status_code == 401                # Supabase not enabled yet
    monkeypatch.setenv("AELIO_ALLOW_TEST_PROVIDER", "1")                      # some real history to protect
    db.kv_set("intelligence_settings", {"tiers": {"standard": {"provider": "test", "model": "test-echo"},
                                                  "advanced": {"provider": "test", "model": "test-echo"}}})
    agent = c.post("/api/my/agents", headers=h, json={"name": "Scout"}).json()
    aid = agent["agent_id"]
    assert c.post(f"/api/my/agents/{aid}/chat", headers=h, json={"message": "hello"}).status_code == 200
    before = fingerprint()
    assert before["messages"] and before["conversations"] and before["agents"] and before["users"]

    # 1 backup
    m = backup.create("pre-supabase")
    assert backup.verify(m["file"])["ok"]

    # 2 map users: dry run shows the plan; import links them
    export = {"users": [{"localId": FOUNDER_UID, "email": FOUNDER_EMAIL}, {"localId": PERSONAL_UID, "email": PERSONAL_EMAIL}]}
    sbu = [{"id": SB_FOUNDER, "email": FOUNDER_EMAIL}, {"id": SB_PERSONAL, "email": PERSONAL_EMAIL}]
    p = identity.plan(export, sbu)
    assert len(p["mapped"]) == 2 and not p["missing_in_supabase"]
    assert fingerprint() == before                                             # planning changes nothing
    assert identity.import_mapping([{"firebase_uid": r["firebase_uid"], "supabase_uid": r["supabase_uid"]} for r in p["mapped"]],
                                   "founder")["linked"] == 2

    # 3 dual-run: both providers reach the same accounts and permissions
    monkeypatch.setenv("AELIO_AUTH_PROVIDERS", "supabase,firebase")
    for hdr in (c.tok(), c.sb()):
        me = c.get("/api/me", headers=hdr).json()
        assert me["role"] == "founder" and me["level"] == "founder"
    me = c.get("/api/me", headers=c.sb(SB_PERSONAL, PERSONAL_EMAIL)).json()
    assert me["level"] == "personal_founder" and me["recovery_account"] is True
    assert c.get("/api/brain/engine", headers=c.sb(SB_PERSONAL, PERSONAL_EMAIL)).status_code == 403
    assert c.get("/api/my/ai", headers=c.sb()).json()["consent_at"]       # consent carried over
    assert fingerprint() == before                                             # no duplicate users, nothing changed

    # 4 cutover
    monkeypatch.setenv("AELIO_AUTH_PROVIDERS", "supabase")
    assert c.get("/api/me", headers=c.tok()).status_code == 401
    assert c.get("/api/me", headers=c.sb()).json()["role"] == "founder"

    # 5 rollback A (fast): providers back to Firebase; nothing else changes
    monkeypatch.setenv("AELIO_AUTH_PROVIDERS", "firebase")
    assert c.get("/api/me", headers=c.tok()).json()["role"] == "founder"
    assert c.get("/api/me", headers=c.sb()).status_code == 401
    assert fingerprint() == before

    # 6 rollback B (full): restore the pre-migration backup; Supabase links are gone, Firebase works as before
    r = backup.restore(m["file"])
    assert backup.verify(r["safety_backup"])["ok"]
    assert not db.q1("SELECT 1 FROM identities WHERE provider='supabase'")
    assert fingerprint() == before
    assert c.get("/api/me", headers=c.tok()).json()["role"] == "founder"
    assert db.q1("PRAGMA integrity_check")["integrity_check"] == "ok"
