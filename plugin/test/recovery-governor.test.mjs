import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {RuntimePersistence} from '../dist/runtime/state/persistence.js'
import {recoveryPlan} from '../dist/runtime/continuation/recovery.js'
import {recordRecoveryStrategy,recoveryStrategyEligibility} from '../dist/runtime/continuation/recovery-governor.js'
import {dispatchContinuation} from '../dist/runtime/continuation/dispatcher.js'
import {evaluateIdle} from '../dist/runtime/continuation/evaluator.js'
import {startAssessedMission} from './helpers/semantic.mjs'

function mission(id='recovery-governor'){
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,id,'opaque implementation',{task_kind:'implementation',likely_verification:[]})
  m.execution.obligations=m.execution.obligations.filter(o=>o.kind!=='verification')
  store.updateProgress(m,false)
  return{store,m}
}

test('same recovery strategy cannot replay on unchanged semantic state and deterministically advances rung',()=>{
  const {m}=mission('rg-repeat');m.continuation.stagnation_count=1
  const first=recoveryPlan(m);assert.equal(first.action,'same-worker-resume');assert.equal(recoveryStrategyEligibility(m,first).allowed,true)
  recordRecoveryStrategy(m,first,'started',10)
  assert.equal(recoveryStrategyEligibility(m,first).allowed,false)
  const next=recoveryPlan(m);assert.equal(next.level,2);assert.equal(next.action,'same-worker-resume')
  assert.notEqual(next.level,first.level)
  assert.notEqual(recoveryStrategyEligibility(m,next).fingerprint,recoveryStrategyEligibility(m,first).fingerprint)
  assert.match(next.prompt,/materially different corrective hypothesis or action/i)
})

test('material semantic delta permits the same recovery strategy again',()=>{
  const {store,m}=mission('rg-new-info');m.continuation.stagnation_count=1
  const first=recoveryPlan(m);recordRecoveryStrategy(m,first,'started',10)
  m.execution.blockers.push('new-diagnostic-information');assert.equal(store.updateProgress(m,false),true)
  m.continuation.stagnation_count=1
  const again=recoveryPlan(m);assert.equal(again.level,1);assert.equal(again.action,'same-worker-resume')
  assert.equal(recoveryStrategyEligibility(m,again).allowed,true)
})

test('unknown consequential release outcome blocks automatic recovery until reconciliation',()=>{
  const {m}=mission('rg-unknown-effect');m.continuation.stagnation_count=3
  m.release.release_chain={push:{outcome:'unknown',at:Date.now(),command:'git push'}}
  assert.equal(recoveryPlan(m).action,'user-action')
  const decision=evaluateIdle(m);assert.equal(decision.decision,'USER_ACTION_REQUIRED');assert.equal(decision.reason_code,'recovery-effect-uncertain');assert.equal(decision.reason,'release-push-outcome-unknown')
  assert.equal(m.continuation.stagnation_count,0)
})

test('busy parent session defers synthetic continuation without counting a transport failure',async()=>{
  const {m}=mission('rg-busy-parent');const calls=[]
  const host={sessionStatus:async()=>'busy',continueSession:async(...args)=>{calls.push(args);return true}}
  const ok=await dispatchContinuation(host,m,'continue safely','child-result-ready')
  assert.equal(ok,false);assert.equal(calls.length,0);assert.equal(m.continuation.continuation_failure_count??0,0)
  assert.ok(m.execution.ledger.some(e=>e.type==='continuation.deferred'&&e.payload?.reason==='parent-session-active'&&e.payload?.host_status==='busy'))
})

test('delivered stagnation continuation records the exact strategy decision state',async()=>{
  const {m}=mission('rg-dispatch');m.continuation.stagnation_count=3
  const plan=recoveryPlan(m);assert.equal(plan.action,'narrow-task')
  const calls=[];const host={sessionStatus:async()=>'idle',continueSession:async(...args)=>{calls.push(args);return true}}
  const ok=await dispatchContinuation(host,m,plan.prompt,`stagnation-level-${plan.level}:${plan.action}`)
  assert.equal(ok,true);assert.equal(calls.length,1)
  const last=m.continuation.recovery_history?.at(-1);assert.equal(last.action,'narrow-task');assert.equal(last.level,3);assert.equal(last.outcome,'started');assert.equal(last.progress_signature,m.continuation.semantic_progress_snapshot.state_hash)
})

test('recovery history is bounded and malformed durable records fail closed',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-recovery-governor-'))
  try{
    const store=new MissionStore(root),m=startAssessedMission(store,'rg-persist','opaque',{task_kind:'implementation',likely_verification:[]});m.execution.obligations=m.execution.obligations.filter(o=>o.kind!=='verification');store.updateProgress(m,false)
    for(let i=0;i<30;i++){m.continuation.stagnation_count=(i%5)+1;const plan=recoveryPlan(m);recordRecoveryStrategy(m,plan,'started',100+i);m.continuation.recovery_history.at(-1).progress_signature=`${(i+1).toString(16).padStart(8,'0')}`}
    assert.equal(m.continuation.recovery_history.length,24)
    const persistence=new RuntimePersistence(root);persistence.save(store.all(),true);assert.equal(persistence.load().length,1)
    const raw=JSON.parse(readFileSync(persistence.path,'utf8'));raw.missions[0].continuation.recovery_history[0].fingerprint='forged';writeFileSync(persistence.path,JSON.stringify(raw));assert.equal(persistence.load().length,0);assert.match(String(persistence.lastLoadReport.error),/invalid mission state/i)
  }finally{rmSync(root,{recursive:true,force:true})}
})
