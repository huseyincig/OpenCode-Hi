import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { architectureMethodologySignals,changedSurfaceMethodologySignals,workerResultMethodologySignals } from '../dist/runtime/methodology/signals.js'
import { createToolBeforeHook } from '../dist/hooks/tool-before.js'
import { ProjectMethodologyLearningStore } from '../dist/runtime/project-intelligence/methodology-learning.js'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { activateMethodologySignal } from '../dist/runtime/methodology/activation.js'
import { parseSemanticIntentAssessment } from '../dist/runtime/intent/semantic-assessment.js'
import {fileURLToPath} from 'node:url'
import {opencodeChildPort} from './helpers/host-port.mjs'

const root=fileURLToPath(new URL('../../',import.meta.url)).replace(/[\\/]$/,'')

function names(items){return items.map(x=>x.name).sort()}
function runtime(){return new TaskRuntime(opencodeChildPort({}), {delete(){}}, {release(){}}, root, root, ()=>({}), ()=>[], ()=>({}))}
function missionWithWorker(objective='Implement a bounded internal change',scope=['plugin/src/internal.ts']){
  const m=new MissionStore(root).start(`s-${Math.random()}`,objective)
  m.methodology.methodology_needs=[]
  const task={id:'t1',objective,status:'running',role:'coder',category:'standard',scope:[...scope],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],created_at:Date.now(),updated_at:Date.now()}
  const worker={id:'w1',task_id:'t1',role:'coder',category:'standard',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f1',status:'busy',generation_at_spawn:m.continuation.generation}
  m.execution.tasks=[task];m.execution.workers=[worker]
  return m
}

test('changed-surface producer emits only evidence-backed surface signals',()=>{
  assert.deepEqual(names(changedSurfaceMethodologySignals(['plugin/src/internal.ts'])),[])
  assert.ok(names(changedSurfaceMethodologySignals(['package.json'])).includes('surface.dependency'))
  assert.ok(names(changedSurfaceMethodologySignals(['src/auth/session.ts'])).includes('surface.security'))
  assert.ok(names(changedSurfaceMethodologySignals(['src/api/schema.proto'])).includes('surface.contract'))
  const ui=names(changedSurfaceMethodologySignals(['app/components/Button.tsx']))
  assert.ok(ui.includes('surface.ui-markup'))
  assert.ok(ui.includes('surface.ui-visual'))
})

test('worker-result producer requires structured context/failure findings rather than prose inference',()=>{
  assert.deepEqual(workerResultMethodologySignals({status:'DONE',needsContext:[]}),[])
  const genericContext=names(workerResultMethodologySignals({status:'NEEDS_CONTEXT',needsContext:['find symbol owner and path']}))
  assert.deepEqual(genericContext,['context.iterative-gap'])
  const scoped=names(workerResultMethodologySignals({status:'NEEDS_CONTEXT',needsContext:['find symbol owner and path'],contextGap:'scope'}))
  assert.ok(scoped.includes('context.iterative-gap'))
  assert.ok(scoped.includes('context.scope-gap'))
  assert.deepEqual(workerResultMethodologySignals({status:'FIX_REQUIRED',needsContext:[]}),[])
  assert.deepEqual(names(workerResultMethodologySignals({status:'FIX_REQUIRED',needsContext:[],failureFinding:'ci-build'})),['failure.ci-build'])
})

test('central activation rejects producer/signal mismatches and records admitted activation provenance',()=>{
  const m=new MissionStore(root).start('s-activation','Implement a bounded internal change')
  m.methodology.methodology_needs=[]
  assert.throws(()=>activateMethodologySignal(m,root,{signal:'surface.dependency',producer:'intent',reason:'wrong producer'}),/producer not allowed/)
  const activated=activateMethodologySignal(m,root,{signal:'surface.dependency',producer:'changed-surface',reason:'package manifest changed'})
  assert.deepEqual(activated,['hi-dependency-change'])
  assert.equal(m.methodology.methodology_needs[0].signal,'surface.dependency')
  assert.equal(m.methodology.methodology_needs[0].producer,'changed-surface')
})

