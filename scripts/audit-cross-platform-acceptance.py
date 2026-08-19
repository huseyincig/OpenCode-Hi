#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
version=(ROOT/'VERSION').read_text(encoding='utf-8').strip();accept=ROOT/f'data/validation/cross-platform-acceptance-{version}.json';out=ROOT/'data/validation/prompt-b-cross-platform-acceptance.json'
def sh(*args):return subprocess.check_output(args,cwd=ROOT,text=True,stderr=subprocess.DEVNULL).strip()
d=json.loads(accept.read_text(encoding='utf-8')) if accept.exists() else {};viol=[]
source=(d.get('source_binding') or {}).get('tested_git_commit'); tree=(d.get('source_binding') or {}).get('tested_git_tree')
if d.get('status')!='PASS':viol.append('status-drift')
if not isinstance(source,str) or len(source)!=40:viol.append('source-commit-missing')
else:
 try:
  if sh('git','rev-parse',f'{source}^{{tree}}')!=tree:viol.append('source-tree-drift')
  if subprocess.run(['git','merge-base','--is-ancestor',source,'HEAD'],cwd=ROOT).returncode!=0:viol.append('source-not-ancestor')
 except Exception:viol.append('source-git-object-missing')
ga=d.get('github_actions') or {};u=ga.get('ubuntu') or {};w=ga.get('windows') or {}
if ga.get('workflow')!='Release Readiness' or ga.get('status')!='completed' or ga.get('conclusion')!='success':viol.append('workflow-not-success')
for name,j in [('ubuntu',u),('windows',w)]:
 if not isinstance(j.get('job_id'),int) or j.get('status')!='completed' or j.get('conclusion')!='success':viol.append(name+'-job-not-success')
required_steps={'Product build, architecture lint, Node acceptance, docs parity','Packed public documentation','Python product acceptance','Build deterministic release candidate','Verify release archives are readable'}
for name,j in [('ubuntu',u),('windows',w)]:
 steps={x.get('name'):x.get('conclusion') for x in (j.get('steps') or [])}
 if any(steps.get(x)!='success' for x in required_steps):viol.append(name+'-required-step-not-success')
def valid_node_summary(value):
 if not isinstance(value,dict):return False
 try: tests=int(value.get('tests'));passed=int(value.get('pass'));failed=int(value.get('fail'));skipped=int(value.get('skipped'))
 except Exception:return False
 return tests>0 and failed==0 and passed>=0 and skipped>=0 and passed+skipped==tests
if not valid_node_summary(u.get('node_summary')):viol.append('ubuntu-node-summary-drift')
if not valid_node_summary(w.get('node_summary')):viol.append('windows-node-summary-drift')
wf=(ROOT/'.github/workflows/release-readiness.yml').read_text(encoding='utf-8')
if 'os: [ubuntu-latest, windows-latest]' not in wf or 'fetch-depth: 0' not in wf:viol.append('cross-platform-workflow-drift')
material_prefixes=('plugin/src/','plugin/dist/','skills/')
material_exact={'package.json','package-lock.json','plugin/package.json','plugin/package-lock.json','VERSION','.gitattributes','scripts/native_plugin_setup.py'}
material_drift=[]
if isinstance(source,str) and len(source)==40:
 try:
  changed=[x for x in sh('git','diff','--name-only',f'{source}..HEAD').splitlines() if x]
  material_drift=[x for x in changed if x in material_exact or x.startswith(material_prefixes)]
 except Exception: material_drift=['<git-diff-unavailable>']
if material_drift:viol.extend('post-ci-material-drift:'+x for x in material_drift)
proofs={'shell-command-policy':'plugin/test/hi-acceptance-evolution.test.mjs','path-semantics':'plugin/test/prompt-b-vcs-path-portability.test.mjs','executable-discovery':'plugin/test/prompt-b-vcs-path-portability.test.mjs','newline':'plugin/test/prompt-b-vcs-path-portability.test.mjs','process-handling':'plugin/test/p3-process-runtime-lifecycle.test.mjs','filesystem':'tests/test_hi.py','packaging':'scripts/release-build.py'}
rows=[]
for surface,rel in proofs.items():
 p=ROOT/rel
 if not p.is_file():viol.append('missing-proof:'+rel);continue
 rows.append({'surface':surface,'proof':rel,'proof_sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
summary={'required_surfaces':7,'covered_surfaces':len(rows),'violations':len(viol)}
row={'schema':1,'kind':'PROMPT_B_CROSS_PLATFORM_ACCEPTANCE_AUDIT','program':'PROMPT_B','section':38,'status':'PASS' if not viol else 'FAIL','acceptance_receipt':f'data/validation/cross-platform-acceptance-{version}.json','acceptance_sha256':hashlib.sha256(accept.read_bytes()).hexdigest() if accept.exists() else None,'source_checkpoint':{'commit':source,'tree':tree},'github_actions':{'run_id':ga.get('run_id'),'ubuntu_job_id':u.get('job_id'),'windows_job_id':w.get('job_id'),'conclusion':ga.get('conclusion')},'summary':summary,'surfaces':rows,'linux_current_certified':not viol,'windows_current_certified':not viol,'windows_historical_release_evidence':True,'post_ci_material_drift':material_drift,'violations':viol,'claim_boundary':'Current-source Windows/Linux certification is bound to the exact external CI source checkpoint. Subsequent evidence-only commits may consume it only while runtime/package material paths remain byte-identical to that checkpoint.'}
out.write_text(json.dumps(row,indent=2,sort_keys=True)+'\n',encoding='utf-8',newline='\n')
print(f'cross-platform audit {row["status"]}: surfaces={len(rows)}/7 windows_current={row["windows_current_certified"]} violations={len(viol)}')
sys.exit(0 if not viol else 1)
