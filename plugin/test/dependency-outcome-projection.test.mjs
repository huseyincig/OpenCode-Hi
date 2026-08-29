import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {projectDirectDependencyOutcomes,renderDirectDependencyOutcomeContext,DependencyOutcomeProjectionError} from '../dist/runtime/execution/dependency-outcome-projection.js'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {opencodeChildPort} from './helpers/host-port.mjs'

const HASH_A='a'.repeat(64),HASH_B='b'.repeat(64)
function mission(id='phase7-dependency'){
  return startAssessedMission(new MissionStore(),id,'dependent implementation',{task_kind:'implementation',dependency_class:'sequential',required_capabilities:['implementation']})
}
function done(m,task,{summary='dependency result',changed=['src/schema.ts'],digest=HASH_A,evidence=true}={}){
  const worker=createWorker(m,task,'p/code');worker.attempt=1;worker.generation_at_spawn=m.continuation.generation;worker.status='completed';worker.completed_at=Date.now();worker.last_result_digest=digest;worker.native_state_hash=HASH_B
  task.status='completed';task.result={status:'DONE',summary,changed_files:changed,evidence:evidence?[{kind:'targeted-tests',summary:'CLAIM_MUST_NOT_FLOW',pass:true,outcome:'passed'}]:[],open_issues:[],needs_context:[]};task.updated_at=Date.now()
  return worker
}
function nativeClient(){
  const creates=[],prompts=[];let n=0
  return {creates,prompts,client:{session:{
    create:async req=>{creates.push(req);return{data:{id:`child-${++n}`}}},
    promptAsync:async req=>{prompts.push(req);return{data:{}}},
    abort:async()=>({data:true}),
    diff:async()=>({data:[]}),
  }}}
}
function runtime(client){return new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:4})),process.cwd(),process.cwd(),()=>resolveHiConfig({}),()=>[{id:'p/code',provider:'p',quality:8,cost:1,tags:['coding','balanced'],writeCapable:true}],()=>({}))}

test('dependency projection binds direct DONE result to exact accepted attempt/digest and excludes worker proof claims',()=>{
  const m=mission('dep-projection'),pre=createTask(m,{objective:'define schema',role:'coder',category:'standard',scope:['src/schema.ts']}),worker=done(m,pre,{summary:'Schema exposes User and Session tables.'}),next=createTask(m,{objective:'implement API',role:'coder',category:'standard',dependencies:[pre.id]})
  const [item]=projectDirectDependencyOutcomes(m,next)
  assert.equal(item.task_id,pre.id);assert.equal(item.worker_id,worker.id);assert.equal(item.result_digest,HASH_A);assert.equal(item.generation,m.continuation.generation)
  assert.equal(item.attempt_id,`eu:${pre.id}:g${m.continuation.generation}:a1`);assert.equal(item.run_id,`worker:${worker.id}:g${m.continuation.generation}:a1`)
  assert.equal(item.summary,'Schema exposes User and Session tables.');assert.deepEqual(item.changed_files,['src/schema.ts']);assert.equal(item.source_state_hash,HASH_B)
  assert.equal('evidence' in item,false);assert.equal('findings' in item,false);assert.doesNotMatch(JSON.stringify(item),/CLAIM_MUST_NOT_FLOW/)
})

test('dependency projection is direct-edge only and deterministic across fan-in dependency order',()=>{
  const m=mission('dep-direct'),a=createTask(m,{objective:'A',role:'coder',category:'standard'});done(m,a,{summary:'A'});const b=createTask(m,{objective:'B',role:'coder',category:'standard',dependencies:[a.id]});done(m,b,{summary:'B'});const c=createTask(m,{objective:'C',role:'coder',category:'standard',dependencies:[b.id]});assert.deepEqual(projectDirectDependencyOutcomes(m,c).map(x=>x.task_id),[b.id])
  const d=createTask(m,{objective:'D',role:'coder',category:'standard'});done(m,d,{summary:'D'});const join=createTask(m,{objective:'join',role:'coder',category:'standard',dependencies:[d.id,b.id]});assert.deepEqual(projectDirectDependencyOutcomes(m,join).map(x=>x.task_id),[b.id,d.id].sort())
})

test('dependency renderer keeps valid JSON and preserves every identity while degrading detail to fit budget',()=>{
  const m=mission('dep-render'),pre=createTask(m,{objective:'large',role:'coder',category:'standard'});done(m,pre,{summary:'x'.repeat(3000),changed:Array.from({length:32},(_,i)=>`src/file-${i}.ts`)});const next=createTask(m,{objective:'next',role:'coder',category:'standard',dependencies:[pre.id]}),items=projectDirectDependencyOutcomes(m,next)
  const text=renderDirectDependencyOutcomeContext(items,700);assert.ok(text.length<=700);const payload=JSON.parse(text.split('\n').slice(1).join('\n'));assert.equal(payload.kind,'direct-dependency-outcomes');assert.equal(payload.evidence_authority,false);assert.equal(payload.items.length,1);assert.equal(payload.items[0].task_id,pre.id);assert.equal(payload.items[0].result_digest,HASH_A)
})

