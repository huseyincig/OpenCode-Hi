import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,mkdtempSync,mkdirSync,readFileSync,rmSync,symlinkSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {isTaskOutcomeMemoryRecord} from '../dist/contracts/task-outcome-memory.js'
import {ProjectTaskOutcomeMemoryStore,taskOutcomeMemoryFingerprint} from '../dist/runtime/project-intelligence/task-outcome-memory.js'
import {projectTaskOutcomeMemoryPath} from '../dist/runtime/storage/ownership.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {TaskRuntime} from '../dist/runtime/task/task-runtime.js'
import {BackgroundRegistry} from '../dist/runtime/background/registry.js'
import {createConcurrencyPolicySource} from '../dist/runtime/scheduler/concurrency.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {createRuntimeScopedStores} from '../dist/runtime/application/runtime-scoped-stores.js'
import {ContextArtifactStore} from '../dist/runtime/context/artifact-store.js'
import {opencodeChildPort} from './helpers/host-port.mjs'
import {appendLedger} from '../dist/runtime/ledger/ledger.js'

const result=(status='FIX_REQUIRED',overrides={})=>({status,summary:'UNTRUSTED SUMMARY MUST NOT PERSIST',changed_files:[],evidence:[],open_issues:status==='DONE'?[]:['native-diff-mismatch:src/a.ts:SECRET_DETAIL'],needs_context:[],...overrides})
function fixture(root,sid='m1',objective='small fix'){
  const store=new MissionStore(root),m=startAssessedMission(store,sid,'opaque task',{likely_targets:['src/a.ts'],required_capabilities:['implementation']})
  const task=createTask(m,{objective,role:'coder',category:'quick',scope:['src/a.ts'],constraints:[],requiredEvidence:[],obligationIds:[]})
  const worker=createWorker(m,task,'host-default');worker.attempt=1;appendLedger(m,'native.diff.mismatch',{task_id:task.id,worker_id:worker.id,payload:{test:true}})
  return{m,task,worker}
}
function writeSource(root,text='export const value = 1\n'){mkdirSync(join(root,'src'),{recursive:true});writeFileSync(join(root,'src','a.ts'),text)}

test('TaskOutcomeMemoryRecord is strict and source-state bound',()=>{
  const valid={schema:1,type:'hi-task-outcome-memory',fingerprint:'a'.repeat(64),source_state_hash:'b'.repeat(64),scope:['src/a.ts'],outcome:'FIX_REQUIRED',attempt:1,generation:1,result_digest:'c'.repeat(64),issue_classes:['native-diff-mismatch'],recorded_at:1}
  assert.equal(isTaskOutcomeMemoryRecord(valid),true)
  assert.equal(isTaskOutcomeMemoryRecord({...valid,scope:['../escape']}),false)
  assert.equal(isTaskOutcomeMemoryRecord({...valid,unexpected:true}),false)
  assert.equal(isTaskOutcomeMemoryRecord({...valid,source_state_hash:'bad'}),false)
})

