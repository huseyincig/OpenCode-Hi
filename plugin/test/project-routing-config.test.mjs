import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import HiPlugin from '../dist/plugin.js'
import {resolveHiConfig,resolveHiConfigWithReport} from '../dist/config/resolver.js'

function projectConfig(root){
  mkdirSync(join(root,'.opencode','hi','policy'),{recursive:true})
  writeFileSync(join(root,'.opencode','hi','policy','routing.json'),JSON.stringify({
    schema:1,type:'hi-routing',primaryMode:'manager',
    teamMode:{enabled:true,maxMembers:3,maxWallMinutes:7},
    parallel:{enabled:false,max:1,providers:{},models:{}},
    profile:{balanced:{specialistThreshold:'low',reviewThreshold:'high'}},
    routing:{modelPolicy:'manual',strategy:'quality',maxFallbacks:1,roleModels:{coder:['openai/local']},roleVariants:{},adaptiveRoles:[]}
  },null,2))
}

test('project-owned HI config survives host stripping of unknown top-level hi config', async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-real-config-shape-')); projectConfig(root)
  const resolved=resolveHiConfigWithReport(undefined,root).config
  assert.equal(resolved.primaryMode,'manager')
  assert.equal('teamMode' in resolved,false,'legacy project teamMode is ignored; scheduler topology owns parallelism')
  assert.equal(resolved.parallel.enabled,false)
  assert.equal(resolved.routing.maxFallbacks,1)
  assert.deepEqual(resolved.routing.roleModels.coder,['openai/local'])
  const client={app:{log:async()=>({})},provider:{list:async()=>({data:[]})},session:{create:async()=>({data:{id:'child'}}),promptAsync:async()=>({}),abort:async()=>({}),messages:async()=>({data:[]}),status:async()=>({data:{}}),children:async()=>({data:[]}),diff:async()=>({data:[]}),todo:async()=>({data:[]}),revert:async()=>({}),unrevert:async()=>({})}}
  const hooks=await HiPlugin({directory:root,worktree:root,project:{},client})
  const hostConfig={} // mirrors OpenCode 1.18.x canonical config after unknown `hi` is stripped
  await hooks.config(hostConfig)
  assert.equal(hooks.tool.hi_team_create,undefined);assert.equal(hooks.tool.hi_team_shutdown,undefined)
  await hooks.dispose?.(); rmSync(root,{recursive:true,force:true})
})


test('project model routing admits child roles only and ignores primary/unknown role model keys', async()=>{
  const p=mkdtempSync(join(tmpdir(),'hi-project-routing-role-scope-'));try{
    mkdirSync(join(p,'.opencode','hi','policy'),{recursive:true})
    writeFileSync(join(p,'.opencode','hi','policy','routing.json'),JSON.stringify({
      schema:1,type:'hi-routing',
      models:{mode:'role-mapped',roles:{manager:'p/manager','working-manager':'p/wm',coder:'p/code',unknown:'p/nope'}},
      routing:{roleModels:{manager:['p/manager'],'working-manager':['p/wm'],coder:['p/code','p/fallback'],unknown:['p/nope']},roleVariants:{manager:{'p/manager':'high'},coder:{'p/code':'high'},unknown:{'p/nope':'low'}}}
    }))
    const cfg=resolveHiConfig({},p)
    assert.deepEqual(cfg.models.roles,{coder:'p/code'})
    assert.deepEqual(cfg.routing.roleModels,{coder:['p/code','p/fallback']})
    assert.deepEqual(cfg.routing.roleVariants,{coder:{'p/code':'high'}})
    const host=resolveHiConfig({models:{mode:'role-mapped',roles:{manager:'h/manager',coder:'h/code',unknown:'h/nope'}},routing:{roleModels:{manager:['h/manager'],coder:['h/code'],unknown:['h/nope']},roleVariants:{manager:{'h/manager':'high'},coder:{'h/code':'low'},unknown:{'h/nope':'high'}}}})
    assert.deepEqual(host.models.roles,{coder:'h/code'});assert.deepEqual(host.routing.roleModels,{coder:['h/code']});assert.deepEqual(host.routing.roleVariants,{coder:{'h/code':'low'}})
  }finally{rmSync(p,{recursive:true,force:true})}
})
