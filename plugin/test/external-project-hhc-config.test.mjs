import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import HhcPlugin from '../dist/plugin.js'
import {resolveHhcConfigWithReport} from '../dist/config/resolver.js'

function projectConfig(root){
  mkdirSync(join(root,'.opencode'),{recursive:true})
  writeFileSync(join(root,'.opencode','oho-routing.json'),JSON.stringify({
    schema:1,type:'oho-routing',primaryMode:'manager',
    teamMode:{enabled:true,auto:false,maxMembers:3,maxMessages:9,maxTurns:5,maxWallMinutes:7},
    parallel:{enabled:false,max:1,providers:{},models:{}},
    profile:{standard:{specialistThreshold:'low',parallelThreshold:'high',reviewThreshold:'high',costSensitivity:'medium',qualityFloor:'high'}},
    routing:{modelPolicy:'manual',strategy:'quality',maxFallbacks:1,roleModels:{coder:['openai/local']},roleVariants:{},smartSelectRoles:[]}
  },null,2))
}

test('project-owned OHO config survives host stripping of unknown top-level hhc config', async()=>{
  const root=mkdtempSync(join(tmpdir(),'hhc-real-config-shape-')); projectConfig(root)
  const resolved=resolveHhcConfigWithReport(undefined,root).config
  assert.equal(resolved.primaryMode,'manager')
  assert.equal(resolved.teamMode.enabled,true)
  assert.equal(resolved.teamMode.maxMembers,3)
  assert.equal(resolved.parallel.enabled,false)
  assert.equal(resolved.routing.maxFallbacks,1)
  assert.deepEqual(resolved.routing.roleModels.coder,['openai/local'])
  const client={app:{log:async()=>({})},provider:{list:async()=>({data:[]})},session:{create:async()=>({data:{id:'child'}}),promptAsync:async()=>({}),abort:async()=>({}),messages:async()=>({data:[]}),status:async()=>({data:{}}),children:async()=>({data:[]}),diff:async()=>({data:[]}),todo:async()=>({data:[]}),revert:async()=>({}),unrevert:async()=>({})}}
  const hooks=await HhcPlugin({directory:root,worktree:root,project:{},client})
  const hostConfig={} // mirrors OpenCode 1.18.x canonical config after unknown `hhc` is stripped
  await hooks.config(hostConfig)
  assert.ok(hooks.tool.hhc_team_create,'Team tool must be enabled from project-owned OHO config')
  assert.ok(hooks.tool.hhc_team_shutdown)
  await hooks.dispose?.(); rmSync(root,{recursive:true,force:true})
})
