#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'data/validation/prompt-b-packaging-fresh-consumer.json'
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
pkg=json.loads((ROOT/'package.json').read_text());target=str((pkg.get('dependencies') or {}).get('@opencode-ai/sdk') or '').strip();peer=str((pkg.get('peerDependencies') or {}).get('@opencode-ai/plugin') or '').strip();viol=[];rows=[]
if not re.fullmatch(r'\d+\.\d+\.\d+',target) or peer!=target:viol.append('exact-host-target-pin-drift')
fresh_rel=f'data/validation/fresh-consumer-opencode-{target}.json';a=json.loads((ROOT/fresh_rel).read_text());runtime=a.get('material_runtime') or {};checks=a.get('checks') or {}
def row(name,owner,oa,proof,pa):
 op=ROOT/owner;pp=ROOT/proof
 if not op.is_file() or not pp.is_file():viol.append(f'{name}:missing-file');return
 ot=op.read_text(errors='replace');pt=pp.read_text(errors='replace')
 if oa not in ot:viol.append(f'{name}:owner-anchor-drift')
 if pa not in pt:viol.append(f'{name}:proof-anchor-drift')
 rows.append({'invariant':name,'owner':owner,'owner_sha256':sha(owner),'owner_anchor':oa,'proof':proof,'proof_sha256':sha(proof),'proof_anchor':pa,'status':'PASS'})
row('pack','scripts/run-fresh-consumer-acceptance.py',"'npm','pack'",fresh_rel,'"installed_from_tarball": true')
row('fresh-project-owned-consumer','scripts/run-fresh-consumer-acceptance.py',"WORK=AGENT_WORK/'acceptance'",fresh_rel,'"project": "<acceptance>/consumer/project"')
row('install-packed-artifact','scripts/run-fresh-consumer-acceptance.py',"'npm','install'",fresh_rel,'"pack_install": true')
row('normal-node-setup','scripts/run-fresh-consumer-acceptance.py',"'setup',str(bootstrap)",fresh_rel,'"node_setup": true')
row('start-exact-opencode','scripts/run-fresh-consumer-acceptance.py',"opencode_bin,'serve'",fresh_rel,'"exact_host_version": true')
row('execute-material-hi-runtime','scripts/run-fresh-consumer-acceptance.py',"'/experimental/tool/ids?'",fresh_rel,'"hi_tool_count": 32')
row('no-hidden-dev-dependency','package.json',f'"@opencode-ai/sdk": "{target}"',fresh_rel,'"consumer_resolution": true')
row('no-repository-relative-runtime-path','scripts/run-fresh-consumer-acceptance.py',"'no_source_tree_in_server_log'",fresh_rel,'"no_source_tree_in_server_log": true')
static={
 'exact_host':a.get('status')=='PASS' and (a.get('host') or {}).get('opencode')==target and (a.get('host') or {}).get('platform')=='linux' and (a.get('host') or {}).get('architecture')=='aarch64' and bool((a.get('host') or {}).get('binary_sha256')),
 'all_acceptance_checks':all(checks.values()),
 'hi_tools_exact':runtime.get('hi_tool_count')==32,
 'session_material_path':(runtime.get('session') or {}).get('created') is True and (runtime.get('session') or {}).get('version')==target,
 'node_setup_clean':checks.get('node_setup') is True and checks.get('node_setup_no_application_root_node_project') is True,
}
viol += [k for k,v in static.items() if not v]
out={'schema':1,'kind':'PROMPT_B_PACKAGING_FRESH_CONSUMER_ADVERSARIAL_AUDIT','program':'PROMPT_B','section':26,'status':'PASS' if not viol else 'FAIL','summary':{'required':8,'covered':sum(r['status']=='PASS' for r in rows),'violations':len(viol)},'invariants':rows,'static_guards':static,'acceptance_receipt':fresh_rel,'claim_boundary':f'Exact OpenCode {target} fresh-consumer package/runtime acceptance from a packed artifact, with the target derived from the exact root SDK/plugin pin. Host-load uses an isolated local packed wrapper while normal-user Node setup is independently exercised from the same artifact. Provider-backed chat is not claimed.','violations':viol}
OUT.write_text(json.dumps(out,indent=2)+'\n');print(f"packaging/fresh consumer audit {out['status']}: host={target} covered={len(rows)}/8 violations={len(viol)}")
sys.exit(0 if not viol else 1)
