import test from "node:test"
import assert from "node:assert/strict"
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {MissionStore} from "../dist/runtime/mission/mission-store.js"
import {addEvidence} from "../dist/runtime/evidence/evidence-runtime.js"
import {captureEvidenceScopeState} from "../dist/runtime/evidence/scope-state.js"
import {evaluatePreconditions} from "../dist/runtime/readiness/preconditions.js"
import {evaluateIdle} from "../dist/runtime/continuation/evaluator.js"
import {buildMissionRuntimeProjection} from "../dist/runtime/context/mission-runtime-projection.js"
import {startAssessedMission} from "./helpers/semantic.mjs"

function addClearance(root,m,observedAt){
  const scope=["src/contract.ts"],state=captureEvidenceScopeState(root,scope)
  assert.ok(state)
  return addEvidence(m,{kind:"source-provenance-evidence",summary:"runtime-bound exploration clearance",scope,source:"exploration-clearance:resolvable:t_clearance",trusted_source_class:"runtime-observation",source_state_hash:state,scope_state_hash:state,outcome:"passed",pass:true,observed_at:observedAt})
}

test("stale exploration clearance is a mission-visible repo-resolvable readiness precondition",()=>{
  const root=mkdtempSync(join(tmpdir(),"hi-m14-readiness-"))
  try{
    mkdirSync(join(root,"src"),{recursive:true})
    writeFileSync(join(root,"src","contract.ts"),"export interface Contract { id:string }\n")
    const store=new MissionStore(root),m=startAssessedMission(store,"m14-stale-clearance","implement the current contract",{likely_targets:["src/contract.ts"]})
    addClearance(root,m,100)
    writeFileSync(join(root,"src","contract.ts"),"export interface Contract { id:string; mode:string }\n")

    const readiness=evaluatePreconditions(m,root)
    const clearanceGate=readiness.items.find(item=>item.id==="gate-exploration-clearance")
    assert.equal(clearanceGate?.status,"blocked")
    assert.match(clearanceGate?.reason??"",/source-state-drift/)
    assert.equal(readiness.ready,false)

    const idle=evaluateIdle(m,Date.now()+1000,root)
    assert.equal(idle.decision,"CONTINUE")
    assert.equal(idle.reason_code,"exploration-clearance-refresh")
    assert.match(idle.prompt??"",/refresh bounded repository exploration/i)

    const projection=buildMissionRuntimeProjection(m,undefined,root)
    assert.match(projection.next_action,/refresh-exploration-clearance/)
    assert.ok(projection.blockers.some(item=>item.includes("gate:gate-exploration-clearance:blocked")))

    addClearance(root,m,200)
    const refreshed=evaluatePreconditions(m,root)
    assert.equal(refreshed.items.find(item=>item.id==="gate-exploration-clearance")?.status,"not-applicable")
    assert.equal(evaluateIdle(m,Date.now()+2000,root).reason_code,"open-obligation")
    assert.doesNotMatch(buildMissionRuntimeProjection(m,undefined,root).next_action,/refresh-exploration-clearance/)
  }finally{rmSync(root,{recursive:true,force:true})}
})
