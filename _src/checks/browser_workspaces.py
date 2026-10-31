"""Local synthetic regression for restored Brain/ECHO/projects. Never production evidence."""
import json,time,uuid,os
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixtures import *
shots=Path(os.environ.get('AELIO_SCREENSHOT_DIR','/workspace/.onboarding/previews'));shots.mkdir(parents=True,exist_ok=True)
entries=[];profiles=[];memories=[]
def handler(route):
 path=route.request.url.split('/api/platform',1)[-1].split('?')[0];method=route.request.method
 data=route.request.post_data_json if method in ('POST','PATCH') else {}
 if path=='/workspace':
  if method=='POST':entries.append({**data,'id':str(uuid.uuid4()),'owner_id':A})
  result={'entries':entries} if method=='GET' else {'entry':entries[-1]}
 elif path.startswith('/workspace/'):
  eid=path.split('/')[2];entry=next(e for e in entries if e['id']==eid)
  if method=='PATCH':entry.update(data)
  if method=='DELETE':entries.remove(entry)
  result={'entry':entry}
 elif path=='/echo':
  if method=='POST':
   aid=str(uuid.uuid4());cid=str(uuid.uuid4());profiles.append({**data,'agent_id':aid});agents.append({'id':aid,'kind':'custom','name':data['name'],'subtitle':'ECHO · private AI simulation'});threads.append({'id':cid,'title':data['name'],'participants':[aid],'product':'aelio','appearance':{},'memory_enabled':True});messages[cid]=[];result={'agent_id':aid,'conversation_id':cid}
  else:result={'profiles':profiles}
 elif path.startswith('/echo/'):
  parts=path.split('/');aid=parts[2];profile=next(p for p in profiles if p['agent_id']==aid)
  if len(parts)==3:
   if method=='PATCH':profile.update(data)
   if method=='DELETE':profiles.remove(profile)
   result={'ok':True}
  elif len(parts)==4:
   if method=='POST':memories.append({**data,'id':str(uuid.uuid4()),'echo_id':aid,'status':'pending'})
   result={'memories':[m for m in memories if m['echo_id']==aid]}
  else:
   m=next(m for m in memories if m['id']==parts[4]);m['status']='approved' if data['approve'] else 'rejected';result={'ok':True}
 elif path=='/files':result={'files':[]}
 elif path.startswith('/conversations/search'):result={'conversations':[]}
 else:return mock(route)
 route.fulfill(content_type='application/json',body=json.dumps(result))
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for width in (320,375,390,430,768,1024,1440):
  context=browser.new_context(viewport={'width':width,'height':1000},reduced_motion='reduce')
  context.add_init_script("localStorage.setItem('aelio.auth',"+json.dumps(json.dumps({'access_token':'fixture-user','refresh_token':'fixture-refresh','expires_at':time.time()+3600,'user':{'id':A,'email':'local-fixture@example.test'}}))+");")
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/api/platform/**',handler);page.route('**/assets/config.js',handler)
  page.goto(BASE+'/',wait_until='networkidle');page.locator('.hero-composer').wait_for()
  page.get_by_label('Workspace',exact=True).select_option('brain');page.get_by_role('heading',name='Brain',exact=True).wait_for()
  page.get_by_role('button',name='Dream Beyond',exact=True).click();page.get_by_role('button',name='New entry',exact=True).click()
  page.get_by_label('Title',exact=True).fill('Synthetic goal '+str(width));page.get_by_label('Details',exact=True).fill('Fixture private plan');page.get_by_role('button',name='Save entry',exact=True).click();page.get_by_role('heading',name='Synthetic goal '+str(width),exact=True).wait_for()
  page.reload(wait_until='networkidle');page.get_by_label('Workspace',exact=True).select_option('brain');page.get_by_role('button',name='Dream Beyond',exact=True).click();page.get_by_role('heading',name='Synthetic goal '+str(width),exact=True).wait_for()
  page.get_by_role('button',name='Technology',exact=True).click();assert page.get_by_role('heading',name='Synthetic goal '+str(width),exact=True).count()==0
  page.get_by_role('button',name='Dream Beyond',exact=True).click();page.get_by_role('heading',name='Synthetic goal '+str(width),exact=True).wait_for()
  page.screenshot(path=str(shots/f'brain-{width}.png'))
  if not page.evaluate('document.documentElement.scrollWidth<=innerWidth'): print(page.evaluate("Array.from(document.querySelectorAll('*')).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right})).filter(e=>e.right>innerWidth+1).slice(0,25)"))
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),('Brain overflow',width)
  page.screenshot(path=str(shots/f'brain-{width}.png'))
  if width<=900:page.get_by_role('button',name='Open conversations',exact=True).click()
  page.locator('.home-nav').get_by_role('button',name='ECHO',exact=True).click();page.get_by_role('button',name='Memory ECHO',exact=True).click()
  page.get_by_label('Name',exact=True).fill('Synthetic Echo '+str(width));page.get_by_label('Who inspires this ECHO?',exact=True).select_option('living')
  page.get_by_label('I understand this is an AI simulation, not the actual person.',exact=True).check()
  assert not page.get_by_label("I have the living person's consent to create this realistic replica.",exact=True).is_checked()
  page.get_by_label("I have the living person's consent to create this realistic replica.",exact=True).check();page.get_by_role('button',name='Create private ECHO',exact=True).click()
  page.get_by_role('heading',name='Synthetic Echo '+str(width),exact=True).wait_for()
  page.get_by_label('New memory for review',exact=True).fill('Synthetic nickname Sport');page.get_by_role('button',name='Add for review',exact=True).click();page.get_by_text('memory · pending',exact=True).wait_for();page.get_by_role('button',name='Approve memory',exact=True).click();page.get_by_text('memory · approved',exact=True).wait_for()
  page.screenshot(path=str(shots/f'echo-{width}.png'))
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),('ECHO overflow',width)
  page.get_by_role('button',name='Open conversation',exact=True).click();page.locator('.chat-header').wait_for()
  assert not page.locator('.mobile-nav').is_visible()
  page.get_by_role('button',name='Conversation settings',exact=True).click();page.get_by_label('Move to Project',exact=True).fill('Fixture project '+str(width));
  with page.expect_response(lambda r:r.request.method=='PATCH' and '/api/platform/conversations/' in r.url)as saved_project:
   page.get_by_role('button',name='Save project assignment',exact=True).click()
  assert saved_project.value.ok
  assert any(t.get('project')=='Fixture project '+str(width) for t in threads)
  if width<=900:page.get_by_role('button',name='Open conversations',exact=True).click()
  page.locator('.home-nav').get_by_role('button',name='Projects',exact=True).click();page.get_by_role('heading',name='Fixture project '+str(width),exact=True).wait_for()
  page.screenshot(path=str(shots/f'projects-{width}.png'))
  assert page.get_by_role('option',name='Studio Brain',exact=True).count()==0
  assert not errors,errors
  print('PASS',width,'Brain persistence, ECHO consent/review, project assignment, member Studio visibility, no horizontal overflow')
  context.close()
 browser.close()
