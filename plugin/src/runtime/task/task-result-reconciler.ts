import { createHash } from 'node:crypto'
import type { MissionState,WorkerResult,WorkerState } from '../mission/types.js'
import { appendLedger } from '../ledger/ledger.js'
import { addEvidence,markMutation } from '../evidence/evidence-runtime.js'
import type { RuntimeScopedStores } from '../application/runtime-scoped-stores.js'
import { isHiReadOnlyChildRole,isHiReviewerRole } from '../roles/catalog.js'
import { assessDiffOwnership } from './diff-ownership.js'
import { applyWorkerResult,beginWorkerAttempt } from '../worker/worker-runtime.js'
import { replanVerificationForChangedSurface,verificationSatisfied,reviewObligationSatisfied } from '../verification/policy.js'
import { collectRepoContext } from '../intent/repo-context.js'
import { changedSurfaceMethodologySignals,verificationMethodologySignals,workerResultMethodologySignals } from '../methodology/signals.js'
import { activateMethodologySignal } from '../methodology/activation.js'
import { methodologyExitCheck,reconcileMethodologyExits } from '../methodology/exit.js'
import { reviewFindingMarker,reviewFindingNeedsCorrection } from '../../contracts/review-finding.js'
import { openHumanDecision } from '../human-decision/runtime.js'
import { runtimeSignal,type RuntimeSignalSink } from '../events/event-sink.js'
import { syncMissionGates } from '../gates/gates.js'
import { DEFAULT_CONTEXT_BUDGET,clipText } from '../context/budget.js'
import { promptToolOverrides } from '../routing/execution-profile.js'
import type { BackgroundRegistry } from '../background/registry.js'
import type { ConcurrencyScheduler } from '../scheduler/concurrency.js'
import type { ProjectMethodologyLearningStore } from '../project-intelligence/methodology-learning.js'
import { ChildExecutionCoordinator,diffDelta,normFile } from './child-execution-coordinator.js'
import { taskRuntimeAdmittedModel,reserveTaskRuntimeDispatch,bindTaskRuntimeHost,beginTaskRuntimeSettlement,releaseTaskRuntimeReservation } from '../scheduler/task-runtime-adapter.js'
import { executionAttemptIdentity } from '../../contracts/orchestration-core.js'

function providerOf(model:string|undefined):string|undefined{return model&&model!=='host-default'&&model.includes('/')?model.slice(0,model.indexOf('/')):undefined}
function resultDigest(result:WorkerResult):string{return createHash('sha256').update(JSON.stringify(result)).digest('hex')}

