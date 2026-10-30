"""Synthetic local stream contract. No live inference or account access."""
import json,time,os
from playwright.sync_api import sync_playwright
from browser_fixtures import mock,A,C
BASE=os.environ.get('AELIO_BROWSER_BASE','http://127.0.0.1:8098')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);ctx=browser.new_context(viewport={'width':390,'height':850},reduced_motion='reduce')
 ctx.add_init_script("localStorage.setItem('aelio.auth',"+json.dumps(json.dumps({'access_token':'fixture-user','refresh_token':'fixture-refresh','expires_at':time.time()+3600,'user':{'id':A}}))+");")
 calls=[]
 def api(route):
  if route.request.url.endswith('/respond'):
   data=route.request.post_data_json;calls.append(data);assert data['page_context']['path']=='/create/';assert data['consent'] is True
   route.fulfill(content_type='application/x-ndjson',body='\n'.join(json.dumps(e) for e in [{'type':'delta','speaker':'AELIO','text':'Synthetic streamed reply for this page.'},{'type':'saved'}])+'\n');return
  mock(route)
 ctx.route('https://**',lambda r:r.abort());ctx.route('**/api/public/site-design**',lambda r:r.fulfill(content_type='application/json',body='{}'));ctx.route('**/api/platform/**',api);ctx.route('**/assets/config.js',mock)
 page=ctx.new_page();page.goto(BASE+'/create/',wait_until='networkidle');assert not calls
 page.get_by_role('button',name='Open AELIO DreamBox').click();frame=page.frame_locator('#aelio-dreambox-panel');frame.get_by_label('DreamBox message',exact=True).fill('Explicit synthetic send')
 frame.get_by_role('button',name='Send ↑',exact=True).click();frame.get_by_text('Synthetic streamed reply for this page.',exact=True).wait_for();assert len(calls)==1
 assert frame.get_by_label('DreamBox message',exact=True).input_value()==''
 frame.get_by_label('DreamBox message',exact=True).fill('Private fixture draft')
 page.evaluate("localStorage.removeItem('aelio.auth')")
 # Storage event reaches the separate same-origin iframe and clears owner history before guest setup.
 frame.get_by_text('Synthetic streamed reply for this page.',exact=True).wait_for(state='hidden')
 assert frame.get_by_label('DreamBox message',exact=True).input_value()==''
 print('Explicit send streams once with grounded page metadata; logout clears private history/draft.')
 browser.close()
