"""Actual local UI renders with labeled synthetic account/images. Never hosted Auth/provider evidence."""
import json,time,uuid,os
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixtures import *
BASE=os.environ.get('AELIO_BROWSER_BASE','http://127.0.0.1:8093')
OUT=Path(os.environ.get('AELIO_SCREENSHOT_DIR','/workspace/aelio-live/docs/previews/v1.0.10-local'));OUT.mkdir(parents=True,exist_ok=True)
root=Path(__file__).resolve().parents[2]
keys=['mila','naomi','angelo','oliver','simone','chloe','reggie']
for kind in keys:
 aid=str(uuid.uuid5(uuid.NAMESPACE_DNS,'review-'+kind));cid=str(uuid.uuid5(uuid.NAMESPACE_DNS,'review-thread-'+kind))
 agents.append({'id':aid,'kind':kind,'name':'MILA'if kind=='mila'else kind.title(),'subtitle':'Your companion','appearance_mode':'inherit','appearance':{}})
 threads.append({'id':cid,'title':agents[-1]['name'],'subtitle':'Your private conversation','permanent_key':kind,'participants':[aid],'appearance':{},'product':'aelio'});messages[cid]=[]
images=[{'id':str(uuid.uuid5(uuid.NAMESPACE_DNS,'review-library-'+str(i))),'name':['Sample · Coastal inspiration.webp','Sample · Evening reflections.webp'][i],'mime':'image/webp','created_at':'2026-10-30T12:00:00Z','category':'generated-assets','conversation_id':C,'agent_id':A}for i in range(2)]
threads[0]['appearance']={}
threads[0]['subtitle']='Your Original Main Pal'
calls=[]
def api_fixture(route):
 p=route.request.url.split('/api/platform',1)[-1].split('?')[0];calls.append(p)
 if p=='/files':return route.fulfill(content_type='application/json',body=json.dumps({'files':images,'next':None}))
 if p.startswith('/files/'):
  i=next((i for i,f in enumerate(images)if f['id']==p.split('/')[2]),0)
  return route.fulfill(content_type='image/webp',body=(root/'public/assets/dream'/['ocean-fresh.webp','og-dark-waterfront.webp'][i]).read_bytes())
 if p=='/echo':return route.fulfill(content_type='application/json',body='{"profiles":[]}')
 if p=='/workspace':return route.fulfill(content_type='application/json',body='{"entries":[]}')
 return mock(route)
def init(context):
 context.add_init_script("localStorage.setItem('aelio.auth',"+json.dumps(json.dumps({'access_token':'fixture-user','refresh_token':'fixture-refresh','expires_at':time.time()+3600,'user':{'id':A,'email':'local-review@example.test'}}))+");")
 context.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const n=document.createElement('div');n.textContent='LOCAL REVIEW · SAMPLE DATA';Object.assign(n.style,{position:'fixed',top:'86px',right:'8px',zIndex:'100',pointerEvents:'none',font:'9px system-ui',padding:'4px 8px',borderRadius:'6px',color:'#fff',background:'#34271ee0'});document.body.appendChild(n);});")
