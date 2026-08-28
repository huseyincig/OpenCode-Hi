import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,writeFileSync,existsSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {RuntimePersistence} from '../dist/runtime/state/persistence.js'
import {classifyWorkerFailure} from '../dist/runtime/worker/failure-classifier.js'
import {runtimeModelCandidateStatus} from '../dist/runtime/routing/model-resolver.js'
import {resolveHiConfig} from '../dist/config/resolver.js'

test('injected provider timeout rate-limit and network failures are retryable transport failures, never reasoning stagnation',()=>{
  for(const text of ['provider timeout after 30s','429 upstream rate limit','network connection reset by peer']){
    const x=classifyWorkerFailure(text);assert.equal(x.kind,'provider-transport',text);assert.equal(x.retryable,true,text);assert.equal(x.stagnation,false,text)
  }
})

test('injected model-unavailable observation fails the runtime candidate check without fabricating compatibility',()=>{
  const status=runtimeModelCandidateStatus('p/missing',[{id:'p/available',provider:'p',writeCapable:true}],resolveHiConfig({}),{})
  assert.deepEqual(status,{ok:false,reason:'runtime-model-unavailable'})
})

test('injected tool error and permission deny preserve distinct bounded recovery classes',()=>{
  const tool=classifyWorkerFailure('tool unavailable for selected model');assert.equal(tool.kind,'tool-incompatibility');assert.equal(tool.retryable,true);assert.equal(tool.stagnation,false)
  const deny=classifyWorkerFailure('permission denied by host policy');assert.equal(deny.kind,'permission');assert.equal(deny.retryable,false);assert.equal(deny.stagnation,false)
})

test('injected disk write failure throws synchronously and never fabricates committed runtime state',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-q5-disk-')),prior=process.env.OPENCODE_HI_STATE_DIR
  try{
    const blocker=join(root,'state-root-file');writeFileSync(blocker,'x')
    process.env.OPENCODE_HI_STATE_DIR=blocker
    const p=new RuntimePersistence(root)
    assert.throws(()=>p.save([],true),/(ENOTDIR|not a directory)/i)
    assert.equal(existsSync(p.path),false)
  }finally{if(prior===undefined)delete process.env.OPENCODE_HI_STATE_DIR;else process.env.OPENCODE_HI_STATE_DIR=prior;rmSync(root,{recursive:true,force:true})}
})


test('exact OpenCode 1.18.20 named errors outrank legacy text heuristics',()=>{
  const auth=classifyWorkerFailure({name:'ProviderAuthError',message:'provider failed'});assert.deepEqual([auth.kind,auth.retryable,auth.stagnation],['permission',false,false])
  const overflow=classifyWorkerFailure({name:'ContextOverflowError',message:'maximum context length exceeded'});assert.deepEqual([overflow.kind,overflow.retryable,overflow.stagnation],['context-overflow',true,false])
  const retryable=classifyWorkerFailure({name:'APIError',message:'network_error',isRetryable:true,statusCode:503});assert.deepEqual([retryable.kind,retryable.retryable,retryable.stagnation],['provider-transport',true,false])
  const terminal4xx=classifyWorkerFailure({name:'APIError',message:'invalid request',isRetryable:false,statusCode:400});assert.deepEqual([terminal4xx.kind,terminal4xx.retryable,terminal4xx.stagnation],['provider-transport',false,false])
  const toolChoiceCompatibility=classifyWorkerFailure({name:'APIError',message:'Upstream request failed: [invalid_request_error] only `\"auto\"` is supported for `tool_choice`. `\"none\"`, `\"required\"`, and named function choices are not currently supported',isRetryable:false,statusCode:400});assert.deepEqual([toolChoiceCompatibility.kind,toolChoiceCompatibility.retryable,toolChoiceCompatibility.stagnation,toolChoiceCompatibility.reason],['provider-transport',true,false,'opencode-required-tool-choice-compatibility-fallback-eligible'])
  const thinkingToolChoiceCompatibility=classifyWorkerFailure({name:'APIError',message:'Upstream request failed: [invalid_request_error] Thinking mode does not support this tool_choice',isRetryable:false,statusCode:400});assert.deepEqual([thinkingToolChoiceCompatibility.kind,thinkingToolChoiceCompatibility.retryable,thinkingToolChoiceCompatibility.stagnation,thinkingToolChoiceCompatibility.reason],['provider-transport',true,false,'opencode-required-tool-choice-compatibility-fallback-eligible'])
  const selectedModelProviderUnavailable=classifyWorkerFailure({name:'APIError',message:"Upstream request failed: [404] No allowed providers are available for the selected model. Providers serving xiaomi/mimo-v2.5-20260422: gmicloud, deepinfra, xiaomi, but your request's provider.only preference permits only: tencent.",isRetryable:false,statusCode:404});assert.deepEqual([selectedModelProviderUnavailable.kind,selectedModelProviderUnavailable.retryable,selectedModelProviderUnavailable.stagnation,selectedModelProviderUnavailable.reason],['provider-transport',true,false,'opencode-selected-model-provider-unavailable-fallback-eligible'])
  const terminal5xx=classifyWorkerFailure({name:'APIError',message:'server error',isRetryable:false,statusCode:503});assert.deepEqual([terminal5xx.kind,terminal5xx.retryable,terminal5xx.stagnation],['provider-transport',true,false])
  const aborted=classifyWorkerFailure({name:'MessageAbortedError',message:'aborted'});assert.deepEqual([aborted.kind,aborted.retryable,aborted.stagnation],['unknown',false,false])
})
