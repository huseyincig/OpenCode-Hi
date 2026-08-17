import { createHash } from 'node:crypto'
import { authorityClassForPatterns } from '../safety/project-authority.js'
import { appendLedger } from '../ledger/ledger.js'
import { addEvidence, markMutation, normalizeProjectPath } from '../evidence/evidence-runtime.js'
import { evidenceProducerAttemptForWorker } from '../evidence/applicability.js'
import { parseWorkerResult } from '../task/result-parser.js'
import { automaticContinuationEnabled, adaptiveIdleEvaluatorEnabled } from '../../config/execution-policy.js'
import { dispatchContinuation } from '../continuation/dispatcher.js'
import { classifyRuntimeHumanDecision,openHumanDecision } from '../human-decision/runtime.js'
import { runtimeSignal } from '../events/event-sink.js'
import { evaluateIdle, shouldCountStagnation } from '../continuation/evaluator.js'
import { evaluateCompletion } from '../completion/evaluator.js'
import type { PluginRuntimeState } from './hi-tool-surface.js'
import type { HostEvent,HostPort } from '../host/port.js'
import type { createRuntimeServices } from './runtime-services.js'
import type { ProjectAuthorityStore } from '../safety/project-authority.js'

export class RuntimeEventController{
  constructor(private readonly deps:{state:PluginRuntimeState;host:HostPort;services:ReturnType<typeof createRuntimeServices>;projectAuthority:ProjectAuthorityStore;pendingNativePermissions:Map<string,string[]>;projectRoot:string}){}
  async handle(ev:HostEvent){
    const {state,host,services,projectAuthority,pendingNativePermissions,projectRoot}=this.deps
    const {store,background,persistence,tasks,teams,processRuntime,workspaceRuntime,eventSink,scopedStores}=services

    if(ev.kind==='installation-updated'){await host.refreshRuntimeInventory('installation-updated');return}
    if(ev.rawType==='server.connected'){await host.refreshRuntimeInventory('server-connected');return}
    const sid=ev.sessionID;if(!sid)return
    const nativePermissionID=ev.permission?.id
    if(ev.kind==='permission-asked'&&nativePermissionID)pendingNativePermissions.set(nativePermissionID,ev.permission?.patterns??[])
    if(ev.kind==='permission-replied'&&nativePermissionID){const patterns=[...new Set([...pendingNativePermissions.get(nativePermissionID)??[],...(ev.permission?.patterns??[])])];if(ev.permission?.reply==='always'){const cls=authorityClassForPatterns(patterns);if(cls){projectAuthority.grant(cls);await host.log('info','Hi project authority persisted from native always approval',{authority_class:cls,patterns})}}pendingNativePermissions.delete(nativePermissionID)}
    const child=tasks.resolveChildCallback(sid)
    const childMission=child?store.get(child.parent_session_id):undefined
    const mission=childMission??store.get(sid)
    if(mission){await teams.expireMission(mission);await teams.reconcileMission(mission);if(child?.status==='cancelled'){appendLedger(mission,'worker.callback.after-team-shutdown-ignored',{worker_id:child.id,payload:{session_id:sid,event:ev.rawType}});persistence.save(store.all());return}}
    if(child&&mission&&tasks.childCallbackDisposition(mission,child)==='restart-reconcile-pending'){appendLedger(mission,'worker.callback.pre-reconcile-ignored',{worker_id:child.id,payload:{session_id:sid,event:ev.rawType,reason:'runtime-restart-reconcile-pending'}});persistence.save(store.all());return}
    if(child&&mission&&tasks.childCallbackDisposition(mission,child)==='stale-mission'){appendLedger(mission,'worker.callback.stale-mission-ignored',{worker_id:child?.id,payload:{worker_mission_id:child?.parent_mission_id,mission_id:mission.identity.mission_id,worker_generation:child?.generation_at_spawn,mission_generation:mission.continuation.generation,event:ev.rawType}});persistence.save(store.all());return}
    if(mission&&(mission.continuation.user_interrupted||mission.identity.status==='stopped')){appendLedger(mission,'runtime.event.after-user-stop-ignored',{worker_id:child?.id,payload:{session_id:sid,event:ev.rawType}});persistence.save(store.all());return}
    if(ev.kind==='permission-asked'&&mission){const pid=ev.permission?.id;mission.authority.pending_permission_ids??=[];const alreadyReplied=Boolean(pid&&mission.execution.ledger.some(e=>e.type==='permission.replied'&&e.payload?.permission_id===pid||e.type==='permission.duplicate-ignored'&&e.payload?.permission_id===pid&&e.payload?.event==='replied'));if(alreadyReplied){if(pid)pendingNativePermissions.delete(pid);appendLedger(mission,'permission.stale-ask-ignored',{worker_id:child?.id,payload:{session_id:sid,permission_id:pid,reason:'reply-observed-first'}})}else if(!pid||!mission.authority.pending_permission_ids.includes(pid)){if(pid)mission.authority.pending_permission_ids.push(pid);mission.authority.pending_permissions=(mission.authority.pending_permissions??0)+1;appendLedger(mission,'permission.asked',{worker_id:child?.id,payload:{session_id:sid,permission_id:pid}})}else appendLedger(mission,'permission.duplicate-ignored',{worker_id:child?.id,payload:{session_id:sid,permission_id:pid,event:'asked'}});persistence.save(store.all());return}
    if(ev.kind==='permission-replied'&&mission){const pid=ev.permission?.id;mission.authority.pending_permission_ids??=[];const idx=pid?mission.authority.pending_permission_ids.indexOf(pid):-1;if(pid&&idx<0){appendLedger(mission,'permission.duplicate-ignored',{worker_id:child?.id,payload:{session_id:sid,permission_id:pid,event:'replied'}})}else{if(idx>=0)mission.authority.pending_permission_ids.splice(idx,1);mission.authority.pending_permissions=Math.max(0,(mission.authority.pending_permissions??0)-1);appendLedger(mission,'permission.replied',{worker_id:child?.id,payload:{session_id:sid,permission_id:pid,decision:ev.permission?.decision??'unknown'}})}persistence.save(store.all());return}
    if(child){
      const m=childMission;if(!m)return
      if(ev.kind==='file-edited'||ev.kind==='file-watcher-updated'||ev.kind==='session-diff'){
        const files=ev.filePaths;const stateHash=ev.kind==='session-diff'?createHash('sha256').update(JSON.stringify(ev.properties??{})).digest('hex'):undefined;if(files.length)await tasks.noteNativeWriteSet(m,child.id,files,ev.rawType,stateHash);persistence.save(store.all());return
      }
      if(ev.kind==='session-status'){const nativeStatus=ev.status;tasks.noteNativeStatus(m,child.id,nativeStatus);if(child.runtime_recovery_pending&&!/idle|completed|stopped/i.test(nativeStatus)){child.runtime_recovery_pending=false;appendLedger(m,'worker.runtime-fallback.active',{task_id:child.task_id,worker_id:child.id,payload:{status:nativeStatus,attempt:child.runtime_recovery_attempt??0}})}persistence.save(store.all());return}
      if(ev.kind==='lsp-diagnostics'){
        const diagnostics=Array.isArray(ev.properties?.diagnostics)?ev.properties.diagnostics:[];const errors=diagnostics.filter((d:any)=>['error',1].includes(d?.severity)).length
        addEvidence(m,{kind:'lsp-diagnostics',summary:`native LSP diagnostics: ${errors} error(s), ${diagnostics.length} total`,scope:child.write_set??[],source:`session:${sid}:lsp`,source_session_id:sid,source_state_hash:child.native_state_hash,task_id:child.task_id,obligation_ids:m.execution.tasks.find(t=>t.id===child.task_id)?.obligation_ids??[],producer_attempt:evidenceProducerAttemptForWorker(m,child),pass:errors===0,outcome:errors===0?'passed':'failed',reason:errors?`${errors} error diagnostic(s)`:undefined});persistence.save(store.all());return
      }
      if(ev.kind==='session-error'||ev.kind==='session-deleted'){
        const detail=String(ev.properties?.error?.message??ev.properties?.error??ev.rawType)
        if(ev.kind==='session-error'&&await tasks.recoverRuntimeFailure(m,child.id,detail)){store.updateProgress(m);appendLedger(m,'parent.wake',{worker_id:child.id,payload:{result:'RUNTIME_FALLBACK',event:ev.rawType}});persistence.save(store.all());return}
        tasks.fail(m,child.id,detail);await tasks.cleanupWorkspaceForTask(m,child.task_id);await teams.reconcileMission(m);store.updateProgress(m);appendLedger(m,'parent.wake',{worker_id:child.id,payload:{result:'FAILED',event:ev.rawType}})
        const siblingPending=background.pendingFor(m.identity.session_id).filter(w=>w.id!==child.id),permissionFailure=child.last_runtime_failure_kind==='permission';if(permissionFailure){m.continuation.stagnation_count=0;openHumanDecision(m,{semantic_type:'operational_action',reason_code:'permission-failure',summary:`Native child permission failure requires user/runtime intervention before retry. ${detail.slice(0,240)}`,task_id:child.task_id,worker_id:child.id,response_schema:{kind:'external-action'}})}else if(automaticContinuationEnabled(state.config.executionPolicy)&&!m.continuation.user_interrupted&&!siblingPending.length)await dispatchContinuation(host,m,'Hi child worker failed. Reconcile the failure, preserve completed work, and choose the minimum safe recovery. Do not duplicate completed tasks.','child-failed');else if(siblingPending.length)appendLedger(m,'parent.wake.deferred',{worker_id:child.id,payload:{reason:'sibling-workers-pending',pending:siblingPending.map(w=>w.id).slice(0,20)}})
        persistence.save(store.all());return
      }
      if(ev.kind!=='session-idle')return
      if(child.runtime_recovery_pending){appendLedger(m,'worker.callback.pre-fallback-active-ignored',{task_id:child.task_id,worker_id:child.id,payload:{session_id:sid,attempt:child.runtime_recovery_attempt??0,event:ev.rawType}});persistence.save(store.all());return}
      if(child.status==='completed'||child.status==='failed'||child.status==='cancelled')return
      try{const assistant=await host.readAssistantResult(sid,12),modelEvidence=assistant.model,text=assistant.text;if(assistant.usage)tasks.noteUsage(m,child.id,assistant.usage);if(!modelEvidence&&!text){appendLedger(m,'worker.idle.pre-assistant-ignored',{task_id:child.task_id,worker_id:child.id,payload:{session_id:sid}});persistence.save(store.all());return}const effective=tasks.noteEffectiveModel(m,child.id,modelEvidence?{...modelEvidence,source:'assistant-message-metadata'}:undefined);let result=parseWorkerResult(text);if(!effective.ok)result={...result,status:'BLOCKED',summary:`Effective child model could not be verified against the selected execution model. ${effective.reason}`,open_issues:[...new Set([...(result.open_issues??[]),effective.reason])],needs_context:[...new Set([...(result.needs_context??[]),'effective-model-reconcile: refresh runtime inventory/provider policy and resume with a verified role-selected model'])]};result=await tasks.reconcileNativeResult(m,child.id,result);tasks.applyResult(m,child.id,result);if(['completed','failed','cancelled'].includes(child.status))await tasks.cleanupWorkspaceForTask(m,child.task_id);await teams.reconcileMission(m);if(['completed','failed','cancelled'].includes(child.status))background.delete(child.id);else background.set(child);store.updateProgress(m);appendLedger(m,'parent.wake',{worker_id:child.id,payload:{result:result.status}});if(automaticContinuationEnabled(state.config.executionPolicy)&&!m.continuation.user_interrupted&&!background.pendingFor(m.identity.session_id).length)await dispatchContinuation(host,m,'Hi child result is ready. Reconcile it against current obligations. Prefer same-session corrective resume for NEEDS_CONTEXT/FIX_REQUIRED. Do not create duplicate tasks.','child-result-ready')}catch(e){tasks.fail(m,child.id,String(e));appendLedger(m,'worker.result.failed',{worker_id:child.id,payload:{error:String(e)}})}
      persistence.save(store.all());return
    }
    if(ev.kind==='session-deleted'){const parent=store.get(sid);if(parent){store.stop(sid,'parent-session-deleted');await processRuntime.stopMission(parent);await tasks.cancelAll(parent);if(workspaceRuntime)await workspaceRuntime.cleanupMission(parent);persistence.save(store.all())}return}
    if(ev.kind==='todo-updated'){const m=store.get(sid);if(m){const todos=ev.properties?.todos??ev.properties?.items??[];if(Array.isArray(todos))m.execution.native_todos_incomplete=todos.filter((t:any)=>!['completed','cancelled','done'].includes(String(t?.status??'').toLowerCase())).length;store.updateProgress(m);persistence.save(store.all())}return}
    if((ev.kind==='file-edited'||ev.kind==='file-watcher-updated'||ev.kind==='session-diff')&&mission){const files=ev.filePaths.map(file=>normalizeProjectPath(file,projectRoot)).filter(Boolean);if(files.length){markMutation(mission,files,ev.rawType);scopedStores.projectIntelligence.invalidateChanged(files);scopedStores.contextArtifacts.invalidateChanged(files);scopedStores.skillCatalog.invalidateChanged(files)}persistence.save(store.all());return}
    if(ev.kind==='lsp-diagnostics'&&mission){const diagnostics=Array.isArray(ev.properties?.diagnostics)?ev.properties.diagnostics:[];const errors=diagnostics.filter((d:any)=>['error',1].includes(d?.severity)).length;addEvidence(mission,{kind:'lsp-diagnostics',summary:`native LSP diagnostics: ${errors} error(s), ${diagnostics.length} total`,scope:mission.vcs.changed_files,source:`session:${sid}:lsp`,source_session_id:sid,obligation_ids:mission.execution.obligations.filter(o=>o.kind==='verification'&&o.status==='open').map(o=>o.id),pass:errors===0,outcome:errors===0?'passed':'failed',reason:errors?`${errors} error diagnostic(s)`:undefined});persistence.save(store.all());return}
    if(ev.kind==='session-compacted'&&mission){appendLedger(mission,'session.compacted',{payload:{source:'native-event'}});persistence.save(store.all());return}
    if(ev.kind!=='session-idle')return
    const m=store.get(sid);if(!m||!adaptiveIdleEvaluatorEnabled(state.config.executionPolicy))return
    const progressed=store.updateProgress(m,false);void eventSink(runtimeSignal('mission.idle',m.identity.mission_id));let decision=evaluateIdle(m);if(!progressed&&shouldCountStagnation(decision)){store.updateProgress(m,true);decision=evaluateIdle(m)}appendLedger(m,'runtime.decision',{payload:{decision:decision.decision,reason:decision.reason,reason_code:decision.reason_code,progressed,stagnation_count:m.continuation.stagnation_count}})
    if(decision.decision==='STOP'){const c=evaluateCompletion(m);if(c.complete)store.complete(sid);persistence.save(store.all());return}
    if(decision.decision==='USER_ACTION_REQUIRED'){if(m.authority.human_decision?.status!=='OPEN'){const human=classifyRuntimeHumanDecision(decision.reason_code);openHumanDecision(m,{...human,reason_code:decision.reason_code,summary:decision.reason})}persistence.save(store.all());return}
    if(decision.decision==='RECOVER'&&decision.reason_code==='stagnation-recovery'){const match=/^stagnation-level-(\d+):/.exec(decision.reason);const level=match?Number(match[1]):0;if(level&&await tasks.recoverStagnation(m,level)){store.updateProgress(m);persistence.save(store.all());return}}
    if(decision.prompt&&['CONTINUE','RECONCILE','VERIFY','RECOVER'].includes(decision.decision))await dispatchContinuation(host,m,decision.prompt,decision.reason)
    persistence.save(store.all())
  }
}
