import test from 'node:test'
import assert from 'node:assert/strict'
import {matchesHiOpenCodeAgent,projectHiOpenCodeAgents} from '../dist/opencode/agent-binding.js'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'

const clone=x=>structuredClone(x)
const collisions=(config,agents)=>projectHiOpenCodeAgents(config,agents).collisions

test('OpenCode adapter injects absent canonical Hi agents and accepts idempotent binding',()=>{
  const cfg={};assert.deepEqual(collisions(cfg,PACKAGED_HI_AGENTS),[]);assert.deepEqual(Object.keys(cfg.agent).sort(),Object.keys(PACKAGED_HI_AGENTS).sort())
  assert.deepEqual(collisions(cfg,PACKAGED_HI_AGENTS),[])
})

test('admitted hi-project skill permission is the only tolerated canonical agent permission extension',()=>{
  const actual=clone(PACKAGED_HI_AGENTS.coder);actual.permission.skill['hi-project-example']='allow'
  assert.equal(matchesHiOpenCodeAgent(actual,PACKAGED_HI_AGENTS.coder),true)
})

test('canonical Hi agent names still fail binding on prompt mode or permission collisions',()=>{
  for(const mutate of [
    a=>{a.coder.prompt='foreign coder'},
    a=>{a.coder.mode='primary'},
    a=>{a.coder.permission.task='allow'},
    a=>{a.coder.permission.skill['foreign-skill']='allow'},
  ]){
    const cfg={agent:clone(PACKAGED_HI_AGENTS)};mutate(cfg.agent)
    assert.deepEqual(collisions(cfg,PACKAGED_HI_AGENTS),['coder'])
  }
})

test('OpenCode-owned model and variant metadata are compatible with canonical Hi agents',()=>{
  for(const role of ['manager','working-manager','coder']){
    const expected=PACKAGED_HI_AGENTS[role],actual=clone(expected)
    assert.equal(Object.hasOwn(expected,'model'),false,`${role}: packaged Hi definition must not own model choice`)
    actual.model='p/host-selected';actual.variant='high'
    assert.equal(matchesHiOpenCodeAgent(actual,expected),true)
    const cfg={agent:{[role]:actual}}
    assert.deepEqual(collisions(cfg,{[role]:expected}),[])
    assert.equal(cfg.agent[role].model,'p/host-selected');assert.equal(cfg.agent[role].variant,'high')
  }
})

test('sparse OpenCode parser-normalized host model override is merged into canonical Hi agent semantics',()=>{
  const cfg={agent:{coder:{model:'p/host-selected',options:{},permission:{}}}}
  const out=projectHiOpenCodeAgents(cfg,PACKAGED_HI_AGENTS)
  assert.deepEqual(out.collisions,[]);assert.ok(out.compatibleExisting.includes('coder'))
  assert.equal(cfg.agent.coder.model,'p/host-selected');assert.equal(cfg.agent.coder.mode,'subagent');assert.equal(typeof cfg.agent.coder.prompt,'string')
  assert.deepEqual(cfg.agent.coder.permission,PACKAGED_HI_AGENTS.coder.permission)
  assert.equal('options' in cfg.agent.coder,false,'parser-normalized empty options must not replace canonical semantics')
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
  assert.deepEqual(collisions(cfg,{coder:PACKAGED_HI_AGENTS.coder}),[])
  assert.equal(cfg.agent.coder,actual,'compatible full host agent is preserved rather than replaced')
  assert.deepEqual(cfg.agent.external,{description:'foreign agent',mode:'subagent'})
})

test('foreign execution semantics and malformed routing metadata remain collisions',()=>{
  for(const mutate of [
    a=>{a.permission.task='allow'},
    a=>{a.model='malformed-model'},
    a=>{a.variant=''},
    a=>{a.tools={bash:true}},
    a=>{a.disabled=true},
    a=>{a.options={temperature:1}},
    a=>{a.steps=PACKAGED_HI_AGENTS.coder.steps+1},
  ]){const actual=clone(PACKAGED_HI_AGENTS.coder);mutate(actual);assert.equal(matchesHiOpenCodeAgent(actual,PACKAGED_HI_AGENTS.coder),false)}

  for(const sparse of [
    {model:'p/model',permission:{edit:'allow'}},
    {model:'p/model',options:{temperature:1}},
    {model:'malformed',permission:{},options:{}},
  ]){
    const cfg={agent:{coder:sparse}}
    assert.deepEqual(projectHiOpenCodeAgents(cfg,{coder:PACKAGED_HI_AGENTS.coder}).collisions,['coder'])
  }
})