test('TaskRuntime result reconciliation wires changed-surface and risk signals into methodology needs',()=>{
  const m=missionWithWorker('Update dependency behavior',['package.json'])
  runtime().applyResult(m,'w1',{status:'DONE',summary:'Dependency manifest updated.',changed_files:['package.json'],evidence:[],open_issues:[],needs_context:[]})
  const activated=new Set(m.methodology.methodology_needs.map(x=>x.name))
  assert.ok(activated.has('hi-dependency-change'))
  assert.ok(activated.has('hi-security-review'))
  assert.ok(activated.has('hi-test-strategy'))
  assert.ok(m.execution.ledger.some(x=>x.type==='methodology.activated'&&x.payload?.signal==='surface.dependency'))
})

test('TaskRuntime does not auto-activate surface methodology for a bounded internal file change',()=>{
  const m=missionWithWorker('Implement a bounded internal helper',['plugin/src/internal.ts'])
  runtime().applyResult(m,'w1',{status:'DONE',summary:'Internal helper changed.',changed_files:['plugin/src/internal.ts'],evidence:[],open_issues:[],needs_context:[]})
  assert.deepEqual(m.methodology.methodology_needs,[])
})

test('TaskRuntime wires NEEDS_CONTEXT into retrieval methodologies instead of relying on initial intent',()=>{
  const m=missionWithWorker('Implement a bounded internal helper',['plugin/src/internal.ts'])
  runtime().applyResult(m,'w1',{status:'NEEDS_CONTEXT',summary:'Unknown symbol ownership blocks the task.',changed_files:[],evidence:[],open_issues:[],needs_context:['locate symbol owner and defining path'],context_gap:'scope'})
  const activated=new Set(m.methodology.methodology_needs.map(x=>x.name))
  assert.ok(activated.has('hi-iterative-retrieval'))
  assert.ok(activated.has('hi-repository-analysis'))
  assert.ok(m.methodology.methodology_needs.some(x=>x.producer==='context'))
})


test('selected child methodology must be actually native-loaded before DONE can be accepted',()=>{
  const m=missionWithWorker('Implement behavior with TDD',['plugin/src/internal.ts'])
  activateMethodologySignal(m,root,{signal:'intent.tdd',producer:'intent',reason:'TDD explicitly required'})
  m.execution.workers[0].selected_methodologies=['hi-test-driven-development']
  runtime().applyResult(m,'w1',{status:'DONE',summary:'Implemented without loading selected methodology.',changed_files:[],evidence:[],open_issues:[],needs_context:[]})
  assert.equal(m.execution.tasks[0].result.status,'FIX_REQUIRED')
  assert.ok(m.execution.tasks[0].result.open_issues.some(x=>x.startsWith('methodology-not-loaded:')))
  assert.ok(m.methodology.methodology_needs.some(x=>x.name==='hi-test-driven-development'))
})

test('loaded methodology need resolves after the bounded worker completes successfully',()=>{
  const m=missionWithWorker('Implement behavior with TDD',['plugin/src/internal.ts'])
  activateMethodologySignal(m,root,{signal:'intent.tdd',producer:'intent',reason:'TDD explicitly required'})
  m.execution.workers[0].selected_methodologies=['hi-test-driven-development']
  m.execution.workers[0].loaded_methodologies=['hi-test-driven-development']
  runtime().applyResult(m,'w1',{status:'DONE',summary:'TDD loop completed.',changed_files:[],evidence:[{kind:'targeted-tests',summary:'focused TDD test passed',pass:true}],open_issues:[],needs_context:[]})
  assert.equal(m.execution.tasks[0].result.status,'DONE')
  assert.ok(!m.methodology.methodology_needs.some(x=>x.name==='hi-test-driven-development'))
  assert.ok(m.execution.ledger.some(x=>x.type==='methodology.resolved'&&x.payload?.name==='hi-test-driven-development'))
})


