import test from 'node:test'
import assert from 'node:assert/strict'
import {resolveBrowserBackend} from '../dist/runtime/browser/backend-policy.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'
import {HI_BROWSER_EXECUTION_TOOL_IDS} from '../dist/runtime/browser/executor.js'
import {resolveBrowserExecutionOwner} from '../dist/runtime/browser/ownership.js'
import {LocalPreviewManager} from '../dist/runtime/browser/local-preview.js'
import {resolve,dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {opencodeChildPort} from './helpers/host-port.mjs'

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..')

const HOST={agent:PACKAGED_HI_AGENTS,mcp:{browser:{type:'remote',url:'http://127.0.0.1:9/mcp',enabled:true},docs:{type:'local',command:['node','docs.mjs'],enabled:true}}}
function client(prompts=[]){let n=0;return{session:{create:async()=>({data:{id:`child-${++n}`}}),promptAsync:async req=>{prompts.push(req);return{data:{}}},abort:async()=>({data:true}),diff:async()=>({data:[]})}}}
function mission(id,caps){const store=new MissionStore(),m=store.start(id,'browser backend fixture');store.applyInitialSemanticAssessment(id,{material:true,message_kind:'mission',task_kind:'review',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:caps,requested_external_actions:[],likely_verification:['visual-check'],likely_targets:['src/view.tsx'],intent_signals:['intent.browser'],suppressed_intent_signals:[]});m.methodology.methodology_needs.push({name:'hi-browser-testing',signal:'intent.browser',trigger_source:'task-intent',producer:'intent',reason:'browser acceptance',created_at:Date.now()});return m}
function runtime(prompts,resources=new Set()){return new TaskRuntime(opencodeChildPort(client(prompts)),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),repoRoot,repoRoot,()=>DEFAULT_HI_CONFIG,()=>[{id:'provider/vision',provider:'provider',visionCapable:true,writeCapable:true}],()=>structuredClone(HOST),undefined,{},undefined,undefined,()=>resources)}

test('browser backend policy prefers healthy bounded Playwright and does not infer MCP from server names',()=>{
  assert.deepEqual(resolveBrowserBackend({role:'visual-qa',browserRequested:true,localBrowserAvailable:true,semanticCapabilities:['visual-qa','mcp'],selectedMcpServers:['browser']}),{backend:'bounded-playwright',reason:'healthy-bounded-playwright-default'})
  assert.deepEqual(resolveBrowserBackend({role:'visual-qa',browserRequested:true,localBrowserAvailable:false,semanticCapabilities:['visual-qa'],selectedMcpServers:[]}),{reason:'browser-execution-resource-unavailable'})
})

test('explicit MCP browser backend requires exact selected MCP and semantic capability',()=>{
  assert.throws(()=>resolveBrowserBackend({role:'visual-qa',browserRequested:true,requested:'mcp',localBrowserAvailable:false,semanticCapabilities:['visual-qa'],selectedMcpServers:['browser']}),/semantic capability mcp/)
  assert.throws(()=>resolveBrowserBackend({role:'visual-qa',browserRequested:true,requested:'mcp',localBrowserAvailable:false,semanticCapabilities:['visual-qa','mcp'],selectedMcpServers:[]}),/at least one exact selected MCP server/)
  assert.deepEqual(resolveBrowserBackend({role:'visual-qa',browserRequested:true,requested:'mcp',localBrowserAvailable:false,semanticCapabilities:['visual-qa','mcp'],selectedMcpServers:['browser']}),{backend:'mcp',reason:'explicit-task-selected-mcp-browser-backend'})
})

test('visual task defaults to bounded Playwright and disables unselected MCP servers',async()=>{
  const prompts=[],m=mission('m13-local',['visual-qa']),rt=runtime(prompts,new Set(['host-capability:browser-execution']))
  const out=await rt.start(m,{objective:'verify local UI',role:'visual-qa',category:'visual',scope:['src/view.tsx'],browserAllowedOrigins:['http://127.0.0.1:4173']})
  const task=m.execution.tasks.find(t=>t.id===out.task_id);assert.equal(task.execution_profile.browser_backend,'bounded-playwright');assert.deepEqual(out.methodologies,['hi-browser-testing','hi-visual-qa'])
  for(const id of HI_BROWSER_EXECUTION_TOOL_IDS)assert.equal(prompts[0].body.tools[id],undefined,id)
  assert.equal(prompts[0].body.tools['browser_*'],false);assert.equal(prompts[0].body.tools['docs_*'],false)
  assert.ok(task.constraints.includes('hi-browser-backend:bounded-playwright'))
})

