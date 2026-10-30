"""Immutable v1.0.2 source-only update relative to the preserved v1.0.1 manifest.
No network, deployment, Git mutation, database operation or credential export.
"""
import argparse,hashlib,json,subprocess,zipfile
from pathlib import Path
VERSION='AELIO_v1.0.2'
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--baseline',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 if a.output.exists():raise SystemExit('Refusing to overwrite an existing version')
 baseline=json.loads(a.baseline.read_text());old={v['path'].removeprefix('AELIO/'):v for v in baseline['files'] if v['path'].startswith('AELIO/')}
 def current():
  names=subprocess.check_output(['git','-C',str(a.root),'ls-files','--cached','--others','--exclude-standard','-z']).decode().split('\0')
  return sorted({n for n in names if n and (a.root/n).is_file()})
 def allowed(n):
  if n.startswith("deliveries/"):return False
  if n.startswith('public/') and not n.startswith('public/assets/dream/'):return False
  parts=Path(n).parts
  if any(x in parts for x in ('node_modules','.git','__pycache__','.pytest_cache','.next','.open-next','.wrangler','var')):raise SystemExit('Cache/data selected: '+n)
  if (a.root/n).is_symlink() or not (a.root/n).resolve().is_relative_to(a.root.resolve()):raise SystemExit('Unsafe source path')
  if Path(n).name.startswith('.env') and Path(n).name!='.env.example':raise SystemExit('Filled environment file refused')
  return True
 def changed():return [n for n in current() if allowed(n) and (n not in old or sha((a.root/n).read_bytes())!=old[n]['sha256'])]
 removed=[n for n in old if not (a.root/n).exists()]
 # Write continuity inventory before hashing its final bytes.
 paths=changed();paths=sorted(set(paths+['RELEASE_MANIFEST.md']))
 (a.root/'RELEASE_MANIFEST.md').write_text('# '+VERSION+' source update manifest\n\nDelta baseline: preserved AELIO_v1.0.1 delivery (not the old Git main). Apply that complete candidate first, then this source update, and run npm ci / npm run build. No previous ZIP was overwritten.\n\nThe migration Git branch preserves Git history and contains cumulative v1.0.1 + v1.0.2 work; update ZIPs contain only changed source/assets. Generated public HTML/JS/CSS and unchanged files are excluded. The original marketing homepage remains at /explore/.\n\n## Files added or modified\n\n'+''.join('- '+n+'\n' for n in paths)+'\n## Deletions since v1.0.1\n\n'+ ('\n'.join('- '+n for n in removed) if removed else 'None.')+'\n\n## SQL and configuration\n\nRun only appearance migration04 after the existing prerequisites; config/DREAM_BOX.md explains headers, provider boundaries and manual build/rollout. Existing Auth/R2 secrets are unchanged. No production SQL, deployment or main merge is part of this delivery. GitHub write access is verified for the user-authorized development branch codex/migration-v1.0.2.\n\nValidation:31 JavaScript tests, six local integration scenarios, TypeScript/build/public checks and responsive browser contracts. See docs/releases/AELIO_v1.0.2_VALIDATION.md for actual boundaries and unverified external services. SHA-256 file and archive hashes are in the external delivery manifests.\n')
 paths=changed();records=[{'path':n,'size':(a.root/n).stat().st_size,'sha256':sha((a.root/n).read_bytes())} for n in paths]
 a.output.mkdir(parents=True)
 instructions='''AELIO_v1.0.2 SOURCE UPDATE — NOT A COMPLETE REPOSITORY

Base required: the complete AELIO_v1.0.1 candidate. This delta cannot replace the original unmodified Git main by itself. The preserved local migration Git branch contains the complete cumulative work.
Extract all GitHub ZIP parts, if split, over the AELIO project root, preserving relative paths. Each ZIP contains at most100 files. No deletions are needed since v1.0.1. The older v1.0.1 migration still removes its two legacy Firebase runtime modules as documented there.
The GitHub ZIP intentionally excludes generated HTML/JS/CSS and unchanged files. Run npm ci, npm run build, npm run typecheck, npm test and npm run check. Do not upload source into public/. The preserved marketing homepage builds at /explore/; Dream Box builds at /.
SQL.zip contains only migration04 and execution instructions. Apply manually in staging after prerequisites, never create another Supabase project. Config.zip contains changed headers and the new setup notes; no real keys.
If manually uploading to GitHub, use codex/migration-v1.0.2 and preserve main. Disable all automatic Cloudflare branch/preview deployments before any push/upload. No workflow in the source automatically deploys, but dashboard integrations are unverified.
PATHD remains at its already-preserved v1.0.1 implementation; this update does not change its code or subscriptions.
The user alone controls any eventual production rollout. Local fixture tests do not verify live services.
'''
 names=[]
 for i in range(0,len(paths),98):
  chunk=paths[i:i+98];part=i//98+1;name=VERSION+('_GitHub.zip' if len(paths)<=98 else '_GitHub_Part'+str(part)+'.zip');names.append(name)
  with zipfile.ZipFile(a.output/name,'x',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
   for n in chunk:z.write(a.root/n,n)
   z.writestr('DELIVERY_INFO/UPLOAD.txt',instructions);z.writestr('DELIVERY_INFO/MANIFEST.json',json.dumps([r for r in records if r['path'] in chunk],indent=2))
 for kind,files in [('SQL',['supabase/migrations/20261029000004_appearance.sql']),('Config',['config/DREAM_BOX.md','_headers'])]:
  name=VERSION+'_'+kind+'.zip';names.append(name)
  with zipfile.ZipFile(a.output/name,'x',zipfile.ZIP_DEFLATED) as z:
   for n in files:z.write(a.root/n,n)
   z.writestr('README.txt',('Run migration04 ONLY after the previously applied migrations01,02,03. It adds appearance columns; existing RLS remains. Back up and validate staging first. No production SQL was run. New installations must follow the v1.0.1 prerequisites; do not initialize a second project.\n' if kind=='SQL' else 'Read config/DREAM_BOX.md. Merge these changed headers with existing settings. Existing Auth/R2 secrets are unchanged; no new environment key is required. Build before owner-managed upload.\n'))
 manifest={'version':VERSION,'base_version':'AELIO_v1.0.1','complete_repository':False,'baseline_manifest_sha256':sha(a.baseline.read_bytes()),'deletions':removed,'files':records}
 (a.output/'FILE_MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n');(a.output/'UPLOAD_INSTRUCTIONS.txt').write_text(instructions);(a.output/'DELETIONS.txt').write_text('\n'.join(removed) if removed else 'No deletions relative to AELIO_v1.0.1.\n')
 (a.output/'SHA256SUMS.txt').write_text(''.join(sha((a.output/n).read_bytes())+'  '+n+'\n' for n in names))
 outer=VERSION+'_Delivery.zip'
 with zipfile.ZipFile(a.output/outer,'x',zipfile.ZIP_DEFLATED) as z:
  for n in names+['FILE_MANIFEST.json','UPLOAD_INSTRUCTIONS.txt','DELETIONS.txt','SHA256SUMS.txt']:z.write(a.output/n,n)
 for n in a.output.iterdir():n.chmod(0o644)
 a.output.chmod(0o755)
 # CRC, file-count, source-byte checks and exact union membership.
 selected=[]
 for n in names:
  with zipfile.ZipFile(a.output/n) as z:
   assert z.testzip() is None
   if '_GitHub' in n:
    assert len(z.namelist())<=100
    for entry in z.namelist():
     if not entry.startswith('DELIVERY_INFO/'):
      selected.append(entry);assert sha(z.read(entry))==sha((a.root/entry).read_bytes())
 assert sorted(selected)==paths and len(selected)==len(set(selected))
 print(json.dumps({'version':VERSION,'project_files':len(paths),'github_parts':(len(paths)+97)//98,'bundle':str(a.output/outer),'bundle_bytes':(a.output/outer).stat().st_size}))
if __name__=='__main__':main()