test('independent multi-stream topology does not activate dependency-planning methodology',()=>{
  const store=new MissionStore(root)
  const m=store.start('s-independent-multi-methodology','Fix two independent disjoint files')
  store.applyInitialSemanticAssessment('s-independent-multi-methodology',{material:true,message_kind:'mission',task_kind:'bug-fix',scope:'multi-stream',risk:'low',ambiguity:'none',dependency_class:'independent-multi',required_capabilities:['implementation','verification'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:['src/a.ts','src/b.ts'],intent_signals:[],suppressed_intent_signals:[]})
  assert.deepEqual(architectureMethodologySignals(m.identity.intent),[])
  assert.equal(m.methodology.methodology_needs.some(x=>x.name==='hi-implementation-planning'),false)
})

test('architecture runtime producer owns only structured architecture state while explicit durable-decision intent stays intent-owned',()=>{
  const store=new MissionStore(root)
  const m=store.start('s-architecture-producer','Plan an architecture decision then update dependent API modules sequentially')
  store.applyInitialSemanticAssessment('s-architecture-producer',{material:true,message_kind:'mission',task_kind:'implementation',scope:'multi-file',risk:'medium',ambiguity:'none',dependency_class:'sequential',required_capabilities:[],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:['intent.architecture-decision'],suppressed_intent_signals:[]})
  const signals=architectureMethodologySignals(m.identity.intent).map(x=>x.name)
  assert.deepEqual(signals,['architecture.dependency-structure'])
  assert.ok(m.methodology.methodology_needs.some(x=>x.producer==='architecture'&&x.signal==='architecture.dependency-structure'))
  assert.ok(m.methodology.methodology_needs.some(x=>x.producer==='intent'&&x.signal==='intent.architecture-decision'))
})

test('review feedback remains a single structured intent-owned methodology activation',()=>{
  const store=new MissionStore(root)
  store.start('s-human-feedback','Fix the parser behavior')
  store.applyInitialSemanticAssessment('s-human-feedback',{material:true,message_kind:'mission',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]})
  store.beginFollowupSemanticAssessment('s-human-feedback','Reviewer found the parser still rejects valid input')
  const m=store.applyFollowupSemanticAssessment('s-human-feedback',{material:true,message_kind:'amendment',task_kind:'bug-fix',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:['targeted-tests'],likely_targets:[],intent_signals:['intent.review-feedback'],suppressed_intent_signals:[]})
  const needs=m.methodology.methodology_needs.filter(x=>x.name==='hi-review-feedback')
  assert.equal(needs.length,1)
  assert.equal(needs[0].signal,'intent.review-feedback')
  assert.equal(needs[0].producer,'intent')
})

test('release producer activates only when a concrete publish/release command reaches the safety boundary',async()=>{
  const store=new MissionStore(root)
  const m=store.start('s-release-producer','Prepare package changes')
  store.applyInitialSemanticAssessment('s-release-producer',{material:true,message_kind:'mission',task_kind:'release-readiness',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:[],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:[],suppressed_intent_signals:[]})
  m.methodology.methodology_needs=[]
  const hook=createToolBeforeHook(store,undefined,root)
  await assert.rejects(()=>hook({sessionID:'s-release-producer',tool:'bash',args:{command:'npm publish'}},{args:{command:'npm publish'}}))
  assert.ok(m.methodology.methodology_needs.some(x=>x.name==='hi-release-guardrails'&&x.signal==='release.boundary'&&x.producer==='release'))
})


