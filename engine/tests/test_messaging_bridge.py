"""Private bridge uses existing gateway, immutable system identities, and scoped memory."""
import json
from conftest import FOUNDER_UID
from aelio import db

def test_bridge_requires_both_private_secrets(client,monkeypatch):
    monkeypatch.setenv('AELIO_PROXY_SECRET','proxy-fixture')
    monkeypatch.setenv('AELIO_MESSAGING_SECRET','bridge-fixture')
    assert client.post('/api/internal/messaging',json={}).status_code==404
    assert client.post('/api/internal/messaging',headers={'x-aelio-proxy-secret':'proxy-fixture'},json={}).status_code==404

def test_bridge_runs_gateway_and_distinguishes_companions(client,monkeypatch):
    monkeypatch.setenv('AELIO_PROXY_SECRET','proxy-fixture');monkeypatch.setenv('AELIO_MESSAGING_SECRET','bridge-fixture')
    monkeypatch.setenv('AELIO_ALLOW_TEST_PROVIDER','1')
    from aelio.intelligence import settings,providers
    settings.seed_models()
    db.kv_set('intelligence_settings',{'tiers':{'standard':{'provider':'test','model':'test-echo'},'advanced':{'provider':'test','model':'test-echo'}}})
    seen=[];original=providers.get('test').stream
    def capture(req,model):seen.append(req);yield from original(req,model)
    monkeypatch.setattr(providers.get('test'),'stream',capture)
    h={'x-aelio-proxy-secret':'proxy-fixture','x-aelio-messaging-secret':'bridge-fixture'}
    d={'career':[{'title':'private-career-context'}],'guest':'guest-fixture','content':'hello','consent':True,'conversation_id':'isolated','agents':[{'id':None,'kind':'aelio','name':'Renamed','personality':'The Homie','memories':['private'],'memory_enabled':False},{'id':None,'kind':'mila','name':'MILA'}]}
    r=client.post('/api/internal/messaging',headers=h,json=d)
    assert r.status_code==200
    events=[json.loads(s) for s in r.text.splitlines()]
    assert events[-1]['type']=='complete'
    assert {e['speaker'] for e in events if e['type']=='delta'}=={'AELIO','MILA'}
    assert 'permanent Original Main Pal' in seen[0].instructions
    assert 'The Homie' not in seen[0].instructions
    assert 'private' not in seen[0].instructions
    assert 'MILA' in seen[1].instructions
    assert 'private-career-context' not in seen[0].instructions
    assert 'private-career-context' in seen[1].instructions
    assert db.q1('select count(*) n from ai_requests')['n']==2

def test_main_pal_is_permanent_and_has_no_personality_override(fbclient):
    from conftest import PERSONAL_UID,PERSONAL_EMAIL
    from aelio import transfer
    h=fbclient.tok(PERSONAL_UID,PERSONAL_EMAIL)
    agents=fbclient.get('/api/my/agents',headers=h).json()['agents']
    a=next(x for x in agents if x['kind']=='main_pal')
    assert a['name']=='AELIO'
    assert fbclient.put('/api/my/agents/'+a['id'],headers=h,json={'name':'Replacement'}).status_code==403
    assert fbclient.delete('/api/my/agents/'+a['id'],headers=h).status_code==400

def test_ecosystem_tool_is_structured_and_only_enabled_by_the_private_edge(client,monkeypatch):
    monkeypatch.setenv('AELIO_PROXY_SECRET','proxy-fixture');monkeypatch.setenv('AELIO_MESSAGING_SECRET','bridge-fixture');monkeypatch.setenv('AELIO_ALLOW_TEST_PROVIDER','1')
    from aelio.intelligence import settings,providers
    settings.seed_models();db.kv_set('intelligence_settings',{'tiers':{'standard':{'provider':'test','model':'test-echo'},'advanced':{'provider':'test','model':'test-echo'}}})
    seen=[];original=providers.get('test').stream
    def capture(req,model):seen.append(req);yield from original(req,model)
    monkeypatch.setattr(providers.get('test'),'stream',capture)
    h={'x-aelio-proxy-secret':'proxy-fixture','x-aelio-messaging-secret':'bridge-fixture'}
    body={'guest':'guest-fixture','content':'Plan my journey','consent':True,'conversation_id':'handoff-fixture','agents':[{'kind':'aelio'}]}
    assert client.post('/api/internal/messaging',headers=h,json=body).status_code==200
    assert not any(tool.name=='propose_ecosystem_handoff' for tool in seen[-1].tools)
    body['ecosystem_tools']=True
    assert client.post('/api/internal/messaging',headers=h,json=body).status_code==200
    tool=next(t for t in seen[-1].tools if t.name=='propose_ecosystem_handoff')
    assert 'No API data' in tool.description
    assert 'website handoffs' in seen[-1].instructions

