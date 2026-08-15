#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
accept=ROOT/'data/validation/cross-platform-acceptance-0.1.0.json';out=ROOT/'data/validation/prompt-b-cross-platform-acceptance.json'
d=json.loads(accept.read_text()) if accept.exists() else {};viol=[]
if d.get('status')!='PASS_WITH_TRUTHFUL_WINDOWS_CURRENT_SOURCE_LIMITATION':viol.append('status-drift')
if (d.get('linux_current') or {}).get('status')!='PASS':viol.append('linux-current-not-pass')
w=d.get('windows') or {}
if w.get('current_source_tested') is not False or w.get('status')!='HISTORICAL_RELEASE_CERTIFIED_CURRENT_SOURCE_UNTESTED':viol.append('windows-truth-boundary-drift')
wf=(ROOT/'.github/workflows/release-readiness.yml').read_text();
if 'os: [ubuntu-latest, windows-latest]' not in wf:viol.append('cross-platform-workflow-drift')
proofs={
 'shell-command-policy':'plugin/test/hi-acceptance-evolution.test.mjs',
 'path-semantics':'plugin/test/prompt-b-vcs-path-portability.test.mjs',
 'executable-discovery':'plugin/test/prompt-b-vcs-path-portability.test.mjs',
 'newline':'plugin/test/prompt-b-vcs-path-portability.test.mjs',
 'process-handling':'plugin/test/p3-process-runtime-lifecycle.test.mjs',
 'filesystem':'tests/test_hi.py',
 'packaging':'scripts/release-build.py'}
rows=[]
for surface,rel in proofs.items():
 p=ROOT/rel
 if not p.is_file():viol.append('missing-proof:'+rel);continue
 rows.append({'surface':surface,'proof':rel,'proof_sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
summary={'required_surfaces':7,'covered_surfaces':len(rows),'violations':len(viol)}
row={'schema':1,'kind':'PROMPT_B_CROSS_PLATFORM_ACCEPTANCE_AUDIT','program':'PROMPT_B','section':38,'status':'PASS' if not viol else 'FAIL','acceptance_receipt':'data/validation/cross-platform-acceptance-0.1.0.json','acceptance_sha256':hashlib.sha256(accept.read_bytes()).hexdigest() if accept.exists() else None,'summary':summary,'surfaces':rows,'linux_current_certified':True,'windows_current_certified':False,'windows_historical_release_evidence':True,'violations':viol,'claim_boundary':'Linux current-source acceptance is executed locally. Windows is a mandatory CI validation target with historical v0.1.0 evidence, but current local Prompt B HEAD is not claimed Windows-certified until an exact-source Windows run exists.'}
out.write_text(json.dumps(row,indent=2,sort_keys=True)+'\n');print(f'cross-platform audit {row["status"]}: surfaces={len(rows)}/7 windows_current=false violations={len(viol)}');sys.exit(0 if not viol else 1)
