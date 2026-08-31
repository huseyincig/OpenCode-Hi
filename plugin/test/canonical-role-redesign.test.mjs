import test from 'node:test'
import assert from 'node:assert/strict'
import {routeCapabilities} from '../dist/runtime/routing/capability-router.js'
import {minimumTeamFor} from '../dist/runtime/routing/minimum-team.js'
import {HI_CHILD_ROLES,isHiReadOnlyChildRole} from '../dist/runtime/roles/catalog.js'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {opencodeChildPort} from './helpers/host-port.mjs'
import {parseSemanticIntentAssessment} from '../dist/runtime/intent/semantic-assessment.js'
import {applyProjectSettings} from '../dist/config/project-settings.js'
import {createToolBeforeHook} from '../dist/hooks/tool-before.js'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

const FINAL_CHILD=['coder','architect','repository-explorer','researcher','technical-writer','test-engineer','qa-reviewer','security-reviewer','visual-qa']
function intent(overrides={}){return{objective:'opaque',taskKind:'implementation',scope:'multi-file',risk:'medium',ambiguity:'none',dependencyClass:'independent',requiredCapabilities:['implementation'],requestedExternalActions:[],likelyVerification:[],avoid:[],...overrides}}
function roleOf(overrides){return routeCapabilities(intent(overrides),{specialistThreshold:'medium',reviewThreshold:'medium'}).role}
function runtime(options={}){const created=[],registry=new BackgroundRegistry();const client={session:{create:async req=>{created.push(req);return{data:{id:'child-'+created.length}}},promptAsync:async()=>({data:{}}),abort:async()=>({data:{}}),diff:async()=>({data:[]})}};const cfg=resolveHiConfig({parallel:{enabled:true,max:4}}),host=options.browser?{agent:PACKAGED_HI_AGENTS}:{},root=options.browser?resolve(process.cwd(),'..'):process.cwd();return{created,registry,rt:new TaskRuntime(opencodeChildPort(client),registry,createConcurrencyPolicySource(()=>({global:4})),root,root,()=>cfg,()=>[{id:'p/model',provider:'p',quality:8,cost:1,tags:['balanced'],writeCapable:true,visionCapable:true}],()=>host,undefined,{},undefined,undefined,()=>options.browser?new Set(['host-capability:browser-execution']):new Set())}}

test('canonical catalog contains exactly the nine child roles with native subagent projections',()=>{
  assert.deepEqual([...HI_CHILD_ROLES],FINAL_CHILD)
  for(const role of FINAL_CHILD)assert.equal(PACKAGED_HI_AGENTS[role]?.mode,'subagent',role)
})

test('semantic owner routing covers research docs tests implementation diagnosis architecture QA security and visual',()=>{
  assert.equal(roleOf({taskKind:'review',scope:'external',requiredCapabilities:['external-research','source-verification']}),'researcher')
  assert.equal(roleOf({taskKind:'implementation',requiredCapabilities:['documentation']}),'technical-writer')
  assert.equal(roleOf({taskKind:'implementation',requiredCapabilities:['test-authoring']}),'test-engineer')
  assert.equal(roleOf({taskKind:'implementation',requiredCapabilities:['implementation']}),'coder')
  assert.equal(roleOf({taskKind:'implementation',scope:'multi-file',requiredCapabilities:['implementation','repository-analysis','verification','visual-qa']}),'coder','repository analysis is supporting context and cannot steal implementation ownership')
  assert.equal(roleOf({taskKind:'analysis',scope:'multi-file',requiredCapabilities:['repository-analysis']}),'repository-explorer')
  assert.equal(roleOf({taskKind:'diagnosis',scope:'repo-wide',requiredCapabilities:['repository-analysis']}),'repository-explorer')
  assert.equal(roleOf({taskKind:'implementation',scope:'repo-wide',requiredCapabilities:['design-exploration']}),'architect')
  assert.equal(roleOf({taskKind:'review',requiredCapabilities:['review','independent-review']}),'qa-reviewer')
  assert.equal(roleOf({taskKind:'review',requiredCapabilities:['review','security-review']}),'security-reviewer')
  assert.equal(roleOf({taskKind:'review',requiredCapabilities:['visual-qa']}),'visual-qa')
})

