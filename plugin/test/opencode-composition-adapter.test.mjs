import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
import {PACKAGED_HI_AGENTS} from '../dist/generated/agent-config.js'
import {ProjectAuthorityStore} from '../dist/runtime/safety/project-authority.js'
import {probeOpenCodeComposition,projectHiOpenCodeComposition,projectHiV1Composition,selectOpenCodeCompositionMode} from '../dist/opencode/composition-adapter.js'

const require=createRequire(import.meta.url)
const clone=x=>structuredClone(x)
function root(){return mkdtempSync(join(tmpdir(),'hi-composition-'))}

test('current project OpenCode plugin SDK stays explicitly pinned to the verified V1 config-hook compatibility target',()=>{
  const pkg=require('../node_modules/@opencode-ai/plugin/package.json')
  assert.equal(pkg.version,'1.18.18')
})

test('composition probe isolates V1 config projection from V2 domain-config shapes without copying either full schema',()=>{
  assert.deepEqual(probeOpenCodeComposition({plugin:['x'],agent:{}}).family,'v1-config-hook')
  assert.deepEqual(probeOpenCodeComposition({plugins:['x'],agents:{},permissions:[],skills:['./skills']}).family,'v2-domain-config')
  assert.deepEqual(probeOpenCodeComposition({plugin:['x'],agents:{}}).family,'mixed')
  assert.deepEqual(probeOpenCodeComposition({mcp:{}}).family,'unknown')
})



test('composition capability selector prefers complete V2 domain transforms, falls back to V1 hook, and fails closed when neither is available',()=>{
  assert.equal(selectOpenCodeCompositionMode({v1ConfigHook:true,v2AgentTransform:false,v2SkillRegistration:false,v2PermissionTransform:false}),'v1-config-hook')
  assert.equal(selectOpenCodeCompositionMode({v1ConfigHook:true,v2AgentTransform:true,v2SkillRegistration:true,v2PermissionTransform:true}),'v2-domain-transform')
  assert.equal(selectOpenCodeCompositionMode({v1ConfigHook:false,v2AgentTransform:true,v2SkillRegistration:false,v2PermissionTransform:true}),'unsupported')
})
test('V1 composition preserves plugin/provider/MCP/custom order and host global primary/depth while projecting only Hi leaves',()=>{
  const dir=root();try{
    const authority=new ProjectAuthorityStore(dir),externalAgent={description:'external',mode:'subagent',custom:'keep'},config={
      plugin:['external-one','opencode-hi','external-two'],
      provider:{customProvider:{customField:{nested:true}}},
      mcp:{serverA:{type:'remote',url:'https://example.invalid/mcp',oauth:{client:'keep'}}},
      custom_extension:{alpha:1,beta:['x','y']},
      default_agent:'external-primary',subagent_depth:7,
      skills:{paths:['/external/skills'],customSkillField:'keep'},
      agent:{external:externalAgent},
      permission:{bash:{'*':'ask','git push *':'ask'}},
    }
    const before={plugin:structuredClone(config.plugin),provider:structuredClone(config.provider),mcp:structuredClone(config.mcp),custom_extension:structuredClone(config.custom_extension),default_agent:config.default_agent,subagent_depth:config.subagent_depth,external:config.agent.external,bash:structuredClone(config.permission.bash)}
    const out=projectHiOpenCodeComposition({config,packagedAgents:PACKAGED_HI_AGENTS,packagedSkillsDir:join(dir,'missing-skills'),projectRoot:dir,projectAuthority:authority})
    assert.equal(out.applied,true);assert.equal(out.mode,'v1-config-hook')
    assert.deepEqual(config.plugin,before.plugin);assert.deepEqual(config.provider,before.provider);assert.deepEqual(config.mcp,before.mcp);assert.deepEqual(config.custom_extension,before.custom_extension)
    assert.equal(config.default_agent,before.default_agent);assert.equal(config.subagent_depth,before.subagent_depth)
    assert.equal(config.agent.external,before.external);assert.deepEqual(config.permission.bash,before.bash)
    assert.ok(config.agent.coder);assert.ok(config.agent['working-manager'])
    assert.deepEqual(config.skills.paths,['/external/skills'])
  }finally{rmSync(dir,{recursive:true,force:true})}
})

