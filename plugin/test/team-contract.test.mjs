import test from 'node:test'
import assert from 'node:assert/strict'
import {isTeamContract} from '../dist/contracts/team.js'

function valid(){return{team_id:'team_abc_123',mission_id:'m_1',generation:2,member_task_refs:['t1','t2'],member_role_refs:['architect','qa-reviewer'],capacity:4,status:'active',created_at:10}}

test('TeamContract is strict, current-only, and binds role/task cardinality plus bounded capacity',()=>{
  assert.equal(isTeamContract(valid()),true)
  assert.equal(isTeamContract({...valid(),extra:true}),false)
  assert.equal(isTeamContract({...valid(),member_task_refs:['t1']}),false)
  assert.equal(isTeamContract({...valid(),member_task_refs:['t1','t1']}),false)
  assert.equal(isTeamContract({...valid(),capacity:1}),false)
  assert.equal(isTeamContract({...valid(),shutdown_at:12}),false)
})

test('shutdown TeamContract requires an explicit terminal timestamp',()=>{
  assert.equal(isTeamContract({...valid(),status:'shutdown'}),false)
  assert.equal(isTeamContract({...valid(),status:'shutdown',shutdown_at:11}),true)
  assert.equal(isTeamContract({...valid(),status:'shutdown',shutdown_at:9}),false)
})
