import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import HiPlugin from '../dist/plugin.js'
import { assessPluginMission } from './helpers/semantic.mjs'

test('runtime inventory -> project routing -> child uses effective per-role model', async () => {
  const dir=mkdtempSync(join(tmpdir(),'hi-runtime-model-'))
  const created=[]
  const prompted=[]
  try{
    const client={
      app:{log:async()=>{}},
      provider:{list:async()=>({data:[{id:'opencode-go',models:[
        {id:'deepseek-v4-pro',write:true,variants:['high','medium']},
        {id:'minimax-m3',write:true,variants:['medium','low']},
        {id:'unrelated',write:true},
      ]}]})},
      session:{
        create:async req=>{created.push(req);return {data:{id:`child-${created.length}`}}},
        promptAsync:async req=>{prompted.push(req);return {data:{}}},
        abort:async()=>({data:{}}),
      },
    }
    const hooks=await HiPlugin({directory:dir,worktree:dir,project:{},client})
    const config={}
    await hooks.config(config)
    await hooks['chat.message'](
      {sessionID:'parent-1'},{message:{role:'user'},parts:[{type:'text',text:'fix the login bug and test it'}]},
    ); await assessPluginMission(hooks,'parent-1',{task_kind:'bug-fix',risk:'low',required_capabilities:['implementation'],likely_verification:['targeted-tests']})

    assert.equal(existsSync(join(dir,'.opencode','hi','policy','routing.json')),false,'runtime inventory must not silently persist project policy')

    const result=JSON.parse(await hooks.tool.hi_task_start.execute(
      {objective:'login fix implementation',role:'coder',category:'deep'},
      {sessionID:'parent-1'},
    ))
    assert.equal(result.model,'opencode-go/deepseek-v4-pro')
    assert.equal(created.length,1)
    assert.equal(created[0].body.model.providerID,'opencode-go')
    assert.equal(created[0].body.model.id,'deepseek-v4-pro')
    assert.equal(prompted.length,1)
    assert.equal(prompted[0].body.model.providerID,'opencode-go')
    assert.equal(prompted[0].body.model.modelID,'deepseek-v4-pro')
    assert.match(prompted[0].body.parts[0].text,/Verification contract: targeted-tests/i)
    await hooks.dispose?.()
  } finally { rmSync(dir,{recursive:true,force:true}) }
})