test('project methodology learning requires repeated independent evidence and survives store restart',()=>{
  const project=mkdtempSync(join(tmpdir(),'hi-methodology-learning-'))
  const observation={key:'generated-client-contract-check',procedure:'After regenerating the project client, compare generated contract outputs and run the project contract verifier before accepting the change.',trigger:'Generated project client or schema output changes.',do_not_trigger:'No generated client/schema contract changed.',exit_condition:'Generated output and project contract verification agree.',evidence:['contract-verifier']}
  const m1=new MissionStore(project).start('s-learn-1','Update generated client contract')
  m1.methodology.methodology_needs=[]
  const w1={id:'w-learn-1',task_id:'t-learn-1',role:'coder',category:'standard',parent_session_id:m1.identity.session_id,parent_mission_id:m1.identity.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'learn-1',status:'completed',generation_at_spawn:m1.continuation.generation}
  const first=new ProjectMethodologyLearningStore(project).observe(m1,w1,observation,['contract-verifier','contract verifier passed'])
  assert.equal(first?.state,'CANDIDATE')
  assert.ok(!m1.methodology.methodology_needs.some(x=>x.signal==='project.methodology-gap'))

  const m2=new MissionStore(project).start('s-learn-2','Regenerate the project client after schema update')
  m2.methodology.methodology_needs=[]
  const w2={...w1,id:'w-learn-2',task_id:'t-learn-2',parent_session_id:m2.identity.session_id,parent_mission_id:m2.identity.mission_id,fingerprint:'learn-2',generation_at_spawn:m2.continuation.generation}
  const second=new ProjectMethodologyLearningStore(project).observe(m2,w2,observation,['contract-verifier','contract verifier passed again'])
  assert.equal(second?.state,'READY')
  assert.equal(second?.observations.length,2)
  assert.ok(m2.methodology.methodology_needs.some(x=>x.name==='hi-methodology-authoring'&&x.signal==='project.methodology-gap'&&x.producer==='project-intelligence'))
})

test('project methodology learning rejects an observation whose claimed evidence is not in worker result evidence',()=>{
  const project=mkdtempSync(join(tmpdir(),'hi-methodology-learning-reject-'))
  const m=new MissionStore(project).start('s-learn-reject','Update internal helper')
  m.methodology.methodology_needs=[]
  const w={id:'w-reject',task_id:'t-reject',role:'coder',category:'standard',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'reject',status:'completed',generation_at_spawn:m.continuation.generation}
  const result=new ProjectMethodologyLearningStore(project).observe(m,w,{key:'fake-how',procedure:'Always run the special project workflow after editing this surface.',trigger:'Surface changes.',do_not_trigger:'Surface does not change.',exit_condition:'Special workflow passes.',evidence:['special-proof']},['ordinary-test'])
  assert.equal(result,undefined)
  assert.ok(m.execution.ledger.some(x=>x.type==='project-methodology.observation-rejected'))
  assert.ok(!m.methodology.methodology_needs.some(x=>x.signal==='project.methodology-gap'))
})


test('semantic assessment rejects non-intent methodology signals instead of silently dropping them',()=>{
  assert.throws(()=>parseSemanticIntentAssessment({material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:[],intent_signals:['surface.security'],suppressed_intent_signals:[]}),/unsupported semantic intent signal/)
})

test('intent suppression preserves a runtime-emergent need for the same methodology',()=>{
  const store=new MissionStore(process.cwd()),m=store.start('s-suppression-owner','Review security-sensitive change')
  store.applyInitialSemanticAssessment('s-suppression-owner',{material:true,message_kind:'mission',task_kind:'review',scope:'local',risk:'high',ambiguity:'none',dependency_class:'independent',required_capabilities:['security-review'],requested_external_actions:[],likely_verification:['review-evidence'],likely_targets:['src/auth.ts'],intent_signals:['intent.security-review'],suppressed_intent_signals:[]})
  activateMethodologySignal(m,process.cwd(),{signal:'surface.security',producer:'changed-surface',reason:'Observed security-sensitive changed surface'})
  assert.equal(m.methodology.methodology_needs.filter(n=>n.name==='hi-security-review').length,2)
  store.beginFollowupSemanticAssessment('s-suppression-owner','constraint update')
  store.applyFollowupSemanticAssessment('s-suppression-owner',{material:true,message_kind:'constraint',task_kind:'review',scope:'local',risk:'high',ambiguity:'none',dependency_class:'independent',required_capabilities:['security-review'],requested_external_actions:[],likely_verification:['review-evidence'],likely_targets:['src/auth.ts'],intent_signals:[],suppressed_intent_signals:['intent.security-review']})
  const remaining=m.methodology.methodology_needs.filter(n=>n.name==='hi-security-review')
  assert.equal(remaining.length,1)
  assert.equal(remaining[0].producer,'changed-surface')
  assert.equal(remaining[0].signal,'surface.security')
})
