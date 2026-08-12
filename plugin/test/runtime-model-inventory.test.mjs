import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import HhcPlugin from '../dist/plugin.js'

test('runtime inventory -> project routing -> child uses effective per-role model', async () => {
  const dir=mkdtempSync(join(tmpdir(),'hhc-runtime-model-'))
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
    const hooks=await HhcPlugin({directory:dir,worktree:dir,project:{},client})
    const config={}
    await hooks.config(config)
    await hooks['chat.message'](
      {sessionID:'parent-1',message:{role:'user',parts:[{type:'text',text:'login bugını düzelt test et'}]}},
      {parts:[]},
    )

    const routing=JSON.parse(readFileSync(join(dir,'.opencode','oho-routing.json'),'utf8'))
    assert.deepEqual(routing.routing.roleModels.coder,['opencode-go/deepseek-v4-pro'])
    assert.deepEqual(routing.routing.roleModels['working-manager'],['opencode-go/minimax-m3'])

    const result=JSON.parse(await hooks.tool.hhc_task_start.execute(
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
    assert.match(prompted[0].body.parts[0].text,/smallest repo-native check/i)
    assert.match(prompted[0].body.parts[0].text,/do not run a full repository suite/i)
    await hooks.dispose?.()
  } finally { rmSync(dir,{recursive:true,force:true}) }
})
