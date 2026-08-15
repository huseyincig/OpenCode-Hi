import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {RuntimePersistence} from '../dist/runtime/state/persistence.js'
import {appendLedger} from '../dist/runtime/ledger/ledger.js'
import {actionContract,approvePendingAuthority,beginAuthorizedAction,requireAuthority} from '../dist/runtime/safety/authority.js'
import {ProcessRuntime} from '../dist/runtime/process/runtime.js'
import {ProcessSpawnPermissionError} from '../dist/opencode/open-code-pty-adapter.js'
import {createTask,createWorker} from '../dist/runtime/worker/worker-runtime.js'
import {createSystemTransformHook} from '../dist/hooks/system-transform.js'
import {registerTemporaryMutation,resolveRollback} from '../dist/runtime/mutations/temporary-mutations.js'
import {ChildExecutionCoordinator} from '../dist/runtime/task/child-execution-coordinator.js'
import {authorityProtocolResponse} from './helpers/authority.mjs'
import {startAssessedMission} from './helpers/semantic.mjs'

const SECRET='ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456'
const TOKEN='vercel_token_ABCDEFGHIJKLMNOPQRSTUVWXYZ'
function processMission(){
  const store=new MissionStore(),m=startAssessedMission(store,'sec-process','deploy',{task_kind:'release-readiness',scope:'external',risk:'authority-boundary',requested_external_actions:['deploy']})
  const task=createTask(m,{objective:'deploy',role:'coder',category:'critical',scope:[],requiredEvidence:[]}),worker=createWorker(m,task,'host-default');worker.status='busy';task.status='running'
  return{store,m,worker}
}

test('PROMPT B ProcessRuntime blocks secret-sensitive external action before Authority state mutation',async()=>{
  const {m,worker}=processMission();let spawned=false
  const runtime=new ProcessRuntime({spawn:async()=>{spawned=true;throw new Error('must not spawn')},write:async()=>{},read:async()=>({text:'',start_cursor:0,end_cursor:0,available_start_cursor:0,available_end_cursor:0,truncated:false,status:'RUNNING'}),wait:async()=>{throw new Error('unused')},kill:async()=>{throw new Error('unused')},cleanup:async()=>{},reconcile:async()=>{throw new Error('unused')}},process.cwd(),()=>({agent:{coder:{permission:{bash:{'*':'allow'}}}}}))
  await assert.rejects(()=>runtime.spawn(m,{worker_id:worker.id,command:'vercel',args:['deploy','--token',TOKEN],cwd:process.cwd()}),e=>e instanceof ProcessSpawnPermissionError&&e.decision==='ASK')
  assert.equal(spawned,false);assert.equal(m.authority.authority,undefined);assert.doesNotMatch(JSON.stringify(m),new RegExp(TOKEN))
})

