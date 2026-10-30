"""Browser contract tests with explicit local Auth/API fixtures. Not live AI or Supabase verification.
Start npm run dev first. Uses installed system Chromium via an explicit supported executable option.
"""
import json, os, time
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixtures import *
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 for width in (1440,390):
  context=browser.new_context(viewport={'width':width,'height':900},reduced_motion='reduce')
  context.add_init_script("localStorage.setItem('aelio.auth',"+json.dumps(json.dumps({'access_token':'fixture-user','refresh_token':'fixture-refresh','expires_at':time.time()+3600,'user':{'id':A,'email':'local-fixture@example.test'}}))+");")
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/api/platform/**',mock);page.route('**/assets/config.js',mock)
  page.goto(BASE+'/chat/?companion=aelio',wait_until='networkidle');page.locator('.messages').get_by_text('AELIO fixture conversation',exact=True).wait_for()
  page.get_by_role('textbox',name='Message',exact=True).fill('Unsent AELIO draft')
  if width<680:page.get_by_role('button',name='Open conversations').click()
  page.locator('button.thread').filter(has_text='Chester').click();page.locator('.messages').get_by_text('Chester fixture conversation',exact=True).wait_for()
  assert page.get_by_role('textbox',name='Message',exact=True).input_value()==''
  assert '#226688' in page.locator('.chat').get_attribute('style')
  page.get_by_role('textbox',name='Message',exact=True).fill('Chester-only message');page.get_by_role('button',name='Send message').click()
  if width<680:page.get_by_role('button',name='Open conversations').click()
  page.locator('button.permanent').click();page.wait_for_timeout(500)
  assert page.get_by_role('textbox',name='Message',exact=True).input_value()=='Unsent AELIO draft'
  assert '[offline browser fixture] Chester-only message' not in page.locator('.messages').inner_text()
  if width<680:page.get_by_role('button',name='Open conversations').click()
  page.locator('button.thread').filter(has_text='Chester').click();page.get_by_text('[offline browser fixture] Chester-only message',exact=True).first.wait_for()
  page.get_by_role('button',name='Conversation settings').click();page.get_by_label('Chat background',exact=True).select_option('Minimal White');page.get_by_role('button',name='Save appearance').click();page.get_by_role('button',name='Close settings').click()
  page.get_by_role('button',name='Account',exact=True).click();page.get_by_role('heading',name='Your account',exact=True).wait_for();assert 'PATHD — Connected' in page.locator('.panel').inner_text()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  print(f'{width}px: chat switching, isolated drafts/replies, appearance persistence, account dashboard, no overflow or JS errors passed')
  context.close()
 browser.close()