test('TaskRuntime keeps implementation ownership on coder when mission also requires repository analysis and visual verification',async()=>{
  const x=runtime(),store=new MissionStore(),m=startAssessedMission(store,'implementation-with-supporting-analysis','build application',{task_kind:'implementation',scope:'multi-file',risk:'low',required_capabilities:['implementation','repository-analysis','verification','visual-qa'],likely_verification:['targeted-tests','visual-check'],likely_targets:['app.py','templates/index.html']})
  const out=await x.rt.start(m,{objective:'Build application',scope:['app.py','templates/index.html']})
  const task=m.execution.tasks.find(t=>t.id===out.task_id),worker=m.execution.workers.find(w=>w.id===out.worker_id)
  assert.equal(task?.role,'coder');assert.equal(worker?.role,'coder')
  assert.ok(task?.obligation_ids.includes('o-implementation'),'coder must own the implementation obligation')
  assert.ok(task?.execution_profile?.tools.includes('write'),'implementation worker must retain write authority')
})

test('unknown semantics fail closed instead of defaulting to coder',()=>{
  assert.throws(()=>routeCapabilities(intent({taskKind:'unclassified',requiredCapabilities:[]})),/canonical role owner|unsupported task semantics/i)
})

test('mixed code docs tests semantics decompose into distinct child owners',()=>{
  const d=minimumTeamFor(intent({taskKind:'implementation',requiredCapabilities:['implementation','documentation','test-authoring']}),undefined,'manager')
  assert.deepEqual(d.roles,['coder','technical-writer','test-engineer'])
})

test('new roleModels are generic config keys and absent roles remain Automatic',()=>{
  const cfg=resolveHiConfig({routing:{roleModels:{researcher:['p/research'],'technical-writer':['p/docs'],'test-engineer':['p/test'],coder:['p/code']}}})
  assert.deepEqual(cfg.routing.roleModels.researcher,['p/research'])
  assert.deepEqual(cfg.routing.roleModels['technical-writer'],['p/docs'])
  assert.deepEqual(cfg.routing.roleModels['test-engineer'],['p/test'])
  assert.equal(cfg.routing.roleModels.architect,undefined)
  assert.deepEqual(cfg.routing.roleModels.coder,['p/code'])
})

test('new role permission classes reflect their mutation boundaries',()=>{
  assert.equal(isHiReadOnlyChildRole('researcher'),true)
  assert.equal(isHiReadOnlyChildRole('technical-writer'),false)
  assert.equal(isHiReadOnlyChildRole('test-engineer'),false)
})

test('omitted role keeps coder while implementation is open, then selects sole visual verification owner',async()=>{
  const x=runtime({browser:true}),store=new MissionStore(),m=startAssessedMission(store,'visual-after-implementation','build then visually verify',{task_kind:'implementation',scope:'local',risk:'low',required_capabilities:['implementation','visual-qa'],likely_verification:['visual-check'],likely_targets:['index.html']})
  const first=await x.rt.start(m,{objective:'build page',scope:['index.html']})
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation'),verification=m.execution.obligations.find(o=>o.kind==='verification')
  assert.equal(m.execution.tasks.find(t=>t.id===first.task_id)?.role,'coder')
  implementation.status='closed';implementation.closedAt=Date.now()
  m.execution.tasks.find(t=>t.id===first.task_id).status='completed';m.execution.workers.find(w=>w.id===first.worker_id).status='completed'
  const second=await x.rt.start(m,{objective:'visually verify page',category:'visual',scope:['index.html'],requiredEvidence:['visual-check'],browserAllowedOrigins:['http://127.0.0.1:4173']})
  const task=m.execution.tasks.find(t=>t.id===second.task_id),worker=m.execution.workers.find(w=>w.id===second.worker_id)
  assert.equal(task?.role,'visual-qa');assert.equal(worker?.role,'visual-qa');assert.ok(task?.obligation_ids.includes(verification.id));assert.ok(second.methodologies.includes('hi-visual-qa'));assert.equal(task?.execution_profile?.browser_backend,'bounded-playwright');assert.ok(task?.execution_profile?.tools.includes('hi_browser_screenshot'))
})

