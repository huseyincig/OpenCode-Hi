import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const read=(p)=>readFileSync(join(ROOT,p),'utf8')
const taskRuntime=read('plugin/src/runtime/task/task-runtime.ts')
const child=read('plugin/src/runtime/task/child-execution-coordinator.ts')
const result=read('plugin/src/runtime/task/task-result-reconciler.ts')
const recovery=read('plugin/src/runtime/task/task-recovery-coordinator.ts')
const events=read('plugin/src/runtime/application/runtime-event-controller.ts')

test('A2 TaskRuntime remains the canonical façade over exactly three extracted collaborators',()=>{
  assert.match(taskRuntime,/readonly #child:ChildExecutionCoordinator/)
  assert.match(taskRuntime,/readonly #results:TaskResultReconciler/)
  assert.match(taskRuntime,/readonly #recovery:TaskRecoveryCoordinator/)
  assert.match(taskRuntime,/applyResult\([^]*?this\.#results\.applyResult/)
  assert.match(taskRuntime,/recoverRuntimeFailure\([^]*?this\.#recovery\.recoverRuntimeFailure/)
  assert.match(taskRuntime,/noteEffectiveModel\([^]*?this\.#child\.noteEffectiveModel/)
  assert.doesNotMatch(child,/new MissionStore|MissionState\[\]|Map<[^>]*Task/)
  assert.doesNotMatch(result,/new MissionStore|MissionState\[\]|Map<[^>]*Task/)
  assert.doesNotMatch(recovery,/new MissionStore|MissionState\[\]|Map<[^>]*Task/)
})

test('A2 child execution coordinator owns host-facing child lifecycle and callback identity only',()=>{
  for(const anchor of ['resolveCallbackWorker','async create(','sendProviderPrompt(','abortNativeSession(','captureNativeDiff(','noteEffectiveModel('])assert.ok(child.includes(anchor),anchor)
  assert.doesNotMatch(child,/resolveModel\(|createTask\(|createWorker\(|RuntimePersistence/)
})

test('A2 result reconciler owns result/diff/evidence reconciliation without a second task store',()=>{
  for(const anchor of ['reconcileNativeResult(','noteNativeWriteSet(','applyResult(','addEvidence(','replanVerificationForChangedSurface('])assert.ok(result.includes(anchor),anchor)
  assert.doesNotMatch(result,/createTask\(|createWorker\(|RuntimePersistence|new MissionStore/)
})

test('A2 recovery coordinator owns retry/fallback and stale callback quarantine decisions',()=>{
  for(const anchor of ['callbackDisposition(','recoverStagnation(','recoverRuntimeFailure(','fail('])assert.ok(recovery.includes(anchor),anchor)
  assert.match(events,/tasks\.resolveChildCallback\(sid\)/)
  assert.match(events,/tasks\.childCallbackDisposition\(mission,child\)/)
  assert.doesNotMatch(events,/generation_at_spawn!==undefined&&child\.generation_at_spawn!==mission\.generation/)
})
