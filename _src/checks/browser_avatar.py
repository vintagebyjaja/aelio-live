"""Synthetic custom-upload/crop UI regression; official assets are never replaced by this fixture."""
import base64,struct,zlib
from pathlib import Path
exec(Path(__file__).with_name('browser_companions.py').read_text().split('with sync_playwright()')[0])
# A red/green square makes a real crop change visible without using anyone's photo.
def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
raw=b''.join(b'\0'+b''.join(bytes((220,40,40) if x<32 else (30,180,70)) for x in range(64)) for y in range(64))
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',64,64,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b'')
fid=str(uuid.uuid4())
def avatar_route(route):
 path=route.request.url.split('/api/platform')[-1]
 if path=='/files' and route.request.method=='POST':return route.fulfill(status=201,content_type='application/json',body=json.dumps({'file':{'id':fid,'name':'crop-fixture.png','mime':'image/png','owner_id':A,'status':'ready'}}))
 if path=='/files/'+fid:return route.fulfill(content_type='image/png',body=png)
 return route_handler(route)
def slider(page,label,value):
 page.get_by_label(label,exact=True).evaluate('(e,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,String(value));e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));}',value)
 page.wait_for_timeout(100)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
 context.add_init_script("localStorage.setItem('aelio.auth',"+json.dumps(json.dumps({'access_token':'fixture-user','refresh_token':'fixture-refresh','expires_at':time.time()+3600,'user':{'id':A,'email':'local-fixture@example.test'}}))+");")
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/api/platform/**',avatar_route);page.route('**/assets/config.js',avatar_route);page.goto(BASE+'/',wait_until='networkidle');page.locator('.home-nav').get_by_role('button',name='Agents',exact=True).click();page.get_by_role('button',name='Edit agent',exact=True).click()
 page.locator('.custom-portrait-editor input[type=file]').set_input_files({'name':'crop-fixture.png','mimeType':'image/png','buffer':png});image=page.locator('.custom-portrait-editor img');image.wait_for();image.evaluate('async image=>{await image.decode()}')
 slider(page,'Zoom',2);slider(page,'Horizontal position',0);left=page.locator('.custom-portrait-editor .companion-avatar').screenshot();slider(page,'Horizontal position',100);right=page.locator('.custom-portrait-editor .companion-avatar').screenshot();assert left!=right,'Square images must actually move when repositioned at zoom'
 page.get_by_role('button',name='Save agent',exact=True).click();page.get_by_role('heading',name='Your companions',exact=True).wait_for();assert next(a for a in agents if a['id']==B)['avatar_crop']['x']==100
 page.get_by_role('button',name='Edit agent',exact=True).click();page.get_by_role('button',name='Remove picture',exact=True).click();page.get_by_role('button',name='Save agent',exact=True).click();page.get_by_role('heading',name='Your companions',exact=True).wait_for();assert next(a for a in agents if a['id']==B)['avatar_file_id'] is None
 assert all(not a.get('avatar_file_id') for a in agents if a['kind']!='custom');assert not errors,errors;print('Custom upload, square-image reposition/zoom, save, remove, CSP blob display and unchanged official identities passed');browser.close()
