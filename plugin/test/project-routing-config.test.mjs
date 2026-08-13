import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import HiPlugin from '../dist/plugin.js'
import {resolveHiConfigWithReport} from '../dist/config/resolver.js'

function projectConfig(root){
  mkdirSync(join(root,'.opencode','hi','policy'),{recursive:true})
  writeFileSync(join(root,'.opencode','hi','policy','routing.json'),JSON.stringify({
    schema:1,type:'hi-routing',primaryMode:'manager',
    teamMode:{enabled:true,auto:false,maxMembers:3,maxMessages:9,maxTurns:5,maxWallMinutes:7},
    parallel:{enabled:false,max:1,providers:{},models:{}},
    profile:{balanced:{specialistThreshold:'low',reviewThreshold:'high'}},
    routing:{modelPolicy:'manual',strategy:'quality',maxFallbacks:1,roleModels:{coder:['openai/local']},roleVariants:{},adaptiveRoles:[]}
  },null,2))
}

test('project-owned HI config survives host stripping of unknown top-level hi config', async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-real-config-shape-')); projectConfig(root)
  const resolved=resolveHiConfigWithReport(undefined,root).config
  assert.equal(resolved.primaryMode,'manager')
  assert.equal(resolved.teamMode.enabled,true)
  assert.equal(resolved.teamMode.maxMembers,3)
  assert.equal(resolved.parallel.enabled,false)
  assert.equal(resolved.routing.maxFallbacks,1)
  assert.deepEqual(resolved.routing.roleModels.coder,['openai/local'])
  const client={app:{log:async()=>({})},provider:{list:async()=>({data:[]})},session:{create:async()=>({data:{id:'child'}}),promptAsync:async()=>({}),abort:async()=>({}),messages:async()=>({data:[]}),status:async()=>({data:{}}),children:async()=>({data:[]}),diff:async()=>({data:[]}),todo:async()=>({data:[]}),revert:async()=>({}),unrevert:async()=>({})}}
  const hooks=await HiPlugin({directory:root,worktree:root,project:{},client})
  const hostConfig={} // mirrors OpenCode 1.18.x canonical config after unknown `hi` is stripped
  await hooks.config(hostConfig)
  assert.ok(hooks.tool.hi_team_create,'Team tool must be enabled from project-owned HI config')
  assert.ok(hooks.tool.hi_team_shutdown)
  await hooks.dispose?.(); rmSync(root,{recursive:true,force:true})
})
