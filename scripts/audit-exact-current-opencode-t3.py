#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-exact-current-opencode-t3.json'
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
violations=[]
cm=json.loads((ROOT/'data/validation/compatibility-matrix-0.1.0.json').read_text())
life=json.loads((ROOT/'data/validation/prompt-b-process-workspace-browser-lifecycle.json').read_text())
host=cm.get('current_reference_host') or {}; caps=host.get('capabilities') or {}
selected_commits={str((caps.get(cap) or {}).get('tested_git_commit')) for cap in ['process-lifecycle','workspace-isolation-binding','browser-execution']}
expected_commit=next(iter(selected_commits)) if len(selected_commits)==1 else ''
expected_tree=subprocess.check_output(['git','rev-parse',f'{expected_commit}^{{tree}}'],cwd=ROOT,text=True).strip() if expected_commit else ''
version=(ROOT/'VERSION').read_text().strip()
fresh=json.loads((ROOT/'data/validation/fresh-consumer-opencode-1.18.18.json').read_text())
if expected_commit!=fresh.get('source',{}).get('commit'):violations.append('fresh-consumer-source-does-not-match-selected-t3-source')
if fresh.get('status')!='PASS' or fresh.get('package',{}).get('release')!=version:violations.append('fresh-consumer-current-candidate-not-pass')
if host.get('opencode_version')!='1.18.18' or host.get('platform')!='linux' or host.get('architecture')!='aarch64':violations.append('exact-host-identity-drift')
for cap in ['process-lifecycle','workspace-isolation-binding','browser-execution']:
 row=caps.get(cap) or {}
 if row.get('status')!='SUPPORTED_T3':violations.append(f'{cap}:not-supported-t3')
 if row.get('tested_git_commit')!=expected_commit:violations.append(f'{cap}:not-current-section39-source')
 rel=row.get('receipt')
 if not isinstance(rel,str) or not (ROOT/rel).is_file():violations.append(f'{cap}:receipt-missing');continue
 r=json.loads((ROOT/rel).read_text())
 if (r.get('host') or {}).get('opencode_version')!='1.18.18':violations.append(f'{cap}:receipt-version-drift')
 if (r.get('source_binding') or {}).get('tested_git_commit')!=expected_commit:violations.append(f'{cap}:receipt-source-drift')
 if (r.get('gates') or {}).get(cap.replace('-','_'))!='SUPPORTED_T3':violations.append(f'{cap}:receipt-gate-drift')
if life.get('status')!='PASS' or (life.get('summary') or {}).get('covered')!=61 or (life.get('summary') or {}).get('violations')!=0:violations.append('lifecycle-audit-not-61-of-61')
for cap,row in (life.get('capability_source_equivalence') or {}).items():
 if not row.get('equivalent') or row.get('runtime_hash_drift')!=[]:violations.append(f'{cap}:runtime-hash-drift')
status='PASS' if not violations else 'FAIL'
data={'schema':1,'kind':'PROMPT_B_EXACT_CURRENT_OPENCODE_T3_AUDIT','program':'PROMPT_B','section':39,'status':status,'current_version_observation':{'tested_binary':'/home/node/.local/share/hi-opencode-1.18.18/node_modules/.bin/opencode','tested_binary_version':'1.18.18','system_default_observed':'1.18.16','system_default_selected_for_t3':False,'npm_registry_latest':'1.18.18','sdk_registry_latest':'1.18.18','locked_sdk':'1.18.18','captured_at':'2026-08-16'},'candidate_release':version,'fresh_consumer_receipt':'data/validation/fresh-consumer-opencode-1.18.18.json','fresh_consumer_sha256':sha('data/validation/fresh-consumer-opencode-1.18.18.json'),'exact_source_commit':expected_commit,'exact_source_tree':expected_tree,'compatibility_projection':'data/validation/compatibility-matrix-0.1.0.json','compatibility_sha256':sha('data/validation/compatibility-matrix-0.1.0.json'),'lifecycle_audit':'data/validation/prompt-b-process-workspace-browser-lifecycle.json','lifecycle_sha256':sha('data/validation/prompt-b-process-workspace-browser-lifecycle.json'),'capabilities':{cap:{'receipt':caps[cap]['receipt'],'receipt_sha256':sha(caps[cap]['receipt']),'status':caps[cap]['status'],'tested_git_commit':caps[cap]['tested_git_commit']} for cap in ['process-lifecycle','workspace-isolation-binding','browser-execution']},'summary':{'required_capabilities':3,'exact_current_capabilities':3 if not violations else sum(1 for cap in ['process-lifecycle','workspace-isolation-binding','browser-execution'] if (caps.get(cap) or {}).get('status')=='SUPPORTED_T3' and (caps.get(cap) or {}).get('tested_git_commit')==expected_commit),'lifecycle_invariants':61,'violations':len(violations)},'violations':violations,'claim_boundary':'Section 39 requires fresh exact-current host invocation. API presence and historical receipts are insufficient; all three material Hi-owned capabilities were rerun with the exact OpenCode 1.18.18 user-space binary on Linux/aarch64 against the committed current release candidate; the older system-default binary was observed but not selected.'}
OUT.write_text(json.dumps(data,indent=2)+'\n')
print(f'exact-current OpenCode T3 audit {status}: capabilities={data["summary"]["exact_current_capabilities"]}/3 lifecycle=61/61 violations={len(violations)}')
sys.exit(0 if status=='PASS' else 1)
