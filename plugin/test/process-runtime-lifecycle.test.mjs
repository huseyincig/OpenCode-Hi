import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {ProcessRuntime} from '../dist/runtime/process/runtime.js'
import {ProcessSpawnPermissionError} from '../dist/opencode/open-code-pty-adapter.js'
import {evaluateIdle,shouldCountStagnation} from '../dist/runtime/continuation/evaluator.js'
import {addEvidence} from '../dist/runtime/evidence/evidence-runtime.js'
import {RuntimePersistence,RUNTIME_STATE_SCHEMA} from '../dist/runtime/state/persistence.js'
import {validateMissionEnvelope} from '../dist/runtime/mission/validators.js'

const ASSESS={material:true,message_kind:'mission',task_kind:'implementation',scope:'local',risk:'medium',ambiguity:'none',dependency_class:'independent',required_capabilities:['implementation'],requested_external_actions:[],likely_verification:[],likely_targets:['src/a.ts'],intent_signals:[],suppressed_intent_signals:[]}
function mission(root='/repo'){
  const store=new MissionStore(root),m=store.start('s','run bounded process')
  store.applyInitialSemanticAssessment('s',ASSESS)
  const impl=m.execution.obligations.find(o=>o.kind==='implementation')
  const task=createTask(m,{objective:'run verifier',role:'coder',category:'standard',scope:['src/a.ts'],requiredEvidence:[],obligationIds:impl?[impl.id]:[]})
  const worker=createWorker(m,task,'host-default');worker.status='busy';worker.started_at=Date.now();task.status='running'
  return{store,m,task,worker}
}
function host(bash='allow',external='ask'){return{agent:{coder:{permission:{bash:{'*':bash},external_directory:{'*':external}}}}}}
function contract(req,id='proc_1',pid=5001){return{process_id:id,mission_id:req.mission_id,task_id:req.task_id,worker_id:req.worker_id,host:'opencode',command_identity:createHash('sha256').update(`opencode\0${req.cwd}\0${[req.command,...req.args??[]].map(x=>x.includes(' ')?`'${x}'`:x).join(' ')}`).digest('hex'),cwd:req.cwd,pid,status:'RUNNING',started_at:Date.now(),...(req.timeout_ms?{timeout_at:Date.now()+req.timeout_ms}:{}),output_artifact_refs:[],...(req.service_origins?.length?{service_origins:[...req.service_origins]}:{}),authority_ref:req.authority_ref,cleanup_state:'ACTIVE'}}
class FakeExecutor{
  constructor(){this.states=new Map();this.spawned=[];this.writes=[];this.cleaned=[];this.reconcileMode='ADOPTED';this.waiters=new Map();this.readText='secret-output-1234567890'}
  async spawn(req){const c=contract(req,`proc_${this.spawned.length+1}`,5001+this.spawned.length);this.states.set(c.process_id,c);this.spawned.push(structuredClone(req));return{contract:structuredClone(c),host_process_id:`pty-${c.pid}`}}
  async write(id,input){if(!this.states.has(id))throw new Error('missing');this.writes.push([id,input])}
  async read(id,{cursor=0,max_chars=64}={}){const c=this.states.get(id);if(!c)throw new Error('missing');const text=this.readText;const start=Math.max(0,cursor),slice=text.slice(start,start+max_chars);return{text:slice,start_cursor:start,end_cursor:start+slice.length,available_start_cursor:0,available_end_cursor:text.length,truncated:start+slice.length<text.length,status:c.status}}
  async observe(id){const c=this.states.get(id);if(!c)throw new Error('missing');return structuredClone(c)}
  async wait(id){const c=this.states.get(id);if(!c)throw new Error('missing');if(c.status!=='RUNNING')return{contract:structuredClone(c)};return await new Promise((resolve,reject)=>this.waiters.set(id,{resolve,reject}))}
  exit(id,code=0){const c=this.states.get(id);Object.assign(c,{status:'EXITED',ended_at:Date.now(),exit_code:code,cleanup_state:'CLEANUP_PENDING'});this.waiters.get(id)?.resolve({contract:structuredClone(c)});this.waiters.delete(id)}
  async kill(id,signal='SIGTERM'){const c=this.states.get(id);if(!c)throw new Error('missing');Object.assign(c,{status:'TERMINATED',ended_at:Date.now(),termination_reason:`signal:${signal}`,cleanup_state:'CLEANUP_PENDING'});this.waiters.get(id)?.resolve({contract:structuredClone(c)});this.waiters.delete(id);return{contract:structuredClone(c)}}
  async cleanup(id){const c=this.states.get(id);if(!c)throw new Error('missing');if(c.status==='RUNNING')throw new Error('running');c.cleanup_state='CLEANED';this.cleaned.push(id)}
  async reconcile(c){if(this.reconcileMode==='ORPHANED')return{disposition:'ORPHANED',contract:{...structuredClone(c),status:'ORPHANED',cleanup_state:'QUARANTINED',termination_reason:'restart-owner-missing'}};this.states.set(c.process_id,structuredClone(c));return{disposition:this.reconcileMode,contract:structuredClone(c)}}
  snapshot(id){return structuredClone(this.states.get(id))}
  list(){return[...this.states.values()].map(x=>structuredClone(x))}
}

