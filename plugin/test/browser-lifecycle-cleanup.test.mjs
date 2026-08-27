import test from 'node:test'
import assert from 'node:assert/strict'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {PlaywrightBrowserAdapter} from '../dist/opencode/playwright-browser-adapter.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'
import {opencodeChildPort} from './helpers/host-port.mjs'
import {addEvidence,markMutation} from '../dist/runtime/evidence/evidence-runtime.js'
import {evidenceProducerAttemptForWorker} from '../dist/runtime/evidence/applicability.js'
import {reconcileTaskEvidenceMethodologyNeeds} from '../dist/runtime/methodology/activation.js'

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const context=(task,owner,origins=['http://127.0.0.1:4173'])=>({task_id:task,execution_owner_ref:owner,executor_version:'hi-playwright-browser@1',allowed_origins:origins})

function fakePlaywright(){
  const sessions=[]
  const chromium={launch:async()=>{const page={_url:'about:blank',url(){return this._url},setDefaultTimeout(){},on(){},async goto(url){this._url=url},locator(){return{evaluate:async()=>({body:'ready',items:[]})}}};const browser={newContext:async()=>({route:async()=>{},newPage:async()=>page}),close:async()=>{browser.closed=true},closed:false};sessions.push({browser,page});return browser}}
  return{module:{chromium},sessions}
}

test('exact browser owner cleanup closes only the owned task session',async()=>{
  const pw=fakePlaywright(),adapter=new PlaywrightBrowserAdapter({executable_path:'/fake/chrome',executable_exists:()=>true,load_playwright:async()=>pw.module})
  const first=context('t1','m:w1:s1:g1'),second=context('t2','m:w2:s2:g1',['http://127.0.0.1:4174'])
  await adapter.open(first,'http://127.0.0.1:4173/')
  await adapter.open(second,'http://127.0.0.1:4174/')
  const cleaned=await adapter.cleanup(first)
  assert.deepEqual(cleaned,{cleaned:true,reason:'cleaned'})
  assert.equal(pw.sessions[0].browser.closed,true)
  assert.equal(pw.sessions[1].browser.closed,false)
  await assert.rejects(()=>adapter.inspect(first),/not owned|session is not owned/i)
  assert.equal((await adapter.inspect(second)).result,'OBSERVED')
  await adapter.dispose()
})

test('stale browser owner cleanup cannot close a replacement owner session',async()=>{
  const pw=fakePlaywright(),adapter=new PlaywrightBrowserAdapter({executable_path:'/fake/chrome',executable_exists:()=>true,load_playwright:async()=>pw.module})
  const oldOwner=context('same-task','m:w:s-old:g1'),newOwner=context('same-task','m:w:s-new:g2')
  await adapter.open(oldOwner,'http://127.0.0.1:4173/')
  await adapter.open(newOwner,'http://127.0.0.1:4173/')
  assert.equal(pw.sessions[0].browser.closed,true)
  const stale=await adapter.cleanup(oldOwner)
  assert.deepEqual(stale,{cleaned:false,reason:'owner-mismatch'})
  assert.equal(pw.sessions[1].browser.closed,false)
  assert.equal((await adapter.inspect(newOwner)).result,'OBSERVED')
  await adapter.dispose()
})

