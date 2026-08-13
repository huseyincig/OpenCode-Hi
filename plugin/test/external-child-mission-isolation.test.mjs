import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import HiPlugin from '../dist/plugin.js'
import { assessPluginMission } from './helpers/semantic.mjs'

test('native Hi child prompt cannot create a nested top-level mission', async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-child-mission-isolation-'))
  let n=0
  const client={
    app:{log:async()=>({})},provider:{list:async()=>({data:{all:[{id:'openai',models:[{id:'local'}]}]}})},
    session:{
      create:async()=>({data:{id:`child-${++n}`}}),
      promptAsync:async()=>({}),abort:async()=>({}),messages:async()=>({data:[]}),status:async()=>({data:{}}),children:async()=>({data:[]}),diff:async()=>({data:[]}),todo:async()=>({data:[]}),revert:async()=>({}),unrevert:async()=>({})
    }
  }
  const hooks=await HiPlugin({directory:root,worktree:root,project:{},client})
  const cfg={}; await hooks.config(cfg)
  await hooks['chat.message']({sessionID:'parent',agent:'working-manager'},{message:{role:'user'},parts:[{type:'text',text:'fix the bug in src/parser.ts'}]}); await assessPluginMission(hooks,'parent',{task_kind:'bug-fix',required_capabilities:['implementation'],likely_targets:['src/parser.ts']})
  const started=JSON.parse(await hooks.tool.hi_task_start.execute({objective:'fix parser',role:'coder',category:'standard',model:'openai/local',scope:'src/parser.ts'},{sessionID:'parent'}))
  assert.equal(started.session_id,'child-1')
  await hooks['chat.message']({sessionID:'child-1',agent:'coder'},{message:{role:'user'},parts:[{type:'text',text:'Hi CHILD CONTROL-PLANE CONTRACT\nworker handoff'}]})
  assert.equal(await hooks.tool.hi_status.execute({}, {sessionID:'child-1'}),'Hi: no active mission')
  assert.match(String(await hooks.tool.hi_status.execute({}, {sessionID:'parent'})),/Hi:/)
  await hooks.dispose?.();rmSync(root,{recursive:true,force:true})
})
