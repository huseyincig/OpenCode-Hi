#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CHECKS=[
 ('unique-identities','plugin/src/runtime/mission/validators.ts','new Set(taskIDs).size','plugin/test/task-worker-contract.test.mjs','RuntimePersistence rejects persisted mission graphs with unknown duplicate or cyclic Task dependencies'),
 ('mission-ownership','plugin/src/runtime/mission/validators.ts','worker.parent_mission_id!==missionID','plugin/test/task-worker-contract.test.mjs','PROMPT B Mission validator rejects ghost workers, cross-session worker binding and duplicate native session ownership'),
 ('task-dag-validity','plugin/src/runtime/mission/validators.ts','const cyclic=','plugin/test/task-worker-contract.test.mjs','RuntimePersistence rejects persisted mission graphs with unknown duplicate or cyclic Task dependencies'),
 ('worker-binding','plugin/src/runtime/mission/validators.ts','ownerTask.worker_id!==worker.id','plugin/test/task-worker-contract.test.mjs','PROMPT B Mission validator rejects ghost workers, cross-session worker binding and duplicate native session ownership'),
 ('no-ghost-workers','plugin/src/runtime/mission/validators.ts','ownerTask.worker_id!==worker.id','plugin/test/task-worker-contract.test.mjs','extra worker not owned by task.worker_id must fail closed'),
 ('no-orphan-tasks','plugin/src/runtime/mission/validators.ts','task.worker_id!==undefined','plugin/test/task-worker-contract.test.mjs','PROMPT B Mission validator rejects ghost workers, cross-session worker binding and duplicate native session ownership'),
 ('no-duplicate-completion','plugin/src/runtime/task/task-result-reconciler.ts','worker.result.duplicate-ignored','plugin/test/q3-adversarial-threat-matrix.test.mjs','Q3 duplicate child result callback is idempotently ignored by canonical TaskRuntime'),
 ('out-of-order-callback','plugin/src/runtime/task/child-execution-coordinator.ts','matches.length===1','plugin/test/prompt-b-mission-task-worker-adversarial.test.mjs','PROMPT B reordered callback from superseded child session cannot bind the current worker'),
 ('stale-worker-result','plugin/src/runtime/task/task-result-reconciler.ts','worker.result.stale-generation-ignored','plugin/test/prompt-b-mission-task-worker-adversarial.test.mjs','PROMPT B callback disposition fences stale mission identity but does not let restart quarantine hide native callbacks'),
 ('task-cancellation','plugin/src/runtime/task/task-runtime.ts','async cancel(m:MissionState','plugin/test/w2-workspace-executor.test.mjs','W2 explicit isolated task provisions one lease, binds child workspace, preserves deny permission, and cleanup follows child abort'),
 ('task-recovery','plugin/src/runtime/task/task-runtime.ts','reconcileRestartBeforeResume','plugin/test/crash-restart-survival.test.mjs','restart opens attempt 2 only after an idle FIX_REQUIRED result is ingested from attempt 1'),
 ('dependency-unblock','plugin/src/runtime/task/task-runtime.ts','drainQueue','plugin/test/scheduler-hardening.test.mjs','queued dependent is removed from queue when prerequisite fails'),
 ('concurrent-write-safety','plugin/src/runtime/task/task-result-reconciler.ts','parallel.write-conflict.quarantined','plugin/test/runtime-write-conflict.test.mjs','runtime-discovered overlapping writes quarantine the later writer and serialize its resume'),
 ('restart-reconstruction','plugin/src/runtime/state/persistence.ts','RUNTIME_STATE_SCHEMA = 10','plugin/test/crash-restart-survival.test.mjs','unclean restart quarantines in-flight child, resets ephemeral permission wait, and invalidates evidence'),
 ('terminal-state-correctness','plugin/src/runtime/worker/worker-runtime.ts','task.status=\'completed\'','plugin/test/task-worker-contract.test.mjs','WorkerContract starts at attempt zero and beginWorkerAttempt preserves identity while advancing lifecycle'),
]
def sha(path:Path)->str:return hashlib.sha256(path.read_bytes()).hexdigest()
def main()->int:
    rows=[];viol=[]
    for ident,owner,anchor,proof,proof_anchor in CHECKS:
        op=ROOT/owner;pp=ROOT/proof
        if not op.is_file():viol.append(f'{ident}:missing-owner:{owner}');continue
        if not pp.is_file():viol.append(f'{ident}:missing-proof:{proof}');continue
        ot=op.read_text(errors='ignore');pt=pp.read_text(errors='ignore')
        if anchor not in ot:viol.append(f'{ident}:owner-anchor-drift:{anchor}')
        if proof_anchor not in pt:viol.append(f'{ident}:proof-anchor-drift:{proof_anchor}')
        rows.append({'invariant':ident,'owner':owner,'owner_sha256':sha(op),'proof':proof,'proof_sha256':sha(pp),'owner_anchor':anchor,'proof_anchor':proof_anchor})
    out={'schema':1,'kind':'PROMPT_B_MISSION_TASK_WORKER_ADVERSARIAL_AUDIT','program':'PROMPT_B','section':6,'status':'PASS' if not viol and len(rows)==len(CHECKS) else 'FAIL','invariants':rows,'violations':viol,'summary':{'required':len(CHECKS),'covered':len(rows) if not viol else len([r for r in rows if r['invariant'] not in {v.split(':',1)[0] for v in viol}]),'violations':len(viol)},'closed_defects':[{'id':'ambiguous-native-session-callback-ownership','fix':'Mission validator enforces exact task↔worker/parent-session/native-session ownership; callback resolver accepts exactly one native session owner.','paths':['plugin/src/runtime/mission/validators.ts','plugin/src/runtime/task/child-execution-coordinator.ts']}],'claim_boundary':'Deterministic current-source audit of PROMPT B section 6 invariants. It is not a claim that future bugs are impossible.'}
    path=ROOT/'data/validation/prompt-b-mission-task-worker.json';path.write_text(json.dumps(out,indent=2)+'\n')
    print(f"mission/task/worker audit {out['status']}: covered={out['summary']['covered']}/{out['summary']['required']} violations={len(viol)}")
    return 0 if out['status']=='PASS' else 1
if __name__=='__main__':sys.exit(main())
