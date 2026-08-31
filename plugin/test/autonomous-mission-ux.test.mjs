import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {appendLedger} from '../dist/runtime/ledger/ledger.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {autonomousMissionUxView,formatAutonomousMissionStatus} from '../dist/runtime/ux/autonomous-mission.js'

function mission(id='ux') { return startAssessedMission(new MissionStore(process.cwd()),id,'show autonomous mission state',{task_kind:'analysis',required_capabilities:['analysis']}) }

test('Autonomous Mission UX is a bounded projection over canonical control/runtime owners',()=>{
  const m=mission(),view=autonomousMissionUxView(m,process.cwd())
  assert.equal(view.mission_id,m.identity.mission_id)
  assert.equal(view.claim_boundary,'derived-from-canonical-runtime')
  assert.equal(view.user_controls.settings_owner,'hi_settings')
  assert.equal(view.user_controls.decision_owner,'HumanDecisionContract')
  assert.equal(view.user_controls.completion_owner,'MissionStore/evaluateCompletion')
  assert.equal('setStatus' in view,false);assert.equal('approve' in view,false);assert.equal('persist' in view,false)
})

test('Autonomous Mission UX recomputes after canonical state changes instead of retaining UI cache truth',()=>{
  const m=mission('ux-recompute'),before=autonomousMissionUxView(m,process.cwd())
  m.execution.blockers.push('environment:blocked')
  const after=autonomousMissionUxView(m,process.cwd())
  assert.notDeepEqual(after.blockers,before.blockers)
  assert.ok(after.blockers.some(x=>x.includes('environment:blocked')))
  assert.notStrictEqual(after,before)
})

test('default mission status preserves compact compatibility line and adds bounded goal-oriented state',()=>{
  const m=mission('ux-status')
  m.execution.blockers.push('environment:blocked')
  const status=formatAutonomousMissionStatus(m,process.cwd())
  assert.match(status,/^Hi:/)
  assert.match(status,/obligation open/)
  assert.match(status,/next /)
  assert.match(status,/\nGoal: show autonomous mission state/)
  assert.match(status,/\nNow: /)
  assert.match(status,/\nControl: (?:WAIT|VERIFY|RECONCILE|USER_ACTION_REQUIRED|CONTINUE|DONE) · /)
  assert.match(status,/\nVerification: /)
  assert.match(status,/\nAuthority: /)
  assert.match(status,/\nBlockers: .*environment:blocked/)
})

test('default mission status remains bounded and never surfaces ledger payload detail',()=>{
  const m=mission('ux-status-redaction')
  appendLedger(m,'sensitive.internal',{payload:{secretish:'do-not-surface',raw:'tool trajectory'}})
  m.execution.blockers.push(`bounded:${'x'.repeat(1000)}`)
  const status=formatAutonomousMissionStatus(m,process.cwd())
  assert.doesNotMatch(status,/do-not-surface|tool trajectory|sensitive\.internal/)
  assert.ok(status.length<2600)
  assert.ok(status.split('\n').length<=7)
})