test('dependency projection fails closed on completed task without exact accepted-result provenance',()=>{
  const m=mission('dep-corrupt'),pre=createTask(m,{objective:'pre',role:'coder',category:'standard'});const worker=done(m,pre);worker.last_result_digest=undefined;const next=createTask(m,{objective:'next',role:'coder',category:'standard',dependencies:[pre.id]})
  assert.throws(()=>projectDirectDependencyOutcomes(m,next),DependencyOutcomeProjectionError)
})

test('queued successor receives dependency result produced after queueing, without manual result retrieval or proof leakage',async()=>{
  const {client,creates,prompts}=nativeClient(),r=runtime(client),m=mission('dep-late-result');m.execution.execution_mode='parallel'
  const pre=createTask(m,{objective:'derive DB schema',role:'coder',category:'standard',scope:['src/schema.ts']}),preWorker=createWorker(m,pre,'p/code');pre.status='running';preWorker.status='busy';preWorker.attempt=1;preWorker.generation_at_spawn=m.continuation.generation
  const queued=await r.start(m,{objective:'implement API from schema',role:'coder',category:'standard',scope:['src/api.ts'],dependencies:[pre.id],requiredEvidence:[]})
  assert.equal(queued.readiness,'WAIT');assert.equal(r.queueDepth(),1);assert.equal(creates.length,0);assert.equal(prompts.length,0)
  r.applyResult(m,preWorker.id,{status:'DONE',summary:'Schema contract: User(id,email), Session(userId,token).',changed_files:['src/schema.ts'],evidence:[{kind:'targeted-tests',summary:'SECRET_PROOF_CLAIM_SHOULD_NOT_FLOW',pass:true,outcome:'passed'}],open_issues:[],needs_context:[]})
  await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve))
  assert.equal(r.queueDepth(),0);assert.equal(creates.length,1);assert.equal(prompts.length,1)
  const text=String(prompts[0].body?.parts?.[0]?.text??'')
  assert.match(text,/DIRECT DEPENDENCY OUTCOMES — NON-EVIDENCE/);assert.match(text,/Schema contract: User\(id,email\), Session\(userId,token\)\./);assert.match(text,new RegExp(preWorker.last_result_digest));assert.match(text,new RegExp(`eu:${pre.id}:g${m.continuation.generation}:a1`))
  assert.doesNotMatch(text,/SECRET_PROOF_CLAIM_SHOULD_NOT_FLOW/);assert.doesNotMatch(text,/"evidence":\[/)
  assert.ok(m.execution.ledger.some(e=>e.type==='dependency.outcomes-projected'&&e.task_id===queued.task_id))
})

test('corrupt completed dependency blocks before any child-session mutation',async()=>{
  const {client,creates,prompts}=nativeClient(),r=runtime(client),m=mission('dep-precreate-block'),pre=createTask(m,{objective:'pre',role:'coder',category:'standard'});done(m,pre);m.execution.workers.find(w=>w.task_id===pre.id).last_result_digest=undefined
  await assert.rejects(()=>r.start(m,{objective:'dependent',role:'coder',category:'standard',scope:['src/dependent.ts'],dependencies:[pre.id],requiredEvidence:[]}),/accepted result digest is missing or invalid/)
  assert.equal(creates.length,0);assert.equal(prompts.length,0);const blocked=m.execution.tasks.find(t=>t.objective==='dependent');assert.equal(blocked?.status,'blocked');assert.match(blocked?.result?.open_issues?.[0]??'',/^dependency-outcome-unavailable:/)
})

test('dependency result is revalidated after child-create await and stale provenance is never prompted',async()=>{
  let releaseCreate;const creates=[],prompts=[],aborts=[];const createGate=new Promise(resolve=>{releaseCreate=()=>resolve({data:{id:'child-race'}})})
  const client={session:{create:async req=>{creates.push(req);return createGate},promptAsync:async req=>{prompts.push(req);return{data:{}}},abort:async req=>{aborts.push(req);return{data:true}},diff:async()=>({data:[]})}}
  const r=runtime(client),m=mission('dep-revalidate-race'),pre=createTask(m,{objective:'stable prerequisite',role:'coder',category:'standard'}),preWorker=done(m,pre,{summary:'initial accepted contract'})
  const startPromise=r.start(m,{objective:'dependent after await',role:'coder',category:'standard',scope:['src/dependent.ts'],dependencies:[pre.id],requiredEvidence:[]})
  await new Promise(resolve=>setImmediate(resolve));assert.equal(creates.length,1);assert.equal(prompts.length,0)
  preWorker.last_result_digest=undefined
  releaseCreate()
  await assert.rejects(()=>startPromise,/accepted result digest is missing or invalid/)
  assert.equal(prompts.length,0,'stale dependency provenance must be fenced before provider prompt');assert.equal(aborts.length,1,'already-created unprompted child must be quiesced')
  const dependent=m.execution.tasks.find(t=>t.objective==='dependent after await');assert.equal(dependent?.status,'blocked');assert.match(dependent?.result?.open_issues?.[0]??'',/^dependency-outcome-unavailable:/)
})