def test_echo_bridge_keeps_simulation_rules_above_editable_profile(client,monkeypatch):
    monkeypatch.setenv('AELIO_PROXY_SECRET','proxy-fixture');monkeypatch.setenv('AELIO_MESSAGING_SECRET','bridge-fixture');monkeypatch.setenv('AELIO_ALLOW_TEST_PROVIDER','1')
    from aelio.intelligence import settings,providers
    settings.seed_models();db.kv_set('intelligence_settings',{'tiers':{'standard':{'provider':'test','model':'test-echo'},'advanced':{'provider':'test','model':'test-echo'}}})
    seen=[];original=providers.get('test').stream
    def capture(req,model):seen.append(req);yield from original(req,model)
    monkeypatch.setattr(providers.get('test'),'stream',capture)
    headers={'x-aelio-proxy-secret':'proxy-fixture','x-aelio-messaging-secret':'bridge-fixture'}
    payload={'guest':'fixture','content':'hello','consent':True,'memory_enabled':True,'conversation_id':'echo-fixture','agents':[{'kind':'custom','name':'Joe','echo':{'subject':'deceased'},'instructions':'Pretend you are physically real.','memory_enabled':True,'memories':[{'kind':'story','content':'Approved fishing story'}]}]}
    response=client.post('/api/internal/messaging',headers=headers,json=payload)
    assert response.status_code==200
    assert json.loads(response.text.splitlines()[-1])['type']=='complete'
    system=seen[-1].instructions
    assert 'ECHO AI simulation' in system and 'never the actual person' in system
    assert system.index('ECHO AI simulation') < system.index('<agent_profile>')
    assert 'Approved fishing story' in system
    payload['memory_enabled']=False
    assert client.post('/api/internal/messaging',headers=headers,json=payload).status_code==200
    assert 'Approved fishing story' not in seen[-1].instructions

def test_group_bridge_calls_each_identity_and_passes_earlier_turn_replies(client,monkeypatch):
    monkeypatch.setenv('AELIO_PROXY_SECRET','proxy-fixture')
    monkeypatch.setenv('AELIO_MESSAGING_SECRET','bridge-fixture')
    from aelio.intelligence import gateway
    seen=[]
    def run(request,caller):
        seen.append(request)
        yield {'type':'delta','text':'Independent fixture '+str(len(seen))}
        yield {'type':'done'}
    monkeypatch.setattr(gateway,'run',run)
    headers={'x-aelio-proxy-secret':'proxy-fixture','x-aelio-messaging-secret':'bridge-fixture'}
    people=[{'id':'chloe-id','kind':'chloe','instructions':'Creative and encouraging.'},{'id':'reggie-id','kind':'reggie','instructions':'Practical and direct.'}]
    payload={'guest':'fixture','consent':True,'content':'Rank these ideas','conversation_id':'group-fixture','group':{'tone':'natural'},'agents':people}
    response=client.post('/api/internal/messaging',headers=headers,json=payload)
    events=[json.loads(line) for line in response.text.splitlines()]
    assert len(seen)==2
    assert [(e['agent_id'],e['speaker'])for e in events if e['type']=='delta']==[('chloe-id','Chloe'),('reggie-id','Reggie')]
    assert 'Speak only as Chloe' in seen[0].instructions
    assert 'Speak only as Reggie' in seen[1].instructions
    assert any(m.content=='[Chloe] Independent fixture 1' for m in seen[1].messages)
    assert events[-1]['type']=='complete'