test('Mission execution owns durable ProcessContract registry and schema 10 round-trips it current-only',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-p3-state-')),{m,worker}=mission(root),fake=new FakeExecutor(),runtime=new ProcessRuntime(fake,root,()=>host())
  return runtime.spawn(m,{worker_id:worker.id,command:'node',args:['-e','1'],cwd:root,service_origins:['http://127.0.0.1:5000']}).then(process=>{
    assert.equal(m.execution.processes.length,1);assert.equal(m.execution.processes[0].process_id,process.process_id);assert.deepEqual(process.service_origins,['http://127.0.0.1:5000']);assert.equal(validateMissionEnvelope(m),true)
    const persistence=new RuntimePersistence(root);persistence.save([m]);const raw=JSON.parse(readFileSync(persistence.path,'utf8'));assert.equal(raw.schema,10);assert.equal(RUNTIME_STATE_SCHEMA,10);assert.equal(raw.missions[0].execution.processes.length,1);assert.deepEqual(raw.missions[0].execution.processes[0].service_origins,['http://127.0.0.1:5000'])
    const reload=new RuntimePersistence(root),loaded=reload.load();assert.equal(loaded.length,1);assert.equal(loaded[0].execution.processes[0].pid,process.pid);assert.deepEqual(loaded[0].execution.processes[0].service_origins,['http://127.0.0.1:5000'])
    raw.schema=8;writeFileSync(persistence.path,JSON.stringify(raw));const rejected=new RuntimePersistence(root);assert.deepEqual(rejected.load(),[]);assert.match(rejected.lastLoadReport.error,/unsupported runtime-state schema 8/)
  })
})

test('native permission ask uses exact ToolContext-style request once and only exact ephemeral grant reaches spawn',async()=>{
  const {m,worker}=mission(),fake=new FakeExecutor(),runtime=new ProcessRuntime(fake,'/repo',()=>host('ask'))
  const asks=[];const p=await runtime.spawn(m,{worker_id:worker.id,command:'node',args:['-e','1'],cwd:'/repo',ask:async req=>asks.push(req)})
  assert.equal(asks.length,1);assert.equal(asks[0].permission,'bash');assert.deepEqual(asks[0].patterns,[asks[0].pattern]);assert.equal(fake.spawned.length,1);assert.deepEqual(fake.spawned[0].native_permission_grants,[{permission:'bash',pattern:asks[0].pattern}]);assert.equal(p.status,'RUNNING')
})

test('explicit permission deny never asks and never spawns',async()=>{
  const {m,worker}=mission(),fake=new FakeExecutor(),runtime=new ProcessRuntime(fake,'/repo',()=>host('deny'));let asks=0
  await assert.rejects(()=>runtime.spawn(m,{worker_id:worker.id,command:'node',cwd:'/repo',ask:async()=>{asks++}}),e=>e instanceof ProcessSpawnPermissionError&&e.decision==='DENY')
  assert.equal(asks,0);assert.equal(fake.spawned.length,0)
})

