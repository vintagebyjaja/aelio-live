"""Local synthetic UI contract. No actual users/provider credentials or production services."""
import json,time,uuid,os,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixtures import *
shots=Path(os.environ.get('AELIO_SCREENSHOT_DIR','/tmp/aelio-v1.0.5-previews'));shots.mkdir(parents=True,exist_ok=True)
keys=['aelio','mila','naomi','angelo','oliver','simone','chloe','reggie']
subtitles=['Your Original Main Pal','Your PATH','Tech & Innovation','The Homie','The Gentleman','Class & Confidence','Good Energy','Real Talk']
threads[0]['permanent_key']='aelio'
for key,subtitle in zip(keys[1:],subtitles[1:]):
 aid=str(uuid.uuid5(uuid.NAMESPACE_DNS,'local-fixture-agent-'+key));cid=str(uuid.uuid5(uuid.NAMESPACE_DNS,'local-fixture-chat-'+key))
 agents.append({'id':aid,'kind':key,'name':'MILA' if key=='mila' else key.title(),'subtitle':subtitle,'appearance_mode':'inherit','appearance':{}})
 threads.append({'id':cid,'owner_id':A,'title':agents[-1]['name']+' · '+subtitle,'subtitle':subtitle,'permanent_key':key,'participants':[aid],'appearance':{},'product':'pathd' if key=='mila' else 'aelio'})
 messages[cid]=[]
