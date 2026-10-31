// Isolated visual fixture harness; never an application route or an authentication bypass.
import {build} from 'esbuild';
import {mkdir,writeFile,readFile,readdir,cp,symlink,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const repo=resolve(process.argv[2]||'/workspace/pathd-app'),out='/workspace/.onboarding/pathd-component-preview';
await mkdir(out,{recursive:true});
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Companions from ${JSON.stringify(join(repo,'src/components/companion/Companions.tsx'))};createRoot(document.getElementById('root')).render(<main className="mx-auto max-w-6xl px-5 pb-28 pt-8"><Companions/></main>);`,loader:'tsx',resolveDir:repo},bundle:true,jsx:'automatic',alias:{'@':join(repo,'src'),react:join(repo,'node_modules/react'),'react-dom':join(repo,'node_modules/react-dom')},outfile:join(out,'app.js')});
const cssRoot=join(repo,'.next/static/css'),css=(await readdir(cssRoot,{recursive:true})).filter(f=>f.endsWith('.css'));
await writeFile(join(out,'app.css'),(await Promise.all(css.map(f=>readFile(join(cssRoot,f),'utf8')))).join('\n'));
await mkdir(join(out,'_next/static'),{recursive:true});await cp(join(repo,'.next/static/media'),join(out,'_next/static/media'),{recursive:true});
try{await lstat(join(out,'companions'));}catch(e){if(e.code!=='ENOENT')throw e;await symlink(join(repo,'public/companions'),join(out,'companions'));}
await writeFile(join(out,'index.html'),'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><title>Local PATHD component preview — sample data</title></head><body style="background:#fffbf4;color:#49355f;--font-figtree:figtree;--font-marcellus:marcellus;font-family:figtree,sans-serif"><div id="root"></div><script src="/app.js"></script></body></html>');
console.log('Fixture component bundle prepared at '+out+'. Serve locally on port3001; browser_remaining.py supplies explicitly synthetic API data. No authentication settings changed.');
