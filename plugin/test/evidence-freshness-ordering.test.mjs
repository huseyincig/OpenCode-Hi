import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { ConcurrencyScheduler } from '../dist/runtime/scheduler/concurrency.js'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { createTask, createWorker } from '../dist/runtime/worker/worker-runtime.js'
import { verificationSatisfied } from '../dist/runtime/verification/policy.js'
import { DEFAULT_HI_CONFIG } from '../dist/config/defaults.js'

function runtime(){
  return new TaskRuntime({},new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
}

test('worker-reported verification cannot become fresh when changed_files is only learned from the same result',()=>{
  const s=new MissionStore(); const m=s.start('parent','fix bug and test it')
  m.verification_policy={requiredKinds:['targeted-tests'],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:true}
  const t=createTask(m,{objective:'fix',role:'coder',category:'standard',scope:['src/a.ts'],dependencies:[],requiredEvidence:['targeted-tests']})
  const w=createWorker(m,t,'host-default',[],[],[]); w.status='busy'; w.started_at=Date.now()-10
  runtime().applyResult(m,w.id,{status:'DONE',summary:'fixed',changed_files:['src/a.ts'],evidence:[{kind:'targeted-tests',summary:'tests pass',pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.equal(m.evidence.fresh,false)
  assert.ok(m.evidence.items[0].invalidated_at,'unsequenced worker evidence must be retained but invalidated')
  assert.deepEqual(verificationSatisfied(m),{ok:false,missing:['fresh-evidence']})
})
