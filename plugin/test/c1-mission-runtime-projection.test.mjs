import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { createSystemTransformHook } from '../dist/hooks/system-transform.js'
import { buildMissionRuntimeProjection,renderMissionRuntimeProjection,measureMissionRuntimeProjection } from '../dist/runtime/context/mission-runtime-projection.js'
import { PACKAGED_HI_AGENTS } from '../dist/generated/agent-config.js'
import { startAssessedMission } from './helpers/semantic.mjs'

const LEGACY_A6_BASELINE_CHARS=2728

function fixture(){
  const store=new MissionStore(process.cwd())
  const m=startAssessedMission(store,'c1','opaque task',{scope:'multi-file',likely_verification:['test','typecheck'],likely_targets:['src/a.ts','src/b.ts']})
  m.execution.blockers.push('example-blocker')
  m.vcs.changed_files.push('src/a.ts','src/b.ts')
  m.execution.constraints.push('preserve public API')
  return{store,m}
}

test('C1 MissionRuntimeProjection exposes only the bounded dynamic runtime fields',()=>{
  const {m}=fixture(),p=buildMissionRuntimeProjection(m)
  assert.deepEqual(Object.keys(p),['objective','next_action','execution','blockers','obligations','active_methodologies','verification','authority','changed_files','task_worker'])
  const lines=renderMissionRuntimeProjection(p).split('\n')
  assert.deepEqual(lines.map(x=>x.split(':')[0]),['Hi MISSION RUNTIME PROJECTION','Objective','Next action','Execution','Blockers','Obligations','Active methodologies','Verification','Authority','Changed-file state','Current task/worker'])
  assert.doesNotMatch(lines.join('\n'),/Execution mode:|Primary mode:|Task kind:|Risk:|Dependency class:|Methodology provenance:/)
})

test('C1 parallel runtime projection makes scheduler-owned delegation explicit before parent mutation',()=>{
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,'c1-parallel','independent fixes',{scope:'multi-file',dependency_class:'independent-multi',required_capabilities:['implementation','verification']})
  const p=buildMissionRuntimeProjection(m),text=renderMissionRuntimeProjection(p)
  assert.equal(m.execution.execution_mode,'parallel');assert.match(p.next_action,/^continue:o-implementation; delegate via hi_task_start; parent must not mutate$/);assert.match(p.execution,/mode=parallel/);assert.match(p.execution,/parent-delegation-only/);assert.match(text,/Execution: mode=parallel/)
})

test('C1 stable policy lives in generated OpenCode agent projections while dynamic state stays separate',()=>{
  assert.match(PACKAGED_HI_AGENTS['working-manager'].prompt,/## Hi Stable Control Policy/)
  assert.match(PACKAGED_HI_AGENTS.manager.prompt,/## Hi Stable Control Policy/)
  assert.match(PACKAGED_HI_AGENTS['working-manager'].prompt,/Do not claim completion while obligations, blockers, authority gates or required fresh verification remain open\./)
  assert.match(PACKAGED_HI_AGENTS.manager.prompt,/Do not claim completion while obligations, blockers, authority gates or required fresh verification remain open\./)
  assert.match(PACKAGED_HI_AGENTS.coder.prompt,/## Hi Stable Worker Policy/)
  const {m}=fixture(),before=renderMissionRuntimeProjection(buildMissionRuntimeProjection(m))
  m.identity.objective='changed objective';m.execution.blockers.push('new-blocker');m.authority.pending_permissions=1
  const after=renderMissionRuntimeProjection(buildMissionRuntimeProjection(m))
  assert.notEqual(after,before);assert.match(after,/changed objective/);assert.match(after,/new-blocker/);assert.match(after,/permissions=1/)
})

test('C1 system transform splits stable policy and dynamic runtime block',async()=>{
  const {store}=fixture(),out={system:[]}
  await createSystemTransformHook(store,new BackgroundRegistry(),process.cwd())({sessionID:'c1'},out)
  assert.equal(out.system.length,1)
  assert.match(out.system[0],/^Hi MISSION RUNTIME PROJECTION/)
})

test('first-use settings onboarding is offered once per pending session only when live models exist',async()=>{
  const store=new MissionStore(process.cwd());store.start('c1-onboarding','hello')
  const hook=createSystemTransformHook(store,new BackgroundRegistry(),process.cwd(),undefined,()=>({pending:true,modelCount:6}))
  const first={system:[]};await hook({sessionID:'c1-onboarding'},first);assert.equal(first.system.length,2);assert.match(first.system[0],/^Hi SEMANTIC ASSESSMENT GATE/);assert.match(first.system[1],/^Hi FIRST-USE SETTINGS: 6 effective connected model/);assert.match(first.system[1],/Adaptive\/Single\/Multi/);assert.match(first.system[1],/do not interrupt/)
  const second={system:[]};await hook({sessionID:'c1-onboarding'},second);assert.equal(second.system.length,1,'same pending session must not repeat the onboarding projection')
  const otherStore=new MissionStore(process.cwd());otherStore.start('c1-no-onboarding','hello');const none={system:[]};await createSystemTransformHook(otherStore,new BackgroundRegistry(),process.cwd(),undefined,()=>({pending:true,modelCount:0}))({sessionID:'c1-no-onboarding'},none);assert.equal(none.system.length,1,'no live models means no model-settings onboarding claim')
})

test('C1 representative provider-bound system projection reduces A6 character baseline',()=>{
  const {m}=fixture(),projection=buildMissionRuntimeProjection(m),measurement=measureMissionRuntimeProjection(projection)
  assert.ok(measurement.dynamic_chars<900,'dynamic runtime block must stay bounded')
  const reduction=(LEGACY_A6_BASELINE_CHARS-measurement.dynamic_chars)/LEGACY_A6_BASELINE_CHARS
  assert.ok(reduction>=0.35,`expected >=35% character reduction, got ${(reduction*100).toFixed(1)}%`)
})

test('C1 changed-file state preserves pre-existing user ownership and verification/review state',()=>{
  const {m}=fixture();m.vcs.preexisting_user_changes={'src/user.ts':'baseline'};m.execution.verification_policy.requireReview=true
  const text=renderMissionRuntimeProjection(buildMissionRuntimeProjection(m))
  assert.match(text,/preexisting-user-owned=src\/user.ts/)
  assert.match(text,/independent-review-required/)
})
