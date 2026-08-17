import type { MissionState } from '../mission/types.js'
import { evaluateCompletion } from '../completion/evaluator.js'
import { recoveryPlan } from './recovery.js'
import { evaluatePreconditions } from '../readiness/preconditions.js'
import { latestBlockingVerificationEvidence } from '../verification/policy.js'
import { setRuntimeNudge } from '../nudge/runtime-nudge.js'
import { ambiguousConsequentialEffect } from './recovery-governor.js'
export type RuntimeDecision='NOTHING'|'WAIT'|'CONTINUE'|'RECONCILE'|'VERIFY'|'RECOVER'|'USER_ACTION_REQUIRED'|'STOP'
export type IdleReasonCode='no-active-mission'|'user-stop'|'mission-inactive'|'continuation-lock'|'continuation-reentrant'|'suppressed'|'waiting-permission'|'waiting-worker'|'waiting-process'|'process-orphan-blocked'|'worker-result-unreconciled'|'contract-ambiguity-repo-first'|'precondition-blocked'|'complete'|'waiting-user-authority'|'verification-pending'|'verification-failed'|'verification-environment-issue'|'provider-failure-blocked'|'permission-failure-blocked'|'continuation-runtime-retry'|'continuation-runtime-exhausted'|'execution-budget-exhausted'|'recovery-effect-uncertain'|'stagnation-recovery'|'open-obligation'
export interface DecisionResult{decision:RuntimeDecision;reason:string;reason_code:IdleReasonCode;prompt?:string}
export function evaluateIdle(m:MissionState|undefined,now=Date.now()):DecisionResult{
  if(!m)return{decision:'NOTHING',reason:'no-active-mission',reason_code:'no-active-mission'}
  if(m.continuation.user_interrupted||m.identity.status==='stopped')return{decision:'STOP',reason:'user-stop',reason_code:'user-stop'}
  if(m.identity.status!=='active')return{decision:'WAIT',reason:`mission-${m.identity.status}`,reason_code:'mission-inactive'}
  if(m.continuation.continuation_active)return{decision:'WAIT',reason:'continuation-reentrant',reason_code:'continuation-reentrant'}
  if((m.continuation.suppress_until??0)>now)return{decision:'WAIT',reason:'suppressed',reason_code:'suppressed'}
  if((m.continuation.continuation_lock_until??0)>now)return{decision:'WAIT',reason:'continuation-lock',reason_code:'continuation-lock'}
  if((m.authority.pending_permissions??0)>0)return{decision:'WAIT',reason:'waiting-permission',reason_code:'waiting-permission'}
  if(m.execution.workers.some(w=>['created','queued','starting','busy'].includes(w.status)))return{decision:'WAIT',reason:'waiting-worker',reason_code:'waiting-worker'}
  if(m.execution.processes.some(p=>p.status==='RUNNING'))return{decision:'WAIT',reason:'waiting-process',reason_code:'waiting-process'}
  const orphan=m.execution.processes.find(p=>p.status==='ORPHANED');if(orphan){m.continuation.stagnation_count=0;return{decision:'USER_ACTION_REQUIRED',reason:`process-orphan:${orphan.process_id}`,reason_code:'process-orphan-blocked'}}
  const continuationFailures=m.continuation.continuation_failure_count??0;if(continuationFailures>=3)return{decision:'USER_ACTION_REQUIRED',reason:`continuation-runtime-failures:${continuationFailures}`,reason_code:'continuation-runtime-exhausted'};if(continuationFailures>0){const instruction='The previous Hi continuation delivery failed at the OpenCode runtime/transport layer. Retry the same bounded continuation without changing strategy or counting this as reasoning stagnation.';return{decision:'CONTINUE',reason:`continuation-runtime-retry:${continuationFailures}`,reason_code:'continuation-runtime-retry',prompt:continuationPrompt(m,instruction)}}
  if(m.execution.tasks.some(t=>t.result&&['FIX_REQUIRED','NEEDS_CONTEXT'].includes(t.result.status))){const instruction='Reconcile the latest worker result. Prefer same-session corrective resume; do not spawn a replacement unless justified.';setRuntimeNudge(m,instruction,'worker-result-unreconciled');return{decision:'RECONCILE',reason:'worker-result-unreconciled',reason_code:'worker-result-unreconciled',prompt:continuationPrompt(m,instruction)}}
  const pre=evaluatePreconditions(m);const contractOnly=pre.items.filter(x=>x.status==='blocked').every(x=>x.id==='gate-contract-ambiguity')&&pre.items.some(x=>x.id==='gate-contract-ambiguity'&&x.status==='blocked')
  if(!pre.ready&&contractOnly){const instruction='Resolve the contract-critical ambiguity from repository structure, existing contracts, tests, or evidence before asking the user. Do not implement until resolved.';setRuntimeNudge(m,instruction,'contract-ambiguity-repo-first');return{decision:'CONTINUE',reason:'contract-ambiguity-repo-first',reason_code:'contract-ambiguity-repo-first',prompt:continuationPrompt(m,instruction)}}
  const hard=pre.items.find(x=>x.status==='blocked');if(hard)return{decision:'USER_ACTION_REQUIRED',reason:`precondition:${hard.id}:${hard.reason}`,reason_code:'precondition-blocked'}
  const permissionBlocker=m.execution.blockers.find(x=>x.startsWith('permission-failure:'));if(permissionBlocker){m.continuation.stagnation_count=0;return{decision:'USER_ACTION_REQUIRED',reason:permissionBlocker,reason_code:'permission-failure-blocked'}}
  const providerBlocker=m.execution.blockers.find(x=>x.startsWith('provider-failure:'));if(providerBlocker){m.continuation.stagnation_count=0;return{decision:'USER_ACTION_REQUIRED',reason:providerBlocker,reason_code:'provider-failure-blocked'}}
  const completion=evaluateCompletion(m);if(completion.complete)return{decision:'STOP',reason:'complete',reason_code:'complete'}
  const uncertainEffect=ambiguousConsequentialEffect(m);if(uncertainEffect){m.continuation.stagnation_count=0;return{decision:'USER_ACTION_REQUIRED',reason:uncertainEffect,reason_code:'recovery-effect-uncertain'}}
  if(completion.next==='USER_ACTION_REQUIRED')return{decision:'USER_ACTION_REQUIRED',reason:'waiting-user-authority',reason_code:'waiting-user-authority'}
  if(completion.next==='VERIFY'){
    const latest=latestBlockingVerificationEvidence(m)
    if(latest?.outcome==='environment-issue'){m.continuation.stagnation_count=0;const instruction='Verification could not run because of an environment/tooling issue. Recover the environment or use an equivalent allowed verification path; do not modify product code merely to make an unavailable verifier run, and do not count this as reasoning stagnation.';setRuntimeNudge(m,instruction,'verification-environment-issue');return{decision:'RECOVER',reason:latest.reason??'verification-environment-issue',reason_code:'verification-environment-issue',prompt:continuationPrompt(m,instruction)}}
    if(latest?.outcome==='failed'){const instruction='Latest verification failed. Reconcile the failure with the current task and apply the minimum corrective change before re-running targeted verification.';setRuntimeNudge(m,instruction,'verification-failed');return{decision:'RECOVER',reason:latest.reason??'verification-failed',reason_code:'verification-failed',prompt:continuationPrompt(m,instruction)}}
    const instruction='Verification is required and current evidence is stale or missing. Run the minimum sufficient verification.';setRuntimeNudge(m,instruction,'verification-pending');return{decision:'VERIFY',reason:'verification-pending',reason_code:'verification-pending',prompt:continuationPrompt(m,instruction)}
  }
  const recovery=recoveryPlan(m);if(m.continuation.iteration>=m.continuation.continuation_budget||recovery.action==='user-action')return{decision:'USER_ACTION_REQUIRED',reason:'execution-budget-exhausted',reason_code:'execution-budget-exhausted'}
  if(recovery.level>0){setRuntimeNudge(m,recovery.prompt,`stagnation-level-${recovery.level}`);return{decision:'RECOVER',reason:`stagnation-level-${recovery.level}:${recovery.action}`,reason_code:'stagnation-recovery',prompt:continuationPrompt(m,recovery.prompt)}}
  setRuntimeNudge(m,recovery.prompt,'open-obligation');return{decision:'CONTINUE',reason:'open-obligation',reason_code:'open-obligation',prompt:continuationPrompt(m,recovery.prompt)}
}
export function continuationPrompt(m:MissionState,action:string):string{const open=m.execution.obligations.filter(o=>o.status==='open').map(o=>o.summary).slice(0,3);return['Hi runtime: mission is still active.',`Open obligation: ${open.join(' | ')||'none'}.`,action,'Resume from current state. Do not restart planning. Do not create duplicate tasks.'].join('\n')}

export function shouldCountStagnation(decision:DecisionResult):boolean{return decision.reason_code==='open-obligation'||decision.reason_code==='contract-ambiguity-repo-first'||decision.reason_code==='stagnation-recovery'}
