import test from "node:test"
import assert from "node:assert/strict"
import {MissionStore} from "../dist/runtime/mission/mission-store.js"
import {addEvidence,markMutation} from "../dist/runtime/evidence/evidence-runtime.js"
import {createTask,createWorker} from "../dist/runtime/worker/worker-runtime.js"
import {TaskRuntime} from "../dist/runtime/task/task-runtime.js"
import {BackgroundRegistry} from "../dist/runtime/background/registry.js"
import {ConcurrencyScheduler} from "../dist/runtime/scheduler/concurrency.js"
import {DEFAULT_HI_CONFIG} from "../dist/config/defaults.js"
import {opencodeChildPort} from "./helpers/host-port.mjs"

function runtime(){return new TaskRuntime(opencodeChildPort({}),new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))}

test("known-surface mutation invalidates only overlapping or mission-wide evidence",()=>{
  const m=new MissionStore().start("claim-scope","verify independent surfaces")
  const a=addEvidence(m,{kind:"targeted-tests",summary:"a",scope:["src/a.ts"],source:"bash",pass:true,outcome:"passed"})
  const b=addEvidence(m,{kind:"targeted-tests",summary:"b",scope:["src/b.ts"],source:"bash",pass:true,outcome:"passed"})
  const global=addEvidence(m,{kind:"build",summary:"global",scope:[],source:"bash",pass:true,outcome:"passed"})
  markMutation(m,["src/a.ts"],"test")
  assert.ok(a.invalidated_at)
  assert.equal(b.invalidated_at,undefined)
  assert.ok(global.invalidated_at,"empty-scope evidence is mission-wide and must fail closed on any mutation")
  assert.equal(m.execution.evidence.fresh,true,"unrelated fresh proof remains available")
})

test("unknown mutation surface invalidates every live proof fail-closed",()=>{
  const m=new MissionStore().start("claim-unknown","verify")
  const a=addEvidence(m,{kind:"targeted-tests",summary:"a",scope:["src/a.ts"],source:"bash",pass:true,outcome:"passed"})
  const b=addEvidence(m,{kind:"lint",summary:"b",scope:["src/b.ts"],source:"bash",pass:true,outcome:"passed"})
  markMutation(m,[],"unknown")
  assert.ok(a.invalidated_at);assert.ok(b.invalidated_at);assert.equal(m.execution.evidence.fresh,false)
})

test("worker evidence records exact host-neutral execution attempt producer identity",()=>{
  const store=new MissionStore(),m=store.start("claim-attempt","verify worker")
  m.execution.verification_policy={requiredKinds:["targeted-tests"],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:true}
  const task=createTask(m,{objective:"verify worker",role:"coder",category:"standard",scope:["src/a.ts"],requiredEvidence:["targeted-tests"]})
  const worker=createWorker(m,task,"host-default");worker.status="busy";worker.session_id="child-1";worker.native_state_hash="a".repeat(64);worker.attempt=2;worker.generation_at_spawn=m.continuation.generation
  runtime().applyResult(m,worker.id,{status:"DONE",summary:"done",changed_files:[],evidence:[{kind:"targeted-tests",summary:"pass",pass:true,outcome:"passed",scope:["src/a.ts"]}],open_issues:[],needs_context:[]})
  const evidence=m.execution.evidence.items.at(-1);assert.ok(evidence?.producer_attempt)
  assert.equal(evidence.producer_attempt.worker_id,worker.id);assert.equal(evidence.producer_attempt.execution_unit_id,`eu:${task.id}`)
  assert.equal(evidence.producer_attempt.ordinal,2);assert.equal(evidence.producer_attempt.generation,m.continuation.generation)
  assert.match(evidence.producer_attempt.attempt_id,/^eu:/);assert.match(evidence.producer_attempt.run_id,/^worker:/)
})
