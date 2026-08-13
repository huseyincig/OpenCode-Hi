import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import HiPlugin from '../dist/plugin.js'

function clientWithProviderShape(raw){
  return {
    app:{log:async()=>({})},
    provider:{list:async()=>({data:raw})},
    session:{
      create:async()=>({data:{id:'child'}}),
      promptAsync:async()=>({data:{}}),
      abort:async()=>({data:{}}),
      messages:async()=>({data:[]}),
      status:async()=>({data:{}}),
      children:async()=>({data:[]}),
      diff:async()=>({data:[]}),
      todo:async()=>({data:[]}),
      revert:async()=>({data:{}}),
      unrevert:async()=>({data:{}}),
    },
  }
}

test('runtime inventory exposes only models from OpenCode connected providers when connected set is present',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-connected-provider-'))
  const raw={
    connected:['opencode-go'],
    all:[
      {id:'zhipuai',models:[{id:'px-unavailable'}]},
      {id:'opencode-go',models:[{id:'deepseek-v4-flash'}]},
    ],
  }
  const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:clientWithProviderShape(raw)})
  await hooks.config({})
  await hooks.event({event:{type:'server.connected',properties:{}}})
  const doctor=String(await hooks.tool.hi_doctor.execute({},{}))
  assert.match(doctor,/model-inventory: 1 runtime model\(s\)/)
  assert.match(doctor,/opencode-go\/deepseek-v4-flash/)
  assert.doesNotMatch(doctor,/zhipuai\/px-unavailable/)
  await hooks.dispose?.()
  rmSync(root,{recursive:true,force:true})
})

test('runtime inventory preserves host shapes that do not expose a connected-provider set',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-provider-legacy-shape-'))
  const raw={all:[{id:'p',models:[{id:'m'}]}]}
  const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:clientWithProviderShape(raw)})
  await hooks.config({})
  await hooks.event({event:{type:'server.connected',properties:{}}})
  const doctor=String(await hooks.tool.hi_doctor.execute({},{}))
  assert.match(doctor,/model-inventory: 1 runtime model\(s\)/)
  assert.match(doctor,/p\/m/)
  await hooks.dispose?.()
  rmSync(root,{recursive:true,force:true})
})


test('successful refresh to zero connected models clears stale inventory',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-provider-zero-refresh-'))
  let raw={connected:['p'],all:[{id:'p',models:[{id:'m'}]}]}
  const client=clientWithProviderShape(raw)
  client.provider.list=async()=>({data:raw})
  const hooks=await HiPlugin({directory:root,worktree:root,project:{},client})
  await hooks.config({})
  await hooks.event({event:{type:'server.connected',properties:{}}})
  let doctor=String(await hooks.tool.hi_doctor.execute({},{}))
  assert.match(doctor,/model-inventory: 1 runtime model\(s\)/)
  raw={connected:[],all:[{id:'p',models:[{id:'m'}]}]}
  await hooks.event({event:{type:'installation.updated',properties:{}}})
  doctor=String(await hooks.tool.hi_doctor.execute({},{}))
  assert.match(doctor,/model-inventory: 0 runtime model\(s\)/)
  assert.doesNotMatch(doctor,/p\/m/)
  await hooks.dispose?.();rmSync(root,{recursive:true,force:true})
})
