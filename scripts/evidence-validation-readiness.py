#!/usr/bin/env python3
from __future__ import annotations
import json, os, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
RECEIPT=ROOT/'data/validation/cross-platform-acceptance-0.1.1.json'
MATERIAL_PREFIXES=('plugin/src/','plugin/dist/','skills/')
MATERIAL_EXACT={'package.json','package-lock.json','plugin/package.json','plugin/package-lock.json','VERSION','.gitattributes','scripts/native_plugin_setup.py'}

def sh(*args):
    return subprocess.check_output(args,cwd=ROOT,text=True,stderr=subprocess.DEVNULL).strip()

def result(ready:bool,reason:str):
    print(f'evidence_ready={str(ready).lower()}')
    print(f'evidence_reason={reason}')
    output=os.environ.get('GITHUB_OUTPUT')
    if output:
        with open(output,'a',encoding='utf-8',newline='\n') as f:
            f.write(f'ready={str(ready).lower()}\nreason={reason}\n')
    raise SystemExit(0)

if not RECEIPT.is_file(): result(False,'current cross-platform receipt missing')
try: data=json.loads(RECEIPT.read_text(encoding='utf-8'))
except Exception: result(False,'current cross-platform receipt unreadable')
source=(data.get('source_binding') or {}).get('tested_git_commit')
tree=(data.get('source_binding') or {}).get('tested_git_tree')
ga=data.get('github_actions') or {}
if data.get('status')!='PASS': result(False,'current cross-platform receipt is not PASS')
if not isinstance(source,str) or len(source)!=40: result(False,'receipt source commit missing')
try:
    if sh('git','rev-parse',f'{source}^{{tree}}')!=tree: result(False,'receipt source tree mismatch')
    if subprocess.run(['git','merge-base','--is-ancestor',source,'HEAD'],cwd=ROOT).returncode!=0: result(False,'receipt source is not an ancestor of HEAD')
    changed=[x for x in sh('git','diff','--name-only',f'{source}..HEAD').splitlines() if x]
except Exception: result(False,'receipt source Git objects unavailable')
material=[x for x in changed if x in MATERIAL_EXACT or x.startswith(MATERIAL_PREFIXES)]
if material: result(False,'material product drift after external CI source')
if ga.get('workflow')!='Release Readiness' or ga.get('status')!='completed' or ga.get('conclusion')!='success': result(False,'external CI workflow is not terminal success')
for name in ('ubuntu','windows'):
    job=ga.get(name) or {}
    if job.get('status')!='completed' or job.get('conclusion')!='success': result(False,f'{name} external CI job is not terminal success')
result(True,'exact-source external CI evidence is available and material product paths are unchanged')
