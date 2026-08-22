import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createHiToolSurface} from '../dist/runtime/application/hi-tool-surface.js'
import {detectOpenCodeCapabilities} from '../dist/opencode/capabilities.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {evaluateCompletion} from '../dist/runtime/completion/evaluator.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'
import {opencodeChildPort} from './helpers/host-port.mjs'

const ASSESSMENT={material:true,message_kind:'mission',task_kind:'review',scope:'local',risk:'high',ambiguity:'none',dependency_class:'independent',required_capabilities:['review','security-review','independent-review'],requested_external_actions:[],likely_verification:['review-evidence'],likely_targets:['src/security.js'],intent_signals:[],suppressed_intent_signals:[]}
function state(){return{config:structuredClone(DEFAULT_HI_CONFIG),hostConfig:{},configResolution:undefined,openCodeVersion:'1.18.18'}}
function taskRuntime(root){return new TaskRuntime(opencodeChildPort({}),new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),root,root,()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))}

test('completion-ready mission skips redundant task start before TaskRuntime dispatch',async()=>{
  const root=mkdtempSync(join(process.env.TMPDIR??tmpdir(),'hi-completion-review-'))
  try{
    mkdirSync(join(root,'src'),{recursive:true});writeFileSync(join(root,'src','security.js'),'export const secure = true\n')
    const store=new MissionStore(root),m=store.start('done-parent','review bounded security invariant')
    store.applyInitialSemanticAssessment('done-parent',ASSESSMENT)
    const claims=m.execution.obligations.filter(o=>['review','verification'].includes(o.kind))
    const task=createTask(m,{objective:'fresh security review',role:'security-reviewer',category:'critical',scope:['src/security.js'],requiredEvidence:['review-evidence'],obligationIds:claims.map(o=>o.id)})
    const worker=createWorker(m,task,'opencode-go/mimo-v2.5-pro');worker.status='busy';worker.started_at=Date.now()-5;worker.session_id='review-session';worker.native_state_hash='c'.repeat(64)
    taskRuntime(root).applyResult(m,worker.id,{status:'DONE',summary:'review passed',changed_files:[],evidence:[{kind:'review-evidence',summary:'fresh security review passed',scope:['src/security.js'],pass:true,outcome:'passed'}],findings:[],open_issues:[],needs_context:[]})
    assert.equal(evaluateCompletion(m,root).complete,true,'fixture itself must be completion-ready before exercising the task guard')
    let starts=0,resumes=0
    const tasks={start:async()=>{starts++;throw new Error('must not dispatch')},resume:async()=>{resumes++;throw new Error('must not resume')}}
    const processRuntime={stopMission:async()=>0,list:()=>[]}
    const {toolSurface}=createHiToolSurface({state:state(),store,tasks,processRuntime,projectRoot:root,capabilities:detectOpenCodeCapabilities({}),native:{},getModels:()=>[],scopedStores:{contextArtifacts:{}}})
    const result=JSON.parse(await toolSurface.hi_task_start.execute({objective:'Complete Hi mission - no open obligations remaining',role:'worker'},{sessionID:'done-parent'}))
    assert.deepEqual(result,{status:'SKIPPED',reason:'mission-already-complete',completion_ready:true})
    assert.equal(starts,0);assert.equal(resumes,0)
    assert.ok(m.execution.ledger.some(e=>e.type==='task.start-skipped'&&e.payload?.reason==='mission-already-complete'))
  }finally{rmSync(root,{recursive:true,force:true})}
})
