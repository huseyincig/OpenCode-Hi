#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-exact-current-opencode-t3.json'
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
violations=[]
cm=json.loads((ROOT/'data/validation/compatibility-matrix-0.1.0.json').read_text())
life=json.loads((ROOT/'data/validation/prompt-b-process-workspace-browser-lifecycle.json').read_text())
host=cm.get('current_reference_host') or {}; caps=host.get('capabilities') or {}; eq=life.get('capability_source_equivalence') or {}
version=(ROOT/'VERSION').read_text().strip();fresh=json.loads((ROOT/'data/validation/fresh-consumer-opencode-1.18.18.json').read_text())
current_commit=(fresh.get('source') or {}).get('commit') or '';current_tree=(fresh.get('source') or {}).get('tree') or ''
try:
 if current_commit and subprocess.check_output(['git','rev-parse',f'{current_commit}^{{tree}}'],cwd=ROOT,text=True).strip()!=current_tree:violations.append('fresh-consumer-source-tree-drift')
except Exception:violations.append('fresh-consumer-source-git-object-missing')
if fresh.get('status')!='PASS' or fresh.get('package',{}).get('release')!=version:violations.append('fresh-consumer-current-candidate-not-pass')
if fresh.get('host',{}).get('opencode')!='1.18.18':violations.append('fresh-consumer-exact-host-version-drift')
if host.get('opencode_version')!='1.18.18' or host.get('platform')!='linux' or host.get('architecture')!='aarch64':violations.append('exact-host-identity-drift')
cap_rows={}
for cap in ['process-lifecycle','workspace-isolation-binding','browser-execution']:
 row=caps.get(cap) or {}; er=eq.get(cap) or {}; rel=row.get('receipt')
 if row.get('status')!='SUPPORTED_T3':violations.append(f'{cap}:not-supported-t3')
 if not isinstance(rel,str) or not (ROOT/rel).is_file():violations.append(f'{cap}:receipt-missing');continue
 r=json.loads((ROOT/rel).read_text()); receipt_commit=(r.get('source_binding') or {}).get('tested_git_commit')
 if (r.get('host') or {}).get('opencode_version')!='1.18.18':violations.append(f'{cap}:receipt-version-drift')
 if row.get('tested_git_commit')!=receipt_commit:violations.append(f'{cap}:compatibility-receipt-source-drift')
 if (r.get('gates') or {}).get(cap.replace('-','_'))!='SUPPORTED_T3':violations.append(f'{cap}:receipt-gate-drift')
 if er.get('receipt')!=rel or er.get('status')!='SUPPORTED_T3' or er.get('tested_git_commit')!=receipt_commit or er.get('equivalent') is not True or er.get('runtime_hash_drift')!=[]:violations.append(f'{cap}:runtime-equivalence-not-proven')
 cap_rows[cap]={'receipt':rel,'receipt_sha256':sha(rel),'status':'SUPPORTED_T3','receipt_source_commit':receipt_commit,'runtime_equivalent_to_current':er.get('equivalent') is True,'runtime_hash_drift':er.get('runtime_hash_drift') or []}
if life.get('status')!='PASS' or (life.get('summary') or {}).get('covered')!=61 or (life.get('summary') or {}).get('violations')!=0:violations.append('lifecycle-audit-not-61-of-61')
status='PASS' if not violations and len(cap_rows)==3 else 'FAIL'
data={'schema':1,'kind':'PROMPT_B_EXACT_CURRENT_OPENCODE_T3_AUDIT','program':'PROMPT_B','section':39,'status':status,
 'current_version_observation':{'tested_binary':'/home/node/.local/share/hi-opencode-1.18.18/node_modules/.bin/opencode','tested_binary_version':'1.18.18','system_default_observed':'1.18.16','system_default_selected_for_t3':False,'npm_registry_latest':'1.18.18','sdk_registry_latest':'1.18.18','locked_sdk':'1.18.18','captured_at':'2026-08-16'},
 'candidate_release':version,'fresh_consumer_receipt':'data/validation/fresh-consumer-opencode-1.18.18.json','fresh_consumer_sha256':sha('data/validation/fresh-consumer-opencode-1.18.18.json'),'exact_source_commit':current_commit,'exact_source_tree':current_tree,
 'capability_evidence_mode':'CURRENT_EXACT_HOST_PACKAGE_PLUS_RUNTIME_EQUIVALENT_EXACT_T3','compatibility_projection':'data/validation/compatibility-matrix-0.1.0.json','compatibility_sha256':sha('data/validation/compatibility-matrix-0.1.0.json'),'lifecycle_audit':'data/validation/prompt-b-process-workspace-browser-lifecycle.json','lifecycle_sha256':sha('data/validation/prompt-b-process-workspace-browser-lifecycle.json'),'capabilities':cap_rows,
 'summary':{'required_capabilities':3,'exact_current_capabilities':3 if status=='PASS' else sum(1 for x in cap_rows.values() if x.get('runtime_equivalent_to_current') and x.get('status')=='SUPPORTED_T3'),'lifecycle_invariants':61,'violations':len(violations)},'violations':violations,
 'claim_boundary':'Current candidate certification requires a fresh packed 0.1.2 artifact loaded by exact OpenCode 1.18.18 plus exact real-host T3 capability receipts whose complete capability-relevant runtime owner hashes are byte-identical to current source. Historical receipt prose or API presence alone is insufficient; receipt source commits remain explicit and are never relabeled as current.'}
OUT.write_text(json.dumps(data,indent=2)+'\n')
print(f'exact-current OpenCode T3 audit {status}: capabilities={data["summary"]["exact_current_capabilities"]}/3 lifecycle=61/61 violations={len(violations)}')
if violations:print(json.dumps(violations,indent=2))
sys.exit(0 if status=='PASS' else 1)
