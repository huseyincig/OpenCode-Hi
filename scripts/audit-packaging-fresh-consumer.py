#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-packaging-fresh-consumer.json'
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
def row(inv,owner,oa,proof,pa):
    ok=(ROOT/owner).is_file() and (ROOT/proof).is_file() and oa in (ROOT/owner).read_text(errors='replace') and pa in (ROOT/proof).read_text(errors='replace')
    return {'invariant':inv,'status':'PASS' if ok else 'FAIL','owner':owner,'owner_sha256':sha(owner) if (ROOT/owner).is_file() else None,'owner_anchor':oa,'proof':proof,'proof_sha256':sha(proof) if (ROOT/proof).is_file() else None,'proof_anchor':pa}
a=json.loads((ROOT/'data/validation/fresh-consumer-opencode-1.18.18.json').read_text())
rows=[
 row('pack','.github/workflows/npm-publish.yml','npm pack --dry-run --json --ignore-scripts','data/validation/fresh-consumer-opencode-1.18.18.json','"installed_from_tarball": true'),
 row('fresh-temp-consumer','scripts/run-fresh-consumer-acceptance.py',"TemporaryDirectory(prefix='hi-b26-consumer-')",'data/validation/fresh-consumer-opencode-1.18.18.json','"project": "<temp>/consumer/project"'),
 row('install-packed-artifact','scripts/run-fresh-consumer-acceptance.py',"npm','install','--ignore-scripts'",'data/validation/fresh-consumer-opencode-1.18.18.json','"pack_install": true'),
 row('configure-packed-artifact','scripts/run-fresh-consumer-acceptance.py',"'reconfigure',str(project),'--primary-mode','manager'",'data/validation/fresh-consumer-opencode-1.18.18.json','"setup_reconfigure": true'),
 row('start-exact-opencode','scripts/run-fresh-consumer-acceptance.py',"opencode_bin,'serve'",'data/validation/fresh-consumer-opencode-1.18.18.json','"exact_host_version": true'),
 row('execute-material-hi-runtime','scripts/run-fresh-consumer-acceptance.py',"'/experimental/tool/ids?'",'data/validation/fresh-consumer-opencode-1.18.18.json','"hi_tool_count":'),
 row('no-hidden-dev-dependency','package.json','"@opencode-ai/sdk": "1.18.18"','data/validation/fresh-consumer-opencode-1.18.18.json','"consumer_resolution": true'),
 row('no-repository-relative-runtime-path','scripts/run-fresh-consumer-acceptance.py',"'no_source_tree_in_server_log'",'data/validation/fresh-consumer-opencode-1.18.18.json','"no_source_tree_in_server_log": true'),
]
checks=a.get('checks') or {};runtime=a.get('material_runtime') or {};pkg=a.get('package') or {}
static={
 'acceptance_pass':a.get('status')=='PASS',
 'exact_host':a.get('host',{}).get('opencode')=='1.18.18' and a.get('host',{}).get('platform')=='linux' and a.get('host',{}).get('architecture')=='aarch64' and bool(a.get('host',{}).get('binary_sha256')),
 'all_acceptance_checks':bool(checks) and all(checks.values()),
 'hi_material_surface':runtime.get('hi_tool_count',0)>=10 and {'hi_doctor','hi_status','hi_task_start'}<=set(runtime.get('hi_tools') or []),
 'session_material_path':(runtime.get('session') or {}).get('created') is True and (runtime.get('session') or {}).get('version')=='1.18.18',
 'consumer_entrypoint':str(pkg.get('resolved_entrypoint','')).startswith('file://<temp>/consumer/node_modules/opencode-hi/'),
 'provider_boundary_truthful':(runtime.get('provider_run') or {}).get('attempted') is False and 'Provider-backed model execution is opportunistic' in a.get('claim_boundary',''),
}
viol=[]
for r in rows:
    if r['status']!='PASS':viol.append(f"{r['invariant']}:anchor-drift")
for k,v in static.items():
    if not v:viol.append(f'static:{k}')
out={'schema':1,'kind':'PROMPT_B_PACKAGING_FRESH_CONSUMER_ADVERSARIAL_AUDIT','program':'PROMPT_B','section':26,'status':'PASS' if not viol else 'FAIL','summary':{'required':8,'covered':sum(r['status']=='PASS' for r in rows),'violations':len(viol)},'invariants':rows,'static_guards':static,'acceptance_receipt':'data/validation/fresh-consumer-opencode-1.18.18.json','claim_boundary':'Exact OpenCode 1.18.18 fresh-consumer package/runtime acceptance without source-tree resolution. Isolated HOME intentionally had no provider inventory, so provider-backed chat/model execution is not claimed by this receipt.','violations':viol}
OUT.write_text(json.dumps(out,indent=2)+'\n')
print(f"packaging/fresh consumer audit {out['status']}: covered={out['summary']['covered']}/8 violations={len(viol)}")
for v in viol:print(v)
raise SystemExit(0 if not viol else 1)