type QueueTask=(m:MissionState,worker:WorkerState,run:()=>Promise<WorkerState>)=>void
export class TaskResultReconciler{
  constructor(private readonly scheduler:ConcurrencyScheduler,private readonly registry:BackgroundRegistry,private readonly projectRoot:string,private readonly events:RuntimeSignalSink|undefined,private readonly methodologyLearning:ProjectMethodologyLearningStore,private readonly child:ChildExecutionCoordinator,private readonly queueTaskCallback:QueueTask,private readonly drainQueueCallback:()=>void,private readonly scopedStores:RuntimeScopedStores){}
  private queueTask(m:MissionState,worker:WorkerState,run:()=>Promise<WorkerState>):void{this.queueTaskCallback(m,worker,run)}
  private drainQueue():void{this.drainQueueCallback()}
  async reconcileNativeResult(m:MissionState,workerID:string,result:WorkerResult):Promise<WorkerResult>{
    const worker=m.execution.workers.find(w=>w.id===workerID);if(!worker)return result;const task=m.execution.tasks.find(t=>t.id===worker.task_id);if(!task)return result
    const final=await this.child.captureNativeDiff(worker,'final');const baseline=worker.native_diff_baseline??{};const nativeDelta=final?diffDelta(baseline,final):[];const reportedRaw=[...new Set((result.changed_files??[]).map(normFile).filter(Boolean))];const observedRaw=[...new Set((worker.write_set??[]).map(normFile).filter(Boolean))]
    // Session diff can contain user-owned dirty files that existed before this worker started.
    // A file whose native diff signature is identical to the worker baseline is not part of the
    // worker's net delta, even if the worker self-reports it or briefly touched and restored it.
    // This prevents Hi cleanup from stealing/reverting pre-existing user work.
    const preservedPreexisting=final?reportedRaw.filter(file=>baseline[file]!==undefined&&final[file]===baseline[file]):[]
    const reported=reportedRaw.filter(file=>!preservedPreexisting.includes(file));const observed=final?observedRaw.filter(file=>!(baseline[file]!==undefined&&final[file]===baseline[file])):observedRaw
    if(preservedPreexisting.length)appendLedger(m,'user-diff.preserved',{task_id:task.id,worker_id:worker.id,payload:{files:preservedPreexisting.slice(0,40),policy:'baseline-owned-by-user'}})
    const previousCollateral=[...new Set((task.diff_cleanliness?.collateral??[]).map(normFile).filter(Boolean))]
    if(previousCollateral.length){
      if(!final){
        const marker=`cleanup-unverified:${task.id}:${previousCollateral.slice(0,12).sort().join(',')}`
        appendLedger(m,'diff.cleanup.unverified',{task_id:task.id,worker_id:worker.id,payload:{files:previousCollateral.slice(0,40),reason:'native-diff-unavailable'}})
        return {...result,status:'FIX_REQUIRED',summary:`Cleanup cannot be accepted without native diff evidence. Verify that collateral files are restored before completion: ${previousCollateral.slice(0,12).join(', ')}.`,open_issues:[...new Set([...(result.open_issues??[]),marker])],needs_context:[...new Set([...(result.needs_context??[]),'cleanup-verification: native/session diff evidence is unavailable; do not claim collateral revert as complete until current diff can be deterministically verified'])]}
      }
      const stillDirty=previousCollateral.filter(file=>baseline[file]!==final[file])
      if(stillDirty.length){
        const marker=`cleanup-not-reverted:${task.id}:${stillDirty.slice(0,12).sort().join(',')}`
        appendLedger(m,'diff.cleanup.failed',{task_id:task.id,worker_id:worker.id,payload:{files:stillDirty.slice(0,40)}})
        return {...result,status:'FIX_REQUIRED',summary:`Worker reported cleanup, but native diff still shows collateral changes: ${stillDirty.slice(0,12).join(', ')}.`,changed_files:[...new Set([...reported,...stillDirty])],open_issues:[...new Set([...(result.open_issues??[]),marker])],needs_context:[...new Set([...(result.needs_context??[]),'cleanup-verification: inspect native/session diff and actually revert remaining collateral changes before reporting DONE'])]}
      }
      task.diff_cleanliness={collateral:[...(task.diff_cleanliness?.collateral??[])],accepted_expansions:[...(task.diff_cleanliness?.accepted_expansions??[])],native_verified_reverts:[...previousCollateral]};appendLedger(m,'diff.cleanup.verified',{task_id:task.id,worker_id:worker.id,payload:{reverted:previousCollateral.slice(0,40),source:'native-session-diff-baseline'}})
    }
    const activeWriters=m.execution.workers.filter(w=>!isHiReadOnlyChildRole(w.role)&&['starting','busy'].includes(w.status));const soleWriter=activeWriters.length<=1||activeWriters.every(w=>w.id===worker.id)
    const attributedNative=nativeDelta.filter(file=>observed.includes(file)||task.scope.map(normFile).includes(file)||(soleWriter&&!reported.includes(file)))
    const actual=[...new Set([...observed,...attributedNative])];const missing=actual.filter(file=>!reported.includes(file))
    if(!missing.length){if(final)appendLedger(m,'native.diff.reconciled',{task_id:task.id,worker_id:worker.id,payload:{reported:reported.length,observed:observed.length,native_delta:nativeDelta.length,sole_writer:soleWriter}});return {...result,changed_files:reported}}
    const marker=`native-diff-mismatch:${task.id}:${missing.slice(0,12).sort().join(',')}`;appendLedger(m,'native.diff.mismatch',{task_id:task.id,worker_id:worker.id,payload:{missing:missing.slice(0,40),reported:reported.slice(0,40),observed:observed.slice(0,40),native_delta:nativeDelta.slice(0,40),sole_writer:soleWriter}})
    return {...result,status:'FIX_REQUIRED',summary:`Native/session write evidence disagrees with WorkerResult changed_files. Reconcile before completion: ${missing.slice(0,12).join(', ')}.`,changed_files:[...new Set([...reported,...actual])],open_issues:[...new Set([...(result.open_issues??[]),marker])],needs_context:[...new Set([...(result.needs_context??[]),'native-diff-reconcile: inspect the current native/session diff and return a complete changed_files list; do not conceal or silently discard writes'])]}
  }
  async noteNativeWriteSet(m:MissionState,workerID:string,files:string[],source='session-diff',stateHash?:string):Promise<void>{
    const worker=m.execution.workers.find(w=>w.id===workerID);if(!worker||!files.length)return
    worker.write_set=[...new Set([...(worker.write_set??[]),...files])].slice(0,300);if(stateHash)worker.native_state_hash=stateHash;markMutation(m,files,source);this.scopedStores.projectIntelligence.invalidateChanged(files);this.scopedStores.contextArtifacts.invalidateChanged(files);this.scopedStores.skillCatalog.invalidateChanged(files);if(isHiReadOnlyChildRole(worker.role))return
    for(const other of m.execution.workers){
      if(other.id===worker.id||isHiReadOnlyChildRole(other.role)||!(other.write_set??[]).length||!['starting','busy'].includes(other.status)||!['starting','busy'].includes(worker.status))continue
      const overlap=(worker.write_set??[]).filter(x=>(other.write_set??[]).includes(x));if(!overlap.length)continue
      // The worker whose overlapping write is observed second is quarantined. The already-running
      // writer is allowed to finish, then the quarantined task resumes in the SAME child session
      // after an explicit dependency gate. This prevents blind concurrent merging while preserving
      // task/worker identity and context.
      const winner=other,loser=worker,winnerTask=m.execution.tasks.find(t=>t.id===winner.task_id),loserTask=m.execution.tasks.find(t=>t.id===loser.task_id);if(!winnerTask||!loserTask)continue
      const pair=[winner.id,loser.id].sort().join(':');const marker=`parallel-write-conflict:${pair}:${overlap.slice(0,8).sort().join(',')}`
      if(!m.execution.blockers.includes(marker))m.execution.blockers.push(marker)
      if(!loserTask.dependencies.includes(winnerTask.id))loserTask.dependencies.push(winnerTask.id)
      loserTask.result={status:'FIX_REQUIRED',summary:`Runtime write conflict detected with ${winner.id}; serialized reconciliation required.`,changed_files:[...new Set(loser.write_set??[])],evidence:[],open_issues:[marker],needs_context:[]}
      loserTask.updated_at=Date.now();loser.completed_at=undefined
      this.registry.delete(loser.id)
      const stopped=loser.session_id?await this.child.abortNativeSession(m,loser.session_id,'parallel-write-conflict',loser.id,loserTask.id):false
      if(!stopped){const abortMarker=`parallel-conflict-abort-unavailable:${loserTask.id}:${loser.id}`;m.execution.blockers=[...new Set([...m.execution.blockers,abortMarker])];loser.status='busy';loserTask.status='running';loserTask.result={...loserTask.result,status:'BLOCKED',open_issues:[...new Set([...loserTask.result.open_issues,abortMarker])],needs_context:[...new Set([...loserTask.result.needs_context,'OpenCode lifecycle abort is unavailable; do not assume the conflicting writer is quarantined'])]};this.registry.set(loser);appendLedger(m,'parallel.write-conflict.abort-blocked',{task_id:loserTask.id,worker_id:loser.id,payload:{winner_worker_id:winner.id,files:overlap.slice(0,30)}});break}
      this.scheduler.release(loser.id);releaseTaskRuntimeReservation(m,loser.id);loser.status='queued'
      const resume=async()=>{
        const model=loser.model;if(!model||taskRuntimeAdmittedModel(m,loser,[model],this.scheduler)!==model)throw new Error('Conflict resume scheduler admission unavailable')
        const reservation=reserveTaskRuntimeDispatch(m,loser,model,this.scheduler);if(!reservation.accepted)throw new Error(`Conflict resume reservation unavailable: ${reservation.reason}`)
        const provider=providerOf(model);if(!this.scheduler.acquire(loser.id,provider,model==='host-default'?undefined:model)){releaseTaskRuntimeReservation(m,loser.id);throw new Error('Legacy resource tracker disagreed with conflict resume admission')}
        if(!loser.session_id){this.scheduler.release(loser.id);releaseTaskRuntimeReservation(m,loser.id);throw new Error('Conflict resume child session missing')}
        const bound=bindTaskRuntimeHost(m,loser.id,loser.session_id);if(!bound.accepted){this.scheduler.release(loser.id);releaseTaskRuntimeReservation(m,loser.id);throw new Error(`Conflict resume host binding failed: ${bound.reason}`)}
        loser.status='busy';loser.started_at=Date.now();loser.generation_at_spawn=m.continuation.generation;loser.parent_mission_id=m.identity.mission_id;loserTask.status='running';this.registry.set(loser)
        try{beginWorkerAttempt(loserTask,loser);this.child.recordModelProjection(loser,model,loser.model_variant);await this.child.sendProviderPrompt(loser.session_id,clipText([`Hi runtime write-conflict reconciliation for existing task ${loserTask.id}.`,`Conflicting task ${winnerTask.id} has completed before this resume gate opened.`,`Conflicting files: ${overlap.join(', ')}`,`Current task objective: ${loserTask.objective}`,`Current user constraints: ${(loserTask.constraints??[]).join(' | ')||'none'}.`,'Inspect the current diff/state first. Preserve valid work from the completed task. Reconcile only this task sequentially; do not blindly overwrite or restart planning. Re-run the required scoped verification and return the structured WorkerResult.'].join('\n'),DEFAULT_CONTEXT_BUDGET.max_handoff_chars),loser.role,model==='host-default'?undefined:model,loser.model_variant,promptToolOverrides(loserTask.execution_profile?.tools??[]));appendLedger(m,'parallel.write-conflict.resumed',{task_id:loserTask.id,worker_id:loser.id,payload:{after_task:winnerTask.id,files:overlap.slice(0,30)}});return loser}
        catch(error){let stopped=true;try{stopped=await this.child.abortNativeSession(m,loser.session_id,'parallel-write-conflict-resume-failed',loser.id,loserTask.id)}catch{stopped=false};if(stopped){this.scheduler.release(loser.id);releaseTaskRuntimeReservation(m,loser.id);loser.status='ready';loserTask.status='waiting'}else{const abortMarker=`parallel-conflict-resume-abort-unavailable:${loserTask.id}:${loser.id}`;m.execution.blockers=[...new Set([...m.execution.blockers,abortMarker])];loser.status='busy';loserTask.status='running'}this.registry.set(loser);throw error}
      }
      this.queueTask(m,loser,resume)
      appendLedger(m,'parallel.write-conflict.quarantined',{task_id:loserTask.id,worker_id:loser.id,payload:{winner_worker_id:winner.id,winner_task_id:winnerTask.id,files:overlap.slice(0,30),policy:'verified-abort-then-serialize'}});void this.events?.(runtimeSignal('parallel.write-conflict',m.identity.mission_id,{task_id:loserTask.id,worker_id:loser.id,payload:{other_worker_id:winner.id,files:overlap.slice(0,30),action:'quarantined'}}));break
    }
    syncMissionGates(m)
  }
  noteNativeStatus(m:MissionState,workerID:string,status:string):void{const worker=m.execution.workers.find(w=>w.id===workerID);if(!worker)return;appendLedger(m,'worker.native-status',{worker_id:worker.id,payload:{status}})}
  applyResult(m:MissionState,workerID:string,result:WorkerResult):void{
    const worker=m.execution.workers.find(w=>w.id===workerID);if(!worker)return
    if(worker.generation_at_spawn!==undefined&&worker.generation_at_spawn!==m.continuation.generation){appendLedger(m,'worker.result.stale-generation-ignored',{worker_id:worker.id,payload:{worker_generation:worker.generation_at_spawn,mission_generation:m.continuation.generation}});return}
    const task=m.execution.tasks.find(t=>t.id===worker.task_id);if(!task)return
    const settlement=beginTaskRuntimeSettlement(m,worker);if(!settlement.accepted&&settlement.reason!=='reservation-not-found'){appendLedger(m,'worker.result.scheduler-fence-rejected',{task_id:task.id,worker_id:worker.id,payload:{reason:settlement.reason,attempt:worker.attempt,generation:worker.generation_at_spawn,session_id:worker.session_id}});return}
    const digest=resultDigest(result);if(worker.last_result_digest===digest){appendLedger(m,'worker.result.duplicate-ignored',{task_id:task.id,worker_id:worker.id,payload:{digest}});return}
    if(['completed','failed','cancelled'].includes(worker.status)){appendLedger(m,'worker.result.terminal-ignored',{task_id:task.id,worker_id:worker.id,payload:{status:worker.status,digest}});return}
    worker.last_result_digest=digest;worker.last_result_at=Date.now()
    const observedMutationDuringWorker=Boolean(worker.started_at&&m.execution.evidence.last_mutation_at&&m.execution.evidence.last_mutation_at>=worker.started_at)
    const previousIssues=task.result?.open_issues??[];if(previousIssues.length)m.execution.blockers=m.execution.blockers.filter(b=>!previousIssues.includes(b)||m.execution.tasks.some(other=>other.id!==task.id&&(other.result?.open_issues??[]).includes(b)))

    const previousCollateral=[...(task.diff_cleanliness?.collateral??[])]
    const ownership=isHiReadOnlyChildRole(worker.role)&&result.changed_files.length
      ? {outside:[...result.changed_files],accepted:[],collateral:[...result.changed_files]}
      : assessDiffOwnership(task,result)
    if(ownership.accepted.length){
      task.diff_cleanliness={collateral:previousCollateral,accepted_expansions:[...new Set([...(task.diff_cleanliness?.accepted_expansions??[]),...ownership.accepted])]}
    }
    const cleanlinessMarker=ownership.collateral.length?`diff-cleanliness:${task.id}:${ownership.collateral.slice(0,12).sort().join(',')}`:undefined
    const claimedReverted=previousCollateral.filter(file=>!new Set(result.changed_files.map(normFile)).has(normFile(file)))
    const verifiedReverts=new Set((task.diff_cleanliness?.native_verified_reverts??[]).map(normFile))
    const unverifiedReverts=!cleanlinessMarker?claimedReverted.filter(file=>!verifiedReverts.has(normFile(file))):[]
    const cleanupMarker=unverifiedReverts.length?`cleanup-unverified:${task.id}:${unverifiedReverts.slice(0,12).sort().join(',')}`:undefined
    let effectiveResult:WorkerResult=cleanlinessMarker?{
      ...result,
      status:'FIX_REQUIRED',
      summary:`Diff cleanliness reconciliation required before completion. Unowned/collateral changed files: ${ownership.collateral.slice(0,12).join(', ')}.`,
      open_issues:[...new Set([...result.open_issues,cleanlinessMarker])],
      needs_context:[...new Set([...result.needs_context,'diff-cleanliness-reconcile: inspect current diff; revert collateral files or explicitly justify necessary bounded scope expansion'])]
    }:cleanupMarker?{
      ...result,
      status:'FIX_REQUIRED',
      summary:`Cleanup was reported but deterministic native diff evidence is still required for: ${unverifiedReverts.slice(0,12).join(', ')}.`,
      open_issues:[...new Set([...result.open_issues,cleanupMarker])],
      needs_context:[...new Set([...result.needs_context,'cleanup-verification: do not close collateral-diff blockers from WorkerResult claims alone; provide native/session diff confirmation'])]
    }:result
    const missingMethodologyLoads=effectiveResult.status==='DONE'?(worker.selected_methodologies??[]).filter(name=>!(worker.loaded_methodologies??[]).includes(name)):[]
    if(missingMethodologyLoads.length){
      const marker=`methodology-not-loaded:${task.id}:${missingMethodologyLoads.join(',')}`
      effectiveResult={...effectiveResult,status:'FIX_REQUIRED',summary:`Selected Hi methodology was not loaded through the native skill tool: ${missingMethodologyLoads.join(', ')}.`,open_issues:[...new Set([...effectiveResult.open_issues,marker])],needs_context:[...new Set([...effectiveResult.needs_context,'load the Hi-selected methodology through the OpenCode native skill tool before retrying the bounded task'])]}
      appendLedger(m,'methodology.load-missing',{task_id:task.id,worker_id:worker.id,payload:{selected:worker.selected_methodologies,loaded:worker.loaded_methodologies??[],missing:missingMethodologyLoads}})
    }
    if(cleanlinessMarker){
      task.diff_cleanliness={collateral:[...ownership.collateral],accepted_expansions:[...(task.diff_cleanliness?.accepted_expansions??[])]}
      appendLedger(m,'diff.cleanliness.blocked',{task_id:task.id,worker_id:worker.id,payload:{collateral:ownership.collateral.slice(0,40),outside:ownership.outside.slice(0,40),role:worker.role}})
      void this.events?.(runtimeSignal('diff.cleanliness.blocked',m.identity.mission_id,{task_id:task.id,worker_id:worker.id,payload:{collateral:ownership.collateral.slice(0,40)}}))
    }else if(previousCollateral.length&&!cleanupMarker){
      const stillChanged=new Set(result.changed_files.map(normFile))
      const reverted=previousCollateral.filter(file=>!stillChanged.has(normFile(file))&&verifiedReverts.has(normFile(file)))
      if(reverted.length){
        m.vcs.changed_files=m.vcs.changed_files.filter(file=>!reverted.includes(file)||m.execution.tasks.some(t=>t.id!==task.id&&(t.result?.changed_files??[]).includes(file)))
        appendLedger(m,'diff.cleanliness.resolved',{task_id:task.id,worker_id:worker.id,payload:{reverted:reverted.slice(0,40),source:'native-session-diff'}})
      }
      const unresolved=previousCollateral.filter(file=>!reverted.includes(file))
      task.diff_cleanliness={collateral:unresolved,accepted_expansions:[...(task.diff_cleanliness?.accepted_expansions??[])],native_verified_reverts:[]}
    }


    if(effectiveResult.findings?.length){
      const findings=effectiveResult.findings
      const invalidRole=findings.filter(f=>!isHiReviewerRole(worker.role)||f.reviewer_role!==worker.role)
      const actionable=findings.filter(f=>f.reviewer_role===worker.role&&reviewFindingNeedsCorrection(f))
      const unresolvedCausality=findings.filter(f=>f.reviewer_role===worker.role&&f.disposition==='open'&&f.blocking&&f.causality==='unknown')
      const roleMarkers=invalidRole.map(f=>`review-finding-role-mismatch:${f.id}:${worker.role}->${f.reviewer_role}`)
      const actionableMarkers=actionable.map(reviewFindingMarker)
      const causalityMarkers=unresolvedCausality.map(f=>`review-finding-causality-unresolved:${f.id}`)
      if(roleMarkers.length){effectiveResult={...effectiveResult,status:'FIX_REQUIRED',open_issues:[...new Set([...effectiveResult.open_issues,...roleMarkers])],needs_context:[...new Set([...effectiveResult.needs_context,'review-finding-role-reconcile: structured findings must be emitted by the actual canonical reviewer role'])]};appendLedger(m,'review.finding-role-rejected',{task_id:task.id,worker_id:worker.id,payload:{findings:invalidRole.map(f=>f.id),worker_role:worker.role}})}
      if(actionableMarkers.length){effectiveResult={...effectiveResult,status:'FIX_REQUIRED',open_issues:[...new Set([...effectiveResult.open_issues,...actionableMarkers])]};appendLedger(m,'review.finding-actionable',{task_id:task.id,worker_id:worker.id,payload:{findings:actionable.map(f=>({id:f.id,severity:f.severity,causality:f.causality,blocking:f.blocking,scope:f.scope.slice(0,20)}))}})}
      if(causalityMarkers.length){effectiveResult={...effectiveResult,status:'FIX_REQUIRED',open_issues:[...new Set([...effectiveResult.open_issues,...causalityMarkers])],needs_context:[...new Set([...effectiveResult.needs_context,'review-finding-causality-reconcile: blocking findings with unknown causality cannot become mission blockers until introduced/worsened/pre-existing ownership is established'])]};appendLedger(m,'review.finding-causality-unresolved',{task_id:task.id,worker_id:worker.id,payload:{findings:unresolvedCausality.map(f=>f.id)}})}
      const preExisting=findings.filter(f=>f.causality==='pre-existing'&&f.disposition==='open')
      if(preExisting.length)appendLedger(m,'review.finding-pre-existing',{task_id:task.id,worker_id:worker.id,payload:{findings:preExisting.map(f=>({id:f.id,severity:f.severity,scope:f.scope.slice(0,20)})),policy:'record-without-unrelated-mission-blocker'}})
    }


    // Proof ownership: ingest worker-reported proof into the canonical Evidence owner before
    // methodology exit evaluation. A WorkerResult is not itself proof. If changed files were
    // only reported after the fact, mark that mutation first so same-result evidence is stale.
    const fallbackMutation=effectiveResult.changed_files.length>0&&!observedMutationDuringWorker
    if(fallbackMutation)markMutation(m,effectiveResult.changed_files,'worker-result-fallback')
    const evidenceSource=isHiReadOnlyChildRole(worker.role)?`worker:${worker.id}:reviewer`:`worker:${worker.id}`,attemptIdentity=executionAttemptIdentity({executionUnitId:`eu:${task.id}`,workerId:worker.id,ordinal:worker.attempt,generation:worker.generation_at_spawn??m.continuation.generation}),producer_attempt={worker_id:worker.id,execution_unit_id:attemptIdentity.executionUnitId,attempt_id:attemptIdentity.attemptId,run_id:attemptIdentity.runId,ordinal:attemptIdentity.ordinal,generation:attemptIdentity.generation}
    for(const e of effectiveResult.evidence)addEvidence(m,{kind:e.kind,summary:e.summary,scope:e.scope??effectiveResult.changed_files,source:evidenceSource,source_session_id:worker.session_id,source_state_hash:worker.native_state_hash,task_id:task.id,obligation_ids:task.obligation_ids,producer_attempt,pass:e.pass,outcome:e.outcome,reason:e.reason,invalidated_at:(cleanlinessMarker||fallbackMutation&&!isHiReadOnlyChildRole(worker.role))?(m.execution.evidence.last_mutation_at??Date.now()):undefined})

    if(effectiveResult.status==='DONE'&&(worker.loaded_methodologies?.length??0)>0){
      const missingExit=[...new Set((worker.loaded_methodologies??[]).flatMap(name=>methodologyExitCheck(m,name,{task,worker,result:effectiveResult,projectRoot:this.projectRoot,scope:'worker'}).missing))]
      if(missingExit.length){const exitMarker=`methodology-exit-unsatisfied:${task.id}:${missingExit.join(',')}`;effectiveResult={...effectiveResult,status:'FIX_REQUIRED',summary:`Hi methodology exit contract is not satisfied: ${missingExit.join(', ')}.`,open_issues:[...new Set([...effectiveResult.open_issues,exitMarker])],needs_context:[...new Set([...effectiveResult.needs_context,`methodology-exit: provide the required evidence/result for ${missingExit.join(', ')}`])]};appendLedger(m,'methodology.exit-unsatisfied',{task_id:task.id,worker_id:worker.id,payload:{methodologies:worker.loaded_methodologies,missing:missingExit}})}
    }
    applyWorkerResult(m,task,worker,effectiveResult);this.scheduler.release(worker.id);releaseTaskRuntimeReservation(m,worker.id);this.registry.delete(worker.id)
    for(const signal of changedSurfaceMethodologySignals(effectiveResult.changed_files))activateMethodologySignal(m,this.projectRoot,{signal:signal.name,producer:'changed-surface',reason:signal.reason})
    for(const signal of workerResultMethodologySignals({status:effectiveResult.status,needsContext:effectiveResult.needs_context,contextGap:effectiveResult.context_gap,failureFinding:effectiveResult.failure_finding})){
      const producer=signal.name.startsWith('context.')?'context':'runtime-failure'
      activateMethodologySignal(m,this.projectRoot,{signal:signal.name,producer,reason:signal.reason})
    }
    void this.events?.(runtimeSignal('worker.completed',m.identity.mission_id,{task_id:task.id,worker_id:worker.id,payload:{status:effectiveResult.status}}))
    if(effectiveResult.open_issues.some(x=>String(x).toUpperCase().includes('USER_ACTION_REQUIRED'))){openHumanDecision(m,{semantic_type:'operational_action',reason_code:'worker-user-action-required',summary:effectiveResult.summary.slice(0,500)||'Worker requires external user action before this task can continue.',task_id:task.id,worker_id:worker.id,response_schema:{kind:'external-action'}})}
    const replan=replanVerificationForChangedSurface(m,task,effectiveResult.changed_files,collectRepoContext(this.projectRoot));if(replan.changed){appendLedger(m,'verification.replanned',{task_id:task.id,worker_id:worker.id,payload:{changed_files:effectiveResult.changed_files.slice(0,30),added_kinds:replan.addedKinds,scope_expanded:replan.scopeExpanded,risk_escalated:replan.riskEscalated,reason:replan.reason}});void this.events?.(runtimeSignal('verification.replanned',m.identity.mission_id,{task_id:task.id,worker_id:worker.id,payload:{added_kinds:replan.addedKinds,scope_expanded:replan.scopeExpanded,risk_escalated:replan.riskEscalated}}))}
    for(const signal of verificationMethodologySignals({changed:replan.changed,scopeExpanded:replan.scopeExpanded,riskEscalated:replan.riskEscalated,requireReview:m.execution.verification_policy.requireReview,changedFiles:effectiveResult.changed_files})){
      const producer=signal.name.startsWith('risk.')?'risk':'verification'
      activateMethodologySignal(m,this.projectRoot,{signal:signal.name,producer,reason:signal.reason})
    }
    if(ownership.accepted.length){task.scope=[...new Set([...task.scope,...ownership.accepted])];appendLedger(m,'task.scope-expanded',{task_id:task.id,worker_id:worker.id,payload:{files:ownership.accepted.slice(0,40),policy:'bounded-explicit-ownership'}})}
    if(effectiveResult.status==='DONE'&&effectiveResult.methodology_observations?.length){const evidenceRefs=m.execution.evidence.items.filter(e=>e.task_id===task.id&&!e.invalidated_at&&(e.outcome==='passed'||e.pass===true)&&e.producer_attempt?.worker_id===worker.id&&e.producer_attempt.ordinal===worker.attempt&&e.producer_attempt.generation===(worker.generation_at_spawn??m.continuation.generation)).map(e=>e.kind);for(const observation of effectiveResult.methodology_observations)this.methodologyLearning.observe(m,worker,observation,evidenceRefs)}
    const reviewEvidenceSatisfied=(obligationID:string)=>reviewObligationSatisfied(m,obligationID).ok
    if(effectiveResult.status==='DONE'){
      const now=Date.now();if(worker.role==='repository-explorer'&&m.identity.intent.ambiguity!=='none'){m.identity.intent.ambiguity='none';appendLedger(m,'intent.ambiguity.resolved',{task_id:task.id,worker_id:worker.id,payload:{source:'repository-explorer-result'}})}
      for(const id of task.obligation_ids){const owned=m.execution.obligations.find(o=>o.id===id&&o.status==='open');if(!owned)continue;if(owned.kind==='verification'){if(verificationSatisfied(m,owned.id).ok){owned.status='closed';owned.closedAt=now}}else if(owned.kind==='review'){if(reviewEvidenceSatisfied(owned.id)){owned.status='closed';owned.closedAt=now}else appendLedger(m,'review.claim-unproven',{task_id:task.id,worker_id:worker.id,payload:{obligation:owned.id,reason:'explicit-fresh-source-bound-review-evidence-required'}})}else{owned.status='closed';owned.closedAt=now}if(owned.status==='closed')appendLedger(m,'obligation.closed',{task_id:task.id,worker_id:worker.id,payload:{obligation:owned.id,owner:'task'}})}
      reconcileMethodologyExits(m,this.projectRoot)
    }
    syncMissionGates(m);this.drainQueue()
  }
}