test('TaskRuntime cancel cleans the exact active visual worker browser owner',async()=>{
  const prompts=[],client={session:{create:async()=>({data:{id:'child-browser'}}),promptAsync:async req=>{prompts.push(req);return{data:{}}},abort:async()=>({data:true}),diff:async()=>({data:[]})}}
  const cleanupCalls=[]
  const browserExecutor={
    health:async()=>({available:true}),open:async()=>{throw new Error('unused')},navigate:async()=>{throw new Error('unused')},click:async()=>{throw new Error('unused')},type:async()=>{throw new Error('unused')},inspect:async()=>{throw new Error('unused')},screenshot:async()=>{throw new Error('unused')},wait:async()=>{throw new Error('unused')},close:async()=>{throw new Error('unused')},
    cleanup:async c=>{cleanupCalls.push(c);return{cleaned:true,reason:'cleaned'}}
  }
  const runtime=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),repoRoot,repoRoot,()=>DEFAULT_HI_CONFIG,()=>[{id:'provider/vision',provider:'provider',visionCapable:true,writeCapable:true}],()=>({agent:PACKAGED_HI_AGENTS}),undefined,{},undefined,undefined,()=>new Set(['host-capability:browser-execution']),browserExecutor)
  const store=new MissionStore(repoRoot),m=store.start('m13-cancel','verify local browser')
  store.applyInitialSemanticAssessment('m13-cancel',{material:true,message_kind:'mission',task_kind:'review',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['visual-review'],requested_external_actions:[],likely_verification:['visual-evidence'],likely_targets:['src/view.tsx'],intent_signals:['intent.browser'],suppressed_intent_signals:[]})
  m.methodology.methodology_needs.push({name:'hi-browser-testing',signal:'intent.browser',trigger_source:'task-intent',producer:'intent',reason:'browser acceptance',created_at:Date.now()})
  const started=await runtime.start(m,{objective:'verify local browser',role:'visual-qa',category:'visual',scope:['src/view.tsx'],browserAllowedOrigins:['http://127.0.0.1:4173']})
  const worker=m.execution.workers.find(w=>w.id===started.worker_id),task=m.execution.tasks.find(t=>t.id===started.task_id)
  assert.ok(worker?.session_id);assert.ok(task)
  assert.equal(await runtime.cancel(m,worker.id),true)
  assert.equal(cleanupCalls.length,1)
  assert.deepEqual(cleanupCalls[0],{task_id:task.id,execution_owner_ref:`${m.identity.mission_id}:${worker.id}:child-browser:${worker.generation_at_spawn}`,executor_version:'hi-playwright-browser@1',allowed_origins:['http://127.0.0.1:4173']})
  assert.equal(worker.status,'cancelled');assert.equal(task.status,'cancelled')
})


test('cancelled visual verification task releases open-obligation methodology ownership to its replacement',async()=>{
  let childN=0
  const prompts=[],client={session:{create:async()=>({data:{id:`child-replacement-${++childN}`}}),promptAsync:async req=>{prompts.push(req);return{data:{}}},abort:async()=>({data:true}),diff:async()=>({data:[]})}}
  const browserExecutor={
    health:async()=>({available:true}),open:async()=>{throw new Error('unused')},navigate:async()=>{throw new Error('unused')},click:async()=>{throw new Error('unused')},type:async()=>{throw new Error('unused')},inspect:async()=>{throw new Error('unused')},screenshot:async()=>{throw new Error('unused')},wait:async()=>{throw new Error('unused')},close:async()=>{throw new Error('unused')},cleanup:async()=>({cleaned:true,reason:'cleaned'})
  }
  const runtime=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),repoRoot,repoRoot,()=>DEFAULT_HI_CONFIG,()=>[{id:'provider/vision',provider:'provider',visionCapable:true,writeCapable:true}],()=>({agent:PACKAGED_HI_AGENTS}),undefined,{},undefined,undefined,()=>new Set(['host-capability:browser-execution']),browserExecutor)
  const store=new MissionStore(repoRoot),m=store.start('m13-cancel-replacement','verify local browser after implementation')
  store.applyInitialSemanticAssessment('m13-cancel-replacement',{material:true,message_kind:'mission',task_kind:'review',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['visual-qa'],requested_external_actions:[],likely_verification:['visual-check'],likely_targets:['index.html'],intent_signals:[],suppressed_intent_signals:[]})
  const verification=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(verification);assert.equal(verification.status,'open')
  assert.ok(m.methodology.methodology_needs.some(n=>n.name==='hi-visual-qa'&&!n.task_id))
  const first=await runtime.start(m,{objective:'verify local browser first attempt',role:'visual-qa',category:'visual',scope:['index.html'],requiredEvidence:['visual-check'],obligationIds:[verification.id],browserAllowedOrigins:['http://127.0.0.1:4173']})
  const firstTask=m.execution.tasks.find(t=>t.id===first.task_id),firstWorker=m.execution.workers.find(w=>w.id===first.worker_id);assert.ok(firstTask);assert.ok(firstWorker)
  assert.ok(first.methodologies.includes('hi-visual-qa'));assert.equal(firstTask.execution_profile.browser_backend,'bounded-playwright')
  assert.ok(firstTask.execution_profile.tools.includes('hi_browser_screenshot'))
  assert.ok(m.methodology.methodology_needs.some(n=>n.name==='hi-visual-qa'&&n.task_id===first.task_id&&n.obligation_id===verification.id))
  assert.equal(await runtime.cancel(m,first.worker_id),true);assert.equal(verification.status,'open')
  const replacement=await runtime.start(m,{objective:'verify local browser replacement attempt',role:'visual-qa',category:'visual',scope:['index.html'],requiredEvidence:['visual-check'],obligationIds:[verification.id],browserAllowedOrigins:['http://127.0.0.1:4173']})
  const replacementTask=m.execution.tasks.find(t=>t.id===replacement.task_id);assert.ok(replacementTask)
  assert.ok(replacement.methodologies.includes('hi-visual-qa'))
  assert.equal(replacementTask.execution_profile.browser_backend,'bounded-playwright')
  assert.ok(replacementTask.execution_profile.tools.includes('hi_browser_preview_open'))
  assert.ok(replacementTask.execution_profile.tools.includes('hi_browser_screenshot'))
})


