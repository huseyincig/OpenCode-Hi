import test from 'node:test'
import assert from 'node:assert/strict'
import {resolveBrowserBackend} from '../dist/runtime/browser/backend-policy.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'
import {HI_BROWSER_EXECUTION_TOOL_IDS} from '../dist/runtime/browser/executor.js'
import {resolveBrowserExecutionOwner} from '../dist/runtime/browser/ownership.js'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {opencodeChildPort} from './helpers/host-port.mjs'

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..')

const HOST={agent:PACKAGED_HI_AGENTS,mcp:{browser:{type:'remote',url:'http://127.0.0.1:9/mcp',enabled:true},docs:{type:'local',command:['node','docs.mjs'],enabled:true}}}
function client(prompts=[]){let n=0;return{session:{create:async()=>({data:{id:`child-${++n}`}}),promptAsync:async req=>{prompts.push(req);return{data:{}}},abort:async()=>({data:true}),diff:async()=>({data:[]})}}}
function mission(id,caps){const store=new MissionStore(),m=store.start(id,'browser backend fixture');store.applyInitialSemanticAssessment(id,{material:true,message_kind:'mission',task_kind:'review',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:caps,requested_external_actions:[],likely_verification:['visual-check'],likely_targets:['src/view.tsx'],intent_signals:['intent.browser'],suppressed_intent_signals:[]});m.methodology.methodology_needs.push({name:'hi-browser-testing',signal:'intent.browser',trigger_source:'task-intent',producer:'intent',reason:'browser acceptance',created_at:Date.now()});return m}
function runtime(prompts,resources=new Set()){return new TaskRuntime(opencodeChildPort(client(prompts)),new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),repoRoot,repoRoot,()=>DEFAULT_HI_CONFIG,()=>[{id:'provider/vision',provider:'provider',visionCapable:true,writeCapable:true}],()=>structuredClone(HOST),undefined,{},undefined,undefined,()=>resources)}

test('M13 browser backend policy prefers healthy bounded Playwright and does not infer MCP from server names',()=>{
  assert.deepEqual(resolveBrowserBackend({role:'visual-qa',browserRequested:true,localBrowserAvailable:true,semanticCapabilities:['visual-qa','mcp'],selectedMcpServers:['browser']}),{backend:'bounded-playwright',reason:'healthy-bounded-playwright-default'})
  assert.deepEqual(resolveBrowserBackend({role:'visual-qa',browserRequested:true,localBrowserAvailable:false,semanticCapabilities:['visual-qa'],selectedMcpServers:[]}),{reason:'browser-execution-resource-unavailable'})
})

test('M13 explicit MCP browser backend requires exact selected MCP and semantic capability',()=>{
  assert.throws(()=>resolveBrowserBackend({role:'visual-qa',browserRequested:true,requested:'mcp',localBrowserAvailable:false,semanticCapabilities:['visual-qa'],selectedMcpServers:['browser']}),/semantic capability mcp/)
  assert.throws(()=>resolveBrowserBackend({role:'visual-qa',browserRequested:true,requested:'mcp',localBrowserAvailable:false,semanticCapabilities:['visual-qa','mcp'],selectedMcpServers:[]}),/at least one exact selected MCP server/)
  assert.deepEqual(resolveBrowserBackend({role:'visual-qa',browserRequested:true,requested:'mcp',localBrowserAvailable:false,semanticCapabilities:['visual-qa','mcp'],selectedMcpServers:['browser']}),{backend:'mcp',reason:'explicit-task-selected-mcp-browser-backend'})
})

test('M13 visual task defaults to bounded Playwright and disables unselected MCP servers',async()=>{
  const prompts=[],m=mission('m13-local',['visual-qa']),rt=runtime(prompts,new Set(['host-capability:browser-execution']))
  const out=await rt.start(m,{objective:'verify local UI',role:'visual-qa',category:'visual',scope:['src/view.tsx'],browserAllowedOrigins:['http://127.0.0.1:4173']})
  const task=m.execution.tasks.find(t=>t.id===out.task_id);assert.equal(task.execution_profile.browser_backend,'bounded-playwright');assert.deepEqual(out.methodologies,['hi-browser-testing','hi-visual-qa'])
  for(const id of HI_BROWSER_EXECUTION_TOOL_IDS)assert.equal(prompts[0].body.tools[id],undefined,id)
  assert.equal(prompts[0].body.tools['browser_*'],false);assert.equal(prompts[0].body.tools['docs_*'],false)
  assert.ok(task.constraints.includes('hi-browser-backend:bounded-playwright'))
})

test('M13 selected MCP backend satisfies browser runtime resource without fabricating local Hi browser tools',async()=>{
  const prompts=[],m=mission('m13-mcp',['visual-qa','mcp']),rt=runtime(prompts,new Set())
  const out=await rt.start(m,{objective:'verify UI through configured browser MCP',role:'visual-qa',category:'visual',scope:['src/view.tsx'],mcpServers:['browser'],browserBackend:'mcp'})
  const task=m.execution.tasks.find(t=>t.id===out.task_id);assert.equal(task.execution_profile.browser_backend,'mcp');assert.deepEqual(task.execution_profile.mcp_servers,['browser']);assert.deepEqual(out.methodologies,['hi-browser-testing','hi-visual-qa'])
  for(const id of HI_BROWSER_EXECUTION_TOOL_IDS)assert.equal(prompts[0].body.tools[id],false,id)
  assert.equal(prompts[0].body.tools['browser_*'],undefined);assert.equal(prompts[0].body.tools['docs_*'],false)
  assert.ok(task.constraints.includes('hi-browser-backend:mcp'));assert.ok(task.constraints.includes('hi-mcp:browser'))
  const worker=m.execution.workers.find(w=>w.id===out.worker_id);assert.ok(worker?.session_id);assert.equal(resolveBrowserExecutionOwner(m,{sessionID:worker.session_id,workerID:worker.id,taskID:task.id}),undefined,'MCP backend must never acquire the local Playwright execution owner')
})

test('M13 explicit local backend records one durable browser capability blocker and verification environment issue',async()=>{
  const prompts=[],m=mission('m13-local-missing',['visual-qa']),rt=runtime(prompts,new Set())
  await assert.rejects(()=>rt.start(m,{objective:'verify local UI',role:'visual-qa',category:'visual',scope:['src/view.tsx'],browserBackend:'bounded-playwright',browserAllowedOrigins:['http://127.0.0.1:4173']}),/Required methodology host\/resource capability is unavailable/)
  assert.equal(m.execution.tasks.length,0);assert.equal(prompts.length,0)
  assert.ok(m.execution.blockers.includes('capability-unavailable:browser-execution'))
  assert.ok(m.execution.blockers.includes('capability-precondition:visual-qa:methodology-resource'))
  const verify=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(verify)
  const env=m.execution.evidence.items.find(e=>e.kind==='visual-evidence'&&e.outcome==='environment-issue')
  assert.ok(env);assert.ok(env.obligation_ids?.includes(verify.id));assert.equal(env.reason,'capability-unavailable:browser-execution')
})
