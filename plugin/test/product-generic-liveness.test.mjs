import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {startAssessedMission} from './helpers/semantic.mjs'

async function api(){return import('../dist/runtime/liveness/assessment.js')}
function mission(id='live'){
  const store=new MissionStore(),m=startAssessedMission(store,id,'opaque liveness mission',{task_kind:'implementation',scope:'local',risk:'low',required_capabilities:['implementation']})
  m.execution.ledger=[]
  m.identity.created_at=1_000
  return m
}
function event(m,type,at,payload={},extra={}){m.execution.ledger.push({id:`e-${m.execution.ledger.length}`,at,mission_id:m.identity.mission_id,type,payload,...extra})}

// Canonical product-generic liveness contract. These tests intentionally target a
// single assessment owner that does not exist on the pre-change baseline.
test('~120s no durable progress + exact inflight NO => STALLED',async()=>{
  const {assessMissionLiveness}=await api(),m=mission('stall-no-inflight');event(m,'semantic.assessed',10_000,{revision:1})
  const x=assessMissionLiveness(m,{now:130_001,hostSessions:{}})
  assert.equal(x.state,'STALLED');assert.equal(x.inflight,'NO');assert.equal(x.last_durable_progress_at,10_000)
})

test('>120s no durable progress + exact native busy => not STALLED',async()=>{
  const {assessMissionLiveness}=await api(),m=mission('busy-not-stall');event(m,'semantic.assessed',10_000,{revision:1})
  m.execution.tasks.push({id:'t',mission_id:m.identity.mission_id,objective:'x',status:'running',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],worker_id:'w',external_action_requirements:[],created_at:10_001,updated_at:10_001})
  m.execution.workers.push({id:'w',task_id:'t',role:'coder',category:'standard',session_id:'child',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,model:'host-default',fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'busy',attempt:1,generation_at_spawn:m.continuation.generation,updated_at:10_001})
  const x=assessMissionLiveness(m,{now:200_000,hostSessions:{child:'busy'}})
  assert.notEqual(x.state,'STALLED');assert.equal(x.inflight,'YES')
})

test('busy/retry observations do not change last durable progress timestamp',async()=>{
  const {assessMissionLiveness}=await api(),m=mission('status-not-progress');event(m,'semantic.assessed',10_000,{revision:1});event(m,'worker.native-status',150_000,{status:'busy'});event(m,'worker.native-status',160_000,{status:'retry'})
  const x=assessMissionLiveness(m,{now:170_000,hostSessions:{}});assert.equal(x.last_durable_progress_at,10_000)
})

test('repeated poll/peek/await timeout observations are not durable progress',async()=>{
  const {assessMissionLiveness}=await api(),m=mission('poll-not-progress');event(m,'semantic.assessed',10_000,{revision:1});event(m,'worker.await-timeout',80_000,{timeout_ms:60_000});event(m,'worker.await-timeout',140_000,{timeout_ms:60_000});event(m,'runtime.decision',150_000,{decision:'WAIT'})
  const x=assessMissionLiveness(m,{now:150_001,hostSessions:{}});assert.equal(x.last_durable_progress_at,10_000);assert.equal(x.state,'STALLED')
})

test('unique current-generation tool start and result are durable progress',async()=>{
  const {recordToolOperationProgress,assessMissionLiveness}=await api(),m=mission('tool-progress');const g=m.continuation.generation
  assert.equal(recordToolOperationProgress(m,{operation_id:'call-1',session_id:m.identity.session_id,tool:'read',generation:g},'started',20_000),true)
  assert.equal(recordToolOperationProgress(m,{operation_id:'call-1',session_id:m.identity.session_id,tool:'read',generation:g},'result',21_000),true)
  const x=assessMissionLiveness(m,{now:22_000,hostSessions:{}});assert.equal(x.last_durable_progress_at,21_000)
})

