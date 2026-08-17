import test from 'node:test'
import assert from 'node:assert/strict'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {resolveExecutionMode} from '../dist/runtime/routing/execution-mode.js'
import {decideTopology} from '../dist/runtime/execution/topology-policy.js'
import {resolveHiConfig} from '../dist/config/resolver.js'
import {startAssessedMission} from './helpers/semantic.mjs'

test('generic TeamRuntime config and tools are no longer part of the active Hi configuration surface',()=>{
  const cfg=resolveHiConfig({teamMode:{enabled:true,maxMembers:8,maxWallMinutes:240}})
  assert.equal('teamMode' in cfg,false)
})

test('legacy team execution mode is compatibility-normalized to scheduler-owned parallel topology',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'legacy-team','multi stream',{scope:'multi-stream',dependency_class:'independent',required_capabilities:['implementation','review'],likely_verification:[]})
  m.execution.execution_mode='team'
  const mode=resolveExecutionMode(m.identity.intent,m);assert.equal(mode.mode,'parallel');assert.match(mode.reason.join(' '),/legacy team.*scheduler-owned parallel/i)
  const topology=decideTopology(m.identity.intent,{mode:'adaptive',maxAgents:4,parallelism:2},m);assert.equal(topology.executionMode,'parallel');assert.equal(topology.mode,'multi-agent')
})

test('new assessed multi-stream work uses parallel execution mode directly, never team',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'new-parallel','multi stream',{scope:'multi-stream',dependency_class:'independent',required_capabilities:['implementation','review'],likely_verification:[]})
  assert.equal(m.execution.execution_mode,'parallel')
})
