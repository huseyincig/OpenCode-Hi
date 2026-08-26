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
function contract(req,id='proc_1',pid=5001){return{process_id:id,mission_id:req.mission_id,task_id:req.task_id,worker_id:req.worker_id,host:'opencode',command_identity:createHash('sha256').update(`opencode\0${req.cwd}\0${[req.command,...req.args??[]].map(x=>x.includes(' ')?`'${x}'`:x).join(' ')}`).digest('hex'),cwd:req.cwd,pid,status:'RUNNING',started_at:Date.now(),...(req.timeout_ms?{timeout_at:Date.now()+req.timeout_ms}:{}),output_artifact_refs:[],authority_ref:req.authority_ref,cleanup_state:'ACTIVE'}}
class FakeExecutor{
  constructor(){this.states=new Map();this.spawned=[];this.writes=[];this.cleaned=[];this.reconcileMode='ADOPTED';this.waiters=new Map()}
  async spawn(req){const c=contract(req,`proc_${this.spawned.length+1}`,5001+this.spawned.length);this.states.set(c.process_id,c);this.spawned.push(structuredClone(req));return{contract:structuredClone(c),host_process_id:`pty-${c.pid}`}}
  async write(id,input){if(!this.states.has(id))throw new Error('missing');this.writes.push([id,input])}
  async read(id,{cursor=0,max_chars=64}={}){const c=this.states.get(id);if(!c)throw new Error('missing');const text='secret-output-1234567890';const start=Math.max(0,cursor),slice=text.slice(start,start+max_chars);return{text:slice,start_cursor:start,end_cursor:start+slice.length,available_start_cursor:0,available_end_cursor:text.length,truncated:start+slice.length<text.length,status:c.status}}
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
  return runtime.spawn(m,{worker_id:worker.id,command:'node',args:['-e','1'],cwd:root}).then(process=>{
    assert.equal(m.execution.processes.length,1);assert.equal(m.execution.processes[0].process_id,process.process_id);assert.equal(validateMissionEnvelope(m),true)
    const persistence=new RuntimePersistence(root);persistence.save([m]);const raw=JSON.parse(readFileSync(persistence.path,'utf8'));assert.equal(raw.schema,10);assert.equal(RUNTIME_STATE_SCHEMA,10);assert.equal(raw.missions[0].execution.processes.length,1)
    const reload=new RuntimePersistence(root),loaded=reload.load();assert.equal(loaded.length,1);assert.equal(loaded[0].execution.processes[0].pid,process.pid)
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

test('running process makes continuation WAIT without reasoning stagnation and wait resolves from native promise',async()=>{
  const {m,worker}=mission(),fake=new FakeExecutor(),runtime=new ProcessRuntime(fake,'/repo',()=>host()),p=await runtime.spawn(m,{worker_id:worker.id,command:'node',cwd:'/repo'})
  const decision=evaluateIdle(m);assert.equal(decision.decision,'WAIT');assert.equal(decision.reason_code,'waiting-worker')
  // Once the owning worker is quiescent, the process itself remains the WAIT hinge.
  worker.status='ready';const processWait=evaluateIdle(m);assert.equal(processWait.decision,'WAIT');assert.equal(processWait.reason_code,'waiting-process');assert.equal(shouldCountStagnation(processWait),false)
  let settled=false;const pending=runtime.wait(m,p.process_id).then(x=>{settled=true;return x});await new Promise(r=>setTimeout(r,5));assert.equal(settled,false);fake.exit(p.process_id,0);const exited=await pending;assert.equal(exited.status,'EXITED');assert.equal(exited.exit_code,0)
})

test('bounded process read records hash-bound pending Evidence without persisting raw output',async()=>{
  const {m,worker}=mission(),fake=new FakeExecutor(),runtime=new ProcessRuntime(fake,'/repo',()=>host()),p=await runtime.spawn(m,{worker_id:worker.id,command:'node',cwd:'/repo'})
  const out=await runtime.read(m,p.process_id,0,8);assert.equal(out.text,'secret-o');const ev=m.execution.evidence.items.at(-1);assert.equal(ev.kind,'diagnostic-evidence');assert.equal(ev.outcome,'pending');assert.match(ev.source,/^process:/);assert.match(ev.source_state_hash,/^[a-f0-9]{64}$/);assert.doesNotMatch(JSON.stringify(ev),/secret-output/)
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