test('authoritative process observation updates stale durable RUNNING to terminal without producing output evidence',async()=>{
  const {m,worker}=mission(),fake=new FakeExecutor(),runtime=new ProcessRuntime(fake,'/repo',()=>host()),p=await runtime.spawn(m,{worker_id:worker.id,command:'node',cwd:'/repo'})
  fake.exit(p.process_id,0)
  assert.equal(m.execution.processes.find(x=>x.process_id===p.process_id).status,'RUNNING','durable state remains stale until host observation')
  const observed=await runtime.observe(m,p.process_id)
  assert.equal(observed.status,'EXITED');assert.equal(observed.exit_code,0);assert.equal(m.execution.processes.find(x=>x.process_id===p.process_id).status,'EXITED')
  assert.ok(m.execution.ledger.some(e=>e.type==='process.status-observed'&&e.payload?.process_id===p.process_id&&e.payload?.status==='EXITED'))
  assert.equal(m.execution.evidence.items.filter(e=>String(e.source??'').startsWith(`process:${p.process_id}:`)).length,0,'status observation must not fabricate output evidence')
})

test('hard-deadline running process makes continuation WAIT without reasoning stagnation and wait resolves from native promise',async()=>{
  const {m,worker}=mission(),fake=new FakeExecutor(),runtime=new ProcessRuntime(fake,'/repo',()=>host()),p=await runtime.spawn(m,{worker_id:worker.id,command:'node',cwd:'/repo',timeout_ms:1000})
  const decision=evaluateIdle(m);assert.equal(decision.decision,'WAIT');assert.equal(decision.reason_code,'waiting-worker')
  worker.status='ready';const processWait=evaluateIdle(m);assert.equal(processWait.decision,'WAIT');assert.equal(processWait.reason_code,'waiting-process');assert.equal(shouldCountStagnation(processWait),false)
  let settled=false;const pending=runtime.wait(m,p.process_id).then(x=>{settled=true;return x});await new Promise(r=>setTimeout(r,5));assert.equal(settled,false);fake.exit(p.process_id,0);const exited=await pending;assert.equal(exited.status,'EXITED');assert.equal(exited.exit_code,0)
})

test('deadline-less persistent service does not mask an actionable FIX_REQUIRED reconciliation',async()=>{
  const {m,task,worker}=mission(),fake=new FakeExecutor(),runtime=new ProcessRuntime(fake,'/repo',()=>host());await runtime.spawn(m,{worker_id:worker.id,command:'node',cwd:'/repo'})
  worker.status='ready';task.status='waiting';task.result={status:'FIX_REQUIRED',summary:'structured correction required',changed_files:['src/a.ts'],evidence:[],open_issues:['fix:x'],needs_context:[]}
  const decision=evaluateIdle(m);assert.equal(decision.decision,'RECONCILE');assert.equal(decision.reason_code,'worker-result-unreconciled')
})

test('cancelled task keeps historical FIX_REQUIRED result inert for completion and stagnation',()=>{
  const {m,task,worker}=mission()
  const verification=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(verification)
  m.vcs.changed_files=['src/a.ts'];addEvidence(m,{kind:'changed-surface-sanity',summary:'current host verification passed',scope:['src/a.ts'],source:'bash',trusted_source_class:'host-tool-observation',pass:true,outcome:'passed',obligation_ids:[verification.id]})
  for(const obligation of m.execution.obligations){obligation.status='closed';obligation.closedAt=Date.now()}
  task.status='cancelled';task.result={status:'FIX_REQUIRED',summary:'historical cancelled correction',changed_files:[],evidence:[],open_issues:['historical-only'],needs_context:[]}
  worker.status='cancelled';worker.completed_at=Date.now();m.execution.blockers=[];m.continuation.stagnation_count=0
  const decision=evaluateIdle(m)
  assert.equal(decision.decision,'STOP');assert.equal(decision.reason_code,'complete');assert.equal(shouldCountStagnation(decision),false);assert.equal(m.continuation.stagnation_count,0)
  assert.equal(task.result.status,'FIX_REQUIRED','cancelled task result remains retained for audit/history')
})

test('bounded process read records hash-bound pending Evidence without persisting raw output',async()=>{
  const {m,worker}=mission(),fake=new FakeExecutor(),runtime=new ProcessRuntime(fake,'/repo',()=>host()),p=await runtime.spawn(m,{worker_id:worker.id,command:'node',cwd:'/repo'})
  const out=await runtime.read(m,p.process_id,0,8);assert.equal(out.text,'secret-o');const ev=m.execution.evidence.items.at(-1);assert.equal(ev.kind,'diagnostic-evidence');assert.equal(ev.outcome,'pending');assert.match(ev.source,/^process:/);assert.match(ev.source_state_hash,/^[a-f0-9]{64}$/);assert.doesNotMatch(JSON.stringify(ev),/secret-output/)
})

