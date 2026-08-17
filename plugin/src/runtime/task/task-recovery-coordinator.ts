import type { HiConfig } from '../../config/schema.js'
import type { Category,MissionState } from '../mission/types.js'
import type { AvailableModel } from '../routing/model-resolver.js'
import { resolveModel,runtimeModelCandidateStatus } from '../routing/model-resolver.js'
import { deriveMissionModelFeedback } from '../routing/model-feedback.js'
import { classifyWorkerFailure } from '../worker/failure-classifier.js'
import { methodologyCatalog } from '../methodology/catalog.js'
import { ownershipContract } from '../skills/methodology.js'
import { DEFAULT_CONTEXT_BUDGET,clipText } from '../context/budget.js'
import { promptToolOverrides } from '../routing/execution-profile.js'
import { beginWorkerAttempt } from '../worker/worker-runtime.js'
import { recordPreexistingUserBaseline } from '../safety/staging-safety.js'
import { appendLedger } from '../ledger/ledger.js'
import { runtimeSignal,type RuntimeSignalSink } from '../events/event-sink.js'
import { syncMissionGates } from '../gates/gates.js'
import type { BackgroundRegistry } from '../background/registry.js'
import type { ConcurrencyScheduler } from '../scheduler/concurrency.js'
import { ChildExecutionCoordinator,type ChildWorkspaceBinding } from './child-execution-coordinator.js'
import { taskRuntimeAdmittedModel,reserveTaskRuntimeDispatch,bindTaskRuntimeHost,beginTaskRuntimeSettlement,releaseTaskRuntimeReservation } from '../scheduler/task-runtime-adapter.js'
import { recordRecoveryStrategy } from '../continuation/recovery-governor.js'

