"""Offline-only additive SQLite -> prepared Supabase PostgreSQL import.
Requires DATABASE_URL pointing at an EMPTY, migrated engine schema. Aborts if nonempty.
Source is opened read-only. IDs and all fields are preserved; existing Auth users are not touched.
Run only on local/staging backups first. No automatic connection or invocation by the application.
"""
import argparse, os, sqlite3
import psycopg
from psycopg import sql

def main():
    parser=argparse.ArgumentParser();parser.add_argument('source');parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    source=sqlite3.connect('file:'+os.path.abspath(args.source)+'?mode=ro',uri=True);source.row_factory=sqlite3.Row
    if source.execute('pragma integrity_check').fetchone()[0]!='ok':raise SystemExit('Source integrity check failed')
    tables=[r[0] for r in source.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%'")]
    counts={t:source.execute('select count(*) from "'+t.replace('"','""')+'"').fetchone()[0] for t in tables}
    print('Source verified; row counts:',counts)
    if not args.apply:return
    with psycopg.connect(os.environ['DATABASE_URL']) as target:
        target.execute('set search_path=aelio_engine')
        # Check ALL tables before any writes; transaction rolls back on any mismatch/error.
        for t in tables:
            if target.execute(sql.SQL('select count(*) from {}').format(sql.Identifier(t))).fetchone()[0]:raise SystemExit('Destination is not empty; import refused')
        for t in tables:
            rows=source.execute('select * from "'+t.replace('"','""')+'"').fetchall()
            for row in rows:
                target.execute(sql.SQL('insert into {} ({}) values ({})').format(sql.Identifier(t),sql.SQL(',').join(map(sql.Identifier,row.keys())),sql.SQL(',').join(sql.Placeholder() for _ in row)),tuple(row))
            actual=target.execute(sql.SQL('select count(*) from {}').format(sql.Identifier(t))).fetchone()[0]
            if actual!=counts[t]:raise SystemExit('Row count mismatch; transaction rolled back')
            seq=target.execute("select pg_get_serial_sequence(%s,'id')",('aelio_engine.'+t,)).fetchone()[0] if 'id' in [x[1] for x in source.execute('pragma table_info("'+t.replace('"','""')+'")')] else None
            if seq:target.execute(sql.SQL('select setval(%s, greatest(coalesce(max(id),0),1), coalesce(max(id),0)>0) from {}').format(sql.Identifier(t)),(seq,))
    print('Import committed. Source untouched. Verify canonical record fingerprints before cutover.')
if __name__=='__main__':main()