test('terminal status observed by bounded read reconciles the durable ProcessContract immediately',async()=>{
  const {m,worker}=mission(),fake=new FakeExecutor(),runtime=new ProcessRuntime(fake,'/repo',()=>host()),p=await runtime.spawn(m,{worker_id:worker.id,command:'node',cwd:'/repo'});worker.status='ready'
  fake.exit(p.process_id,127)
  const out=await runtime.read(m,p.process_id,0,8)
  assert.equal(out.status,'EXITED');const durable=m.execution.processes.find(x=>x.process_id===p.process_id);assert.equal(durable.status,'EXITED');assert.equal(durable.exit_code,127);assert.equal(durable.cleanup_state,'CLEANUP_PENDING')
  assert.ok(m.execution.ledger.some(e=>e.type==='process.exited'&&e.payload?.process_id===p.process_id&&e.payload?.exit_code===127))
  const decision=evaluateIdle(m);assert.notEqual(decision.reason_code,'waiting-process','terminal read observation must retire the stale RUNNING wait hinge')
})

test('bounded process output registers exact loopback service origin and restart/terminal reconciliation preserves target authority',async()=>{
  const {m,worker}=mission(),fake=new FakeExecutor(),runtime=new ProcessRuntime(fake,'/repo',()=>host()),p=await runtime.spawn(m,{worker_id:worker.id,command:'python3',args:['app.py'],cwd:'/repo'})
  fake.readText=' * Serving Flask app\n * Running on http://127.0.0.1:5000\nDocs: https://example.com/ignored\n'
  await runtime.read(m,p.process_id,0,4096)
  const registered=m.execution.processes.find(x=>x.process_id===p.process_id);assert.deepEqual(registered.service_origins,['http://127.0.0.1:5000']);assert.ok(m.execution.ledger.some(e=>e.type==='process.service-origin-observed'&&e.payload?.process_id===p.process_id&&e.payload?.service_origins?.includes('http://127.0.0.1:5000')))
  const restored=structuredClone(m),freshFake=new FakeExecutor(),freshRuntime=new ProcessRuntime(freshFake,'/repo',()=>host());await freshRuntime.reconcileRestored([restored]);assert.deepEqual(restored.execution.processes[0].service_origins,['http://127.0.0.1:5000'])
  freshFake.exit(p.process_id,0);const terminal=await freshRuntime.wait(restored,p.process_id);assert.equal(terminal.status,'EXITED');assert.deepEqual(terminal.service_origins,['http://127.0.0.1:5000']);assert.deepEqual(restored.execution.processes[0].service_origins,['http://127.0.0.1:5000']);await freshRuntime.cleanup(restored,p.process_id);assert.equal(restored.execution.processes[0].cleanup_state,'CLEANED');assert.deepEqual(restored.execution.processes[0].service_origins,['http://127.0.0.1:5000'])
})

test('repeated identical process output is inert and does not mint duplicate evidence/progress',async()=>{
  const {m,worker}=mission(),fake=new FakeExecutor(),runtime=new ProcessRuntime(fake,'/repo',()=>host()),p=await runtime.spawn(m,{worker_id:worker.id,command:'node',cwd:'/repo'})
  const before=m.execution.evidence.items.length;await runtime.read(m,p.process_id,0,8);const once=m.execution.evidence.items.length;await runtime.read(m,p.process_id,0,8);const twice=m.execution.evidence.items.length
  assert.equal(once,before+1);assert.equal(twice,once);assert.equal(m.execution.ledger.filter(e=>e.type==='process.output-observed').length,1);assert.equal(m.execution.ledger.filter(e=>e.type==='process.output-repeat').length,1)
})

