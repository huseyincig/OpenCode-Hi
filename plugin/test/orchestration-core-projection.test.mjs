import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { createTask,createWorker,beginWorkerAttempt } from '../dist/runtime/worker/worker-runtime.js'
import { addEvidence,markMutation } from '../dist/runtime/evidence/evidence-runtime.js'
import { projectMissionToWorkGraph } from '../dist/runtime/execution/work-graph-projection.js'
import { validateWorkGraph,isCapabilityResolution } from '../dist/contracts/orchestration-core.js'
import { startAssessedMission } from './helpers/semantic.mjs'

function mission(id='core-projection'){
  const store=new MissionStore(process.cwd())
  const m=startAssessedMission(store,id,'change auth and verify',{task_kind:'implementation',scope:'multi-stream',risk:'high',required_capabilities:['implementation','verification'],likely_verification:['targeted-tests']})
  m.execution.execution_mode='parallel'
  m.execution.topology={mode:'multi-agent',parallelism:2,reason:['independent work streams']}
  return m
}

test('host-neutral WorkGraph projection preserves DAG, execution allocation and same-model multi-unit semantics',()=>{
  const m=mission('projection-dag')
  const a=createTask(m,{objective:'change auth core',role:'coder',category:'deep',scope:['src/auth'],requiredEvidence:['targeted-tests']})
  const b=createTask(m,{objective:'change auth UI',role:'coder',category:'standard',scope:['src/ui'],dependencies:[a.id],requiredEvidence:['targeted-tests']})
  const wa=createWorker(m,a,'provider/same',['provider/fallback']);const wb=createWorker(m,b,'provider/same',['provider/fallback'])
  wa.requested_model='provider/same';wa.projected_model='provider/same';wa.effective_model='provider/same';wa.effective_model_verified=true;wa.model_selection_reason=['bounded cost']
  wb.requested_model='provider/same';wb.projected_model='provider/same';wb.effective_model='provider/same';wb.effective_model_verified=true;wb.model_selection_reason=['bounded cost']
  beginWorkerAttempt(a,wa,100);beginWorkerAttempt(b,wb,110)
  const graph=projectMissionToWorkGraph(m,200)
  assert.equal(graph.nodes.length,2);assert.equal(graph.executionUnits.length,2)
  assert.deepEqual(graph.edges,[{from:a.id,to:b.id,kind:'requires'}])
  assert.equal(graph.executionUnits[0].resourceSelection.selectedModel,'provider/same')
  assert.equal(graph.executionUnits[1].resourceSelection.selectedModel,'provider/same')
  assert.notEqual(graph.executionUnits[0].id,graph.executionUnits[1].id)
  assert.equal(graph.executionUnits[0].attempt.ordinal,1)
  assert.equal(graph.executionUnits[1].attempt.ordinal,1)
  assert.deepEqual(validateWorkGraph(graph),{ok:true,reasons:[]})
})

test('projection preserves evidence freshness, authority and lifecycle control-plane state without aliasing source state',()=>{
  const m=mission('projection-control-plane')
  const task=createTask(m,{objective:'verify auth',role:'qa-reviewer',category:'critical',scope:['src/auth'],requiredEvidence:['targeted-tests']})
  const worker=createWorker(m,task,'provider/reviewer');worker.status='busy';worker.runtime_recovery_attempt=2;worker.last_runtime_failure_kind='provider-transport';worker.write_set=['src/auth/token.ts']
  const hash='a'.repeat(64);m.authority.pending_permissions=1;m.authority.pending_permission_ids=['perm-1'];m.authority.authority={approved:{hash,approved_at:50}}
  markMutation(m,['src/auth/token.ts'],'test');const mutationAt=m.execution.evidence.last_mutation_at;addEvidence(m,{kind:'targeted-tests',summary:'auth test',scope:['src/auth/token.ts'],source:'bash',task_id:task.id,obligation_ids:['o-verification'],pass:true,outcome:'passed',observed_at:mutationAt+1})
  m.continuation.iteration=3;m.continuation.stagnation_count=2;m.continuation.last_progress_signature='sig';m.continuation.continuation_budget=4;m.continuation.continuation_active=true
  const graph=projectMissionToWorkGraph(m,150)
  assert.equal(graph.evidence.fresh,true);assert.equal(graph.evidence.items[0].task_id,task.id);assert.deepEqual(graph.evidence.items[0].obligation_ids,['o-verification'])
  assert.equal(graph.authority.pendingPermissions,1);assert.equal(graph.authority.state.approved.hash,hash)
  assert.equal(graph.progress.iteration,3);assert.equal(graph.progress.stagnationCount,2);assert.equal(graph.executionUnits[0].attempt.recoveryAttempt,2);assert.deepEqual(graph.executionUnits[0].writeSet,['src/auth/token.ts'])
  graph.evidence.items[0].summary='mutated projection';graph.authority.pendingPermissionIds.push('x');graph.executionUnits[0].scope.push('elsewhere')
  assert.equal(m.execution.evidence.items[0].summary,'auth test');assert.deepEqual(m.authority.pending_permission_ids,['perm-1']);assert.deepEqual(task.scope,['src/auth'])
})