test('stale-generation tool callback cannot advance durable progress',async()=>{
  const {recordToolOperationProgress,assessMissionLiveness}=await api(),m=mission('stale-tool');event(m,'semantic.assessed',10_000,{revision:1});m.continuation.generation=3
  assert.equal(recordToolOperationProgress(m,{operation_id:'call-old',session_id:'old',tool:'read',generation:2},'result',99_000),false)
  assert.equal(assessMissionLiveness(m,{now:100_000,hostSessions:{}}).last_durable_progress_at,10_000)
})

test('PID alive alone is not VERIFIED_INFLIGHT',async()=>{
  const {assessMissionLiveness}=await api(),m=mission('pid-alone');event(m,'semantic.assessed',10_000,{revision:1})
  m.execution.processes.push({process_id:'p1',mission_id:m.identity.mission_id,task_id:'t',worker_id:'w',host_process_id:'pty-1',host:'opencode-pty',command:'node app.js',command_identity:'a'.repeat(64),cwd:'.',started_at:10_001,status:'RUNNING',cleanup_state:'OPEN',pid:12345})
  const x=assessMissionLiveness(m,{now:150_000,hostSessions:{},processes:{p1:{pid_alive:true,owner_verified:false,status:'unknown'}}})
  assert.notEqual(x.inflight,'YES')
})

test('inflight UNKNOWN requires reconciliation and never opens destructive recovery',async()=>{
  const {assessMissionLiveness}=await api(),m=mission('unknown-inflight');event(m,'semantic.assessed',10_000,{revision:1})
  m.execution.tasks.push({id:'t',mission_id:m.identity.mission_id,objective:'x',status:'running',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],worker_id:'w',external_action_requirements:[],created_at:10_001,updated_at:10_001})
  m.execution.workers.push({id:'w',task_id:'t',role:'coder',category:'standard',session_id:'child',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,model:'host-default',fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'busy',attempt:1,generation_at_spawn:m.continuation.generation,updated_at:10_001})
  const x=assessMissionLiveness(m,{now:200_000,hostSessions:{child:'unknown'}});assert.equal(x.inflight,'UNKNOWN');assert.equal(x.destructive_recovery_allowed,false);assert.equal(x.state,'RECONCILE')
})

test('replacement is admitted only after old exact execution is quiescent or verified-aborted',async()=>{
  const {replacementExecutionAdmission}=await api()
  assert.equal(replacementExecutionAdmission('ACTIVE'),false);assert.equal(replacementExecutionAdmission('UNKNOWN'),false);assert.equal(replacementExecutionAdmission('QUIESCENT'),true);assert.equal(replacementExecutionAdmission('VERIFIED_ABORTED'),true)
})

test('reconnect live child/session remains reconciliation-owned and duplicate dispatch is not liveness-admitted',async()=>{
  const {assessMissionLiveness,replacementExecutionAdmission}=await api(),m=mission('reconnect-live');event(m,'mission.restored',100_000,{generation:1})
  m.execution.tasks.push({id:'t',mission_id:m.identity.mission_id,objective:'x',status:'waiting',role:'coder',category:'standard',scope:[],constraints:[],dependencies:[],requiredEvidence:[],obligation_ids:[],context_artifacts:[],gate_ids:[],worker_id:'w',external_action_requirements:[],created_at:10_001,updated_at:100_000})
  m.execution.workers.push({id:'w',task_id:'t',role:'coder',category:'standard',session_id:'child',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,model:'host-default',fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'ready',attempt:1,generation_at_spawn:m.continuation.generation,restart_reconcile_pending:true,updated_at:100_000})
  const x=assessMissionLiveness(m,{now:250_000,hostSessions:{child:'busy'}});assert.equal(x.inflight,'YES');assert.equal(replacementExecutionAdmission('ACTIVE'),false)
})

test('generation-stale callback cannot settle or become progress for the current execution',async()=>{
  const {recordToolOperationProgress}=await api(),m=mission('generation-fence');m.continuation.generation=4
  const before=m.execution.ledger.length;assert.equal(recordToolOperationProgress(m,{operation_id:'old-call',session_id:'child-old',tool:'bash',generation:3},'result',200_000),false);assert.equal(m.execution.ledger.length,before)
})

