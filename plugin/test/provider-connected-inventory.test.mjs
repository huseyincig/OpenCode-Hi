import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
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
      {id:'opencode-go',models:[{id:'deepseek-v4-flash',capabilities:{input:{image:false}}}]},
    ],
  }
  const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:clientWithProviderShape(raw)})
  await hooks.config({})
  await hooks.event({event:{type:'server.connected',properties:{}}})
  const doctor=String(await hooks.tool.hi_doctor.execute({},{}))
  assert.match(doctor,/model-inventory: 1 effective runtime model\(s\)/)
  assert.match(doctor,/opencode-go\/deepseek-v4-flash/)
  assert.doesNotMatch(doctor,/zhipuai\/px-unavailable/)
  const routing=JSON.parse(readFileSync(join(root,'.opencode','hi','policy','routing.json'),'utf8'))
  assert.deepEqual(routing.routing.roleModels,{
    coder:['opencode-go/deepseek-v4-flash'],
    architect:['opencode-go/deepseek-v4-flash'],
    'repository-explorer':['opencode-go/deepseek-v4-flash'],
    'qa-reviewer':['opencode-go/deepseek-v4-flash'],
    'security-reviewer':['opencode-go/deepseek-v4-flash'],
  })
  assert.deepEqual(routing.routing.adaptiveRoles,['visual-qa'])
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
  assert.match(doctor,/model-inventory: 1 effective runtime model\(s\)/)
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
  assert.match(doctor,/model-inventory: 1 effective runtime model\(s\)/)
  raw={connected:[],all:[{id:'p',models:[{id:'m'}]}]}
  await hooks.event({event:{type:'installation.updated',properties:{}}})
  doctor=String(await hooks.tool.hi_doctor.execute({},{}))
  assert.match(doctor,/model-inventory: 0 effective runtime model\(s\)/)
  assert.doesNotMatch(doctor,/p\/m/)
  await hooks.dispose?.();rmSync(root,{recursive:true,force:true})
})


test('runtime initial recommendation never shadows an existing host-level user role mapping',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-provider-user-routing-'))
  const raw={connected:['p'],all:[{id:'p',models:[{id:'user-model'},{id:'other-model'}]}]}
  const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:clientWithProviderShape(raw)})
  await hooks.config({hi:{routing:{roleModels:{coder:['p/user-model']}}}})
  await hooks.event({event:{type:'server.connected',properties:{}}})
  assert.equal(existsSync(join(root,'.opencode','hi','policy','routing.json')),false)
  await hooks.dispose?.();rmSync(root,{recursive:true,force:true})
})


test('chat-facing hi_role_models lists only effective connected models and persists explicit child-role choices',async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-role-model-chat-'))
  const raw={connected:['p'],all:[{id:'p',models:[{id:'code'},{id:'vision',capabilities:{input:{image:true}}}]},{id:'offline',models:[{id:'nope'}]}]}
  const hooks=await HiPlugin({directory:root,worktree:root,project:{},client:clientWithProviderShape(raw)})
  await hooks.config({})
  await hooks.event({event:{type:'server.connected',properties:{}}})
  const listed=JSON.parse(String(await hooks.tool.hi_role_models.execute({action:'list'},{})))
  assert.equal(listed.status,'OK');assert.deepEqual(listed.models.map(x=>x.id),['p/code','p/vision']);assert.equal(listed.roles.coder,'p/code')
  const setCoder=JSON.parse(String(await hooks.tool.hi_role_models.execute({action:'set',role:'coder',models:'p/vision,p/code'},{})))
  assert.equal(setCoder.status,'APPLIED');assert.deepEqual(setCoder.role_models.coder,['p/vision','p/code'])
  const blockedVisual=JSON.parse(String(await hooks.tool.hi_role_models.execute({action:'set',role:'visual-qa',models:'p/code'},{})))
  assert.equal(blockedVisual.status,'BLOCKED');assert.match(blockedVisual.reason,/vision/i)
  const setVisual=JSON.parse(String(await hooks.tool.hi_role_models.execute({action:'set',role:'visual-qa',models:'p/vision'},{})))
  assert.equal(setVisual.status,'APPLIED');assert.deepEqual(setVisual.role_models['visual-qa'],['p/vision'])
  const routing=JSON.parse(readFileSync(join(root,'.opencode','hi','policy','routing.json'),'utf8'))
  assert.deepEqual(routing.routing.roleModels.coder,['p/vision','p/code']);assert.deepEqual(routing.routing.roleModels['visual-qa'],['p/vision'])
  await hooks.dispose?.();rmSync(root,{recursive:true,force:true})
})
