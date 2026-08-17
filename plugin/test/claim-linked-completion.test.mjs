import test from "node:test"
import assert from "node:assert/strict"
import {MissionStore} from "../dist/runtime/mission/mission-store.js"
import {startAssessedMission} from "./helpers/semantic.mjs"
import {addEvidence,markMutation} from "../dist/runtime/evidence/evidence-runtime.js"
import {evaluateCompletion} from "../dist/runtime/completion/evaluator.js"
import {syncMissionGates} from "../dist/runtime/gates/gates.js"
import {createTask,createWorker} from "../dist/runtime/worker/worker-runtime.js"
import {executionAttemptIdentity} from "../dist/contracts/orchestration-core.js"

function closeNonVerification(m){for(const o of m.execution.obligations)if(o.kind!=="verification"&&o.kind!=="review"){o.status="closed";o.closedAt=Date.now()}}
function verificationMission(id){const m=startAssessedMission(new MissionStore(),id,"fix src/a.ts",{task_kind:"implementation",likely_verification:["targeted-tests"],likely_targets:["src/a.ts"]});closeNonVerification(m);const v=m.execution.obligations.find(o=>o.kind==="verification");v.requiredEvidence=["targeted-tests"];return{m,v}}

test("closed verification claim survives unrelated mutation but reopens completion after relevant mutation",()=>{
  const {m,v}=verificationMission("claim-completion-scope")
  addEvidence(m,{kind:"targeted-tests",summary:"a passed",scope:["src/a.ts"],source:"bash",obligation_ids:[v.id],pass:true,outcome:"passed"});v.status="closed";v.closedAt=Date.now();syncMissionGates(m)
  assert.equal(evaluateCompletion(m).complete,true)
  markMutation(m,["src/b.ts"],"unrelated");syncMissionGates(m)
  assert.equal(evaluateCompletion(m).complete,true,"unrelated mutation must not invalidate src/a proof")
  markMutation(m,["src/a.ts"],"related");syncMissionGates(m)
  const blocked=evaluateCompletion(m);assert.equal(blocked.complete,false);assert.equal(blocked.next,"VERIFY")
  assert.match(blocked.reasons.join("|"),new RegExp(`${v.id}:fresh-evidence|${v.id}:targeted-tests`))
  assert.equal(m.execution.gates.find(g=>g.id==="gate-verification")?.status,"open")
})

test("closed review claim becomes incomplete when its claim-linked evidence is invalidated",()=>{
  const m=startAssessedMission(new MissionStore(),"claim-review-stale","review src/a.ts",{task_kind:"review",risk:"medium",required_capabilities:["review","independent-review"],likely_verification:["review-evidence"],likely_targets:["src/a.ts"]})
  const review=m.execution.obligations.find(o=>o.kind==="review"),verification=m.execution.obligations.find(o=>o.kind==="verification");assert.ok(review);assert.ok(verification);verification.requiredEvidence=["review-evidence"]
  const task=createTask(m,{objective:"independent review",role:"qa-reviewer",category:"standard",scope:["src/a.ts"],obligationIds:[review.id,verification.id],requiredEvidence:["review-evidence"]}),worker=createWorker(m,task,"host-default");worker.session_id="review-child";worker.native_state_hash="e".repeat(64);worker.attempt=1;worker.generation_at_spawn=m.continuation.generation;worker.status="completed";task.status="completed"
  const identity=executionAttemptIdentity({executionUnitId:`eu:${task.id}`,workerId:worker.id,ordinal:worker.attempt,generation:worker.generation_at_spawn})
  addEvidence(m,{kind:"review-evidence",summary:"independent review passed",scope:["src/a.ts"],source:`worker:${worker.id}:reviewer`,source_session_id:worker.session_id,source_state_hash:worker.native_state_hash,task_id:task.id,obligation_ids:[review.id,verification.id],producer_attempt:{worker_id:worker.id,execution_unit_id:identity.executionUnitId,attempt_id:identity.attemptId,run_id:identity.runId,ordinal:identity.ordinal,generation:identity.generation},pass:true,outcome:"passed"})
  review.status="closed";review.closedAt=Date.now();verification.status="closed";verification.closedAt=Date.now();syncMissionGates(m)
  assert.equal(evaluateCompletion(m).complete,true)
  markMutation(m,["src/a.ts"],"post-review-change");syncMissionGates(m)
  const blocked=evaluateCompletion(m);assert.equal(blocked.complete,false);assert.ok(["VERIFY","RECONCILE"].includes(blocked.next))
  assert.equal(m.execution.gates.find(g=>g.id==="gate-reviewer")?.status,"open")
})

test("valid claim evidence cannot bypass active execution or authority gates",()=>{
  const {m,v}=verificationMission("claim-active-blockers")
  addEvidence(m,{kind:"targeted-tests",summary:"passed",scope:["src/a.ts"],source:"bash",obligation_ids:[v.id],pass:true,outcome:"passed"});v.status="closed";v.closedAt=Date.now()
  m.execution.workers.push({id:"w-active",task_id:"t-active",role:"coder",category:"standard",parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,model:"host-default",fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:"f-active",status:"busy",attempt:1,generation_at_spawn:m.continuation.generation,updated_at:Date.now()})
  let result=evaluateCompletion(m);assert.equal(result.complete,false);assert.ok(result.reasons.includes("active-worker"))
  m.execution.workers=[];m.execution.obligations.push({id:"o-authority-test",kind:"authority",summary:"publish",status:"open"});syncMissionGates(m)
  result=evaluateCompletion(m);assert.equal(result.complete,false);assert.equal(result.next,"USER_ACTION_REQUIRED");assert.ok(result.reasons.some(r=>r.startsWith("authority:")))
})
