import test from 'node:test'
import assert from 'node:assert/strict'
import {bindHiOpenCodeAgents,matchesHiOpenCodeAgent} from '../dist/opencode/agent-binding.js'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'

const clone=x=>structuredClone(x)

test('OpenCode adapter injects absent canonical Hi agents and accepts idempotent binding',()=>{
  const cfg={};assert.deepEqual(bindHiOpenCodeAgents(cfg,PACKAGED_HI_AGENTS),[]);assert.deepEqual(Object.keys(cfg.agent).sort(),Object.keys(PACKAGED_HI_AGENTS).sort())
  assert.deepEqual(bindHiOpenCodeAgents(cfg,PACKAGED_HI_AGENTS),[])
})

test('admitted hi-project skill permission is the only tolerated canonical agent extension',()=>{
  const actual=clone(PACKAGED_HI_AGENTS.coder);actual.permission.skill['hi-project-example']='allow'
  assert.equal(matchesHiOpenCodeAgent(actual,PACKAGED_HI_AGENTS.coder),true)
})

test('canonical Hi agent names fail binding on prompt mode or permission collisions',()=>{
  for(const mutate of [
    a=>{a.coder.prompt='foreign coder'},
    a=>{a.coder.mode='primary'},
    a=>{a.coder.permission.task='allow'},
    a=>{a.coder.permission.skill['foreign-skill']='allow'},
  ]){
    const cfg={agent:clone(PACKAGED_HI_AGENTS)};mutate(cfg.agent)
    assert.deepEqual(bindHiOpenCodeAgents(cfg,PACKAGED_HI_AGENTS),['coder'])
  }
})
