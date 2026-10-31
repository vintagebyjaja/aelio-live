import sys,time,uuid,json,subprocess
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from browser_fixtures import *
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];OUT=R/'docs/previews/combined-v1.0.14';OUT.mkdir(parents=True,exist_ok=True)
threads[0].update(permanent_key='aelio',appearance={})
for kind in ['mila','naomi','angelo','oliver','simone','chloe','reggie']:
 aid=str(uuid.uuid5(uuid.NAMESPACE_DNS,'combined-'+kind));cid=str(uuid.uuid5(uuid.NAMESPACE_DNS,'combined-thread-'+kind));agents.append({'id':aid,'kind':kind,'name':'MILA' if kind=='mila' else kind.title(),'subtitle':'Your companion'});threads.append({'id':cid,'owner_id':A,'title':agents[-1]['name'],'participants':[aid],'permanent_key':kind,'product':'aelio','appearance':{}});messages[cid]=[]
team=str(uuid.uuid5(uuid.NAMESPACE_DNS,'combined-team'));participants=[a['id']for a in agents if a['kind']in ['naomi','angelo','oliver','simone','chloe','reggie']]
threads.append({'id':team,'owner_id':A,'title':'Dream Team','permanent_key':'dream-team','participants':participants,'product':'aelio','appearance':{'background':'Basketball Court'}})
long='A long URL: https://example.test/'+('verylongpath'*40)+'\n\n```js\n'+('const example = true; '*35)+'\n```'
messages[team]=[{'id':str(uuid.uuid4()),'role':'assistant','agent_id':a['id'],'speaker':a['name'],'content':('[LOCAL FIXTURE] My independent perspective. '+long if a['kind']=='naomi' else '[LOCAL FIXTURE] I would compare the practical tradeoffs.'),'created_at':'2026-10-31T01:50:00Z'}for a in agents if a['id']in participants]
report=[]
def api(route):
 path=route.request.url.split('/api/platform',1)[-1].split('?')[0]
 if path.endswith('/respond'):
  cid=path.split('/')[2];text=route.request.post_data_json['content'];replies=[{'id':str(uuid.uuid4()),'role':'assistant','agent_id':a['id'],'speaker':a['name'],'content':'[LOCAL FIXTURE] '+a['name']+' ranks idea two first.','created_at':'2026-10-31T01:51:00Z'}for a in agents if a['id']in participants[:3]]
  messages[cid]+=[{'id':str(uuid.uuid4()),'role':'user','content':text,'created_at':'2026-10-31T01:51:00Z'},*replies]
  return route.fulfill(content_type='application/x-ndjson',body=''.join(json.dumps({'type':'delta','agent_id':m['agent_id'],'speaker':m['speaker'],'text':m['content']})+'\n'for m in replies)+json.dumps({'type':'saved'})+'\n')
 if path=='/messaging/read':return route.fulfill(content_type='application/json',body='{"ok":true}')
 return mock(route)
def badge(page):
 page.evaluate("""()=>{const b=document.createElement('div');b.textContent='LOCAL REVIEW · SYNTHETIC ACCOUNT';b.style.cssText='position:fixed;right:8px;bottom:4px;z-index:9999;font:8px system-ui;padding:3px 6px;background:#151819e6;color:#fff2da;border-radius:5px;pointer-events:none';document.body.append(b)}""")
def fit(page):
 return page.evaluate("""()=>{const send=document.querySelector('[aria-label="Send message"]'),r=send?.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,bodyOverflow:document.body.scrollWidth>innerWidth,composerVisible:!r||r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight+1,zoom:visualViewport.scale,shellHeight:document.querySelector('.dream-app')?.getBoundingClientRect().height,innerHeight}}""")
