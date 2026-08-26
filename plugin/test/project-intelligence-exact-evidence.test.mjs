import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {ProjectMethodologyLearningStore} from '../dist/runtime/project-intelligence/methodology-learning.js'
import {addEvidence} from '../dist/runtime/evidence/evidence-runtime.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {opencodeChildPort} from './helpers/host-port.mjs'

function fixture(root){
  const store=new MissionStore(root),m=store.start('m20-exact-evidence','Learn one reusable project procedure')
  const task={id:'t_m20',mission_id:m.identity.mission_id,objective:'bounded project task',status:'running',role:'coder',category:'standard',scope:['src/a.ts'],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],external_action_requirements:[],worker_id:'w_m20',created_at:Date.now(),updated_at:Date.now()}
  const worker={id:'w_m20',task_id:task.id,role:'coder',category:'standard',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'m20',status:'completed',attempt:1,generation_at_spawn:m.continuation.generation,updated_at:Date.now(),completed_at:Date.now()}
  m.execution.tasks.push(task);m.execution.workers.push(worker)
  const evidence=addEvidence(m,{kind:'targeted-tests',summary:'exact current-attempt host verification',scope:['src/a.ts'],source:'bash:child',trusted_source_class:'host-tool-observation',task_id:task.id,producer_attempt:{worker_id:worker.id,execution_unit_id:`eu:${task.id}`,attempt_id:`eu:${task.id}:g1:a1`,run_id:`worker:${worker.id}:g1:a1`,ordinal:1,generation:m.continuation.generation},pass:true,outcome:'passed'})
  return{m,worker,evidence}
}

const observation={key:'exact-project-check',procedure:'Run the exact project-native check after changing this surface.',trigger:'The bounded project surface changes.',do_not_trigger:'The bounded project surface is unchanged.',exit_condition:'The exact project-native check passes.',evidence:['targeted-tests']}

test('persists canonical Evidence receipt IDs instead of only evidence-kind labels',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-m20-exact-evidence-'))
  try{
    const {m,worker,evidence}=fixture(root),learning=new ProjectMethodologyLearningStore(root)
    const candidate=learning.observe(m,worker,observation,[{id:evidence.id,kind:evidence.kind}])
    assert.ok(candidate,'current-attempt canonical evidence receipt should admit the observation')
    assert.deepEqual(candidate.observations[0].evidence,[evidence.id])
    assert.notDeepEqual(candidate.observations[0].evidence,[evidence.kind])
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('rejects a methodology observation when no claimed kind has a canonical receipt',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-m20-exact-evidence-reject-'))
  try{
    const {m,worker,evidence}=fixture(root),learning=new ProjectMethodologyLearningStore(root)
    const candidate=learning.observe(m,worker,{...observation,evidence:['typecheck']},[{id:evidence.id,kind:evidence.kind}])
    assert.equal(candidate,undefined)
    assert.ok(m.execution.ledger.some(event=>event.type==='project-methodology.observation-rejected'))
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('TaskResultReconciler forwards only same-attempt canonical Evidence receipts into project learning',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-m20-reconciler-evidence-'))
  try{
    const {m,worker,evidence}=fixture(root);worker.status='busy';worker.completed_at=undefined
    const runtime=new TaskRuntime(opencodeChildPort({}),{delete(){}},{release(){}},root,root,()=>({}),()=>[],()=>({}))
    runtime.applyResult(m,worker.id,{status:'DONE',summary:'bounded work completed',changed_files:[],evidence:[],open_issues:[],needs_context:[],methodology_observations:[observation]})
    const candidate=new ProjectMethodologyLearningStore(root).all()[0]
    assert.ok(candidate)
    assert.deepEqual(candidate.observations[0].evidence,[evidence.id])
  }finally{rmSync(root,{recursive:true,force:true})}
})
