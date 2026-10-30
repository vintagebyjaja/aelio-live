"""Explicit synthetic local API/Auth fixtures; never live-service evidence."""
import json,os,time
BASE=os.environ.get('AELIO_BROWSER_BASE','http://127.0.0.1:8090')
A='11111111-1111-4111-8111-111111111111';B='22222222-2222-4222-8222-222222222222'
C='33333333-3333-4333-8333-333333333333';D='44444444-4444-4444-8444-444444444444'
agents=[{'id':A,'kind':'aelio','name':'AELIO','subtitle':'Your Original Main Pal'},{'id':B,'kind':'custom','name':'Chester','subtitle':'Architecture & Design','personality':'The Homie','specialty':'Architecture','instructions':'','memories':[],'memory_enabled':False}]
threads=[{'id':C,'owner_id':A,'title':'AELIO','subtitle':'Everyday','participants':[A],'appearance':{'background':'City Skyline','outgoing':'#922900'},'product':'aelio'},{'id':D,'owner_id':A,'title':'Chester','subtitle':'Floor plans','participants':[B],'appearance':{'background':'Nature & Waterfalls','outgoing':'#226688'},'product':'aelio'}]
messages={C:[{'id':'m1','role':'assistant','speaker':'AELIO','content':'AELIO fixture conversation'}],D:[{'id':'m2','role':'assistant','speaker':'Chester','content':'Chester fixture conversation'}]}
account={'user':{'id':A,'email':'local-fixture@example.test','display_name':'Local tester','recovery_enrolled':True},'preferences':{'external_ai_consent':True,'mila_welcomed':True},'plans':[{'product':'aelio','plan':'free','credits':100},{'product':'pathd','plan':'free','credits':100}],'role':'member'}
def mock(route):
 p=route.request.url.split('/api/platform',1)[-1].split('?')[0];method=route.request.method
 if route.request.url.endswith('/assets/config.js'):
  return route.fulfill(content_type='text/javascript',body='window.AELIO_CONFIG={auth:"supabase",supabase:{url:"https://offline-auth.test",anonKey:"public-fixture"}};')
 if p=='/account':
  if method=='PATCH':account['preferences'].update(route.request.post_data_json)
  d=account
 elif p=='/agents':d={'agents':agents}
 elif p=='/conversations':
  if method=='POST':
   c={**route.request.post_data_json,'id':str(__import__('uuid').uuid4()),'owner_id':A,'appearance':{},'subtitle':'','created_at':'2026-10-29T12:00:00Z'};threads.insert(0,c);messages[c['id']]=[];d={'conversation':c}
  else:d={'conversations':threads}
 elif p.startswith('/agents/') and method=='PATCH':
  a=next(a for a in agents if a['id']==p.split('/')[2]);a.update(route.request.post_data_json);d={'agent':a}
 elif p.endswith('/messages'):d={'messages':messages[p.split('/')[2]]}
 elif p.endswith('/respond'):
  cid=p.split('/')[2];content=route.request.post_data_json['content'];time.sleep(.35)
  messages[cid]+=[{'id':'user-'+str(time.time()),'role':'user','content':content},{'id':'reply-'+str(time.time()),'role':'assistant','content':'[offline browser fixture] '+content}]
  return route.fulfill(content_type='application/x-ndjson',body=json.dumps({'type':'delta','agent_id':A if cid==C else B,'speaker':'AELIO' if cid==C else 'Chester','text':'[offline browser fixture] '+content})+'\n'+json.dumps({'type':'saved','remaining':9})+'\n')
 elif method=='PATCH' and p.startswith('/conversations/'):
  c=next(t for t in threads if t['id']==p.split('/')[2]);c.update(route.request.post_data_json);d={'conversation':c}
 else:return route.fulfill(status=404,content_type='application/json',body=json.dumps({'error':'Fixture route missing: '+p}))
 return route.fulfill(content_type='application/json',body=json.dumps(d))