test('visual verification case handoff requires full verbatim browser evidence refs instead of prefix-like examples',async()=>{
  const prompts=[],m=mission('m13-full-evidence-ref-handoff',['visual-qa']),verify=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(verify);verify.verificationCases=[{id:'vc_reload',subject:'theme survives reload',required_browser_actions:['navigate','inspect']}];m.identity.intent.verificationCases=structuredClone(verify.verificationCases)
  const rt=runtime(prompts,new Set(['host-capability:browser-execution']));await rt.start(m,{objective:'verify theme persistence',role:'visual-qa',category:'visual',scope:['src/view.tsx'],requiredEvidence:['visual-check'],obligationIds:[verify.id],browserAllowedOrigins:['http://127.0.0.1:4173']})
  const prompt=JSON.stringify(prompts[0]);assert.match(prompt,/verification_coverage/);assert.match(prompt,/FULL_EVIDENCE_REF/);assert.match(prompt,/ENTIRE current-attempt evidence_ref string/);assert.match(prompt,/ev_ab12cd34_q1w2e3/);assert.match(prompt,/prefix ev_ab12cd34 is invalid/);assert.match(prompt,/Do not substitute observation_id or screenshot_artifact_ref/);assert.doesNotMatch(prompt,/evidence_refs:\[ev_\*\]/)
})

test('selected MCP backend satisfies browser runtime resource without fabricating local Hi browser tools',async()=>{
  const prompts=[],m=mission('m13-mcp',['visual-qa','mcp']),rt=runtime(prompts,new Set())
  const out=await rt.start(m,{objective:'verify UI through configured browser MCP',role:'visual-qa',category:'visual',scope:['src/view.tsx'],mcpServers:['browser'],browserBackend:'mcp'})
  const task=m.execution.tasks.find(t=>t.id===out.task_id);assert.equal(task.execution_profile.browser_backend,'mcp');assert.deepEqual(task.execution_profile.mcp_servers,['browser']);assert.deepEqual(out.methodologies,['hi-browser-testing','hi-visual-qa'])
  for(const id of HI_BROWSER_EXECUTION_TOOL_IDS)assert.equal(prompts[0].body.tools[id],false,id)
  assert.equal(prompts[0].body.tools['browser_*'],undefined);assert.equal(prompts[0].body.tools['docs_*'],false)
  assert.ok(task.constraints.includes('hi-browser-backend:mcp'));assert.ok(task.constraints.includes('hi-mcp:browser'))
  const worker=m.execution.workers.find(w=>w.id===out.worker_id);assert.ok(worker?.session_id);assert.equal(resolveBrowserExecutionOwner(m,{sessionID:worker.session_id,workerID:worker.id,taskID:task.id}),undefined,'MCP backend must never acquire the local Playwright execution owner')
})

test('explicit local backend records one durable browser capability blocker and verification environment issue',async()=>{
  const prompts=[],m=mission('m13-local-missing',['visual-qa']),rt=runtime(prompts,new Set())
  await assert.rejects(()=>rt.start(m,{objective:'verify local UI',role:'visual-qa',category:'visual',scope:['src/view.tsx'],browserBackend:'bounded-playwright',browserAllowedOrigins:['http://127.0.0.1:4173']}),/Required methodology host\/resource capability is unavailable/)
  assert.equal(m.execution.tasks.length,0);assert.equal(prompts.length,0)
  assert.ok(m.execution.blockers.includes('capability-unavailable:browser-execution'))
  assert.ok(m.execution.blockers.includes('capability-precondition:visual-qa:methodology-resource'))
  const verify=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(verify)
  const env=m.execution.evidence.items.find(e=>e.kind==='visual-evidence'&&e.outcome==='environment-issue')
  assert.ok(env);assert.ok(env.obligation_ids?.includes(verify.id));assert.equal(env.reason,'capability-unavailable:browser-execution')
})


test('local visual task can defer origin creation to Hi-owned preview and receives exact preview handoff',async()=>{
  const prompts=[],m=mission('m13-preview',['visual-qa']),preview=new LocalPreviewManager(repoRoot)
  const rt=new TaskRuntime(opencodeChildPort(client(prompts)),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),repoRoot,repoRoot,()=>DEFAULT_HI_CONFIG,()=>[{id:'provider/vision',provider:'provider',visionCapable:true,writeCapable:true}],()=>structuredClone(HOST),undefined,{},undefined,undefined,()=>new Set(['host-capability:browser-execution']),undefined,undefined,undefined,preview)
  const out=await rt.start(m,{objective:'verify local static UI',role:'visual-qa',category:'visual',scope:['src/view.tsx']})
  const task=m.execution.tasks.find(t=>t.id===out.task_id);assert.equal(task.execution_profile.browser_backend,'bounded-playwright');assert.deepEqual(task.execution_profile.browser_allowed_origins,undefined)
  const prompt=JSON.stringify(prompts[0]);assert.match(prompt,new RegExp(`LOCAL STATIC PREVIEW: task_id=${out.task_id}`));assert.match(prompt,/hi_browser_preview_open/)
  assert.equal(preview.active(out.task_id),false,'preview starts only when the visual worker requests the scoped local target')
  await preview.dispose()
})



