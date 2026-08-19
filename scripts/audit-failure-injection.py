#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'data/validation/prompt-b-failure-injection.json'; violations=[]
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
def text(rel):return (ROOT/rel).read_text(errors='replace')
accept_rel='data/validation/failure-injection-0.1.0.json';a=json.loads((ROOT/accept_rel).read_text())
required=['provider-timeout','model-unavailable','rate-limit','tool-error','permission-deny','process-crash','workspace-failure','disk-write-failure','corrupt-state','child-session-failure','browser-failure','network-failure']
if a.get('schema')!=1 or a.get('kind')!='PROMPT_B_FAILURE_INJECTION_ACCEPTANCE' or a.get('program')!='PROMPT_B' or a.get('section')!=34 or a.get('status')!='PASS':violations.append('acceptance-identity-status')
seen=[x.get('injection') for x in a.get('injections',[]) if isinstance(x,dict)]
if seen!=required:violations.append('injection-inventory')
if a.get('summary')!={'required':12,'covered':12,'violations':0}:violations.append('acceptance-summary')
terminal=a.get('terminal') or {}
if not isinstance(terminal.get('tests'),int) or terminal.get('tests',0)<=0 or terminal.get('pass')!=terminal.get('tests') or terminal.get('fail')!=0 or terminal.get('cancelled')!=0 or terminal.get('skipped')!=0 or terminal.get('todo')!=0:violations.append('targeted-terminal')
if not (a.get('bounded_recovery') or {}).get('no_infinite_retry'):violations.append('infinite-retry-guard')
for row in a.get('injections',[]):
 rel=row.get('proof');anchor=row.get('proof_anchor');expected=row.get('proof_sha256')
 if not isinstance(rel,str) or not (ROOT/rel).is_file():violations.append(f'missing-proof:{rel}');continue
 if sha(rel)!=expected:violations.append(f'proof-hash-drift:{rel}')
 if not isinstance(anchor,str) or anchor not in text(rel):violations.append(f'proof-anchor-drift:{row.get("injection")}')
guards={
 'provider-fallback-bounded':"for(const model of candidates)" in text('plugin/src/runtime/task/task-recovery-coordinator.ts') and 'worker.runtime-fallback.exhausted' in text('plugin/src/runtime/task/task-recovery-coordinator.ts'),
 'continuation-transport-bounded-at-3':"continuationFailures>=3" in text('plugin/src/runtime/continuation/evaluator.ts'),
 'permission-failure-nonretryable':"kind:'permission',stagnation:false,retryable:false" in text('plugin/src/runtime/worker/failure-classifier.ts'),
 'workspace-failure-quarantine':"status:'ORPHANED'" in text('plugin/src/runtime/workspace/runtime.ts') and "cleanup_state:'QUARANTINED'" in text('plugin/src/runtime/workspace/runtime.ts'),
 'process-failure-quarantine':"termination_reason:'restart-reconcile-error'" in text('plugin/src/runtime/process/runtime.ts'),
 'corrupt-state-fail-closed':'return[]' in text('plugin/src/runtime/state/persistence.ts') and 'lastLoadReport' in text('plugin/src/runtime/state/persistence.ts'),
 'browser-wait-bounded':'30000' in text('plugin/src/opencode/playwright-browser-adapter.ts'),
}
for k,v in guards.items():
 if not v:violations.append('static:'+k)
out={'schema':1,'kind':'PROMPT_B_FAILURE_INJECTION_AUDIT','program':'PROMPT_B','section':34,'status':'PASS' if not violations else 'FAIL','acceptance_receipt':accept_rel,'acceptance_sha256':sha(accept_rel),'required_injections':required,'summary':{'required':12,'covered':len(set(seen)&set(required)),'violations':len(violations)},'static_guards':guards,'violations':violations,'claim_boundary':'Controlled failure injection certifies bounded failure semantics and terminal behavior; it does not fabricate live-provider or external T3 evidence.'}
OUT.write_text(json.dumps(out,indent=2)+'\n')
print(f"failure injection audit {out['status']}: covered={out['summary']['covered']}/12 violations={len(violations)}")
sys.exit(0 if not violations else 1)
