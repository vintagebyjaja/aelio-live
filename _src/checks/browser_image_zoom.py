from pathlib import Path
exec(Path(__file__).with_name('browser_combined_review.py').read_text().split('with sync_playwright()as p:')[0])
fid='55555555-5555-4555-8555-555555555555';messages[team].append({'id':'image-fixture','role':'assistant','agent_id':participants[0],'speaker':'Naomi','content':'Local image viewer fixture','image_file_id':fid})
original_api=api
def api(route):
 path=route.request.url.split('/api/platform',1)[-1].split('?')[0]
 if path.startswith('/files/'):
  return route.fulfill(content_type='image/png',body=(R/'docs/previews/chat-images-v0.1/fixture-create.png').read_bytes())
 if path=='/files':return route.fulfill(content_type='application/json',body=json.dumps({'files':[{'id':fid,'name':'Local uploaded image fixture','mime':'image/png','category':'images','created_at':'2026-10-31T01:00:00Z'}],'next':None}))
 return original_api(route)
with sync_playwright()as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce');ctx.add_init_script("localStorage.setItem('aelio.auth',"+json.dumps(json.dumps({'access_token':'fixture','refresh_token':'refresh-fixture','expires_at':time.time()+3600,'user':{'id':A}}))+");");page=ctx.new_page();page.route('https://**/*',lambda r:r.abort());page.route('**/api/platform/**',api);page.route('**/assets/config.js',api);page.goto('http://127.0.0.1:8101/',wait_until='domcontentloaded');page.get_by_label('Workspace',exact=True).select_option('aelio');page.get_by_role('button',name='Open conversations',exact=True).click();page.locator('.mobile-workspace-navigation').get_by_role('button',name='Dream Team',exact=True).click();page.get_by_role('button',name='View generated image full screen').click();stage=page.locator('.image-pan-stage');stage.wait_for();box=stage.bounding_box();cx=box['x']+box['width']/2;cy=box['y']+box['height']/2;cdp=ctx.new_cdp_session(page)
 def touches(kind,d):cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[]if kind=='touchEnd'else [{'x':cx-d,'y':cy,'id':1},{'x':cx+d,'y':cy,'id':2}]})
 touches('touchStart',35);touches('touchMove',80);touches('touchEnd',0);page.wait_for_timeout(100);scale=stage.locator('img').evaluate('(e)=>getComputedStyle(e).transform');assert scale!='matrix(1, 0, 0, 1, 0, 0)',scale;assert page.evaluate('visualViewport.scale')==1
 badge(page);page.screenshot(path=str(OUT/'image-viewer-mobile.png'));page.get_by_role('button',name='Close image',exact=True).click();assert page.get_by_role('button',name='Send message').is_visible();assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
 page.get_by_role('button',name='Open conversations',exact=True).click();page.locator('.mobile-workspace-navigation').get_by_role('button',name='Library',exact=True).click();page.get_by_role('button',name='Preview',exact=True).click();page.get_by_role('button',name='Zoom in image',exact=True).click();assert '140%' in page.locator('.image-zoom-tools').inner_text();page.get_by_role('button',name='Close image preview').click();assert page.locator('.image-pan-stage').count()==0
 print('Chat pinch/pan confined to viewer, page scale stays1, composer return, uploaded Library zoom: PASS');b.close()
