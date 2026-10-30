"""Build immutable complete upload parts (<=100 files each), SQL/config ZIPs and SHA-256 manifests.
No network, Git write, deployment or production operation is performed.
"""
import argparse, hashlib, json, subprocess, zipfile
from pathlib import Path
VERSION='AELIO_v1.0.1'

def digest(data):return hashlib.sha256(data).hexdigest()
def files(root):
    names=subprocess.check_output(['git','-C',str(root),'ls-files','--cached','--others','--exclude-standard','-z']).decode().split('\0')
    out=[]
    for name in sorted(set(n for n in names if n)):
        p=root/name
        if not p.exists():continue
        if p.is_symlink() or not p.resolve().is_relative_to(root.resolve()):raise RuntimeError('Symlink/outside-checkout file refused: '+name)
        if any(s in {'node_modules','.git','.next','.open-next','.wrangler','__pycache__','.pytest_cache','var'} for s in p.relative_to(root).parts):raise RuntimeError('Cache/data file selected: '+name)
        if p.name.startswith('.env') and p.name!='.env.example':raise RuntimeError('Non-template environment file refused')
        if p.is_file():out.append(name)
    return out

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--aelio',type=Path,required=True);parser.add_argument('--pathd',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);a=parser.parse_args()
    repos={'AELIO':a.aelio.resolve(),'PATHD':a.pathd.resolve()}
    if a.output.exists():raise SystemExit('Delivery output exists; refusing to overwrite a previous package')
    # Continuity inventories are project files; create them before collecting final ZIP membership.
    removed={label:subprocess.check_output(['git','-C',str(root),'diff','--name-only','--diff-filter=D'],text=True).splitlines() for label,root in repos.items()}
    changed={label:subprocess.check_output(['git','-C',str(root),'status','--short'],text=True).splitlines() for label,root in repos.items()}
    for label,root in repos.items():
        inventory=sorted(set(files(root)+['RELEASE_MANIFEST.md']))
        (root/'RELEASE_MANIFEST.md').write_text('# '+VERSION+' complete repository inventory\n\nRepository: '+label+'. Local candidate, not deployed/published. The GitHub parts together contain the COMPLETE AELIO and PATHD projects, not just changed files.\n\nThe baseline was unversioned at AELIO platform level. PATHD is package 0.1.1. Extract all parts together, then upload each project directory to its separate repository. Dependencies, build caches, credentials and temporary/data files are excluded. public/ is required committed AELIO deployment output.\n\n## Remove obsolete destination files\n\n'+('\n'.join('- '+n for n in removed[label]) or 'None.')+'\n\n## Changed/added/removed paths\n\n```text\n'+'\n'.join(changed[label])+'\n```\n\n## Complete file inventory\n\n'+ '\n'.join('- '+n for n in inventory)+'\n\nEvery packaged file has a SHA-256 in the external FILE_MANIFEST.json and per-part manifest. ZIP hashes are in SHA256SUMS.txt. This document is included; its hash is calculated by the packaging tool after generation.\n')
    selected=[(label+'/'+name,root/name) for label,root in repos.items() for name in files(root)]
    manifest=[{'path':name,'size':p.stat().st_size,'sha256':digest(p.read_bytes())} for name,p in selected]
    a.output.mkdir(parents=True)
    instructions=f'''{VERSION} — COMPLETE LOCAL DELIVERY, NOT DEPLOYED

1. Verify ZIP SHA-256 checksums in SHA256SUMS.txt.
2. Extract ALL GitHub parts into the SAME empty directory. Do not flatten nested paths.
3. Merge AELIO/ folders across parts and merge PATHD/ folders across parts. Every project file occurs exactly once.
4. Upload CONTENTS of AELIO/ to vintagebyjaja/aelio-live; upload CONTENTS of PATHD/ to vintagebyjaja/pathd-app.
   Do not upload PATHD into AELIO. DELIVERY_INFO/ is packaging metadata, not application code.
5. Remove destination files listed as removed in each RELEASE_MANIFEST.md; a web upload does not delete them.
6. Use a review branch with automatic production deployment paused. A watched branch upload may trigger existing automation.
7. Read AELIO/config/SETUP.md and PROJECT_HANDOFF.md before configuring or deploying anything.
8. SQL.zip contains ordered additive migrations and explicit instructions; no production SQL was executed here.
9. Config.zip contains empty secret templates and configuration instructions. Use existing Supabase/R2; never upload filled secret files.

Local tests do NOT verify real Supabase users, provider output, deployed Cloudflare bindings or a production migration.
The owner performs all configuration, uploads and any eventual deployment. Paid plans remain closed.
'''
    (a.output/'UPLOAD_INSTRUCTIONS.txt').write_text(instructions)
    (a.output/'FILE_MANIFEST.json').write_text(json.dumps({'version':VERSION,'complete_repositories':True,'removed':removed,'files':manifest},indent=2)+'\n')
    chunks=[selected[i:i+98] for i in range(0,len(selected),98)];names=[]
    for i,chunk in enumerate(chunks,1):
        name=f'{VERSION}_GitHub_Part_{i:02d}.zip';names.append(name)
        with zipfile.ZipFile(a.output/name,'x',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
            for entry,p in chunk:z.write(p,entry)
            z.writestr(f'DELIVERY_INFO/Part_{i:02d}_MANIFEST.json',json.dumps({'version':VERSION,'part':i,'parts':len(chunks),'project_files':len(chunk),'files':[m for m in manifest if m['path'] in {n for n,_ in chunk}]},indent=2))
            z.writestr(f'DELIVERY_INFO/Part_{i:02d}_UPLOAD.txt',instructions)
    sql_readme='''ORDERED SQL DELIVERY — nothing here was run on production.

Use the existing xkpzabgpesishxcluxkp Supabase project. Back up, inspect applied migration history and test staging first.
AELIO migrations, in order:
1. 20261028000001_platform_identity.sql (historical prerequisite; skip if already applied)
2. 20261029000002_messaging_platform.sql
3. 20261029000003_engine_postgres.sql

The first migration replaces a historically same-named signup trigger; the second restores compatible PATHD provisioning.
Pause signup during the migration window and validate both products on staging before use. Existing identities/profile data are not dropped.
Expose public and core through the API; do not expose aelio_engine. RLS/grants protect owners and restrict service-only recovery/roles/RPCs.
Existing PATHD 0001/0002/0003 files are supplied for reference, NOT for blind rerun. Their types/extensions/storage prerequisites may already exist.
Do not load demo seed.sql in production. Do not create another Supabase project.
OPTIONAL_ADMIN/founder-bootstrap.sql defaults to refusing execution until existing UUIDs are supplied and matched. It does not create accounts.
TESTS/test_messaging.sql uses synthetic users inside rolled-back transactions; run only on a disposable test/staging copy.

Legacy engine data is not automatically copied: review tools/import_engine_sqlite.py and the identity-plan/import CLI. Preserve source IDs, backups and row fingerprints.
Rollback application/configuration separately; keep additive tables/data. Never drop Auth users or data as an automatic rollback. A database restore is a separate explicit owner-controlled operation.
Read SETUP.md for Auth settings, exact callback paths, environment names and complete real-service verification checklist.
'''
    name=VERSION+'_SQL.zip';names.append(name)
    with zipfile.ZipFile(a.output/name,'x',zipfile.ZIP_DEFLATED) as z:
        z.writestr('README_SQL_ORDER.txt',sql_readme)
        for p in sorted((a.aelio/'supabase/migrations').glob('*.sql')):z.write(p,'AELIO_ORDERED/'+p.name)
        for p in sorted((a.pathd/'supabase/migrations').glob('*.sql')):z.write(p,'PATHD_EXISTING_REFERENCE/'+p.name)
        z.write(a.aelio/'supabase/tests/test_messaging.sql','TESTS/test_messaging.sql');z.write(a.aelio/'config/founder-bootstrap.sql','OPTIONAL_ADMIN/founder-bootstrap.sql');z.write(a.aelio/'config/SETUP.md','SETUP.md')
    name=VERSION+'_Config.zip';names.append(name)
    with zipfile.ZipFile(a.output/name,'x',zipfile.ZIP_DEFLATED) as z:
        for p in (a.aelio/'config').glob('*'):
            if p.is_file():z.write(p,'AELIO/config/'+p.name)
        for relative in ['wrangler.jsonc','Dockerfile.engine','cloudflare/aelio-engine-worker/wrangler.jsonc','cloudflare/aelio-engine-worker/package.json']:
            z.write(a.aelio/relative,'AELIO/'+relative)
        for relative in ['.env.example','wrangler.jsonc','open-next.config.ts']:z.write(a.pathd/relative,'PATHD/'+relative)
        z.writestr('README_CONFIG.txt','Templates only; no secret values. Read AELIO/config/SETUP.md. Existing infrastructure must be reused. Actual PATHD Worker name and real service readiness are unverified. No deployment or runtime configuration change is performed by these files.\n')
    # Verify CRC, membership, uniqueness and per-ZIP limits after writing.
    seen=[]
    for name in names:
        with zipfile.ZipFile(a.output/name) as z:
            assert z.testzip() is None,name
            assert len(z.infolist())<=100,(name,len(z.infolist()))
            if '_GitHub_' in name:seen.extend(n for n in z.namelist() if n.startswith(('AELIO/','PATHD/')))
    assert len(seen)==len(set(seen))==len(selected)
    assert set(seen)=={name for name,_ in selected}
    sums=[digest((a.output/name).read_bytes())+'  '+name for name in names+['FILE_MANIFEST.json','UPLOAD_INSTRUCTIONS.txt']]
    (a.output/'SHA256SUMS.txt').write_text('\n'.join(sums)+'\n')
    print(json.dumps({'version':VERSION,'project_files':len(selected),'github_parts':len(chunks),'zip_files':names,'verified':True},indent=2))
if __name__=='__main__':main()
