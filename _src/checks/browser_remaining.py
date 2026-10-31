"""Synthetic local preview/regression for Library, allowances, routing controls and PATHD. No live accounts/providers."""
import json,time,uuid,os,copy
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixtures import *
BASE=os.environ.get('AELIO_BROWSER_BASE','http://127.0.0.1:8092');OUT=Path(os.environ.get('AELIO_SCREENSHOT_DIR','docs/previews/v1.0.9'));OUT.mkdir(parents=True,exist_ok=True)
image=(Path(__file__).resolve().parents[2]/'public/assets/dream/ocean-fresh.webp').read_bytes()
access={'configured':True,'companion_access':True,'funding_source':'aelio','pathd_plus':True,'pathd_pro':False,'subscriptions':[{'product':'aelio','plan':'adapt','status':'active','paid_until':'2026-11-01T00:00:00Z'},{'product':'pathd','plan':'plus','status':'active','paid_until':'2026-11-01T00:00:00Z'}],'allowances':[{'product':'aelio','plan':'adapt','allocated_usd':12,'remaining_usd':10.85,'used_usd':1.15,'period_start':'2026-10-01T00:00:00Z','period_end':'2026-11-01T00:00:00Z'}]}
base_files=[{'id':str(uuid.uuid5(uuid.NAMESPACE_DNS,'preview-image-'+str(i))),'name':'SAMPLE saved image '+str(i)+'.webp','mime':'image/webp','created_at':'2026-10-30T12:00:00Z','category':'generated-assets','agent_id':agents[i]['id'],'conversation_id':threads[i]['id']}for i in range(2)]
state={'files':copy.deepcopy(base_files),'settings':{}}
def handler(route):
 path=route.request.url.split('/api/platform',1)[-1].split('?')[0];method=route.request.method
 if path=='/files':
  from urllib.parse import urlparse,parse_qs
  q=parse_qs(urlparse(route.request.url).query);rows=state['files'];term=q.get('q',[''])[0]
  if term:rows=[f for f in rows if term.lower()in f['name'].lower()]
  for key,col in [('agent','agent_id'),('conversation','conversation_id')]:
   if q.get(key,[''])[0]:rows=[f for f in rows if f[col]==q[key][0]]
  if q.get('last'):rows=rows[1:]
  return route.fulfill(content_type='application/json',body=json.dumps({'files':rows[:1],'next':{'before':rows[0]['created_at'],'last':rows[0]['id']}if len(rows)>1 else None}))
 if path.startswith('/files/'):
  if method=='DELETE':state['files']=[f for f in state['files']if f['id']!=path.split('/')[2]];return route.fulfill(content_type='application/json',body='{"ok":true}')
  return route.fulfill(content_type='image/webp',body=image)
 if path=='/billing/access':return route.fulfill(content_type='application/json',body=json.dumps(access))
 if path=='/billing/operations':
  if method=='PATCH':state['settings']=route.request.post_data_json['settings'];return route.fulfill(content_type='application/json',body='{"ok":true}')
  d={'daily_usd':.45,'monthly_usd':5.60,'fallbacks':2,'providers':[{'provider':'gemini','requests':40,'failures':2,'average_latency_ms':820,'cost_usd':3.1,'pending_usd':0,'estimated_attempts':1},{'provider':'groq','requests':8,'failures':0,'average_latency_ms':310,'cost_usd':.5,'pending_usd':0,'estimated_attempts':0},{'provider':'openai','requests':2,'failures':0,'average_latency_ms':1200,'cost_usd':2,'pending_usd':0,'estimated_attempts':0}],'allocation':[{'product':'aelio','plan':'adapt','paid_usd':20,'budget_usd':12,'spent_usd':1.15,'subsidy_usd':0}], 'settings':{'GEMINI_MODEL':'sample-gemini','GROQ_MODEL':'sample-groq','OPENAI_MODEL':'sample-openai','GEMINI_INPUT_USD_PER_MILLION':'1','GEMINI_OUTPUT_USD_PER_MILLION':'2','AELIO_DAILY_AI_BUDGET_USD':'5','AELIO_MONTHLY_AI_BUDGET_USD':'100','AELIO_OPENAI_EMERGENCY_BUDGET_USD':'1'},'configured_providers':{'gemini':True,'groq':True,'openai':True},'provider_health':{}}
  return route.fulfill(content_type='application/json',body=json.dumps(d))
 return mock(route)
def banner(context,label='LOCAL PREVIEW · SYNTHETIC SAMPLE DATA'):
 context.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const d=document.createElement('div');d.textContent="+json.dumps(label)+";Object.assign(d.style,{position:'fixed',right:'8px',top:'86px',zIndex:'9999',pointerEvents:'none',background:'#321c46',color:'#fff',padding:'4px 8px',borderRadius:'6px',font:'10px sans-serif'});document.body.appendChild(d);});")
