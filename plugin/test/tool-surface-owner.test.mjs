import test from 'node:test'
import assert from 'node:assert/strict'
import {createHiToolSurface} from '../dist/runtime/application/hi-tool-surface.js'
import {HI_RUNTIME_TOOL_IDS} from '../dist/runtime/routing/execution-profile.js'
import {auditHiToolNamespace} from '../dist/opencode/tool-namespace.js'
import {DEFAULT_HI_CONFIG} from '../dist/config/defaults.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'

function surface(){
  const state={config:structuredClone(DEFAULT_HI_CONFIG),hostConfig:{},openCodeVersion:'1.18.21'}
  const store=new MissionStore()
  const processRuntime={list:()=>[],stopMission:async()=>0}
  return createHiToolSurface({state,store,tasks:{},processRuntime,projectRoot:process.cwd(),capabilities:{contracts:[]},native:{},getModels:()=>[],scopedStores:{contextArtifacts:{}}})
}

test('runtime tool inventory has one canonical ID source and no shadowing',()=>{
  const created=surface()
  assert.deepEqual(Object.keys(created),['toolSurface'])
  assert.deepEqual(Object.keys(created.toolSurface).sort(),[...HI_RUNTIME_TOOL_IDS].sort())
  assert.equal(new Set(HI_RUNTIME_TOOL_IDS).size,HI_RUNTIME_TOOL_IDS.length)
  assert.equal(auditHiToolNamespace([...HI_RUNTIME_TOOL_IDS]).ok,true)
})
