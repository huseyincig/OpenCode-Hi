#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/validation/prompt-b-persistence-concurrency.json'
def sha(rel):return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
checks=[
 # §16 Persistence/restart
 (16,'durable-eight-slices','plugin/src/runtime/mission/types.ts','export interface MissionState','plugin/test/prompt-b-persistence-restart-hostile.test.mjs','persistence round-trip preserves every durable control plane'),
 (16,'task-dag-worker-restart','plugin/src/runtime/mission/mission-store.ts',"['active','waiting-user'].includes(m.identity.status)",'plugin/test/crash-restart-survival.test.mjs','unclean restart quarantines in-flight child'),
 (16,'continuation-ephemeral-reset','plugin/src/runtime/mission/mission-store.ts','m.continuation.continuation_active=false','plugin/test/crash-restart-survival.test.mjs','explicit task restart quiesces and reconciles the durable reservation before the next same-session attempt'),
 (16,'context-state-survival','plugin/src/runtime/state/persistence.ts','missions:MissionState[]','plugin/test/prompt-b-persistence-restart-hostile.test.mjs','context'),
 (16,'vcs-safety-survival','plugin/src/runtime/state/persistence.ts','missions:MissionState[]','plugin/test/prompt-b-persistence-restart-hostile.test.mjs','vcs.changed_files'),
 (16,'authority-restart-semantics','plugin/src/runtime/mission/mission-store.ts','authority.approval.invalidated','plugin/test/authority-input-split.test.mjs','semantic revision and runtime restart invalidate unconsumed approval'),
 (16,'release-transaction-survival','plugin/src/runtime/state/persistence.ts','missions:MissionState[]','plugin/test/prompt-b-persistence-restart-hostile.test.mjs','release.release_chain.blocked_reason'),
 (16,'methodology-state-survival','plugin/src/runtime/state/persistence.ts','missions:MissionState[]','plugin/test/prompt-b-persistence-restart-hostile.test.mjs','parent_loaded_methodologies'),
 (16,'process-restart-reconcile','plugin/src/runtime/process/runtime.ts','reconcileRestored','plugin/test/p3-process-runtime-lifecycle.test.mjs','restart reconciliation adopts exact owner identity and quarantines orphan'),
 (16,'workspace-restart-reconcile','plugin/src/runtime/workspace/runtime.ts','reconcileRestored','plugin/test/w2-workspace-executor.test.mjs','restart adopts exact lease, quarantines missing owner without recreation'),
 (16,'human-decision-survival','plugin/src/runtime/human-decision/transport.ts','readonly #entries=new Map<string,Entry>()','plugin/test/h1-human-decision-transport.test.mjs','restart reopens persisted semantic decision but never replays stale ephemeral transport response'),
 (16,'evidence-reference-restart','plugin/src/runtime/mission/mission-store.ts','evidence.crash-invalidated','plugin/test/prompt-b-persistence-restart-hostile.test.mjs','execution.evidence.items[0].id'),
 (16,'partial-corrupt-old-unknown','plugin/src/runtime/state/persistence.ts','unsupported runtime-state schema','plugin/test/prompt-b-persistence-restart-hostile.test.mjs','persistence rejects corrupt partial old and unknown schema'),
 (16,'duplicate-replay-fail-close','plugin/src/runtime/state/persistence.ts','duplicate persisted session identity','plugin/test/prompt-b-persistence-restart-hostile.test.mjs','duplicate persisted session or Mission identity fails closed'),
 (16,'restore-duplicate-defense','plugin/src/runtime/mission/mission-store.ts','Duplicate restored session identity','plugin/test/prompt-b-persistence-restart-hostile.test.mjs','Duplicate restored session identity'),
 (16,'atomic-primary-replace','plugin/src/runtime/state/persistence.ts','renameSync(tmp,this.path)','plugin/test/prompt-b-persistence-restart-hostile.test.mjs','orphan partial tmp file never overrides last committed primary state'),
 (16,'prewrite-validation','plugin/src/runtime/state/persistence.ts','refusing to persist invalid mission state','plugin/test/prompt-b-persistence-restart-hostile.test.mjs','persistence refuses invalid Mission before replacing the last valid committed state'),
 (16,'strict-current-envelope','plugin/src/runtime/state/persistence.ts','runtime state envelope keys invalid','plugin/test/prompt-b-persistence-restart-hostile.test.mjs','malformed current-schema envelope metadata'),
 (16,'waiting-user-crash-reconcile','plugin/src/runtime/mission/mission-store.ts',"['active','waiting-user'].includes(m.identity.status)",'plugin/test/prompt-b-persistence-restart-hostile.test.mjs','unclean restore invalidates only ephemeral/freshness state'),
 # §17 Concurrency/races
 (17,'simultaneous-task-completion','plugin/src/runtime/task/task-result-reconciler.ts','worker.result.terminal-ignored','plugin/test/prompt-b-concurrency-races.test.mjs','simultaneous distinct task completions reconcile without double-closing'),
 (17,'simultaneous-evidence-mutation','plugin/src/runtime/evidence/evidence-runtime.ts','mission.execution.evidence.fresh=','plugin/test/prompt-b-concurrency-races.test.mjs','evidence/mutation race ordering is deterministic'),
 (17,'worker-cancel-result-race','plugin/src/runtime/task/task-result-reconciler.ts','worker.result.terminal-ignored','plugin/test/prompt-b-concurrency-races.test.mjs','cancellation wins over a late different worker result'),
 (17,'permission-decision-race','plugin/src/runtime/application/runtime-event-controller.ts','permission.stale-ask-ignored','plugin/test/prompt-b-concurrency-races.test.mjs','permission reply-before-ask reorder cannot create a phantom pending permission'),
 (17,'restart-during-write','plugin/src/runtime/state/persistence.ts','writeFileSync(tmp','plugin/test/prompt-b-persistence-restart-hostile.test.mjs','orphan partial tmp file never overrides last committed primary state'),
 (17,'queue-ordering','plugin/src/runtime/task/task-runtime.ts','this.#queue.splice(i--,1)','plugin/test/prompt-b-concurrency-races.test.mjs','bounded task queue is FIFO among runnable workers'),
 (17,'starvation-prevention','plugin/src/runtime/task/task-runtime.ts','while(progress)','plugin/test/prompt-b-concurrency-races.test.mjs','later entries are not starved'),
 (17,'retry-circuit','plugin/src/runtime/continuation/dispatcher.ts','continuation_failure_count','plugin/test/continuation-evaluator-wide-batch.test.mjs','continuation transport failures use a separate bounded runtime retry budget'),
 (17,'duplicate-event-delivery','plugin/src/runtime/task/task-result-reconciler.ts','worker.result.duplicate-ignored','plugin/test/q3-adversarial-threat-matrix.test.mjs','duplicate child result callback is idempotently ignored'),
 (17,'concurrent-workspace-mutation','plugin/src/runtime/workspace/runtime.ts','already owned by another active lease','plugin/test/w2-workspace-executor.test.mjs','concurrent lease identity collision is cleaned and rejected'),
 (17,'process-lifecycle-races','plugin/src/opencode/open-code-pty-adapter.ts','Refusing process-group signal','plugin/test/p2-opencode-pty-executor.test.mjs','kill signalling failure does not fabricate TERMINATED semantics'),
 (17,'runtime-write-conflict-serialization','plugin/src/runtime/task/task-result-reconciler.ts','parallel.write-conflict.quarantined','plugin/test/runtime-write-conflict.test.mjs','runtime-discovered overlapping writes quarantine the later writer and serialize its resume'),
]
violations=[];rows=[]
for section,name,owner,oa,proof,pa in checks:
 op,pp=ROOT/owner,ROOT/proof
 if not op.is_file():violations.append(f'{name}:missing-owner:{owner}');continue
 if not pp.is_file():violations.append(f'{name}:missing-proof:{proof}');continue
 ot,pt=op.read_text(errors='replace'),pp.read_text(errors='replace')
 if oa not in ot:violations.append(f'{name}:owner-anchor-drift:{oa}')
 if pa not in pt:violations.append(f'{name}:proof-anchor-drift:{pa}')
 rows.append({'section':section,'invariant':name,'owner':owner,'owner_sha256':sha(owner),'owner_anchor':oa,'proof':proof,'proof_sha256':sha(proof),'proof_anchor':pa})