test('unassigned work remains a work/execution unit without forcing provider, model or agent allocation',()=>{
  const m=mission('projection-unassigned')
  const task=createTask(m,{objective:'decide later',role:'coder',category:'standard',scope:['src/later.ts']})
  const graph=projectMissionToWorkGraph(m,10),unit=graph.executionUnits[0]
  assert.equal(unit.workNodeId,task.id)
  assert.equal(unit.role,'coder');assert.equal(unit.category,'standard')
  assert.equal(unit.resourceSelection,undefined)
  assert.equal(unit.attempt,undefined)
})

test('orchestration core source has no OpenCode host/client/session imports',async()=>{
  const {readFile}=await import('node:fs/promises')
  const source=await readFile(new URL('../src/contracts/orchestration-core.ts',import.meta.url),'utf8')
  assert.doesNotMatch(source,/from ['"].*(?:opencode|runtime\/host|child-session|client-adapter)/i)
  assert.doesNotMatch(source,/OpenCodeClient|ChildSessionPort|HostPort/)
})


test('WorkGraph validator fails closed on dependency/edge/unit parity corruption',()=>{
  const m=mission('projection-invalid')
  const a=createTask(m,{objective:'a',role:'coder',category:'standard'}),b=createTask(m,{objective:'b',role:'coder',category:'standard',dependencies:[a.id]})
  createWorker(m,a,'provider/a');createWorker(m,b,'provider/b')
  const graph=projectMissionToWorkGraph(m,10)
  const missingEdge=structuredClone(graph);missingEdge.edges=[]
  assert.equal(validateWorkGraph(missingEdge).ok,false);assert.match(validateWorkGraph(missingEdge).reasons.join('|'),/missing-edge/)
  const duplicateUnit=structuredClone(graph);duplicateUnit.executionUnits.push(structuredClone(duplicateUnit.executionUnits[0]))
  assert.equal(validateWorkGraph(duplicateUnit).ok,false);assert.match(validateWorkGraph(duplicateUnit).reasons.join('|'),/duplicate-execution-unit|execution-unit-cardinality/)
  const unknown=structuredClone(graph);unknown.nodes[1].dependencies=['missing']
  assert.equal(validateWorkGraph(unknown).ok,false);assert.match(validateWorkGraph(unknown).reasons.join('|'),/unknown-node-dependency/)
})

test('CapabilityResolution is host-neutral and fail-closed for unavailable semantics',()=>{
  assert.equal(isCapabilityResolution({capability:'child-execution',implementation:'NATIVE',available:true,semanticLoss:[],reason:['host satisfies contract']}),true)
  assert.equal(isCapabilityResolution({capability:'child-execution',implementation:'UNAVAILABLE',available:true,semanticLoss:['missing'],reason:['bad']}),false)
  assert.equal(isCapabilityResolution({capability:'child-execution',implementation:'MAGIC',available:true,semanticLoss:[],reason:[]}),false)
})
