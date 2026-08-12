import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {collectRepoContext} from '../dist/runtime/intent/repo-context.js'
import {normalizeIntent} from '../dist/runtime/intent/normalize.js'
import {verificationPolicyFor,verificationEconomyInstruction} from '../dist/runtime/verification/policy.js'

function repo(scripts){const root=mkdtempSync(join(tmpdir(),'hhc-ve-'));writeFileSync(join(root,'package.json'),JSON.stringify({scripts}));mkdirSync(join(root,'src'));return collectRepoContext(root)}

test('local low-risk bug fix requires targeted verification only, not repo-wide lint/build ceremony',()=>{
  const ctx=repo({test:'vitest run',lint:'eslint .',build:'tsc -b'})
  const intent=normalizeIntent('src/a.ts bugını düzelt test et',ctx)
  assert.deepEqual(intent.likelyVerification,['targeted-tests'])
  assert.deepEqual(verificationPolicyFor(intent).requiredKinds,['targeted-tests'])
})

test('high-risk auth bug strengthens verification with static and build checks when repo provides them',()=>{
  const ctx=repo({test:'vitest run',typecheck:'tsc --noEmit',build:'vite build',lint:'eslint .'})
  const intent=normalizeIntent('auth token bugını src/auth.ts içinde düzelt test et',ctx)
  assert.equal(intent.risk,'high')
  assert.deepEqual(intent.likelyVerification,['targeted-tests','typecheck','build'])
})

test('release-readiness requires repo-native test/static/build evidence instead of only changed-surface sanity',()=>{
  const ctx=repo({test:'vitest run',lint:'eslint .',build:'vite build'})
  const intent=normalizeIntent('release hazırlığını kontrol et',ctx)
  assert.equal(intent.taskKind,'release-readiness')
  assert.deepEqual(intent.likelyVerification,['targeted-tests','lint','build'])
})

test('placeholder npm test script is not treated as an available verifier',()=>{
  const ctx=repo({test:'echo "Error: no test specified" && exit 1',lint:'eslint .'})
  assert.deepEqual(ctx.likelyVerification,['lint'])
  const intent=normalizeIntent('release hazırlığını kontrol et',ctx)
  assert.deepEqual(intent.likelyVerification,['changed-surface-sanity','lint'])
})

test('local verification instruction explicitly rejects unnecessary full-suite expansion',()=>{
  const intent=normalizeIntent('src/a.ts bugını düzelt test et',repo({test:'vitest run',lint:'eslint .'}))
  const m={intent,risk:intent.risk,verification_policy:verificationPolicyFor(intent)}
  const text=verificationEconomyInstruction(m)
  assert.match(text,/smallest repo-native check/i)
  assert.match(text,/do not run a full repository suite/i)
})