test('fresh visual task reactivates canonical methodology and browser surface after prior PASS becomes stale',async()=>{
  let childN=0
  const client={session:{create:async()=>({data:{id:`child-stale-visual-${++childN}`}}),promptAsync:async()=>({data:{}}),abort:async()=>({data:true}),diff:async()=>({data:[]})}}
  const browserExecutor={health:async()=>({available:true}),open:async()=>{throw new Error('unused')},navigate:async()=>{throw new Error('unused')},click:async()=>{throw new Error('unused')},type:async()=>{throw new Error('unused')},inspect:async()=>{throw new Error('unused')},screenshot:async()=>{throw new Error('unused')},wait:async()=>{throw new Error('unused')},close:async()=>{throw new Error('unused')},cleanup:async()=>({cleaned:true,reason:'cleaned'})}
  const runtime=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),repoRoot,repoRoot,()=>DEFAULT_HI_CONFIG,()=>[{id:'provider/vision',provider:'provider',visionCapable:true,writeCapable:true}],()=>({agent:PACKAGED_HI_AGENTS}),undefined,{},undefined,undefined,()=>new Set(['host-capability:browser-execution']),browserExecutor)
  const store=new MissionStore(repoRoot),m=store.start('m13-stale-visual-reactivation','verify local browser again after mutation')
  store.applyInitialSemanticAssessment('m13-stale-visual-reactivation',{material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation','visual-qa'],requested_external_actions:[],likely_verification:['visual-check'],likely_targets:['index.html'],intent_signals:[],suppressed_intent_signals:[]})
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation');assert.ok(implementation);implementation.status='closed';implementation.closedAt=Date.now()
  const verification=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(verification);assert.equal(verification.status,'open');assert.deepEqual(verification.requiredEvidence,['visual-check'])
  const first=await runtime.start(m,{objective:'verify first current visual state',role:'visual-qa',category:'visual',scope:['index.html'],requiredEvidence:['visual-check'],obligationIds:[verification.id],browserAllowedOrigins:['http://127.0.0.1:4173']})
  const firstTask=m.execution.tasks.find(t=>t.id===first.task_id),firstWorker=m.execution.workers.find(w=>w.id===first.worker_id);assert.ok(firstTask);assert.ok(firstWorker)
  firstWorker.loaded_methodologies=['hi-visual-qa']
  const producer=evidenceProducerAttemptForWorker(m,firstWorker),observation=addEvidence(m,{kind:'browser-evidence',summary:'current browser observation',scope:['index.html'],source:'browser:bo_stale_visual_fixture',trusted_source_class:'browser-observation',source_session_id:firstWorker.session_id,source_state_hash:'a'.repeat(64),task_id:firstTask.id,obligation_ids:[verification.id],producer_attempt:producer,outcome:'pending',reason:'browser-observation-only'})
  addEvidence(m,{kind:'visual-evidence',summary:'first visual state passed',scope:['index.html'],source:`browser-derived:${firstWorker.id}`,trusted_source_class:'browser-observation',source_session_id:firstWorker.session_id,source_state_hash:'b'.repeat(64),task_id:firstTask.id,obligation_ids:[verification.id],producer_attempt:producer,evidence_refs:[observation.id],outcome:'passed',pass:true})
  runtime.applyResult(m,firstWorker.id,{status:'DONE',summary:'first visual verification passed',changed_files:[],evidence:[],open_issues:[],needs_context:[]})
  assert.equal(firstTask.status,'completed');assert.equal(verification.status,'closed')
  assert.equal(m.methodology.methodology_needs.some(n=>n.name==='hi-visual-qa'),false,'successful methodology exit should consume the first need')
  markMutation(m,['index.html'],'test-current-visual-mutation')
  assert.equal(verification.status,'open');assert.equal(m.methodology.methodology_needs.some(n=>n.name==='hi-visual-qa'),false,'freshness invalidation alone does not mutate methodology procedure state')
  const replacement=await runtime.start(m,{objective:'verify fresh visual state after mutation',role:'visual-qa',category:'visual',scope:['index.html'],requiredEvidence:['visual-check'],obligationIds:[verification.id],browserAllowedOrigins:['http://127.0.0.1:4173']})
  const replacementTask=m.execution.tasks.find(t=>t.id===replacement.task_id);assert.ok(replacementTask)
  assert.ok(replacement.methodologies.includes('hi-visual-qa'))
  assert.equal(replacementTask.execution_profile.browser_backend,'bounded-playwright')
  assert.ok(replacementTask.execution_profile.tools.includes('hi_browser_open'))
  assert.ok(replacementTask.execution_profile.tools.includes('hi_browser_screenshot'))
  assert.ok(m.methodology.methodology_needs.some(n=>n.name==='hi-visual-qa'&&n.task_id===replacement.task_id&&n.obligation_id===verification.id))
  assert.ok(m.execution.ledger.some(e=>e.type==='methodology.activated'&&e.payload?.name==='hi-visual-qa'&&e.payload?.obligation_id===verification.id))
})

