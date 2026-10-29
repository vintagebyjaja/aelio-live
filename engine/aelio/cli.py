"""AELIO Studio command line.

  python -m aelio.cli init                 create data dirs, seed voices/agents, lock suites if unlocked
  python -m aelio.cli create-founder EMAIL local-mode founder (password + authenticator)
  python -m aelio.cli serve [--port 8787]  run the studio (binds 127.0.0.1; expose via Cloudflare Tunnel)
  python -m aelio.cli first-run            run every first-run verification and write the report
  python -m aelio.cli relock-suites        founder-only: re-hash protected suites after a reviewed change
  python -m aelio.cli register-app NAME SLUG SCOPE[,SCOPE]
  python -m aelio.cli backup [--label L]   verified snapshot of the engine database (+ manifest)
  python -m aelio.cli backup-verify FILE   re-check a backup's checksum, integrity and row counts
  python -m aelio.cli restore FILE         roll back to a backup (backs up the current database first)
  python -m aelio.cli identity-plan --firebase-export users.json --supabase-users sb.json   map users, changes nothing
  python -m aelio.cli identity-import MAPPING.json [--apply]                               link Firebase -> Supabase UIDs
"""
from __future__ import annotations

import argparse
import getpass
import json
import sys

from . import db, gateway, guardians, voice
from .config import get_settings
from .quality import suites


def cmd_init(_a) -> None:
    s = get_settings()
    voice.seed(); guardians.seed_agents()
    if not suites.LOCKS.exists():
        suites.relock("cli:init")
    else:
        db.kv_set("suite_locks", json.loads(suites.LOCKS.read_text()))
    print(f"Initialised data dir {s.data_dir}")


def cmd_create_founder(a) -> None:
    from .security import create_founder
    pw = getpass.getpass("New founder password (min 12 chars): ")
    if pw != getpass.getpass("Repeat: "):
        sys.exit("passwords differ")
    r = create_founder(a.email, pw)
    print("Founder created. Add this secret to your authenticator app (shown once):")
    print("  secret:", r["totp_secret"])
    print("  uri:   ", r["totp_uri"])


def cmd_serve(a) -> None:
    import uvicorn
    from .server import create_app
    cmd_init(a)
    uvicorn.run(create_app(), host=a.host, port=a.port, proxy_headers=True, forwarded_allow_ips="127.0.0.1")


def cmd_relock(_a) -> None:
    print(json.dumps(suites.relock(getpass.getuser()), indent=2))


def cmd_register_app(a) -> None:
    row, raw = gateway.register_app(a.name, a.slug, a.scopes.split(","))
    print(f"Registered {row['slug']} ({row['id']}). API key (shown once): {raw}")


def cmd_first_run(a) -> None:
    from .first_run import run_all
    cmd_init(a)
    rep = run_all(text_steps=a.text_steps, code_steps=a.code_steps)
    print(json.dumps({k: v["passed"] for k, v in rep["tests"].items()}, indent=2))
    print("ALL PASSED" if rep["all_passed"] else "SOME CHECKS FAILED")


def cmd_backup(a) -> None:
    from . import backup
    print(json.dumps(backup.create(a.label), indent=1))


def cmd_backup_verify(a) -> None:
    from . import backup
    r = backup.verify(a.file); print(json.dumps(r)); sys.exit(0 if r["ok"] else 1)


def cmd_restore(a) -> None:
    from . import backup
    print(json.dumps(backup.restore(a.file), indent=1))


def cmd_identity_plan(a) -> None:
    from . import identity
    fb = json.loads(open(a.firebase_export).read())
    sb = json.loads(open(a.supabase_users).read())
    sb = sb.get("users", sb) if isinstance(sb, dict) else sb
    print(json.dumps(identity.plan(fb, sb), indent=1))


def cmd_identity_import(a) -> None:
    from . import backup, identity
    rows = json.loads(open(a.mapping).read())
    rows = rows.get("mapped", rows) if isinstance(rows, dict) else rows
    if not a.apply:
        print(json.dumps({"dry_run": True, "would_link": len(rows), "rows": rows}, indent=1)); return
    print("backup:", backup.create("before-identity-import")["file"])
    print(json.dumps(identity.import_mapping(rows, "cli"), indent=1))


def main(argv=None) -> None:
    p = argparse.ArgumentParser(prog="aelio")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init").set_defaults(fn=cmd_init)
    c = sub.add_parser("create-founder"); c.add_argument("email"); c.set_defaults(fn=cmd_create_founder)
    c = sub.add_parser("serve"); c.add_argument("--host", default="127.0.0.1"); c.add_argument("--port", type=int, default=8787)
    c.set_defaults(fn=cmd_serve)
    c = sub.add_parser("first-run"); c.add_argument("--text-steps", type=int, default=1500)
    c.add_argument("--code-steps", type=int, default=1500); c.set_defaults(fn=cmd_first_run)
    sub.add_parser("relock-suites").set_defaults(fn=cmd_relock)
    c = sub.add_parser("register-app"); c.add_argument("name"); c.add_argument("slug"); c.add_argument("scopes")
    c.set_defaults(fn=cmd_register_app)
    c = sub.add_parser("backup"); c.add_argument("--label", default="manual"); c.set_defaults(fn=cmd_backup)
    c = sub.add_parser("backup-verify"); c.add_argument("file"); c.set_defaults(fn=cmd_backup_verify)
    c = sub.add_parser("restore"); c.add_argument("file"); c.set_defaults(fn=cmd_restore)
    c = sub.add_parser("identity-plan"); c.add_argument("--firebase-export", required=True); c.add_argument("--supabase-users", required=True)
    c.set_defaults(fn=cmd_identity_plan)
    c = sub.add_parser("identity-import"); c.add_argument("mapping"); c.add_argument("--apply", action="store_true")
    c.set_defaults(fn=cmd_identity_import)
    a = p.parse_args(argv)
    a.fn(a)


if __name__ == "__main__":
    main()