with sync_playwright()as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for theme in ['og-dark','og-light']:
  account['preferences']['appearance']={'design':theme,'motion':'reduced'}
  for width in [1440,390]:
   context=browser.new_context(viewport={'width':width,'height':1000},reduced_motion='reduce');init(context)
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/api/platform/**',api_fixture);page.route('**/assets/config.js',api_fixture)
   for view,url in [('home','/'),('dreambox','/chat/?companion=aelio'),('library','/chat/#library')]:
    page.goto(BASE+url,wait_until='networkidle')
    if view=='home':page.locator('.hero-composer').wait_for()
    elif view=='dreambox':page.locator('.messages').get_by_text('AELIO fixture conversation',exact=True).wait_for()
    else:
     page.get_by_role('heading',name='Image Library',exact=True).wait_for();page.locator('.image-tile img').first.wait_for();page.locator('.image-tile img').evaluate_all('async imgs=>{await Promise.all(imgs.map(i=>i.decode().catch(()=>{})))}')
    switch=page.get_by_label('Workspace',exact=True);assert switch.is_visible();r=switch.bounding_box();assert r['x']<85 and r['y']<82,(view,width,r)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),('overflow',theme,width,view)
    assert page.get_by_text('AI Operations',exact=True).count()==0
    assert not any(k in page.locator('.dream-app').inner_text()for k in ['Gemini','Groq','OpenAI','Provider routing','Fallback requests'])
    assert page.get_by_role('option',name='Studio Brain · Private',exact=True).count()==0
    assert page.locator('.dream-app').get_attribute('data-design')==theme
    if view=='library':assert page.locator('.panel').evaluate("e=>getComputedStyle(e).backdropFilter")!='none'
    page.screenshot(path=str(OUT/f'{view}-{theme}-{width}.png'))
   # Pointer and keyboard resizing, persistence, collapse, and accessible switching.
   if width==1440:
    handle=page.get_by_role('separator',name='Resize sidebar',exact=True);bounds=handle.bounding_box();x=bounds['x']+bounds['width']/2;y=bounds['y']+100
    before=int(handle.get_attribute('aria-valuenow'));page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+75,y,steps=8);page.mouse.up();after=int(handle.get_attribute('aria-valuenow'));assert after>=before+50,(before,after)
    page.reload(wait_until='networkidle');assert int(page.get_by_role('separator',name='Resize sidebar').get_attribute('aria-valuenow'))==after
    handle=page.get_by_role('separator',name='Resize sidebar');handle.focus();page.keyboard.press('ArrowLeft');assert int(handle.get_attribute('aria-valuenow'))==after-16
    page.get_by_role('button',name='Collapse sidebar',exact=True).click();assert page.get_by_label('Workspace',exact=True).is_visible();page.get_by_role('button',name='Expand sidebar',exact=True).click()
    page.get_by_role('separator',name='Resize sidebar').dblclick();assert int(page.get_by_role('separator',name='Resize sidebar').get_attribute('aria-valuenow'))==245
   else:
    page.get_by_role('button',name='Open conversations',exact=True).click();assert page.locator('#aelio-sidebar').evaluate("e=>e.getBoundingClientRect().x")>=-1
    page.get_by_label('Workspace',exact=True).select_option('aelio');page.locator('.hero-composer').wait_for();page.get_by_label('Workspace',exact=True).select_option('dreambox');page.locator('.chat-header').wait_for()
   assert not errors,errors
   print('PASS',theme,width,'home/Dream Box/Library cinematic identity, left switcher, member privacy, pointer/keyboard/collapse/mobile access')
   context.close()
 # Other official themes and utility screens use the same scene and semantic tokens.
 for theme in ['ocean-fresh','chocolate-cream']:
  account['preferences']['appearance']={'design':theme,'motion':'reduced'};context=browser.new_context(viewport={'width':390,'height':1000});init(context);page=context.new_page();page.route('**/api/platform/**',api_fixture);page.route('**/assets/config.js',api_fixture);page.goto(BASE+'/chat/#library',wait_until='networkidle');page.get_by_role('heading',name='Image Library',exact=True).wait_for();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(OUT/f'library-{theme}-390.png'));context.close();print('PASS',theme,'official theme retained')
 # Direct old dashboard links and modified client-side role data never render controls.
 account['role']='founder';context=browser.new_context(viewport={'width':1440,'height':1000});init(context);page=context.new_page();page.route('**/api/platform/**',api_fixture);page.route('**/assets/config.js',api_fixture);page.goto(BASE+'/chat/#ai-operations',wait_until='networkidle');page.locator('.hero-composer').wait_for();assert page.get_by_text('AI Operations',exact=True).count()==0;assert page.locator('input[aria-label="GEMINI Standard model"]').count()==0
 # The real local server must deny HTML before delivering the Studio shell when there is no verified session.
 response=page.request.get(BASE+'/studiobrain/ai-operations/');assert response.status in [401,403];assert 'assets/brain/app.js'not in response.text();print('PASS retired public operations link and unauthenticated direct Studio page denial');context.close();account['role']='member'
 # Render actual screenshot comparisons side by side, without altering the screenshots.
 for theme in ['og-dark','og-light']:
  for width,label in [(1440,'desktop'),(390,'mobile')]:
   html='<!doctype html><html><meta charset="utf-8"><style>body{margin:0;background:#141218;color:#f4eee8;font:14px system-ui}header{padding:22px 26px}h1{font:400 23px Georgia;margin:0 0 8px}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:0 16px 18px}section{min-width:0}h2{font-size:13px;font-weight:500;padding:6px}img{display:block;width:100%;border:1px solid #81634955;border-radius:10px;box-sizing:border-box}p{color:#c7beb6;margin:0}</style><header><h1>AELIO · '+('OG Dark'if theme=='og-dark'else'OG Light')+' · '+label+'</h1><p>Same approved photography and themes. Homepage content preserved; navigation and utility surfaces updated. Local sample data.</p></header><main>'
   for view,title in [('home','Approved homepage'),('dreambox','Dream Box'),('library','Image Library')]:html+='<section><h2>'+title+'</h2><img src="'+f'{view}-{theme}-{width}.png'+'"></section>'
   html+='</main></html>';path=OUT/f'comparison-{theme}-{label}.html';path.write_text(html)
   page=browser.new_page(viewport={'width':1680 if label=='desktop'else 1260,'height':1200});page.goto('http://127.0.0.1:8094/'+path.name);page.locator('img').evaluate_all('async imgs=>{await Promise.all(imgs.map(i=>i.decode()))}');page.locator('body').screenshot(path=str(OUT/f'comparison-{theme}-{label}.png'));page.close()
 browser.close()