test('STOP terminates and separately cleans all owned running processes and forbids new spawn',async()=>{
  const {store,m,worker}=mission(),fake=new FakeExecutor(),runtime=new ProcessRuntime(fake,'/repo',()=>host())
  const a=await runtime.spawn(m,{worker_id:worker.id,command:'node',args:['a'],cwd:'/repo'}),b=await runtime.spawn(m,{worker_id:worker.id,command:'node',args:['b'],cwd:'/repo'})
  store.stop('s','test-stop');const count=await runtime.stopMission(m);assert.equal(count,2);assert.equal(m.execution.processes.every(p=>p.status==='TERMINATED'&&p.cleanup_state==='CLEANED'),true);assert.deepEqual(new Set(fake.cleaned),new Set([a.process_id,b.process_id]));await assert.rejects(()=>runtime.spawn(m,{worker_id:worker.id,command:'node',cwd:'/repo'}),/Mission is stopped/)
})

test('restart reconciliation adopts exact owner identity and quarantines orphan without signalling it',async()=>{
  const {m,worker}=mission(),fake=new FakeExecutor(),runtime=new ProcessRuntime(fake,'/repo',()=>host()),p=await runtime.spawn(m,{worker_id:worker.id,command:'node',cwd:'/repo'})
  const restored=structuredClone(m),freshFake=new FakeExecutor(),freshRuntime=new ProcessRuntime(freshFake,'/repo',()=>host());await freshRuntime.reconcileRestored([restored]);assert.equal(restored.execution.processes[0].status,'RUNNING');assert.equal(restored.execution.blockers.some(x=>x.startsWith('process-orphan:')),false)
  const orphaned=structuredClone(m),orphanFake=new FakeExecutor();orphanFake.reconcileMode='ORPHANED';const orphanRuntime=new ProcessRuntime(orphanFake,'/repo',()=>host());await orphanRuntime.reconcileRestored([orphaned]);assert.equal(orphaned.execution.processes[0].status,'ORPHANED');assert.equal(orphaned.execution.processes[0].cleanup_state,'QUARANTINED');assert.ok(orphaned.execution.blockers.includes(`process-orphan:${p.process_id}`));const decision=evaluateIdle(orphaned);worker.status='ready';assert.ok(['WAIT','USER_ACTION_REQUIRED'].includes(decision.decision))
})


test('failed process lifecycle operations cannot masquerade as healthy RUNNING WAIT',async()=>{
  const {m,worker}=mission(),fake=new FakeExecutor(),runtime=new ProcessRuntime(fake,'/repo',()=>host()),p=await runtime.spawn(m,{worker_id:worker.id,command:'node',cwd:'/repo'});worker.status='ready'
  const realKill=fake.kill.bind(fake);fake.kill=async()=>{throw new Error('PTY termination unavailable')}
  await assert.rejects(()=>runtime.kill(m,p.process_id),/termination unavailable/);assert.ok(m.execution.blockers.includes(`process-termination-unverified:${p.process_id}`));let d=evaluateIdle(m);assert.equal(d.decision,'USER_ACTION_REQUIRED');assert.equal(d.reason_code,'operational-blocker')
  fake.kill=realKill;const terminated=await runtime.kill(m,p.process_id);assert.equal(terminated.status,'TERMINATED');assert.equal(m.execution.blockers.includes(`process-termination-unverified:${p.process_id}`),false)
  fake.cleanup=async()=>{throw new Error('cleanup transport unavailable')};await assert.rejects(()=>runtime.cleanup(m,p.process_id),/cleanup transport unavailable/);assert.ok(m.execution.blockers.includes(`process-cleanup:${p.process_id}`));d=evaluateIdle(m);assert.equal(d.decision,'USER_ACTION_REQUIRED');assert.equal(d.reason,`process-cleanup:${p.process_id}`)
})

test('failed process wait is terminal until a later lifecycle observation changes state',async()=>{
  const {m,worker}=mission(),fake=new FakeExecutor(),runtime=new ProcessRuntime(fake,'/repo',()=>host()),p=await runtime.spawn(m,{worker_id:worker.id,command:'node',cwd:'/repo'});worker.status='ready'
  fake.wait=async()=>{throw new Error('PTY wait transport unavailable')};await assert.rejects(()=>runtime.wait(m,p.process_id),/wait transport unavailable/);assert.ok(m.execution.blockers.includes(`process-wait-failed:${p.process_id}`));const d=evaluateIdle(m);assert.equal(d.decision,'USER_ACTION_REQUIRED');assert.equal(d.reason,`process-wait-failed:${p.process_id}`)
})