function providerOf(model:string|undefined):string|undefined{return model&&model!=='host-default'&&model.includes('/')?model.slice(0,model.indexOf('/')):undefined}
export type ChildCallbackDisposition='accept'|'restart-reconcile-pending'|'stale-mission'
export class TaskRecoveryCoordinator{
  callbackDisposition(m:MissionState,worker:{parent_mission_id?:string;generation_at_spawn?:number;restart_reconcile_pending?:boolean}):ChildCallbackDisposition{if(worker.restart_reconcile_pending)return'restart-reconcile-pending';if((worker.parent_mission_id!==undefined&&worker.parent_mission_id!==m.identity.mission_id)||(worker.generation_at_spawn!==undefined&&worker.generation_at_spawn!==m.continuation.generation))return'stale-mission';return'accept'}
  constructor(private readonly scheduler:ConcurrencyScheduler,private readonly registry:BackgroundRegistry,private readonly projectRoot:string,private readonly getConfig:()=>HiConfig,private readonly getModels:()=>AvailableModel[],private readonly getHostConfig:()=>Record<string,unknown>,private readonly events:RuntimeSignalSink|undefined,private readonly child:ChildExecutionCoordinator,private readonly drainQueueCallback:()=>void,private readonly workspaceBinding?:(m:MissionState,taskID:string)=>ChildWorkspaceBinding|undefined){}
  async recoverStagnation(m:MissionState,level:number):Promise<boolean>{
    if(![1,2].includes(level)||m.identity.status!=='active'||m.continuation.user_interrupted)return false
    const worker=[...m.execution.workers].reverse().find(w=>Boolean(w.session_id)&&!['failed','cancelled','busy','starting','queued'].includes(w.status))
    if(!worker?.session_id)return false
    const task=m.execution.tasks.find(t=>t.id===worker.task_id);if(!task)return false
    try{this.workspaceBinding?.(m,task.id)}catch(error){const marker=`workspace-orphan:${task.id}`;m.execution.blockers=[...new Set([...m.execution.blockers,marker])];appendLedger(m,'worker.recovery.workspace-blocked',{task_id:task.id,worker_id:worker.id,payload:{error:String(error)}});return false}
    let model=worker.model,variant=worker.model_variant,action='same-worker-resume'
    if(level===2){
      const stronger:Record<Category,Category>={quick:'standard',standard:'deep',visual:'deep',deep:'critical',critical:'critical'}
      const target=stronger[worker.category]
      const selected=resolveModel(target,this.getModels(),this.getConfig(),undefined,worker.role,this.getHostConfig(),deriveMissionModelFeedback(m,worker.role,target))
      const next=[selected.primary,...selected.fallbacks].find(x=>Boolean(x)&&x!==worker.model)
      if(!next)return false
      model=next;variant=next===selected.primary?selected.primaryVariant:selected.fallbackVariants[next];action='model-escalation'
    }
    if(!model)return false
    const previousWorkerStatus=worker.status,previousTaskStatus=task.status
    worker.status='ready';task.status='waiting'
    if(taskRuntimeAdmittedModel(m,worker,[model],this.scheduler)!==model){worker.status=previousWorkerStatus;task.status=previousTaskStatus;return false}
    const reservation=reserveTaskRuntimeDispatch(m,worker,model,this.scheduler);if(!reservation.accepted){worker.status=previousWorkerStatus;task.status=previousTaskStatus;return false}
    try{
      if(!this.scheduler.acquire(worker.id,providerOf(model),model==='host-default'?undefined:model)){releaseTaskRuntimeReservation(m,worker.id);worker.status=previousWorkerStatus;task.status=previousTaskStatus;return false}
      const bound=bindTaskRuntimeHost(m,worker.id,worker.session_id);if(!bound.accepted){this.scheduler.release(worker.id);releaseTaskRuntimeReservation(m,worker.id);worker.status=previousWorkerStatus;task.status=previousTaskStatus;return false}
      const previous=worker.model
      worker.model=model;worker.model_variant=variant;worker.generation_at_spawn=m.continuation.generation;worker.parent_mission_id=m.identity.mission_id;worker.status='busy';task.status='running';this.registry.set(worker)
      const instruction=level===1
        ?'Hi stagnation recovery: continue the SAME task/session with one narrowly scoped corrective attempt. Preserve completed work and evidence. Do not restart planning.'
        :`Hi stagnation recovery: continue the SAME task/session with policy escalation from ${previous??'default'} to ${model??'default'}. Preserve completed work and evidence. Do not restart planning.`
      beginWorkerAttempt(task,worker);this.child.recordModelProjection(worker,model,variant);await this.child.sendProviderPrompt(worker.session_id,clipText(`${instruction}\nReturn the normal structured WorkerResult.`,DEFAULT_CONTEXT_BUDGET.max_handoff_chars),worker.role,model==='host-default'?undefined:model,variant,promptToolOverrides(task.execution_profile?.tools??[]))
      recordRecoveryStrategy(m,{level:level as 1|2,action:action as 'same-worker-resume'|'model-escalation'},'started')
      appendLedger(m,'worker.stagnation-recovery',{task_id:task.id,worker_id:worker.id,payload:{level,action,from:previous,to:model,variant,generation:m.continuation.generation}})
      void this.events?.(runtimeSignal('worker.recovered',m.identity.mission_id,{task_id:task.id,worker_id:worker.id,payload:{level,action,from:previous,to:model,variant}}))
      return true
    }catch(error){
      let stopped=true;if(worker.session_id)try{stopped=await this.child.abortNativeSession(m,worker.session_id,'stagnation-recovery-failed',worker.id,task.id)}catch{stopped=false}
      if(stopped){this.scheduler.release(worker.id);releaseTaskRuntimeReservation(m,worker.id);worker.status='ready';task.status=task.result?.status==='DONE'?'completed':task.result?'waiting':'blocked'}else{const marker=`stagnation-recovery-abort-unavailable:${task.id}:${worker.id}`;m.execution.blockers=[...new Set([...m.execution.blockers,marker])];worker.status='busy';task.status='running'}this.registry.set(worker)
      appendLedger(m,'worker.stagnation-recovery.failed',{task_id:task.id,worker_id:worker.id,payload:{level,action,error:String(error),host_stopped:stopped}})
      return false
    }
  }
  async recoverRuntimeFailure(m:MissionState,workerID:string,error:string):Promise<boolean>{
    const worker=m.execution.workers.find(w=>w.id===workerID);if(!worker)return false
    const task=m.execution.tasks.find(t=>t.id===worker.task_id),failure=classifyWorkerFailure(error)
    worker.last_runtime_failure_kind=failure.kind;worker.runtime_fallback_exhausted=false
    appendLedger(m,'worker.failure.classified',{task_id:task?.id,worker_id:worker.id,payload:{kind:failure.kind,stagnation:failure.stagnation,retryable:failure.retryable,reason:failure.reason}})
    if(!failure.retryable||!['provider-transport','tool-incompatibility','context-overflow'].includes(failure.kind)||!worker.session_id||!task)return false
    const failedSession=worker.session_id,candidates=worker.fallbacks.filter(x=>x&&x!==worker.model)
    let stopped=false;try{stopped=await this.child.abortNativeSession(m,failedSession,'terminal-runtime-fallback',worker.id,task.id)}catch{}
    if(!stopped){const marker=`runtime-fallback-abort-unavailable:${task.id}:${worker.id}`;m.execution.blockers=[...new Set([...m.execution.blockers,marker])];worker.runtime_fallback_exhausted=true;appendLedger(m,'worker.runtime-fallback.abort-blocked',{task_id:task.id,worker_id:worker.id,payload:{session_id:failedSession,failure_class:failure.kind,marker}});return false}
    this.scheduler.release(worker.id);releaseTaskRuntimeReservation(m,worker.id);worker.session_id=undefined;worker.status='ready';task.status='waiting';this.registry.set(worker)
    for(const model of candidates){
      const runtimeCandidate=runtimeModelCandidateStatus(model,this.getModels(),this.getConfig(),this.getHostConfig());if(!runtimeCandidate.ok){appendLedger(m,'worker.runtime-fallback.skipped',{task_id:task.id,worker_id:worker.id,payload:{model,reason:runtimeCandidate.reason,failure_class:failure.kind,phase:'runtime-policy-revalidation'}});continue}
      const provider=providerOf(model),variant=task.execution_profile?.fallback_variants?.[model],previous=worker.model,fallbackReason=task.execution_profile?.fallback_reasons?.find(x=>x.model===model)?.reason??`runtime fallback after ${failure.kind}`
      const reservation=reserveTaskRuntimeDispatch(m,worker,model,this.scheduler);if(!reservation.accepted){appendLedger(m,'worker.runtime-fallback.skipped',{task_id:task.id,worker_id:worker.id,payload:{model,reason:reservation.reason,failure_class:failure.kind,source:'scheduler'}});continue}
      if(!this.scheduler.acquire(worker.id,provider,model==='host-default'?undefined:model)){releaseTaskRuntimeReservation(m,worker.id);appendLedger(m,'scheduler.resource-tracker-mismatch',{task_id:task.id,worker_id:worker.id,payload:{model,phase:'runtime-fallback'}});continue}
      try{
        this.child.recordModelProjection(worker,model,variant);const child=await this.child.create(m.identity.session_id,`Hi · ${worker.role} · runtime recovery · ${task.objective.slice(0,45)}`,worker.role,model==='host-default'?undefined:model,variant,this.workspaceBinding?.(m,task.id))
        if(!child?.id)throw new Error('Runtime fallback child session id missing')
        const recoverySessionID=String(child.id);worker.session_id=recoverySessionID;const bound=bindTaskRuntimeHost(m,worker.id,recoverySessionID);if(!bound.accepted)throw new Error(`Scheduler host binding failed during runtime fallback: ${bound.reason}`)
        worker.loaded_methodologies=[];worker.model=model;worker.model_variant=variant;worker.fallback_history=[...(worker.fallback_history??[]),{from:previous,to:model,variant,reason:`${fallbackReason}; failure=${failure.kind}`,phase:'runtime',at:Date.now()}];worker.status='busy';worker.runtime_recovery_pending=true;worker.runtime_recovery_attempt=(worker.runtime_recovery_attempt??0)+1;worker.generation_at_spawn=m.continuation.generation;worker.parent_mission_id=m.identity.mission_id;worker.started_at=Date.now();task.status='running';this.registry.set(worker)
        recordPreexistingUserBaseline(m,await this.child.captureNativeDiff(worker,'baseline'))
        const exitRequirements=worker.selected_methodologies.flatMap(name=>{const item=methodologyCatalog(this.projectRoot).find(x=>x.name===name);return item?[`${name}: ${item.exitRequirements.join(', ')}`]:[]})
        const prompt=clipText([ownershipContract('child',worker.selected_methodologies),`Hi terminal runtime recovery for existing task ${task.id}.`,`Failure class: ${failure.kind}.`,`Previous failed session: ${failedSession}.`,`Fallback model: ${model}.`,`OBJECTIVE: ${task.objective}`,`SCOPE: ${task.scope.join(', ')||'bounded by objective'}`,`CURRENT USER CONSTRAINTS: ${(task.constraints??[]).join(' | ')||'none'}.`,`OBSERVED CHANGED FILES SO FAR: ${m.vcs.changed_files.slice(-30).join(', ')||'none'}`,`METHODOLOGY EXIT REQUIREMENTS: ${exitRequirements.join(' | ')||'none'}`,worker.selected_methodologies.length?'This is a fresh child session. Reload every still-selected methodology through the native skill tool before applying it.':'No methodology is selected for this recovery.','Preserve already-observed repository changes and bounded evidence, but do not assume the failed session context is present. Inspect only the minimum current state needed to continue the SAME task. Do not restart top-level planning. Return the normal structured WorkerResult.'].join('\n'),DEFAULT_CONTEXT_BUDGET.max_handoff_chars)
        beginWorkerAttempt(task,worker);await this.child.sendProviderPrompt(recoverySessionID,prompt,worker.role,model==='host-default'?undefined:model,variant,promptToolOverrides(task.execution_profile?.tools??[]))
        appendLedger(m,'worker.runtime-fallback',{task_id:task.id,worker_id:worker.id,payload:{from:previous,to:model,variant,reason:fallbackReason,failure_class:failure.kind,attempt:worker.runtime_recovery_attempt,from_session:failedSession,to_session:worker.session_id,session_mode:'fresh'}})
        return true
      }catch(nextError){
        worker.runtime_recovery_pending=false;let recoveryStopped=true;if(worker.session_id)try{recoveryStopped=await this.child.abortNativeSession(m,worker.session_id,'runtime-fallback-failed',worker.id,task.id)}catch{recoveryStopped=false}
        if(recoveryStopped){this.scheduler.release(worker.id);releaseTaskRuntimeReservation(m,worker.id);worker.session_id=undefined;worker.status='ready';task.status='waiting';this.registry.set(worker)}else{const marker=`runtime-fallback-recovery-abort-unavailable:${task.id}:${worker.id}`;m.execution.blockers=[...new Set([...m.execution.blockers,marker])];worker.status='busy';task.status='running';this.registry.set(worker)}
        appendLedger(m,'worker.runtime-fallback.failed',{task_id:task.id,worker_id:worker.id,payload:{model,error:String(nextError),failure_class:failure.kind,from_session:failedSession,host_stopped:recoveryStopped}});if(!recoveryStopped)return false
      }
    }
    worker.runtime_fallback_exhausted=true;m.continuation.stagnation_count=0;const blocker=`provider-failure:${failure.kind}:${worker.model??'unknown'}`;m.execution.blockers=[...new Set([...m.execution.blockers,blocker])];task.status='blocked';task.updated_at=Date.now();task.result={status:'BLOCKED',summary:'Runtime provider/model fallback chain exhausted.',changed_files:[],evidence:[],open_issues:[blocker],needs_context:['provider/model availability or alternate execution path']};appendLedger(m,'worker.runtime-fallback.exhausted',{task_id:task.id,worker_id:worker.id,payload:{failure_class:failure.kind,attempted:[worker.model,...candidates].filter(Boolean)}});return false
  }
  fail(m:MissionState,workerID:string,error:string):void{const worker=m.execution.workers.find(w=>w.id===workerID);if(!worker)return;if(worker.generation_at_spawn!==undefined&&worker.generation_at_spawn!==m.continuation.generation){appendLedger(m,'worker.failure.stale-generation-ignored',{worker_id:worker.id});return}const settlement=beginTaskRuntimeSettlement(m,worker);if(!settlement.accepted&&settlement.reason!=='reservation-not-found'){appendLedger(m,'worker.failure.scheduler-fence-rejected',{worker_id:worker.id,payload:{reason:settlement.reason}});return}const task=m.execution.tasks.find(t=>t.id===worker.task_id),permissionFailure=worker.last_runtime_failure_kind==='permission',marker=permissionFailure?`permission-failure:${worker.id}`:error;worker.status='failed';worker.completed_at=Date.now();this.scheduler.release(worker.id);releaseTaskRuntimeReservation(m,worker.id);this.registry.delete(worker.id);if(permissionFailure)m.continuation.stagnation_count=0;if(task){task.status='failed';task.updated_at=Date.now();task.result={status:'FAILED',summary:error,changed_files:[],evidence:[],open_issues:[marker],needs_context:permissionFailure?['resolve OpenCode permission/authority and explicitly resume the mission']:[]}}m.execution.blockers=[...new Set([...m.execution.blockers,marker])];appendLedger(m,'worker.failed',{task_id:task?.id,worker_id:worker.id,payload:{error,failure_class:worker.last_runtime_failure_kind??'unknown',blocker:marker}});void this.events?.(runtimeSignal('worker.failed',m.identity.mission_id,{task_id:task?.id,worker_id:worker.id,payload:{error,failure_class:worker.last_runtime_failure_kind??'unknown'}}));syncMissionGates(m);this.drainQueueCallback()}
}
