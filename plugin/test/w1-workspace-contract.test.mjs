import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {isIsolationDecisionContract,isWorkspaceLeaseContract} from '../dist/contracts/workspace.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {RuntimePersistence,RUNTIME_STATE_SCHEMA} from '../dist/runtime/state/persistence.js'
import {createTask} from '../dist/runtime/worker/worker-runtime.js'
import {validateMissionEnvelope} from '../dist/runtime/mission/validators.js'

const baseline='a'.repeat(40)
const decision={required:true,reason:'Task has a material write-conflict/isolation requirement.',strategy:'git-worktree',scope:['src/a.ts'],requested_by:'task:t_workspace'}
const lease={lease_id:'lease_test_1',mission_id:'m_test',task_id:'t_test',repository_root:'/repo',base_ref:'HEAD',workspace_path:'/tmp/repo-hi-worktree',host_workspace_id:'ws_123',branch:'hi/test',created_at:1,status:'ACTIVE',cleanup_state:'ACTIVE',source_baseline:baseline}

test('W1 IsolationDecision is strict and cannot claim required isolation with strategy none',()=>{
  assert.equal(isIsolationDecisionContract(decision),true)
  assert.equal(isIsolationDecisionContract({...decision,required:false,strategy:'none'}),true)
  assert.equal(isIsolationDecisionContract({...decision,strategy:'none'}),false)
  assert.equal(isIsolationDecisionContract({...decision,required:false}),false)
  assert.equal(isIsolationDecisionContract({...decision,foreign:true}),false)
  assert.equal(isIsolationDecisionContract({...decision,scope:['src/a.ts','src/a.ts']}),false)
})

test('W1 WorkspaceLease separates lifecycle from cleanup and binds an exact source baseline',()=>{
  assert.equal(isWorkspaceLeaseContract(lease),true)
  assert.equal(isWorkspaceLeaseContract({...lease,status:'CLOSED',cleanup_state:'CLEANED'}),true)
  assert.equal(isWorkspaceLeaseContract({...lease,status:'ORPHANED',cleanup_state:'QUARANTINED'}),true)
  assert.equal(isWorkspaceLeaseContract({...lease,status:'ACTIVE',cleanup_state:'CLEANUP_PENDING'}),false)
  assert.equal(isWorkspaceLeaseContract({...lease,status:'CLOSED',cleanup_state:'ACTIVE'}),false)
  assert.equal(isWorkspaceLeaseContract({...lease,source_baseline:'HEAD'}),false)
  assert.equal(isWorkspaceLeaseContract({...lease,stdout:'no'}),false)
})

test('W1 Mission execution is the single durable owner and schema 10 round-trips decisions/leases current-only',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-w1-'))
  try{
    const store=new MissionStore(root),m=store.start('w1','bounded workspace contract test')
    // Keep provisional mission free of executable state until the host semantic assessment has occurred.
    m.identity.semantic_assessment.status='assessed';m.identity.intent.taskKind='implementation'
    const task=createTask(m,{objective:'isolated task',role:'coder',category:'quick',scope:['src/a.ts'],dependencies:[],requiredEvidence:[]})
    const d={...decision,requested_by:`task:${task.id}`}
    const l={...lease,mission_id:m.identity.mission_id,task_id:task.id}
    m.execution.isolation_decisions.push(d);m.execution.workspace_leases.push(l)
    assert.equal(validateMissionEnvelope(m),true)
    const persistence=new RuntimePersistence(root);persistence.save([m])
    const raw=JSON.parse(readFileSync(persistence.path,'utf8'))
    assert.equal(RUNTIME_STATE_SCHEMA,10);assert.equal(raw.schema,10)
    assert.deepEqual(raw.missions[0].execution.isolation_decisions,[d])
    assert.deepEqual(raw.missions[0].execution.workspace_leases,[l])
    assert.equal(new RuntimePersistence(root).load().length,1)
    raw.schema=9;writeFileSync(persistence.path,JSON.stringify(raw));const stale=new RuntimePersistence(root);assert.equal(stale.load().length,0);assert.match(stale.lastLoadReport.error??'',/unsupported runtime-state schema 9/)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('W1 lease validator rejects cross-mission unknown-task and duplicate lease ownership',()=>{
  const store=new MissionStore(),m=store.start('w1-invalid','bounded workspace validator test')
  m.identity.semantic_assessment.status='assessed';m.identity.intent.taskKind='implementation'
  const task=createTask(m,{objective:'isolated task',role:'coder',category:'quick',scope:[],dependencies:[],requiredEvidence:[]})
  const valid={...lease,mission_id:m.identity.mission_id,task_id:task.id}
  m.execution.workspace_leases=[valid];assert.equal(validateMissionEnvelope(m),true)
  m.execution.workspace_leases=[{...valid,mission_id:'m_other'}];assert.equal(validateMissionEnvelope(m),false)
  m.execution.workspace_leases=[{...valid,task_id:'t_missing'}];assert.equal(validateMissionEnvelope(m),false)
  m.execution.workspace_leases=[valid,{...valid}];assert.equal(validateMissionEnvelope(m),false)
})
