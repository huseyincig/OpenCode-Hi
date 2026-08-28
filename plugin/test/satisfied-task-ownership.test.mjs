import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {projectMissionToWorkGraph} from '../dist/runtime/execution/work-graph-projection.js'
import {planScheduling} from '../dist/runtime/scheduler/planner.js'
import {evaluateCompletion} from '../dist/runtime/completion/evaluator.js'
import {evaluateIdle} from '../dist/runtime/continuation/evaluator.js'
import {projectDirectDependencyOutcomes} from '../dist/runtime/execution/dependency-outcome-projection.js'
import {reconcileSatisfiedTaskArtifacts,taskHasSatisfiedSettledOwnership,taskResultRequiresReconciliation} from '../dist/runtime/task/task-ownership.js'
import {startAssessedMission} from './helpers/semantic.mjs'

const ISSUE='methodology-exit-unsatisfied:t-coder:diagnostic-evidence'
function fixture(id='satisfied-task'){
  const m=startAssessedMission(new MissionStore(),id,'fix dashboard and verify visually',{task_kind:'bug-fix',scope:'multi-file',required_capabilities:['implementation','visual-qa'],likely_verification:['visual-check'],likely_targets:['index.html']})
  m.execution.execution_mode='parallel';m.execution.topology={mode:'multi-agent',parallelism:2,reason:['test']}
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation'),verification=m.execution.obligations.find(o=>o.kind==='verification')
  assert.ok(implementation);assert.ok(verification)
  const coder=createTask(m,{objective:'fix dashboard',role:'coder',category:'standard',scope:['index.html'],obligationIds:[implementation.id]}),worker=createWorker(m,coder,'p/code',['p/fallback'],['hi-debugging-root-cause'])
  coder.status='waiting';coder.created_at=10;coder.updated_at=10;coder.result={status:'FIX_REQUIRED',summary:'methodology exit missing',changed_files:['index.html'],evidence:[],open_issues:[ISSUE],needs_context:['diagnostic-evidence']};worker.status='ready';worker.attempt=1;worker.completed_at=Date.now()
  m.execution.blockers=[ISSUE];m.methodology.methodology_needs.push({name:'hi-debugging-root-cause',signal:'intent.debugging',trigger_source:'failure-signal',producer:'intent',reason:'test',created_at:Date.now(),task_id:coder.id,obligation_id:implementation.id})
  return{m,implementation,verification,coder,worker}
}
function plan(m){
  const graph=projectMissionToWorkGraph(m,1),unitTraits={}
  for(const u of graph.executionUnits)unitTraits[u.id]={readOnly:u.role==='visual-qa'||u.role==='repository-explorer'||u.role==='architect'||u.role==='qa-reviewer'}
  return planScheduling({graph,unitTraits,resolvedResources:{},capacity:{topology:2,global:4,providers:{},models:{},running:[]}})
}
function decision(p,task){return p.units.find(x=>x.executionUnitId===`eu:${task.id}`)}

test('closed owned obligation retires settled FIX_REQUIRED control authority without rewriting attempt history',()=>{
  const {m,implementation,coder}=fixture('satisfied-retire')
  assert.equal(taskResultRequiresReconciliation(m,coder),true)
  assert.equal(taskHasSatisfiedSettledOwnership(m,coder),false)
  implementation.status='closed';implementation.closedAt=Date.now()
  const reconciled=reconcileSatisfiedTaskArtifacts(m,'test-canonical-reconciliation')
  assert.deepEqual(reconciled,[coder.id])
  assert.equal(taskHasSatisfiedSettledOwnership(m,coder),true)
  assert.equal(taskResultRequiresReconciliation(m,coder),false)
  assert.equal(coder.status,'waiting','durable attempt lifecycle remains historical')
  assert.equal(coder.result.status,'FIX_REQUIRED','raw WorkerResult must never be rewritten to fake DONE')
  assert.deepEqual(coder.result.open_issues,[ISSUE])
  assert.equal(m.execution.blockers.includes(ISSUE),false)
  assert.equal(m.methodology.methodology_needs.some(n=>n.task_id===coder.id),false)
  assert.equal(projectMissionToWorkGraph(m,1).nodes.find(n=>n.id===coder.id).status,'completed','control projection is terminal only because canonical ownership is satisfied')
  const completion=evaluateCompletion(m)
  assert.equal(completion.reasons.includes('pending-task'),false)
  assert.equal(completion.reasons.includes('worker-result-unreconciled'),false)
  assert.notEqual(evaluateIdle(m).reason_code,'worker-result-unreconciled')
})

test('rerun18-shaped read-only verification successor is no longer conflict-blocked by satisfied waiting coder',()=>{
  const {m,implementation,verification,coder}=fixture('satisfied-scheduler')
  const visual=createTask(m,{objective:'verify dashboard',role:'visual-qa',category:'visual',scope:['index.html'],obligationIds:[verification.id]})
  visual.created_at=20;visual.updated_at=20;visual.status='queued'
  let p=plan(m);assert.equal(decision(p,visual).disposition,'DEFERRED_CONFLICT');assert.ok(decision(p,visual).blockingUnitIds.includes(`eu:${coder.id}`))
  implementation.status='closed';implementation.closedAt=Date.now();reconcileSatisfiedTaskArtifacts(m,'test-parent-direct')
  p=plan(m);assert.equal(decision(p,coder).disposition,'TERMINAL');assert.equal(decision(p,visual).disposition,'RUNNABLE')
})

test('open obligation and active host execution remain fail-closed conflict authority',()=>{
  const {m,implementation,verification,coder,worker}=fixture('satisfied-counterexample')
  const visual=createTask(m,{objective:'verify dashboard',role:'visual-qa',category:'visual',scope:['index.html'],obligationIds:[verification.id]});visual.status='queued'
  assert.equal(taskHasSatisfiedSettledOwnership(m,coder),false);assert.equal(decision(plan(m),visual).disposition,'DEFERRED_CONFLICT')
  implementation.status='closed';implementation.closedAt=Date.now();worker.status='busy';coder.status='running'
  assert.equal(taskHasSatisfiedSettledOwnership(m,coder),false,'closed obligation cannot suppress a live host attempt')
  assert.equal(decision(plan(m),visual).disposition,'DEFERRED_CONFLICT')
  assert.equal(m.execution.blockers.includes(ISSUE),true)
})

test('satisfied ownership projection does not fabricate strict dependency DONE outcome',()=>{
  const {m,implementation,coder}=fixture('satisfied-dependency')
  implementation.status='closed';implementation.closedAt=Date.now();reconcileSatisfiedTaskArtifacts(m,'test-parent-direct')
  const dependent=createTask(m,{objective:'consume exact coder outcome',role:'qa-reviewer',category:'standard',scope:['index.html'],dependencies:[coder.id]})
  assert.throws(()=>projectDirectDependencyOutcomes(m,dependent),/not a completed DONE result/)
  assert.equal(coder.status,'waiting');assert.equal(coder.result.status,'FIX_REQUIRED')
})