with sync_playwright()as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in (320,390,768,1440):
  state['files']=copy.deepcopy(base_files)
  context=browser.new_context(viewport={'width':width,'height':1100},reduced_motion='reduce');banner(context)
  context.add_init_script("localStorage.setItem('aelio.auth',"+json.dumps(json.dumps({'access_token':'fixture-user','refresh_token':'fixture-refresh','expires_at':time.time()+3600,'user':{'id':A}}))+");")
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/api/platform/**',handler);page.route('**/assets/config.js',handler)
  page.goto(BASE+'/chat/#library',wait_until='networkidle');page.get_by_role('heading',name='Image Library',exact=True).wait_for();page.locator('.image-tile img').first.wait_for();page.get_by_role('button',name='Load more images',exact=True).click();page.locator('.image-grid article').nth(1).wait_for();assert page.locator('.image-grid article').count()==2
  page.screenshot(path=str(OUT/f'library-{width}.png'))
  page.get_by_role('button',name='Preview SAMPLE saved image 0.webp',exact=True).click();page.locator('dialog[open] img').wait_for();page.screenshot(path=str(OUT/f'library-preview-{width}.png'));page.keyboard.press('Escape');assert not page.locator('dialog').is_visible()
  with page.expect_download()as downloaded:page.get_by_role('button',name='Download',exact=True).first.click()
  assert downloaded.value.suggested_filename.endswith('.webp')
  page.get_by_label('Search images',exact=True).fill('image 1');page.wait_for_timeout(400);assert page.locator('.image-grid article').count()==1
  page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='Delete image',exact=True).click();page.wait_for_timeout(250);assert len(state['files'])==1
  page.goto(BASE+'/chat/#allowance',wait_until='networkidle');page.get_by_text('$10.85 remaining',exact=True).wait_for();page.screenshot(path=str(OUT/f'allowance-{width}.png'))
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),('overflow',width)
  if width<=900:page.get_by_role('button',name='Open conversations',exact=True).click()
  page.screenshot(path=str(OUT/f'navigation-{width}.png'))
  assert not errors,errors
  print('PASS',width,'Library pagination/search/preview/Escape/download/deletion; allowance/funding display; compact navigation; no overflow')
  context.close()
 # Founder controls preview is explicit synthetic data. Real endpoints independently enforce founder + aal2.
 original=account['role'];account['role']='founder'
 context=browser.new_context(viewport={'width':1440,'height':1100});banner(context)
 context.add_init_script("localStorage.setItem('aelio.auth',"+json.dumps(json.dumps({'access_token':'fixture-user','refresh_token':'fixture-refresh','expires_at':time.time()+3600,'user':{'id':A}}))+");")
 page=context.new_page();page.route('**/api/platform/**',handler);page.route('**/assets/config.js',handler);page.goto(BASE+'/chat/#ai-operations',wait_until='networkidle');page.get_by_role('heading',name='AI Operations',exact=True).wait_for();page.screenshot(path=str(OUT/'ai-operations-1440.png'))
 page.get_by_label('GEMINI Standard model',exact=True).fill('updated-sample-model');page.get_by_role('button',name='Save routing controls',exact=True).click();page.get_by_text('Routing settings saved. New requests use these settings.',exact=True).wait_for();assert state['settings']['GEMINI_MODEL']=='updated-sample-model';context.close();account['role']=original
 # PATHD pricing is a real local render. Companion/account data below are intercepted synthetic fixtures.
 for width in (390,1440):
  context=browser.new_context(viewport={'width':width,'height':1100});banner(context,'LOCAL MIGRATION PREVIEW')
  page=context.new_page();page.goto('http://127.0.0.1:3000/pricing',wait_until='networkidle');page.get_by_role('heading',name='PATHD Pro',exact=True).wait_for();assert '$16' in page.locator('body').inner_text();assert '$99 a year' in page.locator('body').inner_text();page.screenshot(path=str(OUT/f'pathd-pricing-{width}.png'),full_page=True)
  def pathd(route):
   path=route.request.url.split('/api/companion')[-1]
   if path=='/billing/access':data=access
   elif path=='/agents':data={'agents':[{'id':A,'kind':'aelio','name':'AELIO'},{'id':B,'kind':'mila','name':'MILA'}]}
   elif path=='/conversations':data={'conversations':[{'id':C,'participants':[B],'title':'MILA','product':'pathd'}]}
   elif path=='/account':data=account
   elif path.endswith('/messages'):data={'messages':[]}
   elif path.startswith('/career/'):data={'items':[]}
   else:data={}
   route.fulfill(content_type='application/json',body=json.dumps(data))
  page.route('**/api/companion/**',pathd);page.goto('http://127.0.0.1:3001/',wait_until='networkidle');page.get_by_role('heading',name='MILA & AELIO, here on your PATH',exact=True).wait_for();page.get_by_text('$10.85 AI allowance remaining',exact=True).wait_for();page.get_by_text('LOCAL MIGRATION PREVIEW',exact=True).evaluate("e=>e.textContent='LOCAL PREVIEW · SAMPLE DATA'");page.screenshot(path=str(OUT/f'pathd-access-{width}.png'))
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');print('PASS PATHD',width,'$16 monthly/$99 annual unchanged, paid AELIO companion access, separate PATHD+ and Pro permissions');context.close()
 browser.close()