test('task evidence methodology reconciliation ignores closed and unrelated obligations',()=>{
  const store=new MissionStore(repoRoot),m=store.start('m13-no-stale-reactivation','review without current visual obligation')
  store.applyInitialSemanticAssessment('m13-no-stale-reactivation',{material:true,message_kind:'mission',task_kind:'review',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['visual-qa'],requested_external_actions:[],likely_verification:['visual-check'],likely_targets:['index.html'],intent_signals:[],suppressed_intent_signals:[]})
  const verification=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(verification);verification.status='closed';verification.closedAt=Date.now();m.methodology.methodology_needs=[]
  assert.deepEqual(reconcileTaskEvidenceMethodologyNeeds(m,repoRoot,{requiredEvidence:['visual-check'],obligationIds:[verification.id]}),[])
  assert.equal(m.methodology.methodology_needs.length,0)
  const review={id:'o-unrelated-review',status:'open',kind:'review',summary:'independent review',requiredEvidence:['review-evidence']};m.execution.obligations.push(review)
  assert.deepEqual(reconcileTaskEvidenceMethodologyNeeds(m,repoRoot,{requiredEvidence:['visual-check'],obligationIds:[review.id]}),[])
  assert.equal(m.methodology.methodology_needs.length,0)
})


test('failed visual verification task releases open-obligation methodology ownership to its replacement',async()=>{
  let childN=0
  const client={session:{create:async()=>({data:{id:`child-failed-replacement-${++childN}`}}),promptAsync:async()=>({data:{}}),abort:async()=>({data:true}),diff:async()=>({data:[]})}}
  const browserExecutor={health:async()=>({available:true}),open:async()=>{throw new Error('unused')},navigate:async()=>{throw new Error('unused')},click:async()=>{throw new Error('unused')},type:async()=>{throw new Error('unused')},inspect:async()=>{throw new Error('unused')},screenshot:async()=>{throw new Error('unused')},wait:async()=>{throw new Error('unused')},close:async()=>{throw new Error('unused')},cleanup:async()=>({cleaned:true,reason:'cleaned'})}
  const runtime=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),repoRoot,repoRoot,()=>DEFAULT_HI_CONFIG,()=>[{id:'provider/vision',provider:'provider',visionCapable:true,writeCapable:true}],()=>({agent:PACKAGED_HI_AGENTS}),undefined,{},undefined,undefined,()=>new Set(['host-capability:browser-execution']),browserExecutor)
  const store=new MissionStore(repoRoot),m=store.start('m13-failed-replacement','verify local browser after implementation')
  store.applyInitialSemanticAssessment('m13-failed-replacement',{material:true,message_kind:'mission',task_kind:'review',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['visual-qa'],requested_external_actions:[],likely_verification:['visual-check'],likely_targets:['index.html'],intent_signals:[],suppressed_intent_signals:[]})
  const verification=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(verification);assert.equal(verification.status,'open')
  const first=await runtime.start(m,{objective:'verify local browser failing attempt',role:'visual-qa',category:'visual',scope:['index.html'],requiredEvidence:['visual-check'],obligationIds:[verification.id],browserAllowedOrigins:['http://127.0.0.1:4173']})
  assert.ok(first.methodologies.includes('hi-visual-qa'))
  runtime.applyResult(m,first.worker_id,{status:'FAILED',summary:'host visual run failed',changed_files:[],evidence:[],open_issues:['visual-run-failed'],needs_context:[]})
  const firstTask=m.execution.tasks.find(t=>t.id===first.task_id);assert.equal(firstTask.status,'failed');assert.equal(verification.status,'open')
  assert.ok(m.methodology.methodology_needs.some(n=>n.name==='hi-visual-qa'&&!n.task_id&&n.obligation_id===verification.id),'failed Task must release an open verification methodology need')
  const replacement=await runtime.start(m,{objective:'verify local browser after failed attempt',role:'visual-qa',category:'visual',scope:['index.html'],requiredEvidence:['visual-check'],obligationIds:[verification.id],browserAllowedOrigins:['http://127.0.0.1:4173']})
  const replacementTask=m.execution.tasks.find(t=>t.id===replacement.task_id);assert.ok(replacementTask)
  assert.ok(replacement.methodologies.includes('hi-visual-qa'));assert.equal(replacementTask.execution_profile.browser_backend,'bounded-playwright');assert.ok(replacementTask.execution_profile.tools.includes('hi_browser_screenshot'))
})


