"""Versioned logical backups for the private engine schema. No Auth or other product tables are modified."""
import json,os,time,uuid
from pathlib import Path
from psycopg import sql
from . import db

def create(label,directory,sha):
    name='aelio-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+uuid.uuid4().hex[:8]+'.pg.json'
    path=directory/name;conn=db._connect().raw;tables={}
    with conn.transaction():
        conn.execute('set transaction isolation level repeatable read, read only')
        names=[r['table_name'] for r in conn.execute("select table_name from information_schema.tables where table_schema='aelio_engine' and table_type='BASE TABLE' order by table_name")]
        for name_ in names:tables[name_]=[dict(r) for r in conn.execute(sql.SQL('select * from {}').format(sql.Identifier(name_)))]
    payload={'format':'aelio-engine-postgres/v1','tables':tables}
    path.write_text(json.dumps(payload,default=str));path.chmod(0o600)
    manifest={'file':name,'created_at':time.time(),'label':label,'sha256':sha(path),'bytes':path.stat().st_size,'integrity':'ok','row_counts':{n:len(rows) for n,rows in tables.items()}}
    mp=path.with_suffix('.manifest.json');mp.write_text(json.dumps(manifest));mp.chmod(0o600)
    db.audit('system','backup','backup.created',name,{'format':payload['format'],'sha256':manifest['sha256']})
    return manifest

def verify(path,sha):
    m=json.loads(path.with_suffix('.manifest.json').read_text());p=json.loads(path.read_text())
    return {'file':path.name,'ok':sha(path)==m['sha256'] and p.get('format')=='aelio-engine-postgres/v1' and {n:len(rows) for n,rows in p['tables'].items()}==m['row_counts']}

def restore(path,directory,sha):
    if os.environ.get('AELIO_ALLOW_DATABASE_RESTORE')!='1':raise RuntimeError('PostgreSQL restore requires the explicit offline AELIO_ALLOW_DATABASE_RESTORE=1 safeguard')
    if not verify(path,sha)['ok']:raise RuntimeError('Backup verification failed; no restore performed')
    safety=create('before-restore',directory,sha);payload=json.loads(path.read_text());conn=db._connect().raw
    with conn.transaction():
        conn.execute('select pg_advisory_xact_lock(14873821)')
        names={r['table_name'] for r in conn.execute("select table_name from information_schema.tables where table_schema='aelio_engine' and table_type='BASE TABLE'")}
        if set(payload['tables'])!=names:raise RuntimeError('Schema mismatch; restore refused')
        conn.execute(sql.SQL('truncate {} restart identity').format(sql.SQL(',').join(sql.Identifier('aelio_engine',n) for n in sorted(names))))
        for name,rows in payload['tables'].items():
            for row in rows:conn.execute(sql.SQL('insert into {} ({}) values ({})').format(sql.Identifier(name),sql.SQL(',').join(map(sql.Identifier,row)),sql.SQL(',').join(sql.Placeholder() for _ in row)),tuple(row.values()))
            columns={r['column_name'] for r in conn.execute("select column_name from information_schema.columns where table_schema='aelio_engine' and table_name=%s",(name,))}
            if 'id' in columns:
                seq=conn.execute("select pg_get_serial_sequence(%s,'id') s",('aelio_engine.'+name,)).fetchone()['s']
                if seq:conn.execute(sql.SQL('select setval(%s,greatest(coalesce(max(id),0),1),coalesce(max(id),0)>0) from {}').format(sql.Identifier(name)),(seq,))
    db.audit('system','backup','backup.restored',path.name,{'safety_backup':safety['file']})
    return {'restored':path.name,'safety_backup':safety['file']}