# Static fail-close guards beyond string anchors.
persistence=(ROOT/'plugin/src/runtime/state/persistence.ts').read_text(errors='replace')
restore=(ROOT/'plugin/src/runtime/mission/mission-store.ts').read_text(errors='replace')
reconciler=(ROOT/'plugin/src/runtime/task/task-result-reconciler.ts').read_text(errors='replace')
events=(ROOT/'plugin/src/runtime/application/runtime-event-controller.ts').read_text(errors='replace')
guards={
 'save_validates_before_tmp_write':persistence.find('refusing to persist invalid mission state')<persistence.find('writeFileSync(tmp'),
 'atomic_same_directory_rename':'renameSync(tmp,this.path)' in persistence,
 'duplicate_session_and_mission_load_rejected':all(x in persistence for x in ['duplicate persisted session identity','duplicate persisted mission identity']),
 'waiting_user_restart_reconciled':"['active','waiting-user'].includes(m.identity.status)" in restore,
 'terminal_worker_result_rejected':'worker.result.terminal-ignored' in reconciler,
 'reply_before_ask_rejected':'permission.stale-ask-ignored' in events,
}
for k,v in guards.items():
 if not v:violations.append('static-guard:'+k)
by={}
for section in (16,17):
 required=sum(1 for x in checks if x[0]==section);bad=sum(1 for v in violations for x in checks if x[0]==section and v.startswith(x[1]+':'));by[str(section)]={'required':required,'covered':required-bad}