test('browser cleanup is bounded when Playwright browser.close never settles',async()=>{
  const never=new Promise(()=>{})
  const module={chromium:{launch:async()=>{
    const page={_url:'about:blank',url(){return this._url},setDefaultTimeout(){},on(){},async goto(url){this._url=url},locator(){return{evaluate:async()=>({body:'ready',items:[]})}}}
    return{newContext:async()=>({route:async()=>{},newPage:async()=>page}),close:async()=>never}
  }}}
  const adapter=new PlaywrightBrowserAdapter({executable_path:'/fake/chrome',executable_exists:()=>true,load_playwright:async()=>module,timeout_ms:1000})
  const owner=context('hung-close','m:w:s:g1')
  await adapter.open(owner,'http://127.0.0.1:4173/')
  const outcome=await Promise.race([
    adapter.cleanup(owner).then(value=>({kind:'result',value})),
    new Promise(resolve=>setTimeout(()=>resolve({kind:'timeout'}),3500)),
  ])
  assert.equal(outcome.kind,'result','browser cleanup must not wait forever for Playwright browser.close')
  assert.equal(outcome.value.cleaned,false)
  assert.equal(outcome.value.reason,'close-failed')
})


test('TaskRuntime cancel fails closed when exact browser cleanup cannot complete',async()=>{
  const prompts=[],client={session:{create:async()=>({data:{id:'child-browser-fail'}}),promptAsync:async req=>{prompts.push(req);return{data:{}}},abort:async()=>({data:true}),diff:async()=>({data:[]})}}
  const browserExecutor={
    health:async()=>({available:true}),open:async()=>{throw new Error('unused')},navigate:async()=>{throw new Error('unused')},click:async()=>{throw new Error('unused')},type:async()=>{throw new Error('unused')},inspect:async()=>{throw new Error('unused')},screenshot:async()=>{throw new Error('unused')},wait:async()=>{throw new Error('unused')},close:async()=>{throw new Error('unused')},
    cleanup:async()=>({cleaned:false,reason:'close-failed',error:'Playwright browser.close timed out after 2000ms'})
  }
  const runtime=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),repoRoot,repoRoot,()=>DEFAULT_HI_CONFIG,()=>[{id:'provider/vision',provider:'provider',visionCapable:true,writeCapable:true}],()=>({agent:PACKAGED_HI_AGENTS}),undefined,{},undefined,undefined,()=>new Set(['host-capability:browser-execution']),browserExecutor)
  const store=new MissionStore(repoRoot),m=store.start('m13-cancel-fail-closed','verify local browser')
  store.applyInitialSemanticAssessment('m13-cancel-fail-closed',{material:true,message_kind:'mission',task_kind:'review',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['visual-review'],requested_external_actions:[],likely_verification:['visual-evidence'],likely_targets:['src/view.tsx'],intent_signals:['intent.browser'],suppressed_intent_signals:[]})
  m.methodology.methodology_needs.push({name:'hi-browser-testing',signal:'intent.browser',trigger_source:'task-intent',producer:'intent',reason:'browser acceptance',created_at:Date.now()})
  const started=await runtime.start(m,{objective:'verify local browser',role:'visual-qa',category:'visual',scope:['src/view.tsx'],browserAllowedOrigins:['http://127.0.0.1:4173']})
  const worker=m.execution.workers.find(w=>w.id===started.worker_id),task=m.execution.tasks.find(t=>t.id===started.task_id)
  assert.ok(worker?.session_id);assert.ok(task)
  assert.equal(await runtime.cancel(m,worker.id),false)
  assert.equal(worker.status,'busy');assert.equal(task.status,'running')
  assert.ok(m.execution.ledger.some(e=>e.type==='browser.cleanup-failed'&&e.worker_id===worker.id))
  assert.ok(m.execution.ledger.some(e=>e.type==='worker.cancel.blocked'&&e.worker_id===worker.id&&e.payload?.reason==='browser-cleanup-failed'))
})
