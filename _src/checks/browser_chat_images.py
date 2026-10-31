"""Local image chat UI contract. All image outputs and account data are labeled fixtures."""
import json,time,uuid
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixtures import *
BASE='http://127.0.0.1:8097';ROOT=Path('/workspace/aelio-live');OUT=ROOT/'docs/previews/chat-images-v0.1';OUT.mkdir(parents=True,exist_ok=True)
files=[];requests=[];quote_requests=[];counter=0

def api(route):
 global counter
 p=route.request.url.split('/api/platform',1)[-1].split('?')[0];method=route.request.method
 if p=='/images/quote':quote_requests.append(route.request.post_data_json);d={'enabled':True,'credits':3,'balance':20,'version':2,'included':False}
 elif p.endswith('/respond') and route.request.post_data_json.get('image_action'):
  payload=route.request.post_data_json;requests.append(payload);cid=p.split('/')[2];fid=str(uuid.uuid4());counter+=1
  files.append({'id':fid,'name':'Sample generated output '+str(counter)+'.png','mime':'image/png','category':'generated-assets','created_at':'2026-10-31T12:00:00Z','conversation_id':cid,'parent_file_id':payload.get('source_image_id')})
  messages[cid]+=[{'id':str(uuid.uuid4()),'role':'user','content':payload['content'],'request_id':payload['request_id']},{'id':str(uuid.uuid4()),'role':'assistant','content':'Your image is ready.','speaker':'AELIO','image_file_id':fid,'source_image_id':payload.get('source_image_id'),'request_id':payload['request_id']}]
  return route.fulfill(content_type='application/x-ndjson',body=json.dumps({'type':'image','file_id':fid})+'\n'+json.dumps({'type':'saved'})+'\n')
 elif p.startswith('/files/'):
  f=next(f for f in files if f['id']==p.split('/')[2]);return route.fulfill(content_type='image/png',body=(OUT/('fixture-edit.png' if f['parent_file_id'] else 'fixture-create.png')).read_bytes())
 elif p=='/files':d={'files':files,'next':None}
 else:return mock(route)
 return route.fulfill(content_type='application/json',body=json.dumps(d))
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 # Generate honest synthetic fixture assets with browser canvas, not an AI-provider claim.
 page=b.new_page()
 for edited in [False,True]:
  data=page.evaluate('''edited=>{const c=document.createElement('canvas');c.width=800;c.height=560;const x=c.getContext('2d');x.fillStyle='#f4ead9';x.fillRect(0,0,800,560);x.fillStyle=edited?'#299ca8':'#ad7138';x.beginPath();x.arc(400,255,130,0,Math.PI*2);x.fill();x.fillStyle='#302c28';x.font='18px sans-serif';x.textAlign='center';x.fillText('LOCAL IMAGE FIXTURE · '+(edited?'EDITED VERSION':'ORIGINAL'),400,465);return c.toDataURL('image/png').split(',')[1]}''',edited)
  import base64;(OUT/('fixture-edit.png' if edited else 'fixture-create.png')).write_bytes(base64.b64decode(data))
 page.close()
 for width in [1440,390]:
  files.clear();requests.clear();messages[C]=[];counter=0;ctx=b.new_context(viewport={'width':width,'height':1050},reduced_motion='reduce');ctx.add_init_script("localStorage.setItem('aelio.auth',"+json.dumps(json.dumps({'access_token':'fixture-user','refresh_token':'fixture-refresh','expires_at':time.time()+3600,'user':{'id':A,'email':'local-sample@example.test'}}))+");")
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/api/platform/**',api);page.route('**/assets/config.js',api);page.goto(BASE+'/',wait_until='networkidle');page.get_by_label('Workspace',exact=True).select_option('dreambox');page.locator('.full-inbox .inbox-row').filter(has_text='AELIO').first.click();page.locator('.composer textarea').fill('Create an image of a copper circle on ivory paper.');page.locator('.composer').get_by_role('button',name='Send message',exact=True).click();page.get_by_role('heading',name='Create your image',exact=True).wait_for();assert len(requests)==0;assert page.get_by_text('3 AELIO credits',exact=False).is_visible();page.get_by_role('button',name='Confirm generation').click();page.locator('.chat-image img').first.wait_for();assert len(requests)==1;original=files[0]['id'];page.locator('.composer textarea').fill('Make the circle turquoise, keeping everything else unchanged.');page.locator('.composer').get_by_role('button',name='Send message',exact=True).click();page.get_by_role('heading',name='Edit your image',exact=True).wait_for();page.get_by_role('button',name='Confirm edit').click();page.locator('.chat-image').nth(1).wait_for();assert requests[1]['source_image_id']==original;assert files[1]['parent_file_id']==original;assert len(files)==2
  page.locator('.chat-image').nth(1).scroll_into_view_if_needed();page.screenshot(path=str(OUT/f'chat-images-{width}.png'));page.locator('.chat-image-preview').last.click();assert page.locator('.chat-image-viewer[open]').is_visible();page.get_by_role('button',name='Close image',exact=True).last.click()
  page.reload(wait_until='networkidle');page.get_by_label('Workspace',exact=True).select_option('dreambox');page.locator('.full-inbox .inbox-row').filter(has_text='AELIO').first.click();page.locator('.chat-image').nth(1).wait_for();assert len(requests)==2
  page.goto(BASE+'/#library',wait_until='networkidle');page.get_by_role('heading',name='Image Library',exact=True).wait_for();page.get_by_role('button',name='Edit in chat').last.wait_for();page.screenshot(path=str(OUT/f'library-images-{width}.png'));page.get_by_role('button',name='Edit in chat').last.click();page.get_by_text('Editing an image from your account',exact=False).wait_for();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors;ctx.close();print('Chat creation/edit confirmation, original preservation, refresh, viewer and Library:',width)
 b.close()