tid=str(uuid.uuid5(uuid.NAMESPACE_DNS,'local-fixture-dream-team'));threads.append({'id':tid,'owner_id':A,'title':'Dream Team','subtitle':'Six minds. One conversation.','permanent_key':'dream-team','participants':[a['id'] for a in agents if a['kind'] in keys[2:]],'appearance':{},'product':'aelio'});messages[tid]=[]
def route_handler(route):
 path=route.request.url.split('/api/platform')[-1]
 if path.startswith('/conversations/search'):
  return route.fulfill(content_type='application/json',body=json.dumps({'conversations':[]}))
 if path.endswith('/respond') and globals().get('fail_reply',False):return route.fulfill(status=503,content_type='application/json',body=json.dumps({'code':'database_failure','error':'Private runtime configuration failed'}))
 if path.endswith('/respond'):
  cid=path.split('/')[2];content=route.request.post_data_json['content'];speaker='Naomi' if cid==tid else 'AELIO';agent=next(a for a in agents if a['name']==speaker)
  messages[cid]+=[{'id':str(uuid.uuid4()),'role':'user','content':content},{'id':str(uuid.uuid4()),'role':'assistant','speaker':speaker,'agent_id':agent['id'],'content':'[offline browser fixture] '+content}]
  return route.fulfill(content_type='application/x-ndjson',body=json.dumps({'type':'delta','agent_id':agent['id'],'speaker':speaker,'text':'[offline browser fixture] '+content})+'\n'+json.dumps({'type':'saved'})+'\n')
 return mock(route)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for width in (1440,390,320):
  context=browser.new_context(viewport={'width':width,'height':1000},reduced_motion='reduce')
  context.add_init_script("localStorage.setItem('aelio.auth',"+json.dumps(json.dumps({'access_token':'fixture-user','refresh_token':'fixture-refresh','expires_at':time.time()+3600,'user':{'id':A,'email':'local-fixture@example.test'}}))+");")
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/api/platform/**',route_handler);page.route('**/assets/config.js',route_handler)
  page.goto(BASE+'/',wait_until='networkidle');page.locator('.hero-composer').wait_for()
  page.screenshot(path=str(shots/f'home-{width}.png'))
  if width<=900:page.locator('.mobile-nav').get_by_role('button',name='Agents',exact=True).click()
  else:page.locator('.home-nav').get_by_role('button',name='Agents',exact=True).click()
  assert page.locator('.companion-card').count()==10 # eight official, one preexisting custom, one team
  if width==1440:page.set_viewport_size({'width':width,'height':1700})
  page.locator('.companion-avatar img').evaluate_all("async items=>{await Promise.all(items.map(async image=>{image.loading='eager';try{await image.decode();}catch{}}));}")
  assert page.locator('.companion-avatar img').evaluate_all('(images)=>images.every(image=>image.naturalWidth>0)')
  page.screenshot(path=str(shots/f'companions-{width}.png'),full_page=True)
  if width==1440:page.set_viewport_size({'width':width,'height':1000})
  before=len(threads)
  for name in ['AELIO','MILA','Naomi','Angelo','Oliver','Simone','Chloe','Reggie']:
   page.get_by_role('button',name='Open '+name+' chat',exact=True).click();page.get_by_role('textbox',name='Message',exact=True).wait_for()
   assert name in page.locator('.chat-header h1').inner_text()
   if width<=900:page.locator('.mobile-nav').get_by_role('button',name='Agents',exact=True).click()
   else:page.locator('.home-nav').get_by_role('button',name='Agents',exact=True).click()
  assert len(threads)==before
  page.get_by_role('button',name='Open Dream Team chat',exact=True).click();page.get_by_role('textbox',name='Message',exact=True).fill('@Na');page.get_by_role('textbox',name='Message',exact=True).press('a');page.get_by_role('textbox',name='Message',exact=True).press('Backspace')
  page.get_by_role('group',name='Mention a companion',exact=True).get_by_role('button',name='Naomi',exact=True).click();assert page.get_by_role('textbox',name='Message',exact=True).input_value()=='@Naomi '
  page.get_by_role('textbox',name='Message',exact=True).fill('@Naomi can you help me build this?');page.get_by_role('button',name='Send message',exact=True).click();page.get_by_text('[offline browser fixture] @Naomi can you help me build this?',exact=True).first.wait_for()
  page.screenshot(path=str(shots/f'dream-team-{width}.png'))
  fail_reply=True;page.get_by_role('textbox',name='Message',exact=True).fill('A draft to preserve');page.get_by_role('button',name='Send message',exact=True).click();page.get_by_role('button',name='Retry response',exact=True).wait_for();assert page.get_by_role('textbox',name='Message',exact=True).input_value()=='A draft to preserve';assert 'Private runtime configuration failed' not in page.locator('body').inner_text()
  fail_reply=False;page.get_by_role('button',name='Retry response',exact=True).click();page.get_by_text('[offline browser fixture] A draft to preserve',exact=True).first.wait_for();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
  context.close();print(f'{width}px: eight clickable identities, stable default chats, Dream Team, mention input, streaming fixture and no overflow passed')
 # Actual software WebGL path and reduced-motion fallback are checked independently of screenshots.
 context=browser.new_context(viewport={'width':1000,'height':900});page=context.new_page();page.route('**/api/platform/**',route_handler);page.route('**/assets/config.js',route_handler)
 page.goto(BASE+'/',wait_until='networkidle');orb=page.locator('.orb-stage .aelio-orb');orb.wait_for()
 # Guests may have no fixture guest route; Home still renders and the orb must not depend on AI readiness.
 page.wait_for_timeout(700);print('Orb renderer:',orb.get_attribute('data-renderer'))
 if orb.get_attribute('data-renderer')=='webgl':
  rect=orb.bounding_box();clip={'x':rect['x']+rect['width']*.3,'y':rect['y']+rect['height']*.3,'width':rect['width']*.4,'height':rect['height']*.4};a=page.screenshot(clip=clip);page.wait_for_timeout(1800);b=page.screenshot(clip=clip);assert a!=b,'Internal material must animate'
 page.emulate_media(reduced_motion='reduce');deadline=time.monotonic()+8
 while orb.get_attribute('data-reduced')!='true' and time.monotonic()<deadline:page.wait_for_timeout(100)
 assert orb.get_attribute('data-reduced')=='true'
 context.close()
 # No WebGL means the established static/CSS identity must remain visible.
 context=browser.new_context(viewport={'width':390,'height':900},reduced_motion='reduce');context.add_init_script("const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...rest){return kind==='webgl'?null:original.call(this,kind,...rest);};")
 page=context.new_page();page.route('**/api/platform/**',route_handler);page.route('**/assets/config.js',route_handler);page.goto(BASE+'/',wait_until='networkidle');fallback=page.locator('.orb-stage .aelio-orb');fallback.wait_for();assert fallback.get_attribute('data-renderer')=='fallback';assert fallback.locator('.orb-metal').is_visible();context.close();browser.close()
