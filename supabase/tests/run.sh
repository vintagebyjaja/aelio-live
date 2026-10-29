#!/usr/bin/env bash
# Runs every migration against a throwaway local PostgreSQL 16 with a mock Supabase auth schema, then the tests.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
D="$(mktemp -d)"; [ "$(id -u)" = 0 ] && chown postgres "$D"; PORT="${PG_PORT:-55432}"
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
as_pg "$BIN/initdb -D $D/data -A trust -U postgres >/dev/null"
as_pg "$BIN/pg_ctl -D $D/data -o '-p $PORT -k $D' -l $D/log start -w >/dev/null"
trap 'as_pg "$BIN/pg_ctl -D $D/data stop -m immediate >/dev/null"; rm -rf "$D"' EXIT
P="env PGOPTIONS=-cclient_min_messages=warning psql -h $D -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$P -f "$HERE/mock_supabase.sql"
for m in "$HERE"/../migrations/*.sql; do $P -f "$m"; done
for m in "$HERE"/../migrations/*.sql; do $P -f "$m"; done       # migrations must be safe to re-run
env PGOPTIONS= psql -h $D -p $PORT -U postgres -v ON_ERROR_STOP=1 -q -f "$HERE/test_platform_identity.sql" 2>&1 | grep -E "NOTICE|ERROR" | sed 's/psql:.*NOTICE:  //'
