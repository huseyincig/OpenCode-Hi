#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,re,sys,subprocess
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-test-suite-audit.json'
violations=[];rows=[]
def sha(rel): return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
def add(name,owner,oa,proof,pa):
    op,pp=ROOT/owner,ROOT/proof
    if not op.is_file(): violations.append(f'{name}:missing-owner:{owner}'); return
    if not pp.is_file(): violations.append(f'{name}:missing-proof:{proof}'); return
    ot,pt=op.read_text(errors='replace'),pp.read_text(errors='replace')
    if oa not in ot: violations.append(f'{name}:owner-anchor-drift:{oa}')
    if pa not in pt: violations.append(f'{name}:proof-anchor-drift:{pa}')
    rows.append({'invariant':name,'owner':owner,'owner_sha256':sha(owner),'owner_anchor':oa,'proof':proof,'proof_sha256':sha(proof),'proof_anchor':pa})
add('harness-invocation','plugin/package.json','node ../scripts/run-node-test-suite.mjs','scripts/run-node-test-suite.mjs',"filter(x=>x.endsWith('.test.mjs')).sort()")
add('mocks-do-not-own-t3','plugin/src/contracts/host-capability.ts','Runtime support requires an active-host observation; T3/REAL_HOST_ACCEPTANCE belongs only','plugin/test/host-capability-contract.test.mjs','without upgrading verification')
add('fixture-realism','scripts/generate-compatibility-matrix.py','External receipts remain canonical evidence','data/validation/prompt-b-process-workspace-browser-lifecycle.json','"covered": 61')
add('false-positive-resistance','scripts/run-node-test-suite.mjs','const knownLibuvTeardown=','data/validation/test-harness-isolation-0.1.0.json','SIGABRT is normalized only with exact uv__io_poll EEXIST signature')
add('skipped-tests-audited','.github/workflows/release-readiness.yml','os: [ubuntu-latest, windows-latest]','tests/test_hi.py',"pytest.skip('symlink privilege varies on Windows')")
add('timeout-handling','scripts/run-node-test-suite.mjs',"'--test-timeout=120000'",'scripts/run-node-test-suite.mjs','timeout:300000')
add('test-isolation','scripts/run-node-test-suite.mjs','OPENCODE_HI_STATE_DIR','data/validation/test-harness-isolation-0.1.0.json','"home_hi_state_delta": 0')
add('cwd-independence','plugin/test/native-skill-catalog.test.mjs','fileURLToPath(import.meta.url)','data/validation/test-harness-isolation-0.1.0.json','"repo_root_cwd"')
add('home-xdg-isolation','scripts/run-node-test-suite.mjs','XDG_STATE_HOME','data/validation/test-harness-isolation-0.1.0.json','"isolation_env"')
add('platform-assumptions','.github/workflows/release-readiness.yml','windows-latest','plugin/test/real-hosted-release-transaction.test.mjs','mandatory Ubuntu release-readiness job')
add('deterministic-behavior','scripts/run-node-test-suite.mjs','.sort().map','plugin/test/decision-replay-corpus.test.mjs','Q1 decision replay corpora are tests-only inputs, not runtime configuration')
# Global hostile/static guards.
runner=(ROOT/'scripts/run-node-test-suite.mjs').read_text()
hostcap=(ROOT/'plugin/src/contracts/host-capability.ts').read_text()
node_tests='\n'.join(p.read_text(errors='replace') for p in (ROOT/'plugin/test').glob('*.test.mjs'))
py_tests=(ROOT/'tests/test_hi.py').read_text(errors='replace')
compat=json.loads((ROOT/'data/validation/compatibility-matrix-0.1.0.json').read_text())
harness=json.loads((ROOT/'data/validation/test-harness-isolation-0.1.0.json').read_text())
static={
 'no_test_only_or_todo': not bool(re.search(r'\b(?:test|describe|it)\.(?:only|todo)\s*\(',node_tests)),
 'conditional_skips_explicit': node_tests.count("skip:process.platform==='win32'")==1 and py_tests.count("pytest.skip('symlink privilege varies on Windows')")==4,
 'runner_sorted_inventory': ".filter(x=>x.endsWith('.test.mjs')).sort()" in runner,
 'runner_bounded_timeout': "'--test-timeout=120000'" in runner and 'timeout:300000' in runner,
 'runner_temp_state_cleanup': 'OPENCODE_HI_STATE_DIR' in runner and 'XDG_STATE_HOME' in runner and 'rmSync(sandbox,{recursive:true,force:true})' in runner,
 'libuv_exception_strict': "result?.signal==='SIGABRT'" in runner and 'fail 0' in runner and 'cancelled 0' in runner and 'uv__io_poll' in runner,
 'runtime_never_assigns_real_host_acceptance': "verification_level:'REAL_HOST_ACCEPTANCE'" not in hostcap,
 'current_t3_receipt_backed': all((compat['current_reference_host']['capabilities'][k].get('status')=='SUPPORTED_T3' and subprocess.run(['git','merge-base','--is-ancestor','5210a12a7b607e0c9048749fa74a4c8b801cd924',str(compat['current_reference_host']['capabilities'][k].get('tested_git_commit') or '')],cwd=ROOT).returncode==0) for k in ('process-lifecycle','workspace-isolation-binding','browser-execution')),
 'home_pollution_delta_zero': harness.get('canonical_suite_observation',{}).get('home_hi_state_delta')==0,
 'cwd_dual_run_green': all((harness.get('cwd_dual_run',{}).get(k,{}).get('pass')==17 and harness.get('cwd_dual_run',{}).get(k,{}).get('fail')==0) for k in ('plugin_cwd','repo_root_cwd')),
}
for k,v in static.items():
    if not v: violations.append('static:'+k)