test('terminal cleanup-only continuation is not reasoning stagnation and resets stale recovery count',()=>{
  const {m,task,worker}=mission();worker.status='completed';worker.completed_at=Date.now();task.status='completed';task.result={status:'DONE',summary:'work done',changed_files:['src/a.ts'],evidence:[],open_issues:[],needs_context:[]}
  const implementation=m.execution.obligations.find(o=>o.kind==='implementation');assert.ok(implementation);implementation.status='closed';implementation.closedAt=Date.now();m.vcs.changed_files=['src/a.ts']
  const verification=m.execution.obligations.find(o=>o.kind==='verification');assert.ok(verification);addEvidence(m,{kind:'changed-surface-sanity',summary:'current host verification passed',scope:['src/a.ts'],source:'bash',trusted_source_class:'host-tool-observation',pass:true,outcome:'passed',obligation_ids:[verification.id]});verification.status='closed';verification.closedAt=Date.now()
  m.execution.processes.push({process_id:'proc_cleanup_only',mission_id:m.identity.mission_id,task_id:task.id,worker_id:worker.id,host:'opencode',command_identity:'f'.repeat(64),cwd:'/repo',pid:5010,status:'TERMINATED',started_at:Date.now()-1000,ended_at:Date.now(),termination_reason:'signal:SIGTERM',output_artifact_refs:[],authority_ref:'native',cleanup_state:'CLEANUP_PENDING'})
  m.continuation.stagnation_count=2
  const decision=evaluateIdle(m);assert.equal(decision.decision,'CONTINUE');assert.equal(decision.reason_code,'process-cleanup-pending');assert.equal(shouldCountStagnation(decision),false);assert.equal(m.continuation.stagnation_count,0);assert.match(decision.prompt??'',/cleanup-terminal-process:proc_cleanup_only/)
})


test('exact task-owner settlement kills and cleans only matching ProcessContracts',async()=>{
  const {m,worker}=mission(),fake=new FakeExecutor(),runtime=new ProcessRuntime(fake,'/repo',()=>host())
  const a=await runtime.spawn(m,{worker_id:worker.id,command:'node',args:['a'],cwd:'/repo'}),b=await runtime.spawn(m,{worker_id:worker.id,command:'node',args:['b'],cwd:'/repo'})
  const otherTask=createTask(m,{objective:'other process',role:'coder',category:'standard',scope:[],requiredEvidence:[],obligationIds:[]}),otherWorker=createWorker(m,otherTask,'host-default');otherWorker.status='busy';otherTask.status='running'
  const other=await runtime.spawn(m,{worker_id:otherWorker.id,command:'node',args:['other'],cwd:'/repo'})
  assert.equal(await runtime.settleTaskOwner(m,worker.task_id,worker.id),2)
  assert.equal(m.execution.processes.find(p=>p.process_id===a.process_id).status,'TERMINATED')
  assert.equal(m.execution.processes.find(p=>p.process_id===a.process_id).cleanup_state,'CLEANED')
  assert.equal(m.execution.processes.find(p=>p.process_id===b.process_id).cleanup_state,'CLEANED')
  assert.equal(m.execution.processes.find(p=>p.process_id===other.process_id).status,'RUNNING')
  assert.equal(m.execution.processes.find(p=>p.process_id===other.process_id).cleanup_state,'ACTIVE')
  assert.ok(m.execution.ledger.some(e=>e.type==='process.task-owner-settled'&&e.task_id===worker.task_id&&e.worker_id===worker.id))
})

test('exact task-owner settlement fails closed when cleanup cannot complete',async()=>{
  const {m,worker}=mission(),fake=new FakeExecutor(),runtime=new ProcessRuntime(fake,'/repo',()=>host()),p=await runtime.spawn(m,{worker_id:worker.id,command:'node',cwd:'/repo'})
  fake.cleanup=async()=>{throw new Error('cleanup transport unavailable')}
  await assert.rejects(()=>runtime.settleTaskOwner(m,worker.task_id,worker.id),/cleanup transport unavailable/)
  const durable=m.execution.processes.find(x=>x.process_id===p.process_id)
  assert.equal(durable.status,'TERMINATED')
  assert.equal(durable.cleanup_state,'CLEANUP_PENDING')
  assert.ok(m.execution.blockers.includes(`process-cleanup:${p.process_id}`))
})
