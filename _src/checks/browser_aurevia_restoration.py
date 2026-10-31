import sys,os,json,time,uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from browser_fixtures import *
from playwright.sync_api import sync_playwright
OUT=Path(__file__).resolve().parents[2]/'docs/previews/restoration-v0.3';OUT.mkdir(parents=True,exist_ok=True)
for kind in ['mila','naomi','angelo','oliver','simone','chloe','reggie']:
 aid=str(uuid.uuid5(uuid.NAMESPACE_DNS,'aurevia-'+kind));cid=str(uuid.uuid5(uuid.NAMESPACE_DNS,'aurevia-thread-'+kind));agents.append({'id':aid,'kind':kind,'name':'MILA' if kind=='mila' else kind.title(),'subtitle':'Your companion'});threads.append({'id':cid,'title':agents[-1]['name'],'participants':[aid],'permanent_key':kind,'product':'aelio','appearance':{}});messages[cid]=[]
team=str(uuid.uuid5(uuid.NAMESPACE_DNS,'dream-team'));threads.append({'id':team,'title':'Dream Team','permanent_key':'dream-team','participants':[a['id']for a in agents if a['kind']in ['naomi','angelo','oliver','simone','chloe','reggie']],'product':'aelio','appearance':{}});messages[team]=[]
state={'residence':{'owner_id':A,'name':'My coastal residence','destination':'plaza','quality':'balanced'},'meetings':[]}
def api(route):
 p=route.request.url.split('/api/platform',1)[-1].split('?')[0]
 if p=='/aurevia':
  if route.request.method=='PATCH':state['residence'].update(route.request.post_data_json)
  return route.fulfill(content_type='application/json',body=json.dumps(state if route.request.method=='GET'else {'residence':state['residence']}))
 return mock(route)
with sync_playwright()as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for width in [1440,390]:
  state['residence']['destination']='plaza';ctx=browser.new_context(viewport={'width':width,'height':1050 if width==1440 else 900},reduced_motion='reduce')
  ctx.add_init_script("localStorage.setItem('aelio.auth',"+json.dumps(json.dumps({'access_token':'fixture-user','refresh_token':'fixture-refresh','expires_at':time.time()+3600,'user':{'id':A,'email':'local-sample@example.test'}}))+");")
  page=ctx.new_page();page.route('https://**/*',lambda r:r.abort());page.route('**/api/platform/**',api);page.route('**/assets/config.js',api)
  page.goto(os.environ.get('AELIO_BROWSER_BASE','http://127.0.0.1:8101')+'/#aurevia',wait_until='domcontentloaded');page.locator('.aurevia-scene[data-ready=true]').wait_for(timeout=60000)
  page.wait_for_timeout(500)
  page.locator('.aurevia-world').screenshot(path=str(OUT/f'plaza-arrival-{width}.png'))
  if width==1440:
   for shot in ['arrival','orb','arcade','coast']:
    page.get_by_label('Orb Plaza camera').select_option(shot);page.wait_for_timeout(200);page.locator('.aurevia-scene canvas').screenshot(path=str(OUT/f'canvas-{shot}.png'))
  page.get_by_label('Orb Plaza camera').select_option('coast');page.wait_for_timeout(1000);page.locator('.aurevia-world').screenshot(path=str(OUT/f'plaza-coast-{width}.png'))
  page.screenshot(path=str(OUT/f'plaza-ui-{width}.png'))
  page.get_by_role('button',name='↗ Return to Office',exact=True).click();page.locator('.aurevia-office-vista .aurevia-scene[data-ready=true]').wait_for(timeout=60000);page.wait_for_timeout(500)
  page.locator('.aurevia-office-vista').screenshot(path=str(OUT/f'office-render-{width}.png'));
  if width==1440:page.locator('.aurevia-office-vista canvas').screenshot(path=str(OUT/'canvas-office.png'))
  page.screenshot(path=str(OUT/f'office-ui-{width}.png'))
  ctx.close()
 browser.close()
