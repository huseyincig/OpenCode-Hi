import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {collectRepoContext} from '../dist/runtime/intent/repo-context.js'
import {verificationPolicyFor,verificationEconomyInstruction} from '../dist/runtime/verification/policy.js'

function repo(scripts){const root=mkdtempSync(join(tmpdir(),'hi-ve-'));writeFileSync(join(root,'package.json'),JSON.stringify({scripts}));mkdirSync(join(root,'src'));return collectRepoContext(root)}
function intent(overrides={}){return{objective:'opaque',taskKind:'bug-fix',scope:'local',risk:'low',ambiguity:'none',dependencyClass:'independent',requiredCapabilities:['implementation'],requestedExternalActions:[],likelyVerification:['targeted-tests'],avoid:[],...overrides}}

test('local low-risk bug fix keeps only structured targeted verification requirement',()=>{const i=intent();assert.deepEqual(verificationPolicyFor(i).requiredKinds,['targeted-tests'])})
test('empty material verification assessment gets a minimum changed-surface contract',()=>{const i=intent({likelyVerification:[]});assert.deepEqual(verificationPolicyFor(i).requiredKinds,['changed-surface-sanity'])})
test('empty review verification assessment gets review evidence rather than generic code checks',()=>{const i=intent({taskKind:'review',requiredCapabilities:['review'],likelyVerification:[]});assert.deepEqual(verificationPolicyFor(i).requiredKinds,['review-evidence'])})
test('high-risk assessment can require targeted static and build evidence explicitly',()=>{const i=intent({risk:'high',likelyVerification:['targeted-tests','typecheck','build']});assert.deepEqual(verificationPolicyFor(i).requiredKinds,['targeted-tests','typecheck','build'])})
test('release-readiness verification is explicit bounded state rather than prose inference',()=>{const i=intent({taskKind:'release-readiness',risk:'medium',likelyVerification:['targeted-tests','lint','build']});assert.deepEqual(verificationPolicyFor(i).requiredKinds,['targeted-tests','lint','build'])})
test('repository context does not treat placeholder npm test as an available verifier',()=>{const ctx=repo({test:'echo "Error: no test specified" && exit 1',lint:'eslint .'});assert.deepEqual(ctx.likelyVerification,['lint'])})
test('local verification instruction explicitly rejects unnecessary full-suite expansion',()=>{const i=intent(),m={identity:{intent:i,risk:i.risk},execution:{verification_policy:verificationPolicyFor(i)}};const text=verificationEconomyInstruction(m);assert.match(text,/smallest repo-native check/i);assert.match(text,/do not run a full repository suite/i)})

test('task-owned review evidence instruction excludes unrelated mission visual verification',()=>{const i=intent({requiredCapabilities:['implementation','security-review','visual-qa'],likelyVerification:['visual-check']}),m={identity:{intent:i,risk:i.risk},execution:{verification_policy:verificationPolicyFor(i)}};assert.match(verificationEconomyInstruction(m,['review-evidence']),/review-evidence/);assert.doesNotMatch(verificationEconomyInstruction(m,['review-evidence']),/visual-check/)})
test('explicit empty task evidence contract never inherits mission verification',()=>{const i=intent({likelyVerification:['visual-check']}),m={identity:{intent:i,risk:i.risk},execution:{verification_policy:verificationPolicyFor(i)}};assert.match(verificationEconomyInstruction(m,[]),/Task evidence contract: none/i);assert.doesNotMatch(verificationEconomyInstruction(m,[]),/visual-check/)})
