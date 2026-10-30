"""Cinematic UI contracts using explicit local Auth/API fixtures, not real account validation."""
import json,time,os
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixtures import *
SHOTS=Path(os.environ.get('AELIO_SCREENSHOT_DIR','/tmp/aelio-v1.0.4-previews'));SHOTS.mkdir(parents=True,exist_ok=True)
def nav(page,width,label):
 if width<=900:
  page.locator('.mobile-nav').get_by_role('button',name=label,exact=True).click()
 else:page.locator('.home-nav').get_by_role('button',name=label,exact=True).click()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in (1440,768,390,320):
  account['preferences']['appearance']={'design':'og-dark'}
  ctx=browser.new_context(viewport={'width':width,'height':1000},reduced_motion='reduce',timezone_id='America/New_York')
  ctx.add_init_script("localStorage.setItem('aelio.auth',"+json.dumps(json.dumps({'access_token':'fixture-user','refresh_token':'fixture-refresh','expires_at':time.time()+3600,'user':{'id':A,'email':'local-fixture@example.test'}}))+");")
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/api/platform/**',mock);page.route('**/assets/config.js',mock)
  page.goto(BASE+'/',wait_until='networkidle');page.locator('.hero-composer').wait_for()
  assert page.locator('.hero-composer textarea').count()==1
  assert page.get_by_role('button',name='Continue →',exact=True).count()==0
  assert page.locator('.aelio-orb').count()>=1
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.screenshot(path=str(SHOTS/f'og-dark-{width}.png'))
  if width<=900:
   assert page.locator('.mobile-nav').is_visible()
   page.locator('.quick-actions button').last.scroll_into_view_if_needed()
   rect=page.locator('.quick-actions button').last.bounding_box();assert rect['x']+rect['width']<=width+1
  # Browser back preserves the home draft rather than reconstructing or submitting it.
  page.get_by_label('Talk to AELIO',exact=True).fill('A preserved home draft')
  page.get_by_role('button',name='Discover experiences',exact=True).click();page.get_by_role('heading',name='A little inspiration. Endless possibilities.',exact=True).wait_for()
  assert page.locator('.discover-topics button').count()==13
  page.go_back();page.locator('.hero-composer').wait_for();assert page.get_by_label('Talk to AELIO',exact=True).input_value()=='A preserved home draft'
  # Direct Send is an explicit user action and uses the real existing streaming path (fixture provider here).
  page.get_by_role('button',name='Send to AELIO',exact=True).click();page.get_by_text('[offline browser fixture] A preserved home draft',exact=True).first.wait_for()
  assert page.get_by_role('textbox',name='Message',exact=True).input_value()==''
  # Topics remain drafts in Discover; the model is never silently invoked by selecting a starter.
  nav(page,width,'Discover');page.locator('.discover-topics button').filter(has_text='Travel Ideas').click()
  assert 'plan a trip' in page.get_by_role('textbox',name='Message',exact=True).input_value()
  assert page.locator('.messages .bubble').count()==0
  nav(page,width,'Settings');page.get_by_role('heading',name='Your AELIO, your way.',exact=True).wait_for()
  page.locator('.settings-workspace').get_by_role('button',name='Connected Apps',exact=True).click();page.get_by_role('heading',name='More ways to follow your vibe.',exact=True).wait_for()
  assert page.get_by_role('link',name='Open Groove Guide',exact=False).get_attribute('href')=='https://grooveville.org/guide/'
  assert page.get_by_role('link',name='Explore VYBR8',exact=False).get_attribute('href')=='https://vybr8.live/'
  assert page.get_by_role('button',name='Plan a Trip',exact=True).is_visible()
  assert not page.get_by_text('Permissions granted: none',exact=False).count()
  assert not page.get_by_role('button',name='Connect Account',exact=True).count()
  # All four themes preview and persist via the existing appearance API.
  for title,design in [('OG Light','og-light'),('OG Dark','og-dark'),('Ocean Fresh','ocean-fresh'),('Chocolate Cream','chocolate-cream')]:
   nav(page,width,'Settings');page.get_by_role('button',name='Appearance & themes',exact=False).click()
   page.locator('.design-choice').filter(has_text=title).click();assert page.locator('.dream-app').get_attribute('data-design')==design
   page.get_by_role('button',name='Save global appearance',exact=True).click();page.get_by_text('Appearance saved. Agents using your default will follow it.',exact=True).wait_for()
   page.get_by_role('button',name='Back to Dream Box',exact=True).click();page.screenshot(path=str(SHOTS/f'{design}-{width}.png'))
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  # Mobile keyboard focus hides the persistent navigation so it cannot overlap the input.
  page.get_by_label('Talk to AELIO',exact=True).focus()
  if width<=900:
   page.set_viewport_size({'width':width,'height':650});page.wait_for_timeout(150);assert not page.locator('.mobile-nav').is_visible()
   page.set_viewport_size({'width':width,'height':1000});page.wait_for_timeout(150);assert page.locator('.mobile-nav').is_visible()
  assert not errors,errors
  print(f'{width}px: unified send/stream, unsent starter drafts, browser back, four themes, verified-only connection states and no overflow passed')
  ctx.close()
 # Guest: no fictional identity, local theme persistence and explicitly limited chat.
 ctx=browser.new_context(viewport={'width':390,'height':950},reduced_motion='reduce')
 page=ctx.new_page()
 def guest_fixture(route):
  if '/assets/config.js' in route.request.url:return route.fulfill(content_type='text/javascript',body='window.AELIO_CONFIG={supabase:{}};')
  if '/guest' in route.request.url:return route.fulfill(content_type='application/json',body=json.dumps({'conversation':{'id':C,'title':'AELIO','participants':[],'appearance':{}},'remaining':10}))
  if '/messages' in route.request.url:return route.fulfill(content_type='application/json',body='{"messages":[]}')
  return route.fulfill(status=401,content_type='application/json',body='{"error":"Fixture: account service needs sign-in"}')
 page.route('**/assets/config.js',guest_fixture);page.route('**/api/platform/**',guest_fixture)
 page.goto(BASE+'/',wait_until='networkidle');page.locator('.hero-composer').wait_for();assert not page.get_by_role('heading',name='Account Security Setup',exact=True).count()
 nav(page,390,'Settings');page.get_by_role('button',name='Appearance & themes',exact=False).click();page.locator('.design-choice').filter(has_text='Ocean Fresh').click();page.get_by_role('button',name='Save global appearance',exact=True).click();page.get_by_text('Appearance saved. Agents using your default will follow it.',exact=True).wait_for();page.reload(wait_until='networkidle');assert page.locator('.dream-app').get_attribute('data-design')=='ocean-fresh'
 print('Guest: no fabricated history/account; local appearance survives reload')
 browser.close()