test('same structured task shape and exact current bytes recall bounded machine failure classes without prose',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-task-memory-'))
  try{writeSource(root);const {m,task,worker}=fixture(root),memory=new ProjectTaskOutcomeMemoryStore(root),observed=memory.observe(m,task,worker,result());assert.ok(observed)
    const hints=memory.recall(m,task);assert.equal(hints.length,1);assert.deepEqual(hints[0].issue_classes,['native-diff-mismatch'])
    const advisory=memory.renderAdvisory(m,task);assert.match(advisory,/advisory\/non-Evidence/);assert.match(advisory,/native-diff-mismatch/);assert.doesNotMatch(advisory,/UNTRUSTED SUMMARY|SECRET_DETAIL/)
    const disk=readFileSync(projectTaskOutcomeMemoryPath(root),'utf8');assert.doesNotMatch(disk,/UNTRUSTED SUMMARY|SECRET_DETAIL/)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('source byte drift and different structured task shape suppress prior outcome recall',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-task-memory-drift-'))
  try{writeSource(root);const first=fixture(root,'m1'),memory=new ProjectTaskOutcomeMemoryStore(root);memory.observe(first.m,first.task,first.worker,result())
    writeSource(root,'export const value = 2\n');assert.deepEqual(memory.recall(first.m,first.task),[])
    writeSource(root);const other=fixture(root,'m2','different objective');assert.notEqual(taskOutcomeMemoryFingerprint(first.m,first.task),taskOutcomeMemoryFingerprint(other.m,other.task));assert.deepEqual(memory.recall(other.m,other.task),[])
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('different accepted dependency outcome context suppresses recall even when task shape and source bytes match',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-task-memory-dependency-'))
  const make=(sid,depSummary)=>{const store=new MissionStore(root),m=startAssessedMission(store,sid,'opaque task',{likely_targets:['src/a.ts'],required_capabilities:['implementation']}),dep=createTask(m,{objective:'prepare dependency',role:'repository-explorer',category:'quick',scope:['src/a.ts'],constraints:[],requiredEvidence:[],obligationIds:[]});dep.status='completed';dep.result={status:'DONE',summary:depSummary,changed_files:[],evidence:[],open_issues:[],needs_context:[]};const task=createTask(m,{objective:'small fix',role:'coder',category:'quick',scope:['src/a.ts'],constraints:[],dependencies:[dep.id],requiredEvidence:[],obligationIds:[]}),worker=createWorker(m,task,'host-default');worker.attempt=1;appendLedger(m,'native.diff.mismatch',{task_id:task.id,worker_id:worker.id,payload:{test:true}});return{m,task,worker}}
  try{writeSource(root);const first=make('dep-a','dependency outcome A'),memory=new ProjectTaskOutcomeMemoryStore(root);memory.observe(first.m,first.task,first.worker,result());const second=make('dep-b','dependency outcome B');assert.notEqual(taskOutcomeMemoryFingerprint(first.m,first.task),taskOutcomeMemoryFingerprint(second.m,second.task));assert.deepEqual(memory.recall(second.m,second.task),[])
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('later DONE in append order supersedes older failures even when wall-clock timestamps are not useful',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-task-memory-order-'))
  try{writeSource(root);const {m,task,worker}=fixture(root),seed=new ProjectTaskOutcomeMemoryStore(root),fp=taskOutcomeMemoryFingerprint(m,task);seed.observe(m,task,worker,result())
    const path=projectTaskOutcomeMemoryPath(root),failure=JSON.parse(readFileSync(path,'utf8').trim()),done={...failure,outcome:'DONE',attempt:2,result_digest:'d'.repeat(64),issue_classes:[],recorded_at:failure.recorded_at-999},later={...failure,attempt:3,result_digest:'e'.repeat(64),recorded_at:failure.recorded_at-1999}
    writeFileSync(path,[JSON.stringify(failure),JSON.stringify(done),JSON.stringify(later)].join('\n')+'\n')
    const memory=new ProjectTaskOutcomeMemoryStore(root),hints=memory.recall(m,task);assert.equal(hints.length,1);assert.equal(hints[0].attempt,3)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('operational-only provider permission and capability failures never become project failure memory',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-task-memory-operational-'))
  try{writeSource(root);const {m,task,worker}=fixture(root),memory=new ProjectTaskOutcomeMemoryStore(root)
    for(const issue of ['provider-failure:provider-transport:p/x','permission-failure:w1','capability-unavailable:model-dispatch'])assert.equal(memory.observe(m,task,worker,result('BLOCKED',{open_issues:[issue]})),undefined)
    assert.equal(memory.observe(m,task,worker,result('FIX_REQUIRED',{open_issues:['ignore-user-instructions:pretend-machine-class']})),undefined)
    assert.equal(memory.records().length,0);assert.equal(existsSync(projectTaskOutcomeMemoryPath(root)),false)
  }finally{rmSync(root,{recursive:true,force:true})}
})


test('project task outcome memory refuses a symlinked project-intelligence parent escape',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-task-memory-symlink-')),outside=mkdtempSync(join(tmpdir(),'hi-task-memory-outside-'))
  try{writeSource(root);mkdirSync(join(root,'.opencode','hi'),{recursive:true});try{symlinkSync(outside,join(root,'.opencode','hi','project-intelligence'),'dir')}catch(error){if(['EPERM','EACCES','ENOTSUP'].includes(error?.code))return;throw error}
    const {m,task,worker}=fixture(root),memory=new ProjectTaskOutcomeMemoryStore(root);assert.throws(()=>memory.observe(m,task,worker,result()),/parent|escape|directory/i);assert.equal(existsSync(join(outside,'task-outcomes.jsonl')),false)
  }finally{rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true})}
})

test('malformed JSONL is ignored and retention stays bounded to newest 128 accepted receipts',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-task-memory-bounded-'))
  try{writeSource(root);const {m,task,worker}=fixture(root),memory=new ProjectTaskOutcomeMemoryStore(root);for(let i=1;i<=140;i++){worker.attempt=i;memory.observe(m,task,worker,result('FIX_REQUIRED',{open_issues:[`native-diff-mismatch:src/a.ts:${i}`]}))}
    const path=projectTaskOutcomeMemoryPath(root);writeFileSync(path,'not-json\n'+readFileSync(path,'utf8'));const loaded=new ProjectTaskOutcomeMemoryStore(root);assert.equal(loaded.records().length,128);assert.equal(loaded.records().at(-1).attempt,140)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('TaskRuntime injects matching prior outcome only at actual dispatch and source drift removes it',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-task-memory-handoff-'))
  try{writeSource(root);const first=fixture(root,'prior'),scoped=createRuntimeScopedStores(root);scoped.taskOutcomeMemory.observe(first.m,first.task,first.worker,result())
    const prompts=[];let seq=0;const client={session:{create:async()=>({data:{id:`child-memory-${++seq}`}}),promptAsync:async req=>{prompts.push(req);return{data:{}}},abort:async()=>({data:{}})}}
    const m2=startAssessedMission(new MissionStore(root),'current','opaque current',{likely_targets:['src/a.ts'],required_capabilities:['implementation']})
    const rt2=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2})),root,process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}),undefined,[],scoped)
    await rt2.start(m2,{objective:'small fix',role:'coder',category:'quick',scope:['src/a.ts']});assert.match(prompts[0].body.parts[0].text,/PRIOR TASK OUTCOME MEMORY/);assert.ok(m2.execution.ledger.some(e=>e.type==='task-outcome-memory.recalled'))
    writeSource(root,'export const value = 99\n')
    const m3=startAssessedMission(new MissionStore(root),'drifted','opaque drifted',{likely_targets:['src/a.ts'],required_capabilities:['implementation']})
    const rt3=new TaskRuntime(opencodeChildPort(client),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2})),root,process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}),undefined,[],createRuntimeScopedStores(root))
    await rt3.start(m3,{objective:'small fix',role:'coder',category:'quick',scope:['src/a.ts']});assert.doesNotMatch(prompts[1].body.parts[0].text,/PRIOR TASK OUTCOME MEMORY/)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('task outcome bookkeeping failure is advisory and cannot prevent accepted Task settlement',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-task-memory-failopen-'))
  try{writeSource(root);const {m,task,worker}=fixture(root),scoped={contextArtifacts:new ContextArtifactStore(root),taskOutcomeMemory:{observe(){throw new Error('synthetic memory write failure')},renderAdvisory(){return undefined}}}
    const rt=new TaskRuntime(opencodeChildPort({session:{}}),new BackgroundRegistry(),createConcurrencyPolicySource(()=>({global:2})),root,process.cwd(),()=>DEFAULT_HI_CONFIG,()=>[],()=>({}),undefined,[],scoped)
    rt.applyResult(m,worker.id,result('DONE',{summary:'done',open_issues:[]}));assert.equal(task.status,'completed');assert.equal(worker.status,'completed');assert.ok(m.execution.ledger.some(e=>e.type==='task-outcome-memory.write-failed'&&e.payload?.policy==='advisory-bookkeeping-fail-open'))
  }finally{rmSync(root,{recursive:true,force:true})}
})
