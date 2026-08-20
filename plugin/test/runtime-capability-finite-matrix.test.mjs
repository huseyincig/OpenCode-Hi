import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {evaluateIdle,shouldCountStagnation} from '../dist/runtime/continuation/evaluator.js'
import {startAssessedMission} from './helpers/semantic.mjs'

function mission(id){return startAssessedMission(new MissionStore(process.cwd()),id,'finite capability matrix',{likely_verification:[]})}

test('non-recoverable operational blockers are terminal and never synthesize another continuation',()=>{
  const blockers=[
    'dependency-unavailable:t-prereq',
    'workspace-orphan:lease-1',
    'workspace-reintegration-failed:t1',
    'queue-overflow-cleanup-failed:t1',
    'browser-cleanup-failed:t1:w1',
    'process-cleanup:p1',
    'scheduler-restart-reconcile-failed:w1',
  ]
  for(const blocker of blockers){const m=mission(`matrix-${blocker.split(':')[0]}`);m.execution.blockers.push(blocker);const d=evaluateIdle(m);assert.equal(d.decision,'USER_ACTION_REQUIRED',blocker);assert.equal(d.reason_code,'operational-blocker',blocker);assert.equal(d.reason,blocker);assert.equal(d.prompt,undefined);assert.equal(shouldCountStagnation(d),false)}
})

test('capability/provider/permission blockers are terminal while legitimate live waits remain non-stagnating',()=>{
  for(const blocker of ['capability-unavailable:browser-execution','capability-unavailable:model-dispatch','capability-precondition:coder:native-child-prompt']){const m=mission(`cap-${blocker.length}`);m.execution.blockers.push(blocker);const d=evaluateIdle(m);assert.equal(d.decision,'USER_ACTION_REQUIRED');assert.equal(d.reason_code,'capability-unavailable');assert.equal(d.prompt,undefined)}
  const provider=mission('provider');provider.execution.blockers.push('provider-failure:provider-transport:p/m');assert.equal(evaluateIdle(provider).reason_code,'provider-failure-blocked')
  const permission=mission('permission-fail');permission.execution.blockers.push('permission-failure:w1');assert.equal(evaluateIdle(permission).reason_code,'permission-failure-blocked')
  const waits=[mission('wait-permission'),mission('wait-worker'),mission('wait-process')];waits[0].authority.pending_permissions=1;waits[1].execution.workers.push({id:'w1',task_id:'t1',role:'coder',category:'standard',parent_session_id:'wait-worker',parent_mission_id:waits[1].identity.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'busy',generation_at_spawn:waits[1].continuation.generation});waits[2].execution.processes.push({process_id:'p1',mission_id:waits[2].identity.mission_id,task_id:'t1',worker_id:'w1',command:'node',args:[],cwd:process.cwd(),status:'RUNNING',started_at:Date.now(),cleanup_state:'ACTIVE',runtime_owner_ref:'x',launch_fingerprint:'x'})
  for(const m of waits){for(let i=0;i<5;i++){const d=evaluateIdle(m);assert.equal(d.decision,'WAIT');assert.equal(shouldCountStagnation(d),false)}assert.equal(m.continuation.stagnation_count,0)}
})

test('session-abort safety blocker outranks a busy worker so unavailable quiescence cannot become infinite WAIT',()=>{
  const m=mission('abort-outranks-wait');m.execution.workers.push({id:'w1',task_id:'t1',role:'coder',category:'standard',parent_session_id:m.identity.session_id,parent_mission_id:m.identity.mission_id,fallbacks:[],selected_methodologies:[],loaded_methodologies:[],methodologies:[],fingerprint:'f',status:'busy',generation_at_spawn:m.continuation.generation});m.execution.blockers.push('capability-unavailable:session-abort')
  const d=evaluateIdle(m);assert.equal(d.decision,'USER_ACTION_REQUIRED');assert.equal(d.reason_code,'capability-unavailable');assert.equal(d.reason,'capability-unavailable:session-abort');assert.equal(d.prompt,undefined)
})