test('process owner mismatch is UNKNOWN/quarantined liveness truth, never kill authority',async()=>{
  const {assessMissionLiveness}=await api(),m=mission('process-owner-mismatch');event(m,'semantic.assessed',10_000,{revision:1})
  m.execution.processes.push({process_id:'p1',mission_id:m.identity.mission_id,task_id:'t',worker_id:'w',host_process_id:'pty-1',host:'opencode-pty',command:'node app.js',command_identity:'b'.repeat(64),cwd:'.',started_at:10_001,status:'RUNNING',cleanup_state:'OPEN',pid:777})
  const x=assessMissionLiveness(m,{now:200_000,hostSessions:{},processes:{p1:{pid_alive:true,owner_verified:false,status:'running'}}});assert.equal(x.inflight,'UNKNOWN');assert.equal(x.destructive_recovery_allowed,false);assert.ok(x.reasons.some(r=>/process-owner-unverified/.test(r)))
})


test('bounded ledger retains the latest durable-progress anchor under repeated inert polling churn',async()=>{
  const {recordToolOperationProgress,lastDurableProgressAt}=await api(),m=mission('ledger-progress-anchor'),g=m.continuation.generation
  assert.equal(recordToolOperationProgress(m,{operation_id:'call-anchor',session_id:m.identity.session_id,tool:'read',generation:g},'result',50_000),true)
  const {appendLedger}=await import('../dist/runtime/ledger/ledger.js')
  for(let i=0;i<260;i++)appendLedger(m,'worker.await-timeout',{payload:{timeout_ms:60_000,attempt:1}})
  assert.equal(m.execution.ledger.length,200);assert.ok(m.execution.ledger.some(e=>e.type==='tool.operation-result'&&e.payload?.operation_id==='call-anchor'));assert.equal(lastDurableProgressAt(m),50_000)
})

test('real tool hooks bind unique callID start/result to current semantic generation',async()=>{
  const {createToolBeforeHook}=await import('../dist/hooks/tool-before.js'),{createToolAfterHook}=await import('../dist/hooks/tool-after.js'),{lastDurableProgressAt}=await api()
  const store=new MissionStore(),m=startAssessedMission(store,'hook-tool-progress','inspect bounded source',{task_kind:'implementation',scope:'local',risk:'low',required_capabilities:['implementation'],likely_targets:['src/a.ts']})
  const before=createToolBeforeHook(store,undefined,process.cwd()),after=createToolAfterHook(store,undefined,undefined,process.cwd())
  await before({sessionID:'hook-tool-progress',tool:'read',callID:'call-exact',args:{filePath:'src/a.ts'}},{args:{filePath:'src/a.ts'}})
  await after({sessionID:'hook-tool-progress',tool:'read',callID:'call-exact',args:{filePath:'src/a.ts'}},{output:'const x = 1'})
  assert.equal(m.execution.ledger.filter(e=>e.type==='tool.operation-started'&&e.payload?.operation_id==='call-exact').length,1)
  assert.equal(m.execution.ledger.filter(e=>e.type==='tool.operation-result'&&e.payload?.operation_id==='call-exact').length,1)
  const progress=lastDurableProgressAt(m);await after({sessionID:'hook-tool-progress',tool:'read',callID:'call-exact',args:{filePath:'src/a.ts'}},{output:'const x = 1'});assert.equal(lastDurableProgressAt(m),progress)
})

test('unmatched tool start is inflight only with exact current host busy/retry truth',async()=>{
  const {recordToolOperationProgress,assessMissionLiveness}=await api(),m=mission('tool-host-truth'),g=m.continuation.generation
  recordToolOperationProgress(m,{operation_id:'call-open',session_id:'tool-session',tool:'bash',generation:g},'started',20_000)
  assert.equal(assessMissionLiveness(m,{now:200_000,hostSessions:{'tool-session':'busy'}}).inflight,'YES')
  assert.equal(assessMissionLiveness(m,{now:200_000,hostSessions:{'tool-session':'unknown'}}).inflight,'UNKNOWN')
  const idle=assessMissionLiveness(m,{now:200_000,hostSessions:{'tool-session':'idle'}});assert.equal(idle.inflight,'NO');assert.equal(idle.state,'STALLED')
})
