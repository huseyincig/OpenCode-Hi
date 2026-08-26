import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {activateMethodologySignal} from '../dist/runtime/methodology/activation.js'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'
import {projectHiOpenCodeAgents} from '../dist/opencode/agent-binding.js'
import {opencodeChildPort} from './helpers/host-port.mjs'

const hiRoot=fileURLToPath(new URL('../../',import.meta.url)).replace(/[\\/]$/,'')
const clone=value=>JSON.parse(JSON.stringify(value))

test('does not dispatch a child when its only role-compatible required methodology is denied',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-methodology-deny-'))
  try{
    const host={};projectHiOpenCodeAgents(host,{coder:clone(PACKAGED_HI_AGENTS.coder)})
    host.agent.coder.permission.skill['hi-test-driven-development']='deny'
    const created=[]
    const client={session:{create:async req=>{created.push(req);return{data:{id:'unexpected-child'}}},promptAsync:async()=>({data:{}}),diff:async()=>({data:[]}),abort:async()=>({data:true})}}
    const runtime=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2,providers:{},models:{}})),root,hiRoot,()=>DEFAULT_HI_CONFIG,()=>[],()=>host)
    const store=new MissionStore(root),m=store.start('methodology-denied','Implement the requested behavior using TDD')
    store.applyInitialSemanticAssessment('methodology-denied',{material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:['src/value.ts'],intent_signals:[],suppressed_intent_signals:[]})
    m.methodology.methodology_needs=[]
    activateMethodologySignal(m,root,{signal:'intent.tdd',producer:'intent',reason:'TDD explicitly required'})
    await assert.rejects(
      ()=>runtime.start(m,{objective:'Implement the requested behavior',role:'coder',scope:['src/value.ts']}),
      error=>error?.name==='TaskPreconditionError'&&error.result?.decision==='RESOLVE'&&error.result?.items?.some(item=>item.id==='methodology-admission'),
    )
    assert.equal(created.length,0)
    assert.ok(m.methodology.methodology_needs.some(need=>need.name==='hi-test-driven-development'))
  }finally{rmSync(root,{recursive:true,force:true})}
})
