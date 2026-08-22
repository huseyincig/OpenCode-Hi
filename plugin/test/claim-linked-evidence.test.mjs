import test from "node:test"
import assert from "node:assert/strict"
import {MissionStore} from "../dist/runtime/mission/mission-store.js"
import {addEvidence,markMutation} from "../dist/runtime/evidence/evidence-runtime.js"
import {createTask,createWorker} from "../dist/runtime/worker/worker-runtime.js"
import {TaskRuntime} from "../dist/runtime/task/task-runtime.js"
import {BackgroundRegistry} from "../dist/runtime/background/registry.js"
import {ConcurrencyScheduler} from "../dist/runtime/scheduler/concurrency.js"
import {DEFAULT_HI_CONFIG} from "../dist/config/defaults.js"
import {verificationSatisfied} from "../dist/runtime/verification/policy.js"
import {opencodeChildPort} from "./helpers/host-port.mjs"
import {startAssessedMission} from "./helpers/semantic.mjs"

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

test("worker PASS remains a claim and cannot become canonical verification evidence",()=>{
  const store=new MissionStore(),m=startAssessedMission(store,"claim-attempt","verify worker",{task_kind:"implementation",scope:"local",risk:"low",ambiguity:"none",dependency_class:"independent",required_capabilities:["implementation","verification"],likely_verification:["targeted-tests"],likely_targets:["src/a.ts"]})
  const verification=m.execution.obligations.find(o=>o.kind==="verification");assert.ok(verification);verification.requiredEvidence=["targeted-tests"]
  // Persisted legacy state may still carry this flag. It must never restore PASS authority to WorkerResult claims.
  m.execution.verification_policy={requiredKinds:["targeted-tests"],requireFresh:true,requireReview:false,allowWorkerReportedEvidence:true}
  const task=createTask(m,{objective:"verify worker",role:"coder",category:"standard",scope:["src/a.ts"],requiredEvidence:["targeted-tests"],obligationIds:[verification.id]})
  const worker=createWorker(m,task,"host-default");worker.status="busy";worker.session_id="child-1";worker.native_state_hash="a".repeat(64);worker.attempt=2;worker.generation_at_spawn=m.continuation.generation
  runtime().applyResult(m,worker.id,{status:"DONE",summary:"done",changed_files:[],evidence:[{kind:"targeted-tests",summary:"pass",pass:true,outcome:"passed",scope:["src/a.ts"]}],open_issues:[],needs_context:[]})
  assert.equal(task.result?.status,"DONE")
  assert.equal(task.result?.evidence[0]?.outcome,"pending");assert.equal(task.result?.evidence[0]?.pass,undefined)
  assert.match(task.result?.evidence[0]?.reason??"",/worker-claim-unverified/)
  assert.equal(m.execution.evidence.items.some(e=>e.kind==="targeted-tests"),false,"WorkerResult claim must not be copied into canonical Evidence")
  assert.equal(verification.status,"open");assert.deepEqual(verificationSatisfied(m,verification.id),{ok:false,missing:["targeted-tests"]})
  assert.ok(m.execution.ledger.some(e=>e.type==="verification.worker-claim-unverified"&&e.worker_id===worker.id))
  assert.ok(m.execution.ledger.some(e=>e.type==="worker.evidence-claim-recorded"&&e.worker_id===worker.id))
})