test('ungrounded caller-supplied live origin is rejected before a static visual task can lose preview fallback',async()=>{
  const prompts=[],m=mission('m13-ungrounded-live-origin',['visual-qa']),preview=new LocalPreviewManager(repoRoot)
  const rt=new TaskRuntime(opencodeChildPort(client(prompts)),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),repoRoot,repoRoot,()=>DEFAULT_HI_CONFIG,()=>[{id:'provider/vision',provider:'provider',visionCapable:true,writeCapable:true}],()=>structuredClone(HOST),undefined,{},undefined,undefined,()=>new Set(['host-capability:browser-execution']),undefined,undefined,undefined,preview)
  await assert.rejects(()=>rt.start(m,{objective:'Visual verification of the empty-state fix in web/index.html.',role:'visual-qa',category:'visual',scope:['web/index.html'],requiredEvidence:['visual-check'],browserAllowedOrigins:['http://127.0.0.1'],browserRequiredOrigins:['http://127.0.0.1']}),/required live origin has no retained service owner or objective\/target URL.*omit browser_required_origins.*Hi-owned preview/i)
  assert.equal(prompts.length,0);assert.equal(m.execution.tasks.length,0);assert.equal(preview.active('anything'),false)
  await preview.dispose()
})


test('visual task binds explicit live objective URL as immutable browser target and does not offer static preview substitution',async()=>{
  const prompts=[],m=mission('m13-live-objective',['visual-qa']),preview=new LocalPreviewManager(repoRoot)
  const rt=new TaskRuntime(opencodeChildPort(client(prompts)),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),repoRoot,repoRoot,()=>DEFAULT_HI_CONFIG,()=>[{id:'provider/vision',provider:'provider',visionCapable:true,writeCapable:true}],()=>structuredClone(HOST),undefined,{},undefined,undefined,()=>new Set(['host-capability:browser-execution']),undefined,undefined,undefined,preview)
  const out=await rt.start(m,{objective:'Browser UI verification for Flask Notes app at http://localhost:5000. Verify add/edit/delete.',role:'visual-qa',category:'visual',scope:['app.py','templates/index.html'],requiredEvidence:['visual-check']})
  const task=m.execution.tasks.find(t=>t.id===out.task_id);assert.ok(task)
  assert.deepEqual(task.execution_profile.browser_required_origins,['http://localhost:5000'])
  assert.deepEqual(task.execution_profile.browser_allowed_origins,['http://localhost:5000'])
  const prompt=JSON.stringify(prompts[0]);assert.match(prompt,/REQUIRED LIVE BROWSER ORIGIN\(S\): http:\/\/localhost:5000/);assert.doesNotMatch(prompt,/LOCAL STATIC PREVIEW/)
  await preview.dispose()
})


function retainedService(m,id,origin){
  m.execution.processes.push({process_id:id,mission_id:m.identity.mission_id,task_id:`t-${id}`,worker_id:`w-${id}`,host:'opencode',command_identity:'c'.repeat(64),cwd:repoRoot,pid:4100+m.execution.processes.length,status:'RUNNING',started_at:Date.now(),output_artifact_refs:[],...(origin?{service_origins:[origin]}:{}),authority_ref:'native',cleanup_state:'ACTIVE'})
}

test('visual task automatically inherits the single retained live service origin and forbids static preview substitution',async()=>{
  const prompts=[],m=mission('m13-retained-live',['visual-qa']),preview=new LocalPreviewManager(repoRoot);retainedService(m,'proc-live','http://127.0.0.1:5000')
  const rt=new TaskRuntime(opencodeChildPort(client(prompts)),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),repoRoot,repoRoot,()=>DEFAULT_HI_CONFIG,()=>[{id:'provider/vision',provider:'provider',visionCapable:true,writeCapable:true}],()=>structuredClone(HOST),undefined,{},undefined,undefined,()=>new Set(['host-capability:browser-execution']),undefined,undefined,undefined,preview)
  const out=await rt.start(m,{objective:'Verify the running Flask Notes UI add/edit/delete behavior.',role:'visual-qa',category:'visual',scope:['app.py','templates/index.html'],requiredEvidence:['visual-check']})
  const task=m.execution.tasks.find(t=>t.id===out.task_id);assert.deepEqual(task.execution_profile.browser_required_origins,['http://127.0.0.1:5000']);assert.deepEqual(task.execution_profile.browser_allowed_origins,['http://127.0.0.1:5000'])
  const prompt=JSON.stringify(prompts[0]);assert.match(prompt,/REQUIRED LIVE BROWSER ORIGIN\(S\): http:\/\/127\.0\.0\.1:5000/);assert.doesNotMatch(prompt,/LOCAL STATIC PREVIEW/)
  await preview.dispose()
})