test('omitted role fails closed when routed owner has no open work and multiple specialist owners remain',async()=>{
  const x=runtime(),store=new MissionStore(),m=startAssessedMission(store,'ambiguous-specialists','build then verify and document',{task_kind:'implementation',scope:'local',risk:'low',required_capabilities:['implementation','visual-qa'],likely_verification:['visual-check'],likely_targets:['index.html']})
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation');implementation.status='closed';implementation.closedAt=Date.now()
  m.execution.obligations.push({id:'o-doc-extra',kind:'documentation',summary:'docs',status:'open',requiredEvidence:[]})
  await assert.rejects(()=>x.rt.start(m,{objective:'remaining specialist work',scope:['index.html']}),/multiple canonical role owners|span multiple canonical role owners/i)
  assert.equal(x.created.length,0)
})

test('caller supplied incompatible role cannot override canonical visual owner',async()=>{
  const x=runtime(),store=new MissionStore(),m=startAssessedMission(store,'canonical-visual-owner','verify rendered UI',{task_kind:'review',scope:'local',risk:'medium',required_capabilities:['visual-qa'],likely_verification:['visual-check'],likely_targets:['index.html']})
  await assert.rejects(()=>x.rt.start(m,{objective:'verify rendered UI',role:'coder',category:'visual',scope:['index.html']}),/canonical role owner.*visual-qa|incompatible requested role/i)
  assert.equal(x.created.length,0)
})

test('category visual cannot override a nonvisual semantic owner',()=>{
  const routed=routeCapabilities(intent({taskKind:'implementation',requiredCapabilities:['documentation']}))
  assert.equal(routed.role,'technical-writer')
  assert.notEqual(routed.role,'visual-qa')
})


test('semantic assessment derives specialist capabilities from canonical intent signals',()=>{
  const base={material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'low',ambiguity:'none',dependency_class:'independent',required_capabilities:[],requested_external_actions:[],likely_verification:[],user_verification:[],likely_targets:['README.md'],suppressed_intent_signals:[],constraint_atoms:[]}
  assert.ok(parseSemanticIntentAssessment({...base,intent_signals:['intent.documentation']}).required_capabilities.includes('documentation'))
  assert.equal(parseSemanticIntentAssessment({...base,intent_signals:['intent.tdd']}).required_capabilities.includes('test-authoring'),false,'methodology signal alone cannot grant write authority before user-text grounding')
  assert.ok(parseSemanticIntentAssessment({...base,task_kind:'review',scope:'external',likely_targets:[],intent_signals:['intent.external-source']}).required_capabilities.includes('external-research'))
})

test('project settings generically persist new roleModels without copying coder mapping',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-role-settings-'))
  try{
    const out=applyProjectSettings(root,{roleModels:{coder:['p/code'],researcher:['p/research'],'technical-writer':['p/docs'],'test-engineer':['p/test']}})
    assert.deepEqual(out.roleModels.researcher,['p/research'])
    assert.deepEqual(out.roleModels['technical-writer'],['p/docs'])
    assert.deepEqual(out.roleModels['test-engineer'],['p/test'])
    assert.deepEqual(out.roleModels.coder,['p/code'])
    assert.equal(out.roleModels.architect,undefined)
  } finally {rmSync(root,{recursive:true,force:true})}
})

test('technical-writer and test-engineer mutation guards reject production-source writes',async()=>{
  for(const spec of [
    {sid:'docs-write-guard',cap:'documentation',role:'technical-writer',scope:['README.md'],allowed:'README.md',denied:'src/app.ts'},
    {sid:'tests-write-guard',cap:'test-authoring',role:'test-engineer',scope:['tests/app.test.ts'],allowed:'tests/app.test.ts',denied:'src/app.ts'},
  ]){
    const userText=spec.cap==='test-authoring'?'Write the test in tests/app.test.ts; do not change production source.':'Update the documentation in README.md; do not change production source.'
    const x=runtime(),store=new MissionStore(),m=startAssessedMission(store,spec.sid,userText,{task_kind:'implementation',scope:'local',risk:'medium',required_capabilities:[spec.cap],likely_verification:[],likely_targets:spec.scope})
    const out=await x.rt.start(m,{objective:userText,scope:spec.scope})
    const worker=m.execution.workers.find(w=>w.task_id===out.task_id);assert.equal(worker.role,spec.role)
    const hook=createToolBeforeHook(store,x.registry,process.cwd(),process.cwd())
    await hook({sessionID:worker.session_id,tool:'edit'},{args:{filePath:spec.allowed}})
    await assert.rejects(()=>hook({sessionID:worker.session_id,tool:'edit'},{args:{filePath:spec.denied}}),/specialist write guard/)
  }
})

