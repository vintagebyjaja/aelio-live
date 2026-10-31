#!/usr/bin/env bash
# Usage: supabase/tests/run_tests.sh test_a.sql [test_b.sql ...]
# Applies every migration (twice, to prove re-runs are safe) to a throwaway local PostgreSQL 16 with a mock
# Supabase auth schema, then runs each test file. Local synthetic data only; never connects to Supabase.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
D="$(mktemp -d)"; [ "$(id -u)" = 0 ] && chown postgres "$D"; PORT="${PG_PORT:-55433}"
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
as_pg "$BIN/initdb -D $D/data -A trust -U postgres >/dev/null"
as_pg "$BIN/pg_ctl -D $D/data -o '-p $PORT -k $D' -l $D/log start -w >/dev/null"
trap 'as_pg "$BIN/pg_ctl -D $D/data stop -m immediate >/dev/null"; rm -rf "$D"' EXIT
P="env PGOPTIONS=-cclient_min_messages=warning psql -h $D -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$P -f "$HERE/mock_supabase.sql"
[ -f "$HERE/mock_supabase_extra.sql" ] && $P -f "$HERE/mock_supabase_extra.sql"
for m in "$HERE"/../migrations/*.sql; do $P -f "$m"; done
for m in "$HERE"/../migrations/*.sql; do $P -f "$m"; done
for t in "$@"; do
  echo "== $t"
  test_log="$D/test-output.log"
  if env PGOPTIONS= psql -h "$D" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -f "$HERE/$t" >"$test_log" 2>&1; then
    awk '/NOTICE|ERROR|passed/ { sub(/psql:.*NOTICE:  /, ""); print }' "$test_log"
    echo "PASS: $t"
  else
    test_status=$?
    cat "$test_log"
    exit "$test_status"
  fi
done