# Conditional skips are accepted because the same suite is mandatory on Ubuntu and Windows, and the skipped cases require platform privilege unavailable on some Windows runners.
skips={'python_windows_symlink_privilege':4,'node_windows_posix_hosted_release':1,'silent_only_or_todo':0}
closed=[
 {'id':'cwd-sensitive-test-root','fix':'Repository fixture roots are derived from import.meta.url rather than process.cwd(); exact same 17 tests pass from plugin cwd and repository root.'},
 {'id':'test-suite-real-home-state-pollution','fix':'Canonical Node harness redirects Hi/XDG state and cache roots to a temporary suite sandbox and removes it; measured HOME Hi-state delta is zero.'},
 {'id':'unbounded-test-runner-timeout','fix':'Native per-test timeout is 120s and suite process timeout is 300s; hangs cannot block CI indefinitely.'},
 {'id':'mock-runtime-self-promoted-t3','fix':'Owned runtime capabilities require active-host health and report OBSERVED only; REAL_HOST_ACCEPTANCE/T3 remains external exact-receipt truth.'},
]
status='PASS' if len(rows)==11 and not violations else 'FAIL'
data={'schema':1,'kind':'PROMPT_B_TEST_SUITE_ADVERSARIAL_AUDIT','program':'PROMPT_B','section':30,'status':status,'invariants':rows,'violations':violations,'summary':{'required':11,'covered':len(rows),'violations':len(violations)},'static_guards':static,'conditional_skips':skips,'harness_acceptance':'data/validation/test-harness-isolation-0.1.0.json','closed_defects':closed,'claim_boundary':'Controlled unit/integration tests prove local semantics only. A green mock is never T3. Exact host support is promoted solely by external exact-source OpenCode acceptance receipts selected through the compatibility projection.'}
OUT.write_text(json.dumps(data,indent=2)+'\n')
print(f'test suite audit {status}: covered={len(rows)}/11 violations={len(violations)}')
if violations: print('\n'.join(violations))
sys.exit(0 if status=='PASS' else 1)