test('PROMPT B durable Authority descriptors preserve raw hash identity without persisting secret values',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-sec-auth-'))
  try{
    const store=new MissionStore(root),m=startAssessedMission(store,'sec-auth','deploy',{task_kind:'release-readiness',scope:'external',risk:'authority-boundary',requested_external_actions:['deploy']})
    const command=`vercel deploy --token ${TOKEN}`,raw=actionContract(command,root)
    assert.throws(()=>requireAuthority(m,command,root),/explicit approval required/)
    assert.equal(m.authority.authority?.pending?.hash,raw.hash);assert.doesNotMatch(m.authority.authority?.pending?.action??'',new RegExp(TOKEN));assert.match(m.authority.authority?.pending?.action??'',/<HI_REDACTED_SECRET>/)
    assert.equal(approvePendingAuthority(m,authorityProtocolResponse(m,'approve')),true);beginAuthorizedAction(m,command,root)
    assert.equal(m.authority.authority?.executing?.hash,raw.hash);assert.doesNotMatch(m.authority.authority?.executing?.action??'',new RegExp(TOKEN))
    const persistence=new RuntimePersistence(root);persistence.save(store.all(),true);assert.doesNotMatch(readFileSync(persistence.path,'utf8'),new RegExp(TOKEN))
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('PROMPT B durable ledger redacts nested tokens, bearer credentials and CLI secret flags',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-sec-ledger-'))
  try{
    const store=new MissionStore(root),m=store.start('sec-ledger','audit')
    appendLedger(m,'host.error',{payload:{error:`Authorization: Bearer ${SECRET}`,nested:{command:`vercel deploy --token ${TOKEN}`,token:SECRET}}})
    const raw=JSON.stringify(m.execution.ledger);assert.doesNotMatch(raw,new RegExp(SECRET));assert.doesNotMatch(raw,new RegExp(TOKEN));assert.match(raw,/<HI_REDACTED_SECRET>/)
    const persistence=new RuntimePersistence(root);persistence.save(store.all(),true);const disk=readFileSync(persistence.path,'utf8');assert.doesNotMatch(disk,new RegExp(SECRET));assert.doesNotMatch(disk,new RegExp(TOKEN))
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('PROMPT B provider child prompt and system runtime projection redact secret-bearing context',async()=>{
  let sent='';const client={session:{promptAsync:async req=>{sent=String(req?.body?.parts?.[0]?.text??'')}}}
  await new ChildExecutionCoordinator(client).sendProviderPrompt('child',`diagnose token=${SECRET}`)
  assert.doesNotMatch(sent,new RegExp(SECRET));assert.match(sent,/<HI_REDACTED_1>/)
  const store=new MissionStore(),m=startAssessedMission(store,'sec-system',`fix token=${SECRET}`);m.execution.constraints.push(`use api_key=${SECRET}`)
  const output={system:[]};await createSystemTransformHook(store)({sessionID:'sec-system'},output)
  const system=output.system.join('\n');assert.doesNotMatch(system,new RegExp(SECRET));assert.match(system,/<HI_REDACTED_/)
})


test('PROMPT B temporary mutation durable state rejects secret rollback commands and redacts durable descriptions/details',()=>{
  const store=new MissionStore(),m=store.start('sec-temp','temp mutation')
  assert.throws(()=>registerTemporaryMutation(m,{kind:'env',description:'rollback',rollback_command:`vercel logout --token ${TOKEN}`}),/must not contain credentials/)
  const item=registerTemporaryMutation(m,{kind:'env',description:`cleanup token=${SECRET}`,rollback_command:'git restore -- config.json'})
  assert.doesNotMatch(item.description,new RegExp(SECRET));resolveRollback(m,item,false,`Bearer ${SECRET}`);assert.doesNotMatch(item.detail??'',new RegExp(SECRET));assert.doesNotMatch(JSON.stringify(m),new RegExp(SECRET))
})


test('PROMPT B process environment is execution-ephemeral and never enters durable ProcessContract or ledger',async()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'sec-env','run process')
  const task=createTask(m,{objective:'run',role:'coder',category:'standard',scope:[],requiredEvidence:[]}),worker=createWorker(m,task,'host-default');worker.status='busy';task.status='running'
  let captured
  const executor={spawn:async req=>{captured=structuredClone(req);return{contract:{process_id:'proc_sec_env',mission_id:req.mission_id,task_id:req.task_id,worker_id:req.worker_id,host:'opencode',command_identity:'a'.repeat(64),cwd:req.cwd,pid:4242,status:'RUNNING',started_at:Date.now(),output_artifact_refs:[],authority_ref:req.authority_ref,cleanup_state:'ACTIVE'},host_process_id:'pty-sec'}},write:async()=>{},read:async()=>({text:'',start_cursor:0,end_cursor:0,available_start_cursor:0,available_end_cursor:0,truncated:false,status:'RUNNING'}),wait:async()=>{throw new Error('unused')},kill:async()=>{throw new Error('unused')},cleanup:async()=>{},reconcile:async()=>{throw new Error('unused')}}
  const runtime=new ProcessRuntime(executor,process.cwd(),()=>({agent:{coder:{permission:{bash:{'*':'allow'}}}}}))
  await runtime.spawn(m,{worker_id:worker.id,command:'node',args:['-e','1'],cwd:process.cwd(),env:{API_TOKEN:SECRET}})
  assert.equal(captured.env.API_TOKEN,SECRET,'env may reach the exact native executor only in-memory')
  const durable=JSON.stringify({processes:m.execution.processes,ledger:m.execution.ledger});assert.doesNotMatch(durable,new RegExp(SECRET));assert.equal('env' in m.execution.processes[0],false)
})
