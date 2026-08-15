import test from 'node:test'
import assert from 'node:assert/strict'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {openCodeHostCapabilityContracts,hostCapabilityByID} from '../dist/contracts/host-capability.js'
import {builtinMethodologyCatalog} from '../dist/runtime/methodology/catalog.js'
import {resolveSkillPlan} from '../dist/runtime/skills/registry.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {TaskPreconditionError} from '../dist/runtime/readiness/preconditions.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'
import {opencodeChildPort} from './helpers/host-port.mjs'

const all={childSessions:true,asyncPrompt:true,syncPrompt:true,abort:true,providerInventory:true,appLog:true,sessionStatus:true,childSessionList:true,sessionTodo:true,sessionDiff:true,sessionFork:true,sessionSummarize:true,sessionRevert:true,sessionUnrevert:true}
const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..')

test('browser execution is supported only at the exact Hi-owned real-host acceptance boundary',()=>{
  const cap=hostCapabilityByID(openCodeHostCapabilityContracts(all),'browser-execution')
  assert.equal(cap?.status,'SUPPORTED')
  assert.equal(cap?.verification_level,'REAL_HOST_ACCEPTANCE')
  assert.match(cap?.native_primitive??'',/Playwright Chromium.*health/i)
  assert.match(cap?.adapter_entrypoint??'',/BrowserRuntime.*PlaywrightBrowserAdapter/i)
  assert.equal(cap?.runtime_health_required,true)
  assert.match(cap?.forbidden_fake_behavior??'',/exact source\/host behavior.*real-host acceptance receipt/i)
})

test('browser and visual methodologies require canonical browser-execution host capability',()=>{
  const catalog=builtinMethodologyCatalog()
  for(const name of ['hi-browser-testing','hi-visual-qa']){
    const policy=catalog.find(x=>x.name===name)
    assert.deepEqual(policy?.resourceRequirements,['host-capability:browser-execution'])
    const candidate={name,provider:'hi',path:`/tmp/${name}/SKILL.md`,valid:true,enabled:true,orchestrationRisk:false}
    const denied=resolveSkillPlan([name],[candidate],{[name]:'allow'},true,'visual-qa',catalog,new Set())
    assert.equal(denied.outcomes[0]?.outcome,'resource-unavailable')
    assert.deepEqual(denied.selected,[])
    const supported=resolveSkillPlan([name],[candidate],{[name]:'allow'},true,'visual-qa',catalog,new Set(['host-capability:browser-execution']))
    assert.equal(supported.selected[0]?.name,name)
  }
})

test('TaskRuntime still fails visual methodology preflight before native child spawn when executor health resource is unavailable',async()=>{
  const created=[]
  const client={session:{create:async req=>{created.push(req);return{data:{id:'child'}}},promptAsync:async()=>({data:{}}),abort:async()=>({data:true}),diff:async()=>({data:[]})}}
  const runtime=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),repoRoot,repoRoot,()=>DEFAULT_HI_CONFIG,()=>[],()=>({agent:PACKAGED_HI_AGENTS}),undefined,{},undefined,undefined,()=>new Set())
  const store=new MissionStore(repoRoot),m=store.start('visual-resource','verify visual rendering')
  store.applyInitialSemanticAssessment('visual-resource',{material:true,message_kind:'mission',task_kind:'review',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['visual-review'],requested_external_actions:[],likely_verification:['visual-evidence'],likely_targets:['src/view.tsx'],intent_signals:['intent.visual-qa'],suppressed_intent_signals:[]})
  m.methodology.methodology_needs.push({name:'hi-visual-qa',signal:'intent.visual-qa',trigger_source:'task-intent',producer:'intent',reason:'explicit visual QA',created_at:Date.now()})
  await assert.rejects(()=>runtime.start(m,{objective:'verify visual rendering',role:'visual-qa',category:'visual',scope:['src/view.tsx']}),error=>{
    assert.ok(error instanceof TaskPreconditionError)
    assert.equal(error.result.decision,'RESOLVE')
    assert.ok(error.result.items.some(item=>item.id==='methodology-resource'&&/hi-visual-qa/.test(item.reason)))
    return true
  })
  assert.equal(created.length,0)
})
