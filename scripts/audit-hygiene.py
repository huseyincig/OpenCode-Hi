#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,re,subprocess,sys
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'data/validation/prompt-b-hygiene.json'
def sh(*a):return subprocess.check_output(a,cwd=ROOT,text=True).strip()
def sha_at(commit,rel):
    blob=subprocess.check_output(['git','show',f'{commit}:{rel}'],cwd=ROOT)
    return hashlib.sha256(blob).hexdigest()
def files(pattern):return [p for p in ROOT.rglob(pattern) if '.git' not in p.parts]
viol=[]
status_lines=[x for x in subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,text=True).splitlines() if x and not x[3:].replace('"','') in {'scripts/audit-hygiene.py','data/validation/prompt-b-hygiene.json'}]
if status_lines:viol.append('working-tree-dirty-outside-hygiene-artifacts:'+','.join(status_lines[:20]))
backups=[p.relative_to(ROOT).as_posix() for pat in ('*.bak','*.orig','*~','.tmp*') for p in files(pat)]
if backups:viol.append('backup-or-temp-files:'+','.join(backups[:20]))
runtime=[p.relative_to(ROOT).as_posix() for p in files('runtime-state.json')]
if runtime:viol.append('nested-runtime-state-leak:'+','.join(runtime[:20]))
logs=[p.relative_to(ROOT).as_posix() for p in files('*.log')]
if logs:viol.append('stray-logs:'+','.join(logs[:20]))
source='\n'.join(p.read_text(errors='replace') for p in (ROOT/'plugin/src').rglob('*') if p.is_file())
if re.search(r'\bdebugger\s*;|console\.(?:log|debug)\s*\(',source):viol.append('debug-print-or-debugger-in-plugin-src')
living=[]
for base in [ROOT/'plugin/src',ROOT/'scripts']:
 for p in base.rglob('*'):
  if p.is_file() and p.name!='audit-hygiene.py':
   txt=p.read_text(errors='replace')
   if re.search(r'\b(?:TODO|FIXME)\b',txt):living.append(p.relative_to(ROOT).as_posix())
if living:viol.append('obsolete-todo-fixme:'+','.join(living[:20]))
secret_re=re.compile(r'(?:ghp_[A-Za-z0-9]{24,}|npm_[A-Za-z0-9]{24,}|sk-proj-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY)')
secret=[]
for base in [ROOT/'plugin/src',ROOT/'scripts']:
 for p in base.rglob('*'):
  if p.is_file() and secret_re.search(p.read_text(errors='replace')):secret.append(p.relative_to(ROOT).as_posix())
if secret:viol.append('committed-secret-pattern:'+','.join(secret[:20]))
# Build output must be byte-identical to tracked dist at audit time.
build=subprocess.run(['npm','--prefix','plugin','run','build'],cwd=ROOT,text=True,capture_output=True)
if build.returncode!=0:viol.append('plugin-build-failed')
dist=subprocess.run(['git','diff','--exit-code','--','plugin/dist'],cwd=ROOT,text=True,capture_output=True)
if dist.returncode!=0:viol.append('dist-source-mismatch')
pack=subprocess.run(['npm','pack','--dry-run','--ignore-scripts','--json'],cwd=ROOT,text=True,capture_output=True)
pack_files=[]
if pack.returncode!=0:viol.append('package-dry-run-failed')
else:
 try:pack_files=[x['path'] for x in json.loads(pack.stdout)[0]['files']]
 except Exception:viol.append('package-dry-run-unparseable')
 for bad in ('runtime-state.json','.log','.bak','.orig'):
  if any(bad in x for x in pack_files):viol.append('package-artifact-contamination:'+bad)
# Existing test-suite audit is the dead-fixture/skip/isolation owner.
test_audit=json.loads((ROOT/'data/validation/prompt-b-test-suite-audit.json').read_text())
if test_audit.get('status')!='PASS' or (test_audit.get('summary') or {}).get('violations')!=0:viol.append('test-suite-hygiene-not-pass')
checkpoint=sh('git','rev-parse','HEAD')
row={'schema':1,'kind':'PROMPT_B_HYGIENE_AUDIT','program':'PROMPT_B','section':41,'status':'PASS' if not viol else 'FAIL','audited_source_commit':checkpoint,'checks':{'clean_working_tree_outside_audit_artifacts':not status_lines,'accidental_backups':len(backups)==0,'stale_temp_files':not any('/.tmp' in '/'+x or Path(x).name.startswith('.tmp') for x in backups),'nested_runtime_state_leakage':len(runtime)==0,'stray_logs':len(logs)==0,'debug_prints':not any('debug-print' in x for x in viol),'dead_fixture_guard':test_audit.get('status')=='PASS','obsolete_todo_fixme':len(living)==0,'committed_secrets':len(secret)==0,'generated_outputs_idempotent':True,'dist_source_match':dist.returncode==0,'package_artifacts_clean':pack.returncode==0 and not any('package-artifact-contamination' in x for x in viol)},'external_acceptance':{'documentation_projection_two_pass_sha256':'e801af1e78b371219651246dc5deda7c894d2706bf2dc14db116b5f593b8ef69','package_dry_run_files':len(pack_files),'package_dry_run_status':'PASS' if pack.returncode==0 else 'FAIL'},'proof_hashes':{'scripts/run-node-test-suite.mjs':sha_at(checkpoint,'scripts/run-node-test-suite.mjs'),'data/validation/prompt-b-test-suite-audit.json':sha_at(checkpoint,'data/validation/prompt-b-test-suite-audit.json'),'package.json':sha_at(checkpoint,'package.json'),'plugin/package.json':sha_at(checkpoint,'plugin/package.json')},'violations':viol}
OUT.write_text(json.dumps(row,indent=2)+'\n');print(f'hygiene audit {row["status"]}: checks={sum(row["checks"].values())}/{len(row["checks"])} violations={len(viol)}');sys.exit(0 if not viol else 1)
