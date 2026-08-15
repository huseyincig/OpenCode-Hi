import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync,readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isProcessContract,processCommandIdentity } from '../dist/contracts/process.js'
import { openCodeHostCapabilityContracts,hostCapabilityByID } from '../dist/contracts/host-capability.js'

const H=processCommandIdentity({host:'opencode',command:'npm test',cwd:'/repo'})
const base={process_id:'proc_abc123',mission_id:'m_abc123',task_id:'t_abc123',worker_id:'w_abc123',host:'opencode',command_identity:H,cwd:'/repo',pid:1234,status:'RUNNING',started_at:1000,output_artifact_refs:[],authority_ref:'permission:opencode:bash:allow',cleanup_state:'ACTIVE'}

test('P1 ProcessContract accepts bounded running and terminal lifecycle states',()=>{
  assert.equal(isProcessContract(base),true)
  assert.equal(isProcessContract({...base,process_group_id:1234,timeout_at:5000}),true)
  assert.equal(isProcessContract({...base,status:'EXITED',ended_at:2000,exit_code:0,cleanup_state:'CLEANUP_PENDING'}),true)
  assert.equal(isProcessContract({...base,status:'EXITED',ended_at:2000,exit_code:7,cleanup_state:'CLEANED',output_artifact_refs:['hi-artifact:a_123']}),true)
  assert.equal(isProcessContract({...base,status:'TIMED_OUT',ended_at:5000,timeout_at:5000,termination_reason:'timeout-policy',cleanup_state:'CLEANUP_PENDING'}),true)
  assert.equal(isProcessContract({...base,status:'TERMINATED',ended_at:2500,termination_reason:'user-stop',cleanup_state:'CLEANED'}),true)
  assert.equal(isProcessContract({...base,status:'ORPHANED',termination_reason:'restart-owner-unverified',cleanup_state:'QUARANTINED'}),true)
  assert.equal(isProcessContract({...base,status:'ORPHANED',ended_at:3000,termination_reason:'restart-owner-unverified',cleanup_state:'QUARANTINED'}),true)
})

test('P1 command identity is deterministic and binds host cwd and command without persisting raw command',()=>{
  const same=processCommandIdentity({host:'opencode',command:' npm test ',cwd:' /repo '})
  assert.equal(same,H);assert.match(H,/^[a-f0-9]{64}$/)
  assert.notEqual(H,processCommandIdentity({host:'opencode',command:'npm test -- changed',cwd:'/repo'}))
  assert.notEqual(H,processCommandIdentity({host:'opencode',command:'npm test',cwd:'/other'}))
  assert.notEqual(H,processCommandIdentity({host:'other-host',command:'npm test',cwd:'/repo'}))
  assert.throws(()=>processCommandIdentity({host:'opencode',command:' ',cwd:'/repo'}),/non-empty/)
})

test('P1 ProcessContract rejects raw or unbounded output fields and malformed identity fields',()=>{
  for(const key of ['stdout','stderr','output','raw_output','buffer'])assert.equal(isProcessContract({...base,[key]:'x'.repeat(10000)}),false,key)
  assert.equal(isProcessContract({...base,command_identity:'npm test'}),false)
  assert.equal(isProcessContract({...base,pid:0}),false)
  assert.equal(isProcessContract({...base,pid:1.5}),false)
  assert.equal(isProcessContract({...base,process_group_id:0}),false)
  assert.equal(isProcessContract({...base,authority_ref:''}),false)
  assert.equal(isProcessContract({...base,output_artifact_refs:['a','a']}),false)
  assert.equal(isProcessContract({...base,output_artifact_refs:Array.from({length:65},(_,i)=>`a${i}`)}),false)
})

test('P1 ProcessContract enforces lifecycle timestamp exit and cleanup coherence',()=>{
  assert.equal(isProcessContract({...base,ended_at:2000}),false,'RUNNING cannot be ended')
  assert.equal(isProcessContract({...base,exit_code:0}),false,'RUNNING cannot carry exit code')
  assert.equal(isProcessContract({...base,termination_reason:'killed'}),false,'RUNNING cannot be terminal')
  assert.equal(isProcessContract({...base,status:'EXITED',ended_at:2000,cleanup_state:'CLEANUP_PENDING'}),false,'EXITED requires exit code')
  assert.equal(isProcessContract({...base,status:'EXITED',ended_at:2000,exit_code:0,termination_reason:'signal',cleanup_state:'CLEANUP_PENDING'}),false)
  assert.equal(isProcessContract({...base,status:'TIMED_OUT',ended_at:2000,termination_reason:'timeout',cleanup_state:'CLEANUP_PENDING'}),false,'timeout needs timeout_at')
  assert.equal(isProcessContract({...base,status:'TIMED_OUT',ended_at:2000,timeout_at:1500,termination_reason:'timeout',exit_code:1,cleanup_state:'CLEANUP_PENDING'}),false)
  assert.equal(isProcessContract({...base,status:'TERMINATED',ended_at:2000,cleanup_state:'CLEANUP_PENDING'}),false,'termination needs reason')
  assert.equal(isProcessContract({...base,status:'ORPHANED',ended_at:2000,termination_reason:'owner missing',cleanup_state:'CLEANUP_PENDING'}),false,'orphan must quarantine')
  assert.equal(isProcessContract({...base,status:'EXITED',ended_at:999,exit_code:0,cleanup_state:'CLEANUP_PENDING'}),false,'end cannot precede start')
  assert.equal(isProcessContract({...base,status:'EXITED',ended_at:2000,exit_code:0,cleanup_state:'ACTIVE'}),false,'terminal process cannot remain ACTIVE cleanup')
  assert.equal(isProcessContract({...base,cleanup_state:'CLEANED'}),false,'running process cannot be cleaned')
})

test('P1 runtime capability requires live process observation while T3 remains external receipt truth',()=>{
  const all={childSessions:true,asyncPrompt:true,syncPrompt:true,abort:true,providerInventory:true,appLog:true,sessionStatus:true,childSessionList:true,sessionTodo:true,sessionDiff:true,sessionFork:true,sessionSummarize:true,sessionRevert:true,sessionUnrevert:true}
  const capability=hostCapabilityByID(openCodeHostCapabilityContracts(all,{processLifecycle:true}),'process-lifecycle')
  assert.equal(capability?.status,'SUPPORTED')
  assert.equal(capability?.verification_level,'OBSERVED')
  assert.equal(capability?.semantic_loss.length,0)
  const hosts=readFileSync(new URL('../../docs/HOSTS.md',import.meta.url),'utf8')
  const architecture=readFileSync(new URL('../../docs/ARCHITECTURE.md',import.meta.url),'utf8')
  assert.match(hosts,/ProcessExecutor/i)
  assert.match(hosts,/`process-lifecycle` is `SUPPORTED`/)
  assert.match(architecture,/contains no raw stdout\/stderr buffer/)
  const roots=[fileURLToPath(new URL('../src/runtime',import.meta.url)),fileURLToPath(new URL('../src/opencode',import.meta.url))]
  const source=roots.flatMap(root=>readdirSync(root,{recursive:true}).filter(x=>typeof x==='string'&&x.endsWith('.ts')).map(x=>readFileSync(join(root,String(x)),'utf8'))).join('\n')
  assert.match(source,/interface\s+ProcessExecutor/)
  assert.match(source,/class\s+OpenCodePtyAdapter/)
})
