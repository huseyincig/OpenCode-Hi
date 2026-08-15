import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {assessChangedFileOwnership} from '../dist/runtime/task/diff-ownership.js'
import {opencodeChildPort} from './helpers/host-port.mjs'

function runtime(){return new TaskRuntime(opencodeChildPort({}),new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}))}
function implementation(m){return m.execution.obligations.find(o=>o.kind==='implementation')}
function assessedMission(id,objective,overrides={}){
  const store=new MissionStore(),m=store.start(id,objective)
  store.applyInitialSemanticAssessment(id,{material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:['src/a.ts'],intent_signals:[],suppressed_intent_signals:[],...overrides})
  return m
}

function result(extra={}){return {status:'DONE',summary:'done',changed_files:['src/a.ts'],scope_expansions:[],evidence:[],open_issues:[],needs_context:[],...extra}}

test('undeclared out-of-scope change converts DONE to FIX_REQUIRED and blocks completion',()=>{
  const m=assessedMission('diff-1','change src/a.ts')
  const impl=implementation(m);assert.ok(impl)
  const t=createTask(m,{objective:'change a',role:'coder',category:'quick',scope:['src/a.ts'],requiredEvidence:[],obligationIds:[impl.id]})
  const w=createWorker(m,t,'host-default');w.status='busy';w.started_at=Date.now()-5
  runtime().applyResult(m,w.id,result({changed_files:['src/a.ts','docs/random.md']}))
  assert.equal(t.result?.status,'FIX_REQUIRED')
  assert.equal(w.status,'ready')
  assert.equal(impl.status,'open')
  assert.deepEqual(t.diff_cleanliness?.collateral,['docs/random.md'])
  assert.ok(m.execution.blockers.some(x=>x.startsWith(`diff-cleanliness:${t.id}:`)))
  assert.ok(m.execution.ledger.some(e=>e.type==='diff.cleanliness.blocked'))
})

test('worker necessary=true proposal cannot self-authorize an unrelated scope expansion',()=>{
  const m=assessedMission('diff-2','change src/a.ts')
  const impl=implementation(m);assert.ok(impl)
  const t=createTask(m,{objective:'change a',role:'coder',category:'quick',scope:['src/a.ts'],requiredEvidence:[],obligationIds:[impl.id]})
  const w=createWorker(m,t,'host-default');w.status='busy';w.started_at=Date.now()-5
  runtime().applyResult(m,w.id,result({changed_files:['src/a.ts','src/helper.ts'],scope_expansions:[{file:'src/helper.ts',necessary:true,reason:'shared helper must change to preserve the corrected contract'}]}))
  assert.equal(t.result?.status,'FIX_REQUIRED')
  assert.equal(impl.status,'open')
  assert.ok(!t.scope.includes('src/helper.ts'))
  assert.deepEqual(t.diff_cleanliness?.collateral,['src/helper.ts'])
})

test('deterministically related test file is accepted as bounded worker scope',()=>{
  const m=assessedMission('diff-2b','change src/a.ts')
  const impl=implementation(m);assert.ok(impl)
  const t=createTask(m,{objective:'change a',role:'coder',category:'quick',scope:['src/a.ts'],requiredEvidence:[],obligationIds:[impl.id]})
  const w=createWorker(m,t,'host-default');w.status='busy';w.started_at=Date.now()-5
  runtime().applyResult(m,w.id,result({changed_files:['src/a.ts','src/a.test.ts']}))
  assert.equal(t.result?.status,'DONE')
  assert.ok(t.scope.includes('src/a.test.ts'))
})

test('control-plane authority can accept a structured necessary scope expansion',()=>{
  const claim={file:'src/helper.ts',necessary:true,reason:'bounded parent-authorized dependency'}
  const worker=assessChangedFileOwnership(['src/a.ts'],['src/a.ts','src/helper.ts'],[claim],'worker-proposal')
  const parent=assessChangedFileOwnership(['src/a.ts'],['src/a.ts','src/helper.ts'],[claim],'control-plane')
  assert.deepEqual(worker.collateral,['src/helper.ts'])
  assert.deepEqual(parent.accepted,['src/helper.ts'])
})

test('read-only specialist cannot self-justify writes as scope expansion',()=>{
  const m=assessedMission('diff-3','review src/a.ts',{task_kind:'review',required_capabilities:['review']})
  const t=createTask(m,{objective:'review a',role:'qa-reviewer',category:'standard',scope:['src/a.ts'],requiredEvidence:[]})
  const w=createWorker(m,t,'host-default');w.status='busy';w.started_at=Date.now()-5
  runtime().applyResult(m,w.id,result({changed_files:['src/a.ts'],scope_expansions:[{file:'src/a.ts',necessary:true,reason:'reviewer wanted to fix it directly'}]}))
  assert.equal(t.result?.status,'FIX_REQUIRED')
  assert.deepEqual(t.diff_cleanliness?.collateral,['src/a.ts'])
})

test('worker cleanup claim alone cannot remove collateral without native diff verification',()=>{
  const m=assessedMission('diff-4','change src/a.ts')
  const impl=implementation(m);assert.ok(impl)
  const t=createTask(m,{objective:'change a',role:'coder',category:'quick',scope:['src/a.ts'],requiredEvidence:[],obligationIds:[impl.id]})
  const w=createWorker(m,t,'host-default');w.status='busy';w.started_at=Date.now()-5
  const rt=runtime()
  rt.applyResult(m,w.id,result({changed_files:['src/a.ts','docs/random.md']}))
  assert.ok(m.vcs.changed_files.includes('docs/random.md'))
  w.status='busy';w.started_at=Date.now()-2
  rt.applyResult(m,w.id,result({summary:'cleaned collateral and kept scoped fix',changed_files:['src/a.ts']}))
  assert.equal(t.result?.status,'FIX_REQUIRED')
  assert.equal(impl.status,'open')
  assert.ok(m.vcs.changed_files.includes('docs/random.md'))
  assert.ok(t.result?.open_issues.some(x=>x.startsWith(`cleanup-unverified:${t.id}:`)))
  assert.equal(m.execution.ledger.some(e=>e.type==='diff.cleanliness.resolved'),false)
})
