"""Local sample-account UI tests. No hosted Auth, AI inference or live learning claims."""
import json,time,uuid,os
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixtures import *
BASE=os.environ.get('AELIO_BROWSER_BASE','http://127.0.0.1:8095')
OUT=Path('/workspace/aelio-live/docs/previews/aurevia-v0.1');OUT.mkdir(parents=True,exist_ok=True)
for kind in ['mila','naomi','angelo','oliver','simone','chloe','reggie']:
 aid=str(uuid.uuid5(uuid.NAMESPACE_DNS,'aurevia-'+kind));cid=str(uuid.uuid5(uuid.NAMESPACE_DNS,'aurevia-thread-'+kind));agents.append({'id':aid,'kind':kind,'name':'MILA' if kind=='mila' else kind.title(),'subtitle':'Your companion'});threads.append({'id':cid,'title':agents[-1]['name'],'participants':[aid],'permanent_key':kind,'product':'aelio','appearance':{}});messages[cid]=[]
dream=str(uuid.uuid4());threads.append({'id':dream,'title':'Dream Team','permanent_key':'dream-team','participants':[a['id'] for a in agents if a['kind'] in ['naomi','angelo','oliver','simone','chloe','reggie']],'product':'aelio','appearance':{}});messages[dream]=[]
state={'residence':{'owner_id':A,'name':'My coastal residence','destination':'plaza','quality':'balanced'},'meetings':[]};calls=[]
def api(route):
 p=route.request.url.split('/api/platform',1)[-1].split('?')[0];method=route.request.method
 if p=='/aurevia':
  if method=='PATCH':state['residence'].update(route.request.post_data_json)
  d=state if method=='GET' else {'residence':state['residence']}
 elif p=='/aurevia/meetings':
  d={'meeting':{**route.request.post_data_json,'id':str(uuid.uuid4()),'created_at':'2026-10-31T12:00:00Z'}};state['meetings'].insert(0,d['meeting'])
 else:return mock(route)
 calls.append((p,method));route.fulfill(content_type='application/json',body=json.dumps(d))