test('live persistent service without registered target fails visual admission before child spawn instead of falling back to preview',async()=>{
  const prompts=[],m=mission('m13-retained-unregistered',['visual-qa']),preview=new LocalPreviewManager(repoRoot);retainedService(m,'proc-unregistered')
  const rt=new TaskRuntime(opencodeChildPort(client(prompts)),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),repoRoot,repoRoot,()=>DEFAULT_HI_CONFIG,()=>[{id:'provider/vision',provider:'provider',visionCapable:true,writeCapable:true}],()=>structuredClone(HOST),undefined,{},undefined,undefined,()=>new Set(['host-capability:browser-execution']),undefined,undefined,undefined,preview)
  await assert.rejects(()=>rt.start(m,{objective:'Verify the running app UI.',role:'visual-qa',category:'visual',scope:['app.py'],requiredEvidence:['visual-check']}),/Live persistent process target is unregistered.*static preview cannot substitute/i)
  assert.equal(prompts.length,0);assert.equal(m.execution.tasks.length,0);assert.equal(preview.active('anything'),false)
  await preview.dispose()
})

test('multiple retained live service targets require one explicit browser_required_origins choice',async()=>{
  const prompts=[],m=mission('m13-retained-multiple',['visual-qa']);retainedService(m,'proc-a','http://127.0.0.1:5000');retainedService(m,'proc-b','http://127.0.0.1:5001')
  const rt=runtime(prompts,new Set(['host-capability:browser-execution']))
  await assert.rejects(()=>rt.start(m,{objective:'Verify the intended live app UI.',role:'visual-qa',category:'visual',scope:['app.py'],requiredEvidence:['visual-check']}),/Multiple live service browser origins are active/)
  const out=await rt.start(m,{objective:'Verify the intended live app UI.',role:'visual-qa',category:'visual',scope:['app.py'],requiredEvidence:['visual-check'],browserRequiredOrigins:['http://127.0.0.1:5001']})
  const task=m.execution.tasks.find(t=>t.id===out.task_id);assert.deepEqual(task.execution_profile.browser_required_origins,['http://127.0.0.1:5001'])
})

test('explicit visual target cannot point at a preview/other origin while a different live service is registered',async()=>{
  const prompts=[],m=mission('m13-retained-mismatch',['visual-qa']);retainedService(m,'proc-live-mismatch','http://127.0.0.1:5000');const rt=runtime(prompts,new Set(['host-capability:browser-execution']))
  await assert.rejects(()=>rt.start(m,{objective:'Verify live UI.',role:'visual-qa',category:'visual',scope:['app.py'],requiredEvidence:['visual-check'],browserRequiredOrigins:['http://127.0.0.1:37999']}),/required origin must match an active registered live service origin/i)
  assert.equal(prompts.length,0)
})

test('browser requirement resolves operational-tool receipt even when live browser capability was already observed',async()=>{
  const prompts=[],m=mission('m13-operational-tool-existing',['visual-qa']),calls=[]
  const ensure=async()=>{calls.push('ensure');return{available:true,attempted:false,implementationId:'playwright-chromium',status:'existing',scope:'existing',receiptPath:join(repoRoot,'.opencode','hi','tools','receipts','browser-execution','playwright-chromium.json')}}
  const rt=new TaskRuntime(opencodeChildPort(client(prompts)),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),repoRoot,repoRoot,()=>DEFAULT_HI_CONFIG,()=>[{id:'provider/vision',provider:'provider',visionCapable:true,writeCapable:true}],()=>structuredClone(HOST),undefined,{},undefined,undefined,()=>new Set(['host-capability:browser-execution']),undefined,ensure)
  const out=await rt.start(m,{objective:'verify local UI with managed operational tool resolution',role:'visual-qa',category:'visual',scope:['src/view.tsx'],browserAllowedOrigins:['http://127.0.0.1:4173']})
  assert.equal(out.readiness,'READY');assert.equal(calls.length,1)
  const event=m.execution.ledger.find(e=>e.type==='operational-tool.resolved'&&e.payload?.phase==='task-requirement')
  assert.ok(event);assert.equal(event.payload.capability,'browser-execution');assert.equal(event.payload.implementation,'playwright-chromium');assert.equal(event.payload.status,'existing');assert.equal(event.payload.scope,'existing');assert.match(String(event.payload.receipt_path),/\.opencode[\\/]hi[\\/]tools[\\/]receipts/)
})
