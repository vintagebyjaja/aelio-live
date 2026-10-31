"""Local Auth/storage fixtures, actual WebGL and UI. No live model or hosted-service evidence."""
import json,time,uuid,os
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixtures import *
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/previews/character-campus-v1.0.15';OUT.mkdir(parents=True,exist_ok=True)
BASE=os.environ.get('AELIO_BROWSER_BASE','http://127.0.0.1:8102');writes=[];portraits={};residence={'name':'Local test residence','destination':'plaza','quality':'low'}
agents[1].update(instructions='Preserve my purpose',memories=['Preserve my knowledge'],memory_enabled=True)
def api(route):
 p=route.request.url.split('/api/platform',1)[-1].split('?')[0];m=route.request.method
 if p=='/aurevia':
  if m=='PATCH':residence.update(route.request.post_data_json)
  d={'residence':residence,'meetings':[]}
 elif p=='/agents' and m=='POST':
  doc=route.request.post_data_json;writes.append(doc);a={**doc,'kind':'custom','id':str(uuid.uuid4()),'owner_id':A};agents.append(a);d={'agent':a}
 elif p.startswith('/agents/') and m=='PATCH':
  doc=route.request.post_data_json;writes.append(doc);a=next(a for a in agents if a['id']==p.split('/')[2]);a.update(doc);d={'agent':a}
 elif p=='/files' and m=='POST':
  fid=str(uuid.uuid4());raw=route.request.post_data_buffer;assert raw[:8]==b'\x89PNG\r\n\x1a\n';assert route.request.headers['x-file-category']=='agents';portraits[fid]=raw;d={'file':{'id':fid,'name':'agent-character.png','mime':'image/png'}}
 elif p.startswith('/files/') and p.endswith('/content'):
  return route.fulfill(content_type='image/png',body=portraits[p.split('/')[2]])
 else:return mock(route)
 route.fulfill(content_type='application/json',body=json.dumps(d))
