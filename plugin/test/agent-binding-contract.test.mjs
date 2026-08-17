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


test('canonical primary Hi agents remain host-selected for model and reject host-side model constraints',()=>{
  for(const role of ['manager','working-manager']){
    const expected=PACKAGED_HI_AGENTS[role]
    assert.equal(Object.hasOwn(expected,'model'),false,`${role}: Hi must not constrain the primary model`)
    assert.equal(Object.hasOwn(expected,'variant'),false,`${role}: Hi must not constrain the primary variant`)
    const cfg={agent:clone(PACKAGED_HI_AGENTS)}
    cfg.agent[role].model='p/forced-primary'
    assert.deepEqual(bindHiOpenCodeAgents(cfg,PACKAGED_HI_AGENTS),[role])
  }
})


test('canonical Hi agent permits harmless metadata and permission narrowing without overwriting host policy',()=>{
  const actual=clone(PACKAGED_HI_AGENTS.coder)
  actual.description='User-facing label for the same canonical Hi coder'
  actual.hidden=true
  actual.steps=Math.max(1,actual.steps-1)
  actual.permission.edit='deny'
  actual.permission.bash['git diff*']='ask'
  actual.permission.bash['rm -rf *']='deny'
  assert.equal(matchesHiOpenCodeAgent(actual,PACKAGED_HI_AGENTS.coder),true)
  const cfg={agent:{coder:actual,external:{description:'foreign agent',mode:'subagent'}}}
  assert.deepEqual(bindHiOpenCodeAgents(cfg,{coder:PACKAGED_HI_AGENTS.coder}),[])
  assert.equal(cfg.agent.coder,actual,'compatible host agent is preserved rather than replaced')
  assert.deepEqual(cfg.agent.external,{description:'foreign agent',mode:'subagent'})
})

test('canonical Hi agent rejects permission widening, model/tool takeover, disablement and larger step budget',()=>{
  for(const mutate of [
    a=>{a.permission.task='allow'},
    a=>{a.model='p/forced'},
    a=>{a.variant='high'},
    a=>{a.tools={bash:true}},
    a=>{a.disabled=true},
    a=>{a.steps=PACKAGED_HI_AGENTS.coder.steps+1},
  ]){const actual=clone(PACKAGED_HI_AGENTS.coder);mutate(actual);assert.equal(matchesHiOpenCodeAgent(actual,PACKAGED_HI_AGENTS.coder),false)}
})
