import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { dispatchContinuation } from '../dist/runtime/continuation/dispatcher.js'
import { actionContract, approvePendingAuthority, requireAuthority } from '../dist/runtime/safety/authority.js'
import { verificationSatisfied } from '../dist/runtime/verification/policy.js'
import { registerTemporaryMutation } from '../dist/runtime/mutations/temporary-mutations.js'
import { evaluatePreconditions } from '../dist/runtime/readiness/preconditions.js'
import { resolveModel } from '../dist/runtime/routing/model-resolver.js'
import { parseWorkerResult } from '../dist/runtime/task/result-parser.js'
import {startAssessedMission} from './helpers/semantic.mjs'

test('T01 generic continuation cannot approve privileged action',()=>{const s=new MissionStore();const m=s.start('s','deploy the release');try{requireAuthority(m,'npm publish')}catch{}assert.equal(approvePendingAuthority(m,'devam et'),false);assert.equal(m.identity.status,'waiting-user')})
test('T02 exact approval remains bound to action hash',()=>{const s=new MissionStore();const m=s.start('s','deploy the release');try{requireAuthority(m,'npm publish','/tmp/a')}catch{}assert.ok(m.authority.authority?.pending);assert.notEqual(actionContract('npm publish','/tmp/a').hash,actionContract('npm publish','/tmp/b').hash)})
test('T03 explicit stop invalidates continuation generation',async()=>{const s=new MissionStore();const m=s.start('s','fix bug');const g=m.continuation.generation;s.stop('s');assert.ok(m.continuation.generation>g);let called=false;const ok=await dispatchContinuation({session:{promptAsync:async()=>{called=true}}},m,'continue','test');assert.equal(ok,false);assert.equal(called,false)})
test('T04 temporary mutation blocks readiness until rollback',()=>{const s=new MissionStore();const m=s.start('s','change local config');registerTemporaryMutation(m,{kind:'config',description:'temporary fixture',rollback_command:'git restore -- config.json'});const r=evaluatePreconditions(m);assert.ok(r.items.some(x=>x.id==='gate-temporary-rollback'&&x.status==='blocked'))})
test('T05 contract ambiguity is represented as blocked repo-first precondition',()=>{const s=new MissionStore();const m=startAssessedMission(s,'s','opaque contract task',{ambiguity:'contract-critical'});assert.equal(m.identity.intent.ambiguity,'contract-critical');assert.ok(evaluatePreconditions(m).items.some(x=>x.id==='gate-contract-ambiguity'&&x.status==='blocked'))})
test('T06 stale verification evidence does not satisfy completion policy',()=>{const s=new MissionStore();const m=s.start('s','fix bug');m.execution.evidence.fresh=false;assert.equal(verificationSatisfied(m).ok,false)})
test('T07 role output aliases normalize without false failure',()=>{assert.equal(parseWorkerResult('STATUS: PASS\nFINDINGS: reviewed').status,'DONE');assert.equal(parseWorkerResult('STATUS: USER_ACTION_REQUIRED\nFINDINGS: MFA needed').status,'BLOCKED');assert.equal(parseWorkerResult('STATUS: NO_PROGRESS\nFINDINGS: same failure').status,'FIX_REQUIRED')})
test('T07b markdown-decorated canonical worker status remains parseable without accepting free text',()=>{const r=parseWorkerResult('**STATUS: PASS**\n\n**FINDINGS:** Reviewed exact schema value.');assert.equal(r.status,'DONE');assert.match(r.summary,/Reviewed exact schema value/);assert.equal(parseWorkerResult('Review looks good; PASS overall').status,'FAILED')})
test('T08 host-default compatibility route exists only without constrained inventory',()=>{const cfg={routing:{allowedProviders:[],deniedModels:[],roleModels:{},categoryModels:{},strategy:'cost-quality',maxFallbacks:2}};const r=resolveModel('standard',[],cfg);assert.equal(r.primary,'host-default')})
test('T09 fallback reasons are explicit',()=>{const cfg={routing:{allowedProviders:[],deniedModels:[],roleModels:{},categoryModels:{},strategy:'cost-quality',maxFallbacks:2}};const r=resolveModel('standard',[{id:'a',quality:2},{id:'b',quality:1}],cfg);assert.equal(r.fallbackReasons.length,1);assert.equal(r.fallbackReasons[0].model,'b')})
test('T10 stopped mission cannot be complete',()=>{const s=new MissionStore();const m=s.start('s','fix bug');s.stop('s');assert.equal(m.continuation.user_interrupted,true);assert.equal(m.identity.status,'stopped')})
