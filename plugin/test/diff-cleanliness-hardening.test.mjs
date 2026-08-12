import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {ConcurrencyScheduler} from '../dist/runtime/scheduler/concurrency.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {DEFAULT_HHC_CONFIG} from '../dist/config/defaults.js'

function runtime(){return new TaskRuntime({},new BackgroundRegistry(),new ConcurrencyScheduler(()=>({global:2,providers:{},models:{}})),process.cwd(),process.cwd(),()=>DEFAULT_HHC_CONFIG,()=>[],()=>({}))}
function implementation(m){return m.obligations.find(o=>o.kind==='implementation')}

function result(extra={}){return {status:'DONE',summary:'done',changed_files:['src/a.ts'],scope_expansions:[],evidence:[],open_issues:[],needs_context:[],...extra}}

test('undeclared out-of-scope change converts DONE to FIX_REQUIRED and blocks completion',()=>{
  const s=new MissionStore(),m=s.start('diff-1','change src/a.ts')
  const impl=implementation(m);assert.ok(impl)
  const t=createTask(m,{objective:'change a',role:'coder',category:'quick',scope:['src/a.ts'],requiredEvidence:[],obligationIds:[impl.id]})
  const w=createWorker(m,t,'host-default');w.status='busy';w.started_at=Date.now()-5
  runtime().applyResult(m,w.id,result({changed_files:['src/a.ts','docs/random.md']}))
  assert.equal(t.result?.status,'FIX_REQUIRED')
  assert.equal(w.status,'ready')
  assert.equal(impl.status,'open')
  assert.deepEqual(t.diff_cleanliness?.collateral,['docs/random.md'])
  assert.ok(m.blockers.some(x=>x.startsWith(`diff-cleanliness:${t.id}:`)))
  assert.ok(m.ledger.some(e=>e.type==='diff.cleanliness.blocked'))
})

test('explicit necessary bounded scope expansion is accepted and becomes owned task scope',()=>{
  const s=new MissionStore(),m=s.start('diff-2','change src/a.ts')
  const impl=implementation(m);assert.ok(impl)
  const t=createTask(m,{objective:'change a',role:'coder',category:'quick',scope:['src/a.ts'],requiredEvidence:[],obligationIds:[impl.id]})
  const w=createWorker(m,t,'host-default');w.status='busy';w.started_at=Date.now()-5
  runtime().applyResult(m,w.id,result({changed_files:['src/a.ts','src/helper.ts'],scope_expansions:[{file:'src/helper.ts',necessary:true,reason:'shared helper must change to preserve the corrected contract'}]}))
  assert.equal(t.result?.status,'DONE')
  assert.equal(impl.status,'closed')
  assert.ok(t.scope.includes('src/helper.ts'))
  assert.deepEqual(t.diff_cleanliness?.collateral,[])
  assert.ok(t.diff_cleanliness?.accepted_expansions.includes('src/helper.ts'))
  assert.ok(m.ledger.some(e=>e.type==='task.scope-expanded'))
})

test('read-only specialist cannot self-justify writes as scope expansion',()=>{
  const s=new MissionStore(),m=s.start('diff-3','review src/a.ts')
  const t=createTask(m,{objective:'review a',role:'qa-reviewer',category:'standard',scope:['src/a.ts'],requiredEvidence:[]})
  const w=createWorker(m,t,'host-default');w.status='busy';w.started_at=Date.now()-5
  runtime().applyResult(m,w.id,result({changed_files:['src/a.ts'],scope_expansions:[{file:'src/a.ts',necessary:true,reason:'reviewer wanted to fix it directly'}]}))
  assert.equal(t.result?.status,'FIX_REQUIRED')
  assert.deepEqual(t.diff_cleanliness?.collateral,['src/a.ts'])
})

test('worker cleanup claim alone cannot remove collateral without native diff verification',()=>{
  const s=new MissionStore(),m=s.start('diff-4','change src/a.ts')
  const impl=implementation(m);assert.ok(impl)
  const t=createTask(m,{objective:'change a',role:'coder',category:'quick',scope:['src/a.ts'],requiredEvidence:[],obligationIds:[impl.id]})
  const w=createWorker(m,t,'host-default');w.status='busy';w.started_at=Date.now()-5
  const rt=runtime()
  rt.applyResult(m,w.id,result({changed_files:['src/a.ts','docs/random.md']}))
  assert.ok(m.changed_files.includes('docs/random.md'))
  w.status='busy';w.started_at=Date.now()-2
  rt.applyResult(m,w.id,result({summary:'cleaned collateral and kept scoped fix',changed_files:['src/a.ts']}))
  assert.equal(t.result?.status,'FIX_REQUIRED')
  assert.equal(impl.status,'open')
  assert.ok(m.changed_files.includes('docs/random.md'))
  assert.ok(t.result?.open_issues.some(x=>x.startsWith(`cleanup-unverified:${t.id}:`)))
  assert.equal(m.ledger.some(e=>e.type==='diff.cleanliness.resolved'),false)
})
