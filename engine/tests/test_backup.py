"""Backups before migration: verified snapshot, tamper detection, restore with a safety copy."""
from aelio import backup, db


def test_backup_verify_restore(env):
    db.insert("kv", {"key": "marker", "value": '"before"'})
    m = backup.create("test")
    assert m["integrity"] == "ok" and m["row_counts"]["kv"] >= 1 and len(m["sha256"]) == 64
    assert backup.verify(m["file"])["ok"] is True
    db.run("UPDATE kv SET value='\"after\"' WHERE key='marker'")
    r = backup.restore(m["file"])
    assert db.kv_get("marker") == "before"
    assert backup.verify(r["safety_backup"])["ok"] is True          # the pre-restore state was kept too


def test_tampered_backup_is_refused(env):
    m = backup.create("t")
    p = env / "data" / "backups" / m["file"]
    data = bytearray(p.read_bytes()); data[-10] ^= 0xFF; p.write_bytes(bytes(data))
    assert backup.verify(m["file"])["ok"] is False
    import pytest
    with pytest.raises(RuntimeError):
        backup.restore(m["file"])
