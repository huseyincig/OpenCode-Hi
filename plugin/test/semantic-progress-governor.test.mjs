import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {RuntimePersistence} from '../dist/runtime/state/persistence.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {addEvidence,markMutation} from '../dist/runtime/evidence/evidence-runtime.js'
import {projectMissionToWorkGraph} from '../dist/runtime/execution/work-graph-projection.js'
import {semanticProgressDelta,semanticProgressMade,semanticProgressSnapshot} from '../dist/runtime/progress/semantic-progress.js'
import {startAssessedMission} from './helpers/semantic.mjs'

function mission(id='semantic-progress'){
  const store=new MissionStore(process.cwd()),m=startAssessedMission(store,id,'fix src/a.ts',{task_kind:'bug-fix',likely_verification:['targeted-tests'],likely_targets:['src/a.ts']})
  store.updateProgress(m,false)
  return{store,m}
}

test('semantic delta distinguishes state churn from material progress',()=>{
  const {m}=mission('sp-churn'),before=semanticProgressSnapshot(m)
  const task=createTask(m,{objective:'inspect',role:'coder',category:'standard',scope:['src/a.ts']})
  const worker=createWorker(m,task,'host-default');worker.status='busy';task.status='running'
  const churn=semanticProgressDelta(before,semanticProgressSnapshot(m))
  assert.equal(churn.stateChanged,true)
  assert.equal(semanticProgressMade(churn),false,'dispatch/status churn alone is activity, not semantic gain')
  assert.ok(churn.signals.includes('state-changed-without-semantic-gain'))
})

test('new evidence dependency completion and changed surface are material semantic progress',()=>{
  const {m}=mission('sp-gain')
  const dependency=createTask(m,{objective:'dependency',role:'coder',category:'standard'}),dependent=createTask(m,{objective:'dependent',role:'coder',category:'standard',dependencies:[dependency.id]})
  void dependent
  let before=semanticProgressSnapshot(m)
  addEvidence(m,{kind:'targeted-tests',summary:'new diagnostic proof',scope:['src/a.ts'],source:'bash',obligation_ids:m.execution.obligations.filter(o=>o.kind==='verification').map(o=>o.id),pass:true,outcome:'passed'})
  let delta=semanticProgressDelta(before,semanticProgressSnapshot(m));assert.equal(delta.evidenceAdded,1);assert.equal(semanticProgressMade(delta),true)
  before=semanticProgressSnapshot(m);dependency.status='completed';delta=semanticProgressDelta(before,semanticProgressSnapshot(m));assert.equal(delta.dependencyCompletions,1);assert.equal(delta.executionAdvanced,true);assert.equal(semanticProgressMade(delta),true)
  before=semanticProgressSnapshot(m);markMutation(m,['src/new.ts'],'test');delta=semanticProgressDelta(before,semanticProgressSnapshot(m));assert.equal(delta.changedFiles,1);assert.equal(semanticProgressMade(delta),true)
})

test('repeated identical failure does not buy infinite progress but a new failure signature is new information once',()=>{
  const {store,m}=mission('sp-failure')
  m.execution.blockers.push('same-failure')
  assert.equal(store.updateProgress(m,true),true)
  assert.equal(m.continuation.last_progress_delta.failureSignatureChanged,true)
  assert.equal(m.continuation.stagnation_count,0)
  assert.equal(store.updateProgress(m,true),false)
  assert.equal(m.continuation.stagnation_count,1)
  m.execution.blockers.push('different-failure')
  assert.equal(store.updateProgress(m,true),true)
  assert.equal(m.continuation.stagnation_count,0)
})

test('evidence invalidation without replacement is not positive progress',()=>{
  const {store,m}=mission('sp-invalidation')
  addEvidence(m,{kind:'targeted-tests',summary:'proof',scope:['src/a.ts'],source:'bash',obligation_ids:m.execution.obligations.filter(o=>o.kind==='verification').map(o=>o.id),pass:true,outcome:'passed'})
  store.updateProgress(m,false)
  const item=m.execution.evidence.items.at(-1);item.invalidated_at=Date.now()
  assert.equal(store.updateProgress(m,true),false)
  assert.equal(m.continuation.last_progress_delta.evidenceInvalidated,1)
  assert.equal(m.continuation.stagnation_count,1)
})

test('WorkGraph exposes the last structured progress delta without aliasing mission state',()=>{
  const {store,m}=mission('sp-projection')
  m.execution.blockers.push('new-diagnostic')
  assert.equal(store.updateProgress(m,true),true)
  const graph=projectMissionToWorkGraph(m,123)
  assert.equal(graph.progress.delta.failureSignatureChanged,true)
  graph.progress.delta.signals.push('tamper')
  assert.equal(m.continuation.last_progress_delta.signals.includes('tamper'),false)
})

test('semantic progress snapshot/delta round-trip and malformed durable state fails closed',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-semantic-progress-'))
  try{
    const store=new MissionStore(root),m=startAssessedMission(store,'sp-persist','fix',{task_kind:'bug-fix',likely_verification:[]})
    store.updateProgress(m,false);m.execution.blockers.push('diagnostic');store.updateProgress(m,true)
    const persistence=new RuntimePersistence(root);persistence.save(store.all(),true)
    const loaded=persistence.load();assert.equal(loaded.length,1);assert.equal(loaded[0].continuation.semantic_progress_snapshot.version,1);assert.equal(loaded[0].continuation.last_progress_delta.failureSignatureChanged,true)
    const raw=JSON.parse(readFileSync(persistence.path,'utf8'));raw.missions[0].continuation.semantic_progress_snapshot.state_hash='forged';writeFileSync(persistence.path,JSON.stringify(raw));assert.equal(persistence.load().length,0);assert.match(String(persistence.lastLoadReport.error),/invalid mission state/i)
  }finally{rmSync(root,{recursive:true,force:true})}
})
