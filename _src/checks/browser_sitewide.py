"""Local-only review: marketing layout and DreamBox with explicit synthetic Auth/API fixtures."""
import json,time,os,sys,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixtures import mock,account,A
BASE=os.environ.get('AELIO_BROWSER_BASE','http://127.0.0.1:8097')
OUT=Path(os.environ.get('AELIO_SCREENSHOT_DIR','/tmp/aelio-v1.0.7-previews'));OUT.mkdir(parents=True,exist_ok=True)
index=json.load(urllib.request.urlopen(BASE+'/assets/search-index.json'))
for route in ['/explore/']+[x['url'] for x in index]:
 html=urllib.request.urlopen(BASE+route).read().decode()
 assert '/assets/editorial.css' in html and '/assets/dreambox-host.js' in html,route
print(f'{len(index)+1} public routes include shared editorial styles and DreamBox')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in [int(w) for w in os.environ.get('AELIO_BROWSER_WIDTHS','1440,768,390,320').split(',')]:
  ctx=browser.new_context(viewport={'width':width,'height':1000},reduced_motion='reduce')
  ctx.add_init_script("localStorage.setItem('aelio-intro-off','1');localStorage.setItem('aelio.auth',"+json.dumps(json.dumps({'access_token':'fixture-user','refresh_token':'fixture-refresh','expires_at':time.time()+3600,'user':{'id':A,'email':'local-fixture@example.test'}}))+");")
  ctx.route('https://**',lambda r:r.abort());ctx.route('**/api/public/site-design**',lambda r:r.fulfill(content_type='application/json',body='{}'));ctx.route('**/api/platform/**',mock);ctx.route('**/assets/config.js',mock)
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'/dream-beyond/agent-team/',wait_until='networkidle')
  assert page.locator('[data-unc-message]').count()==4
  assert all(page.locator('[data-unc-message]').nth(i).is_visible() for i in range(4))
  page.get_by_role('button',name='Replay ↻').click()
  assert page.get_by_text("Fellas, I'm thinking about opening a lounge. What y'all think?",exact=True).is_visible()
  assert page.get_by_role('link',name='Create Your Group Chat →').get_attribute('href')=='/chat/?newGroup=1'
  assert page.locator('.dreambox-access').count()==1
  assert page.locator('iframe.dreambox-frame').count()==0 # no assistant requests before opening
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.locator('.unc-section').screenshot(path=str(OUT/f'agent-team-{width}.png'),style='.site-head,.dreambox-access{visibility:hidden!important;}')
  page.get_by_role('button',name='Open AELIO DreamBox').click()
  frame=page.frame_locator('#aelio-dreambox-panel')
  frame.get_by_label('DreamBox message',exact=True).wait_for()
  frame.get_by_role('article').first.wait_for() if False else None
  frame.locator('.db-messages').get_by_text('AELIO fixture conversation',exact=True).wait_for()
  frame.get_by_label('DreamBox message',exact=True).fill('An unsent page-aware fixture draft')
  frame.get_by_role('button',name='Expand DreamBox').click()
  page.locator('iframe.expanded').wait_for()
  frame.get_by_role('button',name='Minimize DreamBox').click()
  page.get_by_role('button',name='Open AELIO DreamBox').wait_for(state='visible')
  page.get_by_role('button',name='Open AELIO DreamBox').click()
  assert frame.get_by_label('DreamBox message',exact=True).input_value()=='An unsent page-aware fixture draft'
  frame.get_by_role('button',name='Close DreamBox').click()
  page.get_by_role('button',name='Open AELIO DreamBox').click()
  page.goto(BASE+'/technology/green-guardians/',wait_until='networkidle')
  frame=page.frame_locator('#aelio-dreambox-panel');frame.get_by_label('DreamBox message',exact=True).wait_for()
  assert frame.get_by_label('DreamBox message',exact=True).input_value()=='An unsent page-aware fixture draft'
  frame.get_by_role('button',name='Explain the key ideas',exact=True).wait_for()
  frame.get_by_label('DreamBox agent',exact=True).select_option(label='Chester · Architecture & Design')
  frame.locator('.db-messages').get_by_text('Chester fixture conversation',exact=True).wait_for()
  assert page.locator('.dreambox-access').count()==1
  page.screenshot(path=str(OUT/f'dreambox-{width}.png'))
  frame.get_by_role('button',name='Close DreamBox').click()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  for route in ['/dream-beyond/','/create/','/agent-campus/','/values/','/technology/dream-code/','/explore/']:
   page.goto(BASE+route,wait_until='networkidle');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),route
  assert not errors,errors
  print(f'{width}px: exact demo/replay, route styles, widget open/close/expand, navigation draft persistence, agent context and overflow passed')
  ctx.close()
 ctx=browser.new_context(viewport={'width':390,'height':900},reduced_motion='reduce')
 ctx.route('https://**',lambda r:r.abort());ctx.route('**/api/platform/**',mock);ctx.route('**/assets/config.js',mock)
 page=ctx.new_page();page.goto(BASE+'/account/',wait_until='networkidle')
 page.get_by_role('button',name='Continue with Google',exact=True).wait_for();assert page.get_by_role('button',name='Continue with Apple',exact=True).is_visible()
 page.get_by_role('button',name='Create account',exact=True).click()
 assert page.get_by_label('Choose recovery question 1',exact=True).count()==0
 assert page.get_by_role('button',name='Use your passkey',exact=True).count()==0
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path=str(OUT/'signup-390.png'))
 print('Guest signup: Google/Apple options; no mandatory recovery questions; passkeys hidden until configured.')
 ctx.close();browser.close()
