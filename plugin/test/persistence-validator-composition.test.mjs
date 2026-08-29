import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { validateMissionEnvelope,validateMissionIdentityState,validateMissionExecutionState,validateTaskDAG,validateContinuationState,validateVcsSafetyState,validateAuthorityState,validateReleaseState,validateContextState,validateMethodologyState } from '../dist/runtime/mission/validators.js'

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..')

test('RuntimePersistence delegates Mission validation instead of owning slice rules',()=>{
  const persistence=readFileSync(join(ROOT,'plugin/src/runtime/state/persistence.ts'),'utf8')
  assert.match(persistence,/validateMissionEnvelope\(mission\)/)
  assert.doesNotMatch(persistence,/validObligation|validMissionTrajectory|isTaskContract|isWorkerContract|isEvidenceItemContract/)
})

test('Mission validator composes canonical slice and Task DAG validators',()=>{
  const source=readFileSync(join(ROOT,'plugin/src/runtime/mission/validators.ts'),'utf8')
  for(const name of ['validateMissionIdentityState','validateMissionExecutionState','validateTaskDAG','validateContinuationState','validateVcsSafetyState','validateAuthorityState','validateReleaseState','validateContextState','validateMethodologyState'])assert.match(source,new RegExp(`${name}\\(`))
  for(const canonical of ['isTaskContract','isWorkerContract','isEvidenceItemContract','isHumanDecisionContract','isAuthorityStateContract'])assert.match(source,new RegExp(canonical))
})

test('each Mission slice validator fails closed independently',()=>{
  const m=new MissionStore().start('a4','opaque')
  assert.equal(validateMissionEnvelope(m),true)
  assert.equal(validateMissionIdentityState({...m.identity,mission_id:3}),false)
  assert.equal(validateMissionExecutionState(m.identity,{...m.execution,tasks:'bad'},m.methodology),false)
  assert.equal(validateTaskDAG(m.identity,{...m.execution,topology:{...m.execution.topology,parallelism:0}}),false)
  assert.equal(validateContinuationState({...m.continuation,generation:'bad'}),false)
  assert.equal(validateVcsSafetyState({...m.vcs,changed_files:[3]}),false)
  assert.equal(validateAuthorityState({...m.authority,pending_permissions:'bad'}),false)
  assert.equal(validateReleaseState({release_chain:3}),false)
  assert.equal(validateContextState({context_artifacts:[{id:3}]}),false)
  assert.equal(validateMethodologyState({methodology_needs:'bad',parent_loaded_methodologies:[]}),false)
})


test('required implementation targets persist only as bounded project-relative implementation metadata',()=>{
  const store=new MissionStore();store.start('a4-required-targets','Change src/a.ts and src/b.ts. Both are required.')
  const m=store.applyInitialSemanticAssessment('a4-required-targets',{material:true,message_kind:'mission',task_kind:'implementation',scope:'multi-file',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:['src/a.ts','src/b.ts'],intent_signals:[],suppressed_intent_signals:[]})
  assert.equal(validateMissionEnvelope(m),true)
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation');assert.ok(implementation);assert.deepEqual(implementation.requiredTargets,['src/a.ts','src/b.ts'])
  const traversal=structuredClone(m);traversal.execution.obligations.find(o=>o.kind==='implementation').requiredTargets=['../outside.ts'];assert.equal(validateMissionEnvelope(traversal),false)
  const absolute=structuredClone(m);absolute.execution.obligations.find(o=>o.kind==='implementation').requiredTargets=['/tmp/outside.ts'];assert.equal(validateMissionEnvelope(absolute),false)
  const wrongKind=structuredClone(m);const verification=wrongKind.execution.obligations.find(o=>o.kind==='verification');verification.requiredTargets=['src/a.ts'];assert.equal(validateMissionEnvelope(wrongKind),false)
  const malformedUnit=structuredClone(m);const traced=malformedUnit.execution.obligations.find(o=>o.kind==='implementation');traced.requestUnits=[{id:'bad_unit',text:'bounded output'}];assert.equal(validateMissionEnvelope(malformedUnit),false)
})
