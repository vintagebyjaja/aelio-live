"""Dream Box functional contracts with local fixtures, not production verification."""
import json,os,time
from playwright.sync_api import sync_playwright
from browser_fixtures import *
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in (1440,768,390):
  account['preferences']['appearance']={'design':'og-dark'}
  ctx=browser.new_context(viewport={'width':width,'height':960},reduced_motion='reduce')
  ctx.add_init_script("localStorage.setItem('aelio.auth',"+json.dumps(json.dumps({'access_token':'fixture-user','refresh_token':'fixture-refresh','expires_at':time.time()+3600,'user':{'id':A,'email':'local-fixture@example.test'}}))+");")
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/api/platform/**',mock);page.route('**/assets/config.js',mock)
  page.goto(BASE+'/chat/',wait_until='networkidle');page.get_by_text('What’s the vibe today?',exact=True).wait_for()
  assert page.locator('.vibe-card').count()==6
  assert page.locator('.secondary-topics button').count()==7
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  for name,design in [('Ocean Fresh','ocean-fresh'),('Chocolate Cream','chocolate-cream'),('OG Light','og-light'),('OG Dark','og-dark')]:
   page.get_by_role('button',name='Preview '+name,exact=True).click()
   assert page.locator('.dream-app').get_attribute('data-design')==design
   page.get_by_role('button',name='Save global appearance',exact=True).click();page.get_by_text('Appearance saved. Agents using your default will follow it.',exact=True).wait_for()
   page.get_by_role('button',name='Back to Dream Box',exact=True).click()
   page.screenshot(path='/tmp/aelio-home-'+design+'-'+str(width)+'.png')
  page.locator('.vibe-card').filter(has_text='Travel Ideas').click();page.get_by_role('textbox',name='Message',exact=True).wait_for()
  assert 'plan a trip' in page.get_by_role('textbox',name='Message',exact=True).input_value()
  assert page.locator('.messages .bubble').count()==0 # category prepared a draft, never submitted
  if width<=900:page.get_by_role('button',name='Open conversations',exact=True).click()
  page.locator('.home-nav').get_by_role('button',name='Home',exact=False).click()
  page.get_by_label('Start talking to AELIO',exact=True).fill('My own direct thought')
  page.get_by_role('button',name='Continue →',exact=True).click()
  assert page.get_by_role('textbox',name='Message',exact=True).input_value()=='My own direct thought'
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.screenshot(path='/tmp/aelio-chat-'+str(width)+'.png')
  assert not errors,errors
  print(str(width)+'px: four theme previews/save, home categories without auto-send, direct draft, navigation and overflow checks passed')
  ctx.close()
 browser.close()
# Guest preferences must survive a reload without using account APIs.
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':390,'height':900},reduced_motion='reduce')
 page=ctx.new_page()
 def guest_mock(route):
  if '/assets/config.js' in route.request.url:return route.fulfill(content_type='text/javascript',body='window.AELIO_CONFIG={supabase:{}};')
  if '/guest' in route.request.url:return route.fulfill(content_type='application/json',body=json.dumps({'conversation':{'id':C,'title':'AELIO','participants':[],'appearance':{}},'remaining':10}))
  if '/messages' in route.request.url:return route.fulfill(content_type='application/json',body='{"messages":[]}')
  return route.fulfill(status=401,content_type='application/json',body='{"error":"Guest fixture: account APIs prohibited"}')
 page.route('**/assets/config.js',guest_mock);page.route('**/api/platform/**',guest_mock)
 page.goto(BASE+'/',wait_until='networkidle');page.get_by_role('button',name='Preview Ocean Fresh',exact=True).click();page.get_by_role('button',name='Save global appearance',exact=True).click();page.get_by_text('Appearance saved. Agents using your default will follow it.',exact=True).wait_for();page.reload(wait_until='networkidle');assert page.locator('.dream-app').get_attribute('data-design')=='ocean-fresh'
 print('Guest: root Dream Box and locally saved theme survive reload without account access')
 browser.close()
