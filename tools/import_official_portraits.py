"""Import explicitly approved original files. Crop/encode only: never generate or retouch faces.
Local developer utility; no network, Git, database, or deployment operations.
Usage: python tools/import_official_portraits.py --sheet /path/team.png --mila /path/mila.png --pathd-root /workspace/pathd-app
Requires Pillow. Run only after reviewing the original uploaded source files.
"""
from pathlib import Path
import argparse,hashlib,json,re,shutil
from PIL import Image,ImageOps
NAMES=['naomi','angelo','oliver','simone','chloe','reggie']
def load(path):
 image=ImageOps.exif_transpose(Image.open(path));image.load();return image.convert('RGB')
def optimized(image,path):
 image=image.copy();image.thumbnail((768,768),Image.Resampling.LANCZOS);image.save(path,'WEBP',quality=94,method=6)
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--sheet',type=Path,required=True);parser.add_argument('--mila',type=Path,required=True);parser.add_argument('--pathd-root',type=Path);args=parser.parse_args()
 root=Path(__file__).resolve().parents[1];out=root/'public/assets/img/companions';out.mkdir(parents=True,exist_ok=True)
 archive=root/'assets/references/official-portraits';archive.mkdir(parents=True,exist_ok=True)
 sheet=load(args.sheet);mila=load(args.mila)
 if sheet.width<600 or sheet.height<400 or abs(sheet.width/sheet.height-1.5)>.15:raise ValueError('Use the approved three-column/two-row source sheet at its original resolution.')
 if mila.width<400 or mila.height<600:raise ValueError('Use the approved full-resolution MILA source.')
 sources={}
 for label,path,image in [('dream-team',args.sheet,sheet),('mila',args.mila,mila)]:
  digest=hashlib.sha256(path.read_bytes()).hexdigest();sources[label]=digest
  # Preserve full decoded source pixels losslessly; omit EXIF/location metadata from Git/public assets.
  source=archive/f'{label}-{digest[:12]}.png'
  if not source.exists():image.save(source,'PNG')
 for index,name in enumerate(NAMES):
  column,row=index%3,index//3
  box=(round(column*sheet.width/3)+6,round(row*sheet.height/2)+6,round((column+1)*sheet.width/3)-6,round((row+1)*sheet.height/2)-6)
  optimized(sheet.crop(box),out/f'{name}.webp')
 # Fixed founder-reviewed face framing from the supplied business-casual portrait; full source is retained above.
 side=round(mila.width*.70);left=round(mila.width*.16);top=round(mila.height*.04)
 optimized(mila.crop((left,top,left+side,top+side)),out/'mila.webp')
 full=mila.copy();full.thumbnail((1024,1536),Image.Resampling.LANCZOS);full.save(out/'mila-full.webp','WEBP',quality=94,method=6)
 registry=root/'_src/shared/companions.js';text=registry.read_text()
 for i,name in enumerate(NAMES,1):text=text.replace(f"portrait:'persona-{i}.png'",f"portrait:'companions/{name}.webp'")
 text=re.sub(r"(id:'mila',[^\n]*?portrait:)null",r"\1'companions/mila.webp'",text);registry.write_text(text)
 names=json.dumps(NAMES)
 for file in [root/'_src/build.mjs',root/'_src/visuals.mjs']:
  text=file.read_text().replace('persona-${i + 1}.png','companions/${'+names+'[i]}.webp').replace('persona-${k}.png','companions/${'+names+'[k-1]}.webp').replace('persona-${i}.png','companions/${'+names+'[i-1]}.webp');file.write_text(text)
 if args.pathd_root:
  pathd=args.pathd_root.resolve()
  if not (pathd/'src/components/companion').is_dir():raise ValueError('PATHD root must be the separate PATHD application checkout.')
  destination=pathd/'public/companions';destination.mkdir(parents=True,exist_ok=True);shutil.copy2(out/'mila.webp',destination/'mila.webp')
  assert hashlib.sha256((destination/'mila.webp').read_bytes()).digest()==hashlib.sha256((out/'mila.webp').read_bytes()).digest()
 (archive/'SOURCE_MANIFEST.json').write_text(json.dumps({'approved_source_sha256':sources,'method':'exact source crops, no image generation or face retouching','system_ids':NAMES+['mila']},indent=2)+'\n')
 print('Imported approved portraits. Rebuild, inspect crops and rerun browser checks before review-branch delivery.')
if __name__=='__main__':main()
