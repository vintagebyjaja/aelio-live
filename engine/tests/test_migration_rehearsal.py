"""Offline migration keeps historical identities/data without enabling Firebase authentication."""
from aelio import db,backup,identity

def test_mapping_is_explicit_and_preserves_data(env):
    db.insert('users',{'id':'fb_old','email':'legacy@local.test','pw_hash':'legacy','role':'member','created_at':0})
    db.insert('conversations',{'id':'history','user_id':'fb_old','title':'Preserve me','created_at':0,'updated_at':0})
    before=db.q('select * from conversations')
    snapshot=backup.create('local-rehearsal')
    plan=identity.plan({'users':[{'localId':'old','email':'legacy@local.test'}]},[{'id':'new-supabase-uuid','email':'legacy@local.test'}])
    assert plan['mapped'][0]['aelio_user']=='fb_old'
    assert identity.import_mapping([{'firebase_uid':'old','supabase_uid':'new-supabase-uuid'}],'offline-admin')['linked']==1
    assert db.q('select * from conversations')==before
    assert db.q1("select user_id from identities where provider='supabase'")['user_id']=='fb_old'
    assert backup.verify(snapshot['file'])['ok']