def badge(page):page.evaluate("""()=>{if(document.querySelector('#sample-badge'))return;const b=document.createElement('div');b.id='sample-badge';b.textContent='LOCAL REVIEW · SAMPLE ACCOUNT · PHASE 1';b.style.cssText='position:fixed;right:10px;bottom:8px;z-index:99999;font:8px sans-serif;letter-spacing:.1em;color:#ffe3ba;background:#17120edb;padding:6px 8px;border-radius:5px;pointer-events:none';document.body.append(b)}""")
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for width,theme in [(1440,'og-dark'),(390,'og-dark'),(390,'og-light')]:
  state['residence'].update(destination='plaza',quality='balanced');account['preferences']['appearance']={'design':theme};ctx=browser.new_context(viewport={'width':width,'height':1050},reduced_motion='reduce');ctx.add_init_script("localStorage.setItem('aelio.auth',"+json.dumps(json.dumps({'access_token':'fixture-user','refresh_token':'fixture-refresh','expires_at':time.time()+3600,'user':{'id':A,'email':'local-sample@example.test'}}))+");")
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/api/platform/**',api);page.route('**/assets/config.js',api)
  page.goto(BASE+'/',wait_until='networkidle');page.get_by_label('Workspace',exact=True).select_option('aurevia');page.get_by_role('heading',name='AUREVIA',exact=True).wait_for();page.locator('.aurevia-environment').evaluate('(e)=>e.decode()');badge(page)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(OUT/f'world-{theme}-{width}.png'))
  page.get_by_role('button',name='Explore in 3D ↗',exact=True).click();page.locator('.aurevia-scene canvas').wait_for();page.wait_for_timeout(900);assert page.get_by_role('button',name='Walk Forward').is_visible();scene=page.locator('.aurevia-scene');scene.focus();page.keyboard.down('w');page.wait_for_timeout(200);page.keyboard.up('w');page.get_by_label('AUREVIA graphics quality').select_option('low');page.locator('.aurevia-scene canvas').wait_for();page.wait_for_timeout(300);page.screenshot(path=str(OUT/f'explore-{theme}-{width}.png'))
  page.get_by_role('button',name='Cinematic view',exact=True).click();page.get_by_role('button',name='↗ Return to Office',exact=True).click();page.get_by_label('Office conversation').wait_for();page.locator('.aurevia-environment').evaluate('(e)=>e.decode()');page.screenshot(path=str(OUT/f'office-{theme}-{width}.png'),full_page=True)
  text='Office continuity fixture '+str(width)+' '+theme;page.get_by_label('Message your selected companions').fill(text);page.get_by_role('button',name='Send to conversation ↗').click();page.get_by_role('button',name='Send to conversation ↗').wait_for(state='visible');page.locator('.aurevia-transcript').get_by_text(text,exact=True).wait_for();page.locator('.aurevia-office-main h2').scroll_into_view_if_needed();page.screenshot(path=str(OUT/f'office-conversation-{theme}-{width}.png'));page.get_by_role('button',name='Continue in Chat',exact=True).click();page.locator('.messages').get_by_text(text,exact=True).wait_for();page.get_by_role('button',name='Continue in AUREVIA ↗').click();page.get_by_role('button',name='↗ Return to Office',exact=True).click();page.locator('.aurevia-transcript').get_by_text(text,exact=True).wait_for()
  page.get_by_label('Meeting purpose',exact=True).fill('Sample · coastal design review');page.get_by_role('button',name='Save meeting record',exact=True).click();page.get_by_role('button',name='Sample · coastal design review').first.wait_for();assert state['meetings'][0]['conversation_id']==C
  page.get_by_role('button',name='Open Dream Team thread',exact=True).click();assert page.get_by_label('Office conversation').input_value()==dream;assert page.locator('.aurevia-transcript').get_by_text(text,exact=True).count()==0
  before=len(threads);page.locator('.aurevia-invite').filter(has_text='Naomi').locator('input').check();page.locator('.aurevia-invite').filter(has_text='Oliver').locator('input').check();page.get_by_role('button',name='Create separate meeting thread').click();page.wait_for_function('(id)=>document.querySelector("[aria-label=\\"Office conversation\\"]").value !== id',arg=dream);assert len(threads)==before+1;created=threads[0];assert len(created['participants'])==2;assert messages[created['id']]==[];assert page.locator('.aurevia-transcript').get_by_text(text,exact=True).count()==0
  page.locator('.aurevia-destinations button').nth(3).click();page.get_by_role('heading',name='Real evidence, before any degree.').wait_for();assert page.get_by_text('No automated examination',exact=False).count()>0
  page.reload(wait_until='networkidle');page.get_by_role('heading',name='AUREVIA',exact=True).wait_for();assert page.locator('.aurevia-destinations button[aria-current=location]').inner_text().endswith('AELIO University')
  assert not errors,errors;ctx.close();print('AUREVIA UI continuity, travel, 3D, privacy, meeting and theme pass:',width,theme)
 # No private residence fixture for anonymous users; all destinations and 2D fallback work.
 ctx=browser.new_context(viewport={'width':390,'height':900});page=ctx.new_page();page.route('**/assets/config.js',lambda r:r.fulfill(content_type='text/javascript',body='window.AELIO_CONFIG={};'));page.goto(BASE+'/#aurevia',wait_until='networkidle');page.get_by_role('button',name='↗ Return to Office').click();page.get_by_role('button',name='Sign in to enter your office').wait_for();assert page.locator('.aurevia-transcript').count()==0;ctx.close()
 # Explicit WebGL-unavailable fallback rather than a broken/blank canvas.
 ctx=browser.new_context(viewport={'width':390,'height':900});ctx.add_init_script("HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext,{apply(t,self,args){return String(args[0]).startsWith('webgl')?null:Reflect.apply(t,self,args)}})");page=ctx.new_page();page.route('**/assets/config.js',lambda r:r.fulfill(content_type='text/javascript',body='window.AELIO_CONFIG={};'));page.goto(BASE+'/#aurevia',wait_until='networkidle');page.get_by_role('button',name='Explore in 3D ↗').click();page.get_by_text('3D is unavailable on this device.',exact=False).wait_for();assert page.locator('.aurevia-environment').is_visible();ctx.close();browser.close()
print('Anonymous private office gate and WebGL fallback: pass')
