import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { makeHostPort,makeChildSessionPort } from './helpers/host-port.mjs'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { BackgroundRegistry } from '../dist/runtime/background/registry.js'
import { createConcurrencyPolicySource } from '../dist/runtime/scheduler/concurrency.js'
import { TaskRuntime } from '../dist/runtime/task/task-runtime.js'
import { DEFAULT_HI_CONFIG } from '../dist/config/defaults.js'
import { dispatchContinuation } from '../dist/runtime/continuation/dispatcher.js'
import { normalizeOpenCodeEvent } from '../dist/opencode/event-adapter.js'

const source=rel=>readFileSync(new URL(`../src/${rel}`,import.meta.url),'utf8')

test('generic HostPort expresses Hi host needs without importing OpenCode SDK types',()=>{
  const port=source('runtime/host/port.ts')
  assert.match(port,/export interface HostPort/)
  assert.match(port,/continueSession\(/)
  assert.match(port,/readAssistantResult\(/)
  assert.match(port,/export interface ChildSessionPort/)
  assert.doesNotMatch(port,/OpenCode|@opencode-ai|OpenCodeClient|PluginContext/)
  const adapter=source('opencode/host-port.ts')
  assert.match(adapter,/createHostPort\(ctx:OpenCodePluginContext\):HostPort/)
  assert.match(adapter,/sendSyntheticContinuation/)
})

test('semantic runtime core has no raw OpenCode SDK/client lifecycle dependency',()=>{
  for(const rel of ['runtime/task/task-runtime.ts','runtime/task/child-execution-coordinator.ts','runtime/continuation/dispatcher.ts','runtime/application/runtime-services.ts','runtime/application/runtime-event-controller.ts','runtime/process/runtime.ts','runtime/routing/model-resolver.ts']){
    const s=source(rel)
    assert.doesNotMatch(s,/OpenCodeClient|OpenCodePluginContext|NativeOpenCodeAdapter|detectOpenCodeCapabilities|client-adapter|open-code-pty-adapter/,rel)
  }
  assert.match(source('opencode/client-adapter.ts'),/const edge=client as any/)
  assert.match(source('opencode/event-adapter.ts'),/normalizeOpenCodeEvent/)
})

test('raw host event normalization occurs at OpenCode hook boundary, not semantic controller',()=>{
  const hooks=source('opencode/open-code-hooks.ts'),controller=source('runtime/application/runtime-event-controller.ts')
  assert.match(hooks,/normalizeOpenCodeEvent/)
  assert.match(hooks,/eventController\.handle\(normalizeOpenCodeEvent\(input\?\.event\?\?input\)\)/)
  assert.doesNotMatch(controller,/normalizeOpenCodeEvent|event-adapter|client-adapter|@opencode-ai|ctx\.client/)
  assert.match(controller,/HostEvent,HostPort/,'semantic controller consumes only the normalized host contract')
})

test('runtime composition accepts injected host-semantic executors instead of constructing OpenCode adapters',()=>{
  const services=source('runtime/application/runtime-services.ts'),plugin=source('plugin.ts'),runtime=source('runtime/application/plugin-runtime.ts')
  assert.match(services,/export interface RuntimeServicePorts/)
  assert.match(services,/childSession:ChildSessionPort/)
  assert.match(services,/process:ProcessExecutor/)
  assert.match(services,/workspace:WorkspaceExecutor/)
  assert.doesNotMatch(services,/OpenCodePtyAdapter|OpenCodeWorkspaceAdapter|PlaywrightBrowserAdapter|OpenCodePluginContext/)
  assert.match(plugin,/new OpenCodePtyAdapter/)
  assert.match(plugin,/new OpenCodeWorkspaceAdapter/)
  assert.match(runtime,/new PlaywrightBrowserAdapter/)
  assert.doesNotMatch(runtime,/OpenCodePtyAdapter|OpenCodeWorkspaceAdapter|OpenCodePluginContext/)
})

test('alternate host continuation port preserves Mission continuation semantics without OpenCode shapes',async()=>{
  const sent=[];const host=makeHostPort({continueSession:async(sessionID,text,metadata)=>{sent.push({sessionID,text,metadata});return true}})
  const store=new MissionStore();const m=store.start('alt-session','repair issue');
  const ok=await dispatchContinuation(host,m,'continue safely','alternate-host-test')
  assert.equal(ok,true);assert.equal(sent.length,1);assert.equal(sent[0].sessionID,'alt-session')
  assert.equal(m.continuation.continuation_failure_count,0)
  assert.equal(m.execution.ledger.some(e=>e.type==='continuation'),true)
})

test('alternate host child-session port can execute a Hi task without OpenCode client structure',async()=>{
  let creates=0,prompts=0
  const child=makeChildSessionPort({
    create:async()=>({child:{id:`alt-child-${++creates}`},fork:{requested:false,nativeAvailable:false,used:false}}),
    prompt:async()=>{prompts++},
  })
  const runtime=new TaskRuntime(child,new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))
  const store=new MissionStore(),m=store.start('alt-parent','Implement a bounded change')
  store.applyInitialSemanticAssessment('alt-parent',{material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:['x.ts'],intent_signals:[],suppressed_intent_signals:[]})
  const started=await runtime.start(m,{objective:'Implement x',role:'coder',scope:['x.ts']})
  assert.equal(started.session_id,'alt-child-1');assert.equal(creates,1);assert.equal(prompts,1)
  assert.equal(m.execution.workers.find(w=>w.id===started.worker_id)?.session_id,'alt-child-1')
})


test('message.updated crosses the OpenCode boundary as a structured assistant host event',()=>{
  const structured={status:'DONE',summary:'event result',changed_files:[],evidence:[],open_issues:[],needs_context:[]}
  const ev=normalizeOpenCodeEvent({type:'message.updated',properties:{sessionID:'child-event',info:{id:'msg-event',role:'assistant',parentID:'msg-parent',providerID:'p',modelID:'code',time:{created:123,completed:124},tokens:{input:1,output:2,reasoning:0,cache:{read:0,write:0}},cost:0,structured}}})
  assert.equal(ev.kind,'assistant-message-updated');assert.equal(ev.sessionID,'child-event');assert.deepEqual(ev.assistant?.structured,structured)
  assert.deepEqual(ev.assistant?.model,{model:'p/code',variant:undefined,message_id:'msg-event',parent_id:'msg-parent',created_at:123})
  assert.equal(ev.assistant?.usage?.token_source,'opencode-assistant-message')
})