test('V1 composition does not create host-global default_agent or subagent_depth when absent',()=>{
  const dir=root();try{const config={plugin:['opencode-hi']},authority=new ProjectAuthorityStore(dir);const out=projectHiV1Composition({config,packagedAgents:PACKAGED_HI_AGENTS,packagedSkillsDir:join(dir,'missing'),projectRoot:dir,projectAuthority:authority});assert.deepEqual(out.agentProjection.collisions,[]);assert.equal('default_agent' in config,false);assert.equal('subagent_depth' in config,false)}finally{rmSync(dir,{recursive:true,force:true})}
})

test('V2 or mixed shapes are left untouched and return deterministic adapter diagnostics instead of receiving V1 keys',()=>{
  const dir=root();try{
    const authority=new ProjectAuthorityStore(dir)
    for(const [config,mode,diag] of [
      [{plugins:['external'],agents:{external:{description:'keep'}},permissions:[{permission:'*',action:'ask'}],providers:{p:{x:1}},skills:['./external-skills'],mcp:{servers:{x:{type:'remote'}}}},'v2-domain-transform-required','v2-domain-transform-required'],
      [{plugin:['legacy'],agents:{external:{description:'keep'}},custom:'keep'},'mixed-config-collision','mixed-v1-v2-config-family'],
    ]){
      const before=JSON.stringify(config),out=projectHiOpenCodeComposition({config,packagedAgents:PACKAGED_HI_AGENTS,packagedSkillsDir:join(dir,'skills'),projectRoot:dir,projectAuthority:authority})
      assert.equal(out.applied,false);assert.equal(out.mode,mode);assert.deepEqual(out.diagnostics,[diag]);assert.equal(JSON.stringify(config),before);assert.equal('agent' in config,false)
    }
  }finally{rmSync(dir,{recursive:true,force:true})}
})

test('authority bridge never widens an existing ASK even when project grant exists',()=>{
  const dir=root();try{
    const authority=new ProjectAuthorityStore(dir);authority.grant('git-push')
    const config={plugin:['opencode-hi'],permission:{bash:{'*':'allow','git push *':'ask','git commit *':'ask'}}}
    projectHiV1Composition({config,packagedAgents:{},packagedSkillsDir:join(dir,'missing'),projectRoot:dir,projectAuthority:authority})
    assert.equal(config.permission.bash['git push *'],'ask');assert.equal(config.permission.bash['git commit *'],'ask')
  }finally{rmSync(dir,{recursive:true,force:true})}
})

test('compatible same-name Hi agent narrowing is preserved by identity while permission widening yields deterministic collision',()=>{
  const dir=root();try{
    const authority=new ProjectAuthorityStore(dir),coder=clone(PACKAGED_HI_AGENTS.coder);coder.permission.edit='deny';coder.hidden=true
    const config={plugin:['opencode-hi'],agent:{coder}}
    let out=projectHiV1Composition({config,packagedAgents:{coder:PACKAGED_HI_AGENTS.coder},packagedSkillsDir:join(dir,'missing'),projectRoot:dir,projectAuthority:authority})
    assert.deepEqual(out.agentProjection.collisions,[]);assert.equal(config.agent.coder,coder);assert.equal(config.agent.coder.permission.edit,'deny')
    const widened=clone(PACKAGED_HI_AGENTS.coder);widened.permission.task='allow';const bad={plugin:['external','opencode-hi'],agent:{coder:widened},mcp:{x:{keep:true}},permission:{bash:{'*':'ask'}}},before=JSON.stringify(bad),packaged=join(dir,'packaged-skills');mkdirSync(packaged,{recursive:true})
    out=projectHiV1Composition({config:bad,packagedAgents:{coder:PACKAGED_HI_AGENTS.coder,architect:PACKAGED_HI_AGENTS.architect},packagedSkillsDir:packaged,projectRoot:dir,projectAuthority:authority})
    assert.deepEqual(out.diagnostics,['agent-collision:coder']);assert.equal(bad.agent.coder,widened,'collision diagnostics never overwrite the foreign definition');assert.equal(JSON.stringify(bad),before,'collision preflight must not partially inject other Hi leaves')
  }finally{rmSync(dir,{recursive:true,force:true})}
})