status='PASS' if not violations and len(rows)==len(checks) else 'FAIL'
data={'schema':1,'kind':'PROMPT_B_PERSISTENCE_CONCURRENCY_ADVERSARIAL_AUDIT','program':'PROMPT_B','sections':[16,17],'status':status,'invariants':rows,'static_guards':guards,'violations':violations,'summary':{'required':len(checks),'covered':len(checks)-sum(1 for v in violations if ':missing-' in v or ':owner-anchor-drift:' in v or ':proof-anchor-drift:' in v),'violations':len(violations),'by_section':by},'closed_defects':[
 {'id':'duplicate-persisted-mission-replay','fix':'RuntimePersistence save/load and MissionStore restore reject duplicate session_id/mission_id identities instead of last-write-wins overwrite.'},
 {'id':'waiting-user-unclean-restart-gap','fix':'Unclean restart reconciliation applies to active and waiting-user missions, preserving HumanDecision while resetting/reconciling ephemeral workers/permissions/evidence.'},
 {'id':'malformed-current-runtime-envelope','fix':'RuntimePersistence rejects unknown/missing envelope keys and malformed timestamps even when schema number matches.'},
 {'id':'cancelled-worker-late-result-resurrection','fix':'TaskResultReconciler ignores all late results for completed/failed/cancelled terminal workers.'},
 {'id':'permission-reply-before-ask-phantom-wait','fix':'A permission reply observed before its ask makes the later ask stale/idempotent and cannot recreate pending permission state.'},
 ],'claim_boundary':'Persistence is current-schema, strict, atomic-replace and fail-closed; race safety is deterministic owner/idempotency behavior, not a claim that host delivery order is guaranteed.'}
OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(data,indent=2)+'\n')
print(f"persistence/concurrency audit {status}: covered={data['summary']['covered']}/{len(checks)} violations={len(violations)} by_section={by}")
if violations: print('\n'.join(violations))
sys.exit(0 if status=='PASS' else 1)
