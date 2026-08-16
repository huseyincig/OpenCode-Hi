#!/usr/bin/env python3
from __future__ import annotations
import json,re,subprocess,sys,tarfile,tempfile
from pathlib import Path,PurePosixPath
ROOT=Path(__file__).resolve().parents[1]
POLICY=ROOT/'data/documentation-ownership.json'
STALE=(
 r'SOURCE-REUSE-MATRIX',r'docs/engineering-constitution/',r'FINAL-SYSTEM-CERTIFICATION\.md',
 r'ARCHITECTURE-REALITY-MAP\.md',r'npm bootstrap publication is not yet complete',
 r'registry package oluşana kadar',r'release-status-0\.1\.0'
)
def links(text:str):
 for m in re.finditer(r'!?\[[^\]]*\]\(([^)]+)\)',text):
  target=m.group(1).strip().split()[0].strip('<>')
  if not target or target.startswith(('#','http://','https://','mailto:')): continue
  yield target.split('#',1)[0]
def norm(base:PurePosixPath,target:str)->str|None:
 parts=[]
 for part in (base.parent/PurePosixPath(target)).parts:
  if part in ('','.'):continue
  if part=='..':
   if not parts:return None
   parts.pop()
  else:parts.append(part)
 return '/'.join(parts)
def main()->int:
 version=(ROOT/'VERSION').read_text(encoding='utf-8').strip()
 policy=json.loads(POLICY.read_text(encoding='utf-8'))
 required=[x['path'] for x in policy.get('public_documents',[])]
 errors=[]
 with tempfile.TemporaryDirectory(prefix='hi-pack-docs-') as td:
  cp=subprocess.run(['npm','pack','--ignore-scripts','--json','--pack-destination',td],cwd=ROOT,text=True,capture_output=True)
  if cp.returncode!=0:
   print(cp.stdout+cp.stderr);return cp.returncode
  meta=json.loads(cp.stdout)[0]
  if meta.get('name')!='opencode-hi' or meta.get('version')!=version:errors.append(f'pack identity drift: {meta.get("name")}@{meta.get("version")} != opencode-hi@{version}')
  tgz=Path(td)/meta['filename']
  with tarfile.open(tgz,'r:gz') as tf:
   members={m.name:m for m in tf.getmembers() if m.isfile()}
   packed={name.removeprefix('package/'):name for name in members if name.startswith('package/')}
   for rel in required:
    if rel not in packed: errors.append('missing public document in npm package: '+rel)
   readme_member=members.get('package/README.md')
   if not readme_member: errors.append('missing package README.md')
   else:
    payload=tf.extractfile(readme_member).read()
    if payload!=(ROOT/'README.md').read_bytes():errors.append('packed README bytes differ from release source README')
   for rel in required:
    member_name=packed.get(rel)
    if not member_name:continue
    data=tf.extractfile(members[member_name]).read().decode('utf-8','replace')
    for pat in STALE:
     if re.search(pat,data,re.I):errors.append(f'stale public reference in {rel}: {pat}')
    for target in links(data):
     dest=norm(PurePosixPath(rel),target)
     if dest is None:errors.append(f'public link escapes package root: {rel} -> {target}')
     elif dest not in packed:errors.append(f'broken packed public link: {rel} -> {target} ({dest})')
  summary={'name':meta.get('name'),'version':meta.get('version'),'filename':meta.get('filename'),'integrity':meta.get('integrity'),'shasum':meta.get('shasum'),'file_count':len(meta.get('files') or []),'public_documents':len(required),'violations':len(errors)}
  print(json.dumps(summary,indent=2))
 if errors:
  for e in errors:print('- '+e)
  return 1
 print('packed public documentation PASS')
 return 0
if __name__=='__main__':sys.exit(main())