test('non-visual worker cannot contribute browser-derived proof',async()=>{
  const x=runtime(),store=new MissionStore(),m=startAssessedMission(store,'wrong-browser-proof','implement local code',{task_kind:'implementation',scope:'local',risk:'medium',required_capabilities:['implementation'],likely_verification:[],likely_targets:['src/app.ts']})
  const out=await x.rt.start(m,{objective:'implement local code',scope:['src/app.ts']})
  const worker=m.execution.workers.find(w=>w.task_id===out.task_id);assert.equal(worker.role,'coder')
  x.rt.applyResult(m,worker.id,{status:'DONE',summary:'claims visual proof',changed_files:[],evidence:[{kind:'visual-evidence',summary:'not actually visual-owned',scope:['src/app.ts'],pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  assert.ok(m.execution.ledger.some(e=>e.type==='browser.evidence-owner-rejected'&&e.worker_id===worker.id))
  assert.equal(m.execution.evidence.items.some(e=>e.kind==='visual-evidence'&&e.source_session_id===worker.session_id),false)
  const task=m.execution.tasks.find(t=>t.id===out.task_id)
  assert.equal(task.result?.evidence.some(e=>e.kind==='visual-evidence'),false,'wrong-role browser proof must be removed from the canonical Task result, not merely rejected from Evidence')
})


test('mixed visual plus security mission keeps implicit obligations on their mission-specific canonical owners',async()=>{
  const x=runtime({browser:true}),store=new MissionStore(),m=startAssessedMission(store,'mixed-review-owners','build Flask UI and verify dependency safety',{task_kind:'implementation',scope:'multi-file',risk:'low',required_capabilities:['implementation','repository-analysis','verification','visual-qa','dependency-change','security-review'],likely_verification:['visual-check'],likely_targets:['app.py','requirements.txt','templates/index.html']})
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation'),verification=m.execution.obligations.find(o=>o.kind==='verification')
  assert.ok(implementation);assert.ok(verification)
  implementation.status='closed';implementation.closedAt=Date.now()
  m.execution.obligations.push({id:'o-dependency-review-fixture',kind:'review',summary:'Dependency graph changed; independent supply-chain/security review required',status:'open',requiredEvidence:['review-evidence']})
  const review=m.execution.obligations.find(o=>o.id==='o-dependency-review-fixture');assert.ok(review)
  const visual=await x.rt.start(m,{objective:'verify live UI',role:'visual-qa',category:'visual',scope:['app.py','templates/index.html'],requiredEvidence:['visual-check'],browserAllowedOrigins:['http://127.0.0.1:5000']})
  const visualTask=m.execution.tasks.find(t=>t.id===visual.task_id);assert.ok(visualTask)
  assert.equal(visualTask.role,'visual-qa')
  assert.deepEqual(visualTask.obligation_ids,[verification.id],'visual verifier must not auto-claim the independent security/dependency review')
  const security=await x.rt.start(m,{objective:'independently review dependency and security impact',role:'security-reviewer',category:'critical',scope:['requirements.txt','app.py'],requiredEvidence:['review-evidence'],obligationIds:[review.id]})
  const securityTask=m.execution.tasks.find(t=>t.id===security.task_id);assert.ok(securityTask)
  assert.equal(securityTask.role,'security-reviewer')
  assert.deepEqual(securityTask.obligation_ids,[review.id])
})

test('pure visual review still owns its review obligation as well as visual verification',async()=>{
  const x=runtime({browser:true}),store=new MissionStore(),m=startAssessedMission(store,'pure-visual-review-owner','review rendered UI',{task_kind:'review',scope:'local',risk:'medium',required_capabilities:['visual-qa'],likely_verification:['visual-check'],likely_targets:['index.html']})
  const review=m.execution.obligations.find(o=>o.kind==='review'),verification=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(review);assert.ok(verification)
  const out=await x.rt.start(m,{objective:'review rendered UI',role:'visual-qa',category:'visual',scope:['index.html'],requiredEvidence:['visual-check'],browserAllowedOrigins:['http://127.0.0.1:4173']})
  const task=m.execution.tasks.find(t=>t.id===out.task_id);assert.ok(task)
  assert.equal(task.role,'visual-qa')
  assert.deepEqual(new Set(task.obligation_ids),new Set([review.id,verification.id]))
})
