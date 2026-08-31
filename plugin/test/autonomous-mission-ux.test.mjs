import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {startAssessedMission} from './helpers/semantic.mjs'
import {autonomousMissionUxView} from '../dist/runtime/ux/autonomous-mission.js'

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