with sync_playwright()as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in [320,375,390,430,1440]:
  for theme in ['og-dark','og-light','ocean-fresh','chocolate-cream']:
   threads[-1]['appearance']={'background':'Basketball Court'};account['preferences']['appearance']={'design':theme};ctx=b.new_context(viewport={'width':width,'height':900},reduced_motion='reduce');ctx.add_init_script("localStorage.setItem('aelio.auth',"+json.dumps(json.dumps({'access_token':'fixture','refresh_token':'refresh-fixture','expires_at':time.time()+3600,'user':{'id':A}}))+");")
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('https://**/*',lambda r:r.abort());page.route('**/api/platform/**',api);page.route('**/assets/config.js',api)
   page.goto(os.environ.get('AELIO_BROWSER_BASE','http://127.0.0.1:8101')+'/',wait_until='domcontentloaded');page.get_by_label('Workspace',exact=True).select_option('aelio');page.get_by_role('heading',name='Meet your people.',exact=True).wait_for();badge(page)
   # Shared navigation is present in desktop rail and phone drawer, with exact order/URLs.
   nav=page.locator('.environment-rail .shared-navigation' if width>900 else '.mobile-workspace-navigation .shared-navigation')
   if width<=900:page.get_by_role('button',name='Open conversations',exact=True).click()
   assert nav.locator(':scope > button').all_text_contents()==['Chats','Companions','Dream Team','Echo','Library']
   links=nav.locator(':scope > a');assert links.count()==2
   assert links.nth(0).get_attribute('href')=='https://grooveville.org/guide/' and links.nth(1).get_attribute('href')=='https://vybr8.live/'
   for a in links.all():assert a.get_attribute('target')=='_blank' and 'noopener' in a.get_attribute('rel')
   if width in [390,1440] and theme in ['og-dark','og-light']:page.screenshot(path=str(OUT/f'navigation-{theme}-{width}.png'))
   nav.get_by_role('button',name='Chats',exact=True).click();page.locator('.full-inbox').wait_for();assert page.get_by_label('Workspace',exact=True).input_value()=='aelio';assert page.locator('.full-inbox .inbox-companions>button').count()==9
   if width in [390,1440]and theme in ['og-dark','og-light']:page.screenshot(path=str(OUT/f'inbox-{theme}-{width}.png'))
   page.locator('.full-inbox .inbox-companions button').filter(has_text='Dream Team').click();page.locator('.bubble.assistant').first.wait_for();r=fit(page);assert not r['overflow'] and r['composerVisible'],(width,theme,r)
   assert page.locator('.bubble.assistant .message-speaker .companion-avatar').count()>=6
   page.locator('.composer textarea').fill('Fixture ranking '+theme+' '+str(width));page.get_by_role('button',name='Send message',exact=True).click();page.get_by_text('[LOCAL FIXTURE] Naomi ranks idea two first.',exact=True).first.wait_for()
   # Saved fixture response attribution survives a UI reload of the same thread.
   for name in ['Naomi','Angelo','Oliver']:assert page.locator('.bubble.assistant').filter(has_text='[LOCAL FIXTURE] '+name+' ranks idea two first.').last.locator('.message-speaker').inner_text()==name
   page.locator('.composer textarea').fill('Persistent draft');page.get_by_label('Workspace',exact=True).select_option('dreambox');assert page.locator('.full-inbox').count()==1
   if width<=900:page.get_by_role('button',name='Open conversations',exact=True).click()
   nav.get_by_role('button',name='Dream Team',exact=True).click();assert page.locator('.composer textarea').input_value()=='Persistent draft'
   if width in [390,1440] and theme in ['og-dark','og-light']:
    page.screenshot(path=str(OUT/f'chat-{theme}-{width}.png'))
    page.get_by_role('button',name='Conversation settings',exact=True).click();page.get_by_label('Chat background',exact=True).select_option('Sunset & Beaches');page.get_by_role('button',name='Save appearance',exact=True).click();page.get_by_role('button',name='Close settings',exact=True).click();page.screenshot(path=str(OUT/f'chat-beach-{theme}-{width}.png'))
   if width<=900:
    page.set_viewport_size({'width':width,'height':480});page.locator('.composer textarea').focus();page.wait_for_timeout(100);r=fit(page);assert r['composerVisible'] and not r['overflow'],(width,theme,'short viewport',r);page.set_viewport_size({'width':width,'height':900})
   assert not errors,errors;report.append({'width':width,'theme':theme,**r});ctx.close();print('PASS',width,theme,flush=True)
 # Marketing cards, before and after, real generated page + prior approved CSS.
 baseline=subprocess.check_output(['git','show','acfb35e:public/aelio/index.html'],cwd=R).decode();css=subprocess.check_output(['git','show','acfb35e:public/assets/cine.css'],cwd=R).decode()
 for width in [1440,390]:
  for version in ['before','after']:
   ctx=b.new_context(viewport={'width':width,'height':1100},reduced_motion='reduce');page=ctx.new_page();page.route('https://**/*',lambda r:r.abort())
   if version=='before':
    page.route('**/aelio/',lambda r:r.fulfill(content_type='text/html',body=baseline));page.route('**/assets/cine.css*',lambda r:r.fulfill(content_type='text/css',body=css))
   page.goto(os.environ.get('AELIO_BROWSER_BASE','http://127.0.0.1:8101')+'/aelio/',wait_until='domcontentloaded');page.locator('.bento').scroll_into_view_if_needed();page.locator('.bento').screenshot(path=str(OUT/f'explore-{version}-{width}.png'))
   assert page.locator('.bento>a').count()==5;assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
   ctx.close()
 b.close();report.append({'iOS_Safari':'Physical iPhone unavailable; Chromium viewport/short-height checks do not establish iOS keyboard or pinch behavior.','WebKit_binary_present':Path(p.webkit.executable_path).exists()});OUT.joinpath('browser-checks.json').write_text(json.dumps(report,indent=2))
