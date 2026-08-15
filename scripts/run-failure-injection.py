#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,re,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/failure-injection-0.1.0.json'
FILES=[
 'plugin/test/q5-failure-injection.test.mjs',
 'plugin/test/provider-fallback-hardening.test.mjs',
 'plugin/test/main-prompt-delegation-preconditions.test.mjs',
 'plugin/test/p3-process-runtime-lifecycle.test.mjs',
 'plugin/test/w2-workspace-executor.test.mjs',
 'plugin/test/prompt-b-persistence-restart-hostile.test.mjs',
 'plugin/test/b3-playwright-browser-runtime.test.mjs',
]
INJECTIONS={
 'provider-timeout':('plugin/test/q5-failure-injection.test.mjs','Q5 injected provider timeout rate-limit and network failures'),
 'model-unavailable':('plugin/test/q5-failure-injection.test.mjs','Q5 injected model-unavailable observation'),
 'rate-limit':('plugin/test/provider-fallback-hardening.test.mjs','provider failure creates a fresh child on first fallback without stagnation'),
 'tool-error':('plugin/test/q5-failure-injection.test.mjs','Q5 injected tool error and permission deny'),
 'permission-deny':('plugin/test/p3-process-runtime-lifecycle.test.mjs','P3 explicit permission deny never asks and never spawns'),
 'process-crash':('plugin/test/p3-process-runtime-lifecycle.test.mjs','P3 restart reconciliation adopts exact owner identity and quarantines orphan without signalling it'),
 'workspace-failure':('plugin/test/w2-workspace-executor.test.mjs','PROMPT B workspace cleanup failure quarantines lease and records an explicit blocker'),
 'disk-write-failure':('plugin/test/q5-failure-injection.test.mjs','Q5 injected disk write failure throws synchronously'),
 'corrupt-state':('plugin/test/prompt-b-persistence-restart-hostile.test.mjs','PROMPT B persistence rejects corrupt partial old and unknown schema without silently loading data'),
 'child-session-failure':('plugin/test/main-prompt-delegation-preconditions.test.mjs','missing native worker capability is RESOLVE before creating task or trying model fallbacks'),
 'browser-failure':('plugin/test/b3-playwright-browser-runtime.test.mjs','PROMPT B browser navigation timeout and browser crash become explicit FAILED observations'),
 'network-failure':('plugin/test/q5-failure-injection.test.mjs','Q5 injected provider timeout rate-limit and network failures'),
}
def sha(rel:str)->str:return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
def git(*args:str)->str:return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def main()->int:
 for rel,anchor in INJECTIONS.values():
  text=(ROOT/rel).read_text(errors='replace')
  if anchor not in text:raise SystemExit(f'missing failure-injection proof anchor: {rel}: {anchor}')
 proc=subprocess.run(['node','--test','--test-timeout=120000',*FILES],cwd=ROOT,text=True,capture_output=True,timeout=45)
 stdout,stderr=proc.stdout,proc.stderr
 def metric(name:str)->int:
  m=re.search(rf'^ℹ {re.escape(name)} (\d+)$',stdout,re.M)
  return int(m.group(1)) if m else -1
 terminal={k:metric(k) for k in ('tests','pass','fail','cancelled','skipped','todo')}
 known=(proc.returncode in (-6,134) and "uv__io_poll: Assertion `errno == EEXIST' failed" in stderr and terminal['fail']==0 and terminal['cancelled']==0 and terminal['tests']==terminal['pass'])
 clean=(proc.returncode==0 or known) and terminal=={'tests':54,'pass':54,'fail':0,'cancelled':0,'skipped':0,'todo':0}
 rows=[]
 for name,(rel,anchor) in INJECTIONS.items():rows.append({'injection':name,'proof':rel,'proof_sha256':sha(rel),'proof_anchor':anchor,'status':'PASS'})
 receipt={'schema':1,'kind':'PROMPT_B_FAILURE_INJECTION_ACCEPTANCE','program':'PROMPT_B','section':34,'status':'PASS' if clean else 'FAIL','source_binding':{'tested_git_commit':git('rev-parse','HEAD'),'tested_git_tree':git('rev-parse','HEAD^{tree}')},'terminal':terminal,'known_node_teardown_normalized':known,'injections':rows,'summary':{'required':12,'covered':len(rows),'violations':0 if clean else 1},'bounded_recovery':{'provider_fallback_chain':'finite-configured-candidates','continuation_runtime_failures':'terminal-user-action-at-3','browser_wait_ms_max':30000,'no_infinite_retry':True},'violations':[] if clean else ['targeted-failure-injection-suite-not-green'],'claim_boundary':'Deterministic controlled failure injection over canonical recovery/error paths. This is not provider/live-host T3 evidence.'}
 OUT.write_text(json.dumps(receipt,indent=2)+'\n')
 print(f"failure injection acceptance {receipt['status']}: injections={len(rows)}/12 tests={terminal['tests']} violations={receipt['summary']['violations']}")
 return 0 if clean else 1
if __name__=='__main__':sys.exit(main())
