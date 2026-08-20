import test from 'node:test'
import assert from 'node:assert/strict'
import {resolveMcpServerExposure,taskPromptToolOverrides} from '../dist/runtime/routing/execution-profile.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {opencodeChildPort} from './helpers/host-port.mjs'
import {evaluateIdle} from '../dist/runtime/continuation/evaluator.js'

const HOST={mcp:{docs:{type:'local',command:['node','docs.mjs'],enabled:true},browser:{type:'remote',url:'http://127.0.0.1:9/mcp',enabled:true},off:{type:'local',command:['node','off.mjs'],enabled:false}}}
function assessed(store,id,caps=['implementation']){const m=store.start(id,'mcp exposure fixture');store.applyInitialSemanticAssessment(id,{material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:caps,requested_external_actions:[],likely_verification:[],likely_targets:['src/a.ts'],intent_signals:[],suppressed_intent_signals:[]});return m}
function client(prompts=[]){let n=0;return{session:{create:async()=>({data:{id:`child-${++n}`}}),promptAsync:async req=>{prompts.push(req);return{data:{}}},abort:async()=>({data:{}}),diff:async()=>({data:[]})}}}
function runtime(c){return new TaskRuntime(opencodeChildPort(c),new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>structuredClone(HOST))}

test('M12 MCP exposure disables every configured active server when no server is selected',()=>{const x=resolveMcpServerExposure(HOST,[]);assert.deepEqual(x.configured,['browser','docs']);assert.deepEqual(x.disabledPatterns,['browser_*','docs_*']);const tools=taskPromptToolOverrides(['read'],HOST,[]);assert.equal(tools['browser_*'],false);assert.equal(tools['docs_*'],false);assert.equal(tools.read,undefined);assert.ok(!Object.values(tools).includes(true))})

test('M12 MCP selection keeps one exact server native-authoritative and disables siblings only',()=>{const x=resolveMcpServerExposure(HOST,['docs']);assert.deepEqual(x.selected,['docs']);assert.deepEqual(x.disabledPatterns,['browser_*']);const tools=taskPromptToolOverrides(['read'],HOST,['docs']);assert.equal(tools['browser_*'],false);assert.equal(tools['docs_*'],undefined);assert.ok(!Object.values(tools).includes(true))})

test('M12 MCP exposure fails closed for unavailable or sanitized namespace-colliding servers',()=>{assert.throws(()=>resolveMcpServerExposure(HOST,['missing']),/unavailable/);assert.throws(()=>resolveMcpServerExposure({mcp:{'a.b':{enabled:true},a_b:{enabled:true}}},['a.b']),/namespace collision/)})

test('M12 normal child prompt carries native wildcard denies for all configured MCP servers',async()=>{const prompts=[],store=new MissionStore(),m=assessed(store,'m12-no-mcp'),rt=runtime(client(prompts));await rt.start(m,{objective:'bounded edit',role:'coder',category:'quick',scope:['src/a.ts']});assert.equal(prompts.length,1);assert.equal(prompts[0].body.tools['docs_*'],false);assert.equal(prompts[0].body.tools['browser_*'],false);assert.equal(m.execution.tasks.at(-1).execution_profile.mcp_servers,undefined)})

test('M12 exact selected MCP server requires semantic capability and persists task-bound selection',async()=>{const prompts=[],store=new MissionStore(),m=assessed(store,'m12-mcp-selected',['implementation','mcp']),rt=runtime(client(prompts));const out=await rt.start(m,{objective:'lookup docs through configured MCP',role:'coder',category:'quick',scope:['src/a.ts'],mcpServers:['docs']});const task=m.execution.tasks.find(t=>t.id===out.task_id);assert.deepEqual(task.execution_profile.mcp_servers,['docs']);assert.equal(prompts[0].body.tools['browser_*'],false);assert.equal(prompts[0].body.tools['docs_*'],undefined);assert.ok(task.constraints.includes('hi-mcp:docs'))})

test('M12 MCP request fails before task creation without semantic capability',async()=>{const store=new MissionStore(),m=assessed(store,'m12-mcp-no-cap'),rt=runtime(client([]));await assert.rejects(()=>rt.start(m,{objective:'lookup docs',role:'coder',category:'quick',scope:['src/a.ts'],mcpServers:['docs']}),/semantic capability mcp/);assert.equal(m.execution.tasks.length,0)})


test('M12 unavailable selected MCP server becomes one durable terminal capability state',async()=>{
  const store=new MissionStore(),m=assessed(store,'m12-mcp-missing',['implementation','mcp']),rt=new TaskRuntime(opencodeChildPort(client([])),new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({mcp:{}}))
  await assert.rejects(()=>rt.start(m,{objective:'lookup docs',role:'coder',category:'quick',scope:['src/a.ts'],mcpServers:['missing']}),/USER_ACTION_REQUIRED:.*MCP server/i)
  assert.equal(m.execution.tasks.length,0);assert.ok(m.execution.blockers.includes('capability-unavailable:mcp-server-missing'))
  const decision=evaluateIdle(m);assert.equal(decision.decision,'USER_ACTION_REQUIRED');assert.equal(decision.reason_code,'capability-unavailable');assert.equal(decision.prompt,undefined)
})
