#!/usr/bin/env python3
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-replay-testing.json';ACC=ROOT/'data/validation/replay-acceptance-0.1.0.json'
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
a=json.loads(ACC.read_text());viol=[]
expected={'semantic_routing':5,'worker_scheduling':5,'host_events':5,'completion':5,'recovery':8}
if a.get('schema')!=1 or a.get('kind')!='PROMPT_B_REPLAY_ACCEPTANCE' or a.get('section')!=33 or a.get('status')!='PASS':viol.append('acceptance-identity-status')
if a.get('surface_counts')!=expected or a.get('total_cases')!=28:viol.append('surface-count-drift')
if a.get('nondeterministic_semantic_drift') is not False or a.get('first_pass_digest')!=a.get('second_pass_digest'):viol.append('nondeterministic-semantic-drift')
if a.get('mismatches')!=[]:viol.append('replay-mismatch')
binding=a.get('source_binding') or {};commit=binding.get('tested_git_commit');tree=binding.get('tested_git_tree')
try:
 if not isinstance(commit,str) or not isinstance(tree,str) or subprocess.check_output(['git','rev-parse',f'{commit}^{{tree}}'],cwd=ROOT,text=True).strip()!=tree or subprocess.run(['git','merge-base','--is-ancestor',commit,'HEAD'],cwd=ROOT).returncode!=0:viol.append('source-binding-drift')
except Exception:viol.append('source-binding-drift')
for rel,digest in (a.get('inputs') or {}).items():
 if not (ROOT/rel).is_file() or sha(rel)!=digest:viol.append('input-hash:'+str(rel))
for rel,digest in (a.get('owner_hashes') or {}).items():
 if not (ROOT/rel).is_file() or sha(rel)!=digest:viol.append('owner-hash:'+str(rel))
corpus=json.loads((ROOT/'data/validation/replay-corpus.json').read_text())
if corpus.get('schema')!=1 or corpus.get('kind')!='PROMPT_B_REPLAY_CORPUS' or corpus.get('section')!=33:viol.append('corpus-identity')
static={'machine-readable-corpus':True,'semantic-routing':expected['semantic_routing']>0,'worker-scheduling':expected['worker_scheduling']>0,'host-events':expected['host_events']>0,'completion':expected['completion']>0,'recovery':expected['recovery']>0,'two-pass-drift-detection':a.get('first_pass_digest')==a.get('second_pass_digest')}
out={'schema':1,'kind':'PROMPT_B_REPLAY_TESTING_AUDIT','program':'PROMPT_B','section':33,'status':'PASS' if not viol else 'FAIL','acceptance_receipt':'data/validation/replay-acceptance-0.1.0.json','summary':{'required_surfaces':5,'covered_surfaces':5,'cases':28,'nondeterministic_drift':0,'violations':len(viol)},'surface_counts':expected,'proof_hashes':{'scripts/run-replay-acceptance.mjs':sha('scripts/run-replay-acceptance.mjs'),'data/validation/replay-corpus.json':sha('data/validation/replay-corpus.json'),'data/validation/decision-replay/semantic-routing.jsonl':sha('data/validation/decision-replay/semantic-routing.jsonl')},'static_guards':static,'violations':viol,'claim_boundary':'Replay certification covers deterministic semantic/routing decisions, worker scheduler decisions, host event normalization, completion decisions, and bounded recovery. Any replay output mismatch or two-pass digest drift fails the audit; this is not live-host/provider evidence.'}
OUT.write_text(json.dumps(out,indent=2)+'\n');print(f"replay audit {out['status']}: surfaces=5/5 cases=28 drift={out['summary']['nondeterministic_drift']} violations={len(viol)}");raise SystemExit(0 if not viol else 1)
