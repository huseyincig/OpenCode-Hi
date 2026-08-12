import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveModel } from '../dist/runtime/routing/model-resolver.js'
import { auditHiToolNamespace } from '../dist/opencode/tool-namespace.js'
import { providerPolicyView } from '../dist/opencode/native-adapter.js'
import { classifyWorkerFailure } from '../dist/runtime/worker/failure-classifier.js'
import { auditNativeAgentReuse } from '../dist/runtime/routing/agent-reuse.js'
import { nativeFirstTaskDecision } from '../dist/runtime/task/native-first-policy.js'

const baseConfig={routing:{allowedProviders:[],deniedModels:[],roleModels:{},categoryModels:{},categoryVariants:{},strategy:'cost-quality',maxFallbacks:3}}

test('Native-08 Hi tools cannot shadow native tool names',()=>{
  assert.equal(auditHiToolNamespace(['hi_task_start','hi_status']).ok,true)
  assert.equal(auditHiToolNamespace(['task']).ok,false)
})

test('Native-10 provider policy deny removes an otherwise available model',()=>{
  const host={policy:{provider:{use:{blocked:'deny',ok:'allow'}}}}
  const r=resolveModel('standard',[{id:'blocked/m1',provider:'blocked',quality:10},{id:'ok/m2',provider:'ok',quality:1}],baseConfig,undefined,undefined,host)
  assert.equal(r.primary,'ok/m2')
  assert.ok(r.rejected.some(x=>x.id==='blocked/m1'&&x.reason.includes('opencode-provider-policy-deny')))
})

test('Native-11 deep category selects a host-exposed high reasoning variant',()=>{
  const r=resolveModel('deep',[{id:'p/m',provider:'p',quality:2,variants:['low','medium','high']}],baseConfig)
  assert.equal(r.primary,'p/m')
  assert.equal(r.primaryVariant,'high')
})

test('provider policy adapter understands effective allow and deny decisions',()=>{
  const x=providerPolicyView({enabled_providers:['p1','p2'],policy:{provider:{use:{p2:'deny'}}}})
  assert.equal(x.allowed.has('p1'),true); assert.equal(x.denied.has('p2'),true)
})

test('Native-04 provider failure is not reasoning stagnation',()=>{
  const x=classifyWorkerFailure('429 upstream provider rate limit')
  assert.equal(x.kind,'provider-transport');assert.equal(x.stagnation,false);assert.equal(x.retryable,true)
})

test('Native-first agent reuse audit rejects persona explosion by default',()=>{
  assert.equal(auditNativeAgentReuse('coder').decision,'hi-custom-required')
  assert.equal(auditNativeAgentReuse('generic-librarian').decision,'native-reuse-preferred')
})

test('Native command vs Hi task split remains explicit',()=>{
  assert.equal(nativeFirstTaskDecision('static-repeatable').preferred,'opencode-command-subtask')
  assert.equal(nativeFirstTaskDecision('dynamic-mission').preferred,'hi-task-adapter')
})
