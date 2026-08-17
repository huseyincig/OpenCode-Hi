import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { ConcurrencyScheduler } from '../dist/runtime/scheduler/concurrency.js'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { createTask, createWorker } from '../dist/runtime/worker/worker-runtime.js'
import { verificationSatisfied } from '../dist/runtime/verification/policy.js'
import { DEFAULT_HI_CONFIG } from '../dist/config/defaults.js'
import {opencodeChildPort} from './helpers/host-port.mjs'

function runtime(){
  return new TaskRuntime(opencodeChildPort({}),new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
}

test('worker-reported verification cannot become fresh when changed_files is only learned from the same result',()=>{
  const s=new MissionStore(); const m=s.start('parent','fix bug and test it')
  m.execution.verification_policy={requiredKinds:['targeted-tests'],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:true}
  const t=createTask(m,{objective:'fix',role:'coder',category:'standard',scope:['src/a.ts'],dependencies:[],requiredEvidence:['targeted-tests']})
  const w=createWorker(m,t,'host-default',[],[],[]); w.status='busy'; w.started_at=Date.now()-10; w.session_id='worker-session'; w.native_state_hash='a'.repeat(64)
  runtime().applyResult(m,w.id,{status:'DONE',summary:'fixed',changed_files:['src/a.ts'],evidence:[{kind:'targeted-tests',summary:'tests pass',pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(m.execution.evidence.fresh,false)
  assert.ok(m.execution.evidence.items[0].invalidated_at,'unsequenced worker evidence must be retained but invalidated')
  assert.deepEqual(verificationSatisfied(m),{ok:false,missing:['fresh-evidence']})
})


test('corrective result can contribute fresh methodology evidence when the attempt has no native mutation',()=>{
  const s=new MissionStore(); const m=s.start('parent','fix bug and test it')
  const t=createTask(m,{objective:'fix',role:'coder',category:'standard',scope:['src/a.ts'],dependencies:[],requiredEvidence:['targeted-tests']})
  t.status='waiting';t.result={status:'FIX_REQUIRED',summary:'decision proof missing',changed_files:['src/a.ts'],evidence:[],open_issues:['methodology-exit-unsatisfied:decision-evidence'],needs_context:['decision-evidence']}
  const w=createWorker(m,t,'host-default',[],['hi-implementation-planning'],[]);w.loaded_methodologies=['hi-implementation-planning'];w.status='busy';w.started_at=Date.now()-10;w.session_id='worker-session';w.native_state_hash='b'.repeat(64);w.native_diff_baseline={'src/a.ts':'same'};w.native_diff_final={'src/a.ts':'same'}
  runtime().applyResult(m,w.id,{status:'DONE',summary:'decision proof supplied',changed_files:['src/a.ts'],evidence:[{kind:'decision-evidence',summary:'minimal change chosen from the failing assertion',pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(t.status,'completed');assert.equal(t.result.status,'DONE')
  const decision=m.execution.evidence.items.find(e=>e.kind==='decision-evidence');assert.ok(decision);assert.equal(decision.invalidated_at,undefined);assert.equal(m.execution.evidence.fresh,true)
})