def overflow(page):assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
def badge(page):page.evaluate("""()=>{let b=document.createElement('div');b.textContent='LOCAL FIXTURE · ACTUAL WEBGL';b.style.cssText='position:fixed;top:48px;right:4px;z-index:99999;color:#fff;background:#191919d9;font:8px system-ui;padding:4px;pointer-events:none';document.body.append(b)}""")
with sync_playwright()as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for width in [int(v) for v in os.environ.get('AELIO_CREATOR_WIDTHS','1440,390,320,430').split(',')]:
  ctx=b.new_context(viewport={'width':width,'height':1000},reduced_motion='reduce');ctx.add_init_script("if(top===self){localStorage.setItem('aelio.auth',"+json.dumps(json.dumps({'access_token':'fixture','refresh_token':'fixture-refresh','expires_at':time.time()+3600,'user':{'id':A}}))+");}")
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('https://**/*',lambda r:r.abort());page.route('**/api/platform/**',api);page.route('**/assets/config.js',api)
  page.goto(BASE+'/#character-creator');page.locator('.character-live-preview[data-ready=true]').wait_for(timeout=60000);overflow(page)
  canvas=page.locator('.character-live-preview canvas');before=canvas.screenshot();page.get_by_role('button',name='SKIN TONE #65391f',exact=True).click();page.wait_for_timeout(150);assert before!=canvas.screenshot()
  before=canvas.screenshot();page.get_by_role('button',name='Rotate character right',exact=True).click();page.wait_for_timeout(150);assert before!=canvas.screenshot()
  page.get_by_role('button',name='Zoom in character',exact=True).click();page.get_by_role('button',name='HAIR STYLE bob',exact=True).click()
  page.once('dialog',lambda d:d.accept('Saved local look'));page.get_by_role('button',name='Save this appearance',exact=False).click();page.get_by_role('button',name='Saved local look',exact=True).wait_for()
  badge(page);page.screenshot(path=str(OUT/f'creator-{width}.png'),full_page=False)
  page.get_by_role('button',name='Continue →',exact=True).click();page.get_by_label('Character agent name',exact=True).fill('Creator fixture '+str(width));page.get_by_label('Agent instructions',exact=True).fill('Custom test purpose');page.get_by_role('button',name='Continue →',exact=True).click();page.get_by_label('Agent knowledge',exact=True).fill('Custom context');page.get_by_role('button',name='Continue →',exact=True).click();page.get_by_role('button',name='Create Agent',exact=True).click();page.locator('.character-creator').wait_for(state='detached',timeout=30000)
  assert writes[-1]['character']['current']['skin']=='#65391f';assert writes[-1]['character']['presets'][0]['name']=='Saved local look';assert portraits[writes[-1]['avatar_file_id']]
  # Reload appearance-only editor with owner-bound saved agent ID. No personality or history mutation.
  page.evaluate("id=>{history.replaceState({character_agent:id,character_origin:'agents',aelioEnvironment:'dreambox'},'','#character-creator')}",B);page.reload();page.locator('.character-live-preview[data-ready=true]').wait_for(timeout=60000);page.get_by_role('button',name='HAIR STYLE bun',exact=True).click();page.get_by_role('navigation',name='Agent creation steps',exact=True).get_by_role('button').nth(3).click();page.get_by_role('button',name='Save Appearance',exact=True).click();page.locator('.character-creator').wait_for(state='detached',timeout=30000)
  assert set(writes[-1])=={'character','avatar_file_id','avatar_crop'};assert agents[1]['instructions']=='Preserve my purpose';assert messages[D][0]['content']=='Chester fixture conversation';assert agents[1]['memories']==['Preserve my knowledge']
  page.goto(BASE+'/#aurevia');page.locator('.campus-map').wait_for();assert page.locator('canvas').count()==0;overflow(page)
  page.get_by_role('button',name='Zoom in map',exact=True).click();assert page.locator('.campus-zoom').inner_text().find('125%')>=0;page.get_by_role('button',name='Reset map',exact=True).click()
  page.get_by_role('button',name='List View',exact=False).click();page.locator('.campus-list-view button').filter(has_text='The Courthouse').click();assert page.get_by_role('button',name='Location in development',exact=True).is_disabled()
  page.locator('.campus-sidebar button').filter(has_text='Orb Plaza').click();page.get_by_role('button',name='Map View',exact=False).click();badge(page);page.screenshot(path=str(OUT/f'map-{width}.png'),full_page=False)
  page.get_by_role('button',name='Enter Location →',exact=True).click();page.locator('.aurevia-world canvas').wait_for(timeout=60000);assert page.locator('.campus-map').count()==0;overflow(page)
  page.get_by_role('button',name='Return to Campus Map',exact=True).click();page.locator('.campus-map').wait_for();assert page.locator('canvas').count()==0
  page.locator('.campus-sidebar button').filter(has_text='Principal').click();page.get_by_role('button',name='Enter Location →',exact=True).click();page.get_by_label('Office conversation',exact=True).select_option(D);page.get_by_label('Office shared transcript',exact=True).get_by_text('Chester fixture conversation',exact=True).wait_for();page.get_by_role('button',name='Character',exact=True).click();page.locator('.character-live-preview[data-ready=true]').wait_for(timeout=60000);assert page.get_by_role('heading',name='CUSTOMIZE YOUR AGENT',exact=True).is_visible()
  assert not errors,errors;ctx.close();print('PASS creator save/edit + map/plaza/office',width,flush=True)
 # Short non-reduced-motion travel is skippable and mounts only the chosen environment.
 ctx=b.new_context(viewport={'width':1440,'height':950});page=ctx.new_page();page.route('**/api/platform/**',api);page.route('**/assets/config.js',api);page.goto(BASE+'/#aurevia');page.locator('.campus-map').wait_for();page.locator('.campus-sidebar button').filter(has_text='Orb Plaza').click();page.get_by_role('button',name='Enter Location →',exact=True).click();page.get_by_role('dialog',name='Travelling in AUREVIA').wait_for();page.get_by_role('button',name='Skip travel',exact=True).click();page.locator('.aurevia-world canvas').wait_for(timeout=60000);ctx.close();b.close();print('PASS skippable travel',flush=True)
