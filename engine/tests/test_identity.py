"""Supabase-only identity regression tests. Historical mapping stays available, never a runtime fallback."""
import time
import jwt
import pytest
from aelio import db,identity
from conftest import FOUNDER_UID, FOUNDER_EMAIL, PERSONAL_UID, PERSONAL_EMAIL

def test_supabase_session_reuses_existing_id(fbclient):
    for _ in range(3):assert fbclient.get('/api/me',headers=fbclient.tok()).json()['role']=='founder'
    assert len(db.q('select * from identities'))==1
    assert db.q1('select provider from identities')['provider']=='supabase'

def test_firebase_never_accepted_even_with_legacy_switch(fbclient,monkeypatch):
    monkeypatch.setenv('AELIO_AUTH_PROVIDERS','firebase,supabase')
    token=jwt.encode({'iss':'https://securetoken.google.com/legacy','sub':FOUNDER_UID,'exp':time.time()+500},'local-test-only-key-at-least-32-bytes-long',algorithm='HS256')
    assert fbclient.get('/api/me',headers={'Authorization':'Bearer '+token}).status_code==401

@pytest.mark.parametrize('over',[{'role':'anon'},{'role':'service_role'},{'is_anonymous':True},{'aud':'wrong'},{'iss':'https://evil.test'},{'exp':1}])
def test_invalid_tokens(fbclient,over):
    assert fbclient.get('/api/me',headers=fbclient.tok(**over)).status_code==401

def test_no_email_only_founder_or_automatic_account_link(fbclient,monkeypatch):
    fbclient.get('/api/me',headers=fbclient.tok())
    monkeypatch.setenv('AELIO_PORTAL_OPEN','1')
    r=fbclient.get('/api/me',headers=fbclient.tok(uid='attacker',email=FOUNDER_EMAIL))
    assert r.status_code==409
    rows=db.q('select user_id from identities')
    assert len({r['user_id'] for r in rows})==1
    assert fbclient.get('/api/brain/engine',headers=fbclient.tok(uid='attacker',email=FOUNDER_EMAIL)).status_code==409

def test_personal_has_perks_not_studio(fbclient):
    r=fbclient.get('/api/me',headers=fbclient.tok(PERSONAL_UID,PERSONAL_EMAIL)).json()
    assert r['role']=='member' and r['unlimited']
    assert fbclient.get('/api/brain/engine',headers=fbclient.tok(PERSONAL_UID,PERSONAL_EMAIL)).status_code==403

SB_FOUNDER='11111111-1111-4111-8111-111111111111'
SB_PERSONAL='22222222-2222-4222-8222-222222222222'
@pytest.fixture()
def sb(fb,monkeypatch):
    import json
    from cryptography.hazmat.primitives.asymmetric import ec
    key=ec.generate_private_key(ec.SECP256R1())
    jwk=json.loads(jwt.algorithms.ECAlgorithm.to_jwk(key.public_key()));jwk.update(kid='sb-key-1',alg='ES256',use='sig')
    previous=identity._jwks
    monkeypatch.setattr(identity,'_jwks',lambda:[jwk]+previous())
    monkeypatch.setenv('AELIO_FOUNDER_UIDS',FOUNDER_UID+','+SB_FOUNDER)
    monkeypatch.setenv('AELIO_MEMBER_UIDS',PERSONAL_UID+','+SB_PERSONAL)
    monkeypatch.setenv('AELIO_UNLIMITED_UIDS',PERSONAL_UID+','+SB_PERSONAL)
    def token(sub=SB_FOUNDER,email=FOUNDER_EMAIL,**over):
        t=int(time.time());claims={'iss':'https://abcdefghijklmnop.supabase.co/auth/v1','aud':'authenticated','sub':sub,'exp':t+600,'iat':t,'email':email,'email_confirmed_at':'2026-01-01','role':'authenticated','app_metadata':{'products':['aelio','pathd']},**over}
        return {'Authorization':'Bearer '+jwt.encode(claims,key,algorithm='ES256',headers={'kid':'sb-key-1'})}
    return token
