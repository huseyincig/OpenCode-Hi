import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,writeFileSync,existsSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {RuntimePersistence} from '../dist/runtime/state/persistence.js'
import {classifyWorkerFailure} from '../dist/runtime/worker/failure-classifier.js'
import {runtimeModelCandidateStatus} from '../dist/runtime/routing/model-resolver.js'
import {resolveHiConfig} from '../dist/config/resolver.js'

test('Q5 injected provider timeout rate-limit and network failures are retryable transport failures, never reasoning stagnation',()=>{
  for(const text of ['provider timeout after 30s','429 upstream rate limit','network connection reset by peer']){
    const x=classifyWorkerFailure(text);assert.equal(x.kind,'provider-transport',text);assert.equal(x.retryable,true,text);assert.equal(x.stagnation,false,text)
  }
})

test('Q5 injected model-unavailable observation fails the runtime candidate check without fabricating compatibility',()=>{
  const status=runtimeModelCandidateStatus('p/missing',[{id:'p/available',provider:'p',writeCapable:true}],resolveHiConfig({}),{})
  assert.deepEqual(status,{ok:false,reason:'runtime-model-unavailable'})
})

test('Q5 injected tool error and permission deny preserve distinct bounded recovery classes',()=>{
  const tool=classifyWorkerFailure('tool unavailable for selected model');assert.equal(tool.kind,'tool-incompatibility');assert.equal(tool.retryable,true);assert.equal(tool.stagnation,false)
  const deny=classifyWorkerFailure('permission denied by host policy');assert.equal(deny.kind,'permission');assert.equal(deny.retryable,false);assert.equal(deny.stagnation,false)
})

test('Q5 injected disk write failure throws synchronously and never fabricates committed runtime state',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-q5-disk-')),prior=process.env.OPENCODE_HI_STATE_DIR
  try{
    const blocker=join(root,'state-root-file');writeFileSync(blocker,'x')
    process.env.OPENCODE_HI_STATE_DIR=blocker
    const p=new RuntimePersistence(root)
    assert.throws(()=>p.save([],true),/(ENOTDIR|not a directory)/i)
    assert.equal(existsSync(p.path),false)
  }finally{if(prior===undefined)delete process.env.OPENCODE_HI_STATE_DIR;else process.env.OPENCODE_HI_STATE_DIR=prior;rmSync(root,{recursive:true,force:true})}
})
