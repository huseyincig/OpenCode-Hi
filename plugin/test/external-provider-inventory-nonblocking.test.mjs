import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import HiPlugin from '../dist/plugin.js'

test('chat.message does not block on unresolved native provider inventory', async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-inventory-nonblocking-'))
  let providerCalls=0
  const never=new Promise(()=>{})
  const client={
    provider:{list:async()=>{providerCalls++;return never}},
    app:{log:async()=>({})},
    session:{create:async()=>({data:{id:'child'}}),promptAsync:async()=>({}),abort:async()=>({}),messages:async()=>({data:[]}),status:async()=>({data:{}}),children:async()=>({data:[]}),diff:async()=>({data:[]}),todo:async()=>({data:[]}),revert:async()=>({}),unrevert:async()=>({})}
  }
  const hooks=await HiPlugin({directory:root,worktree:root,project:{},client})
  const cfg={hi:{routing:{roleModels:{coder:['openai/local']}}}}
  await hooks.config(cfg)
  const output={message:{role:'user'},parts:[{type:'text',text:'fix the bug in src/parser.ts'}]}
  const start=Date.now()
  await Promise.race([
    hooks['chat.message']({sessionID:'p1',agent:'working-manager'},output),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('chat.message blocked on provider inventory')),250))
  ])
  assert.ok(Date.now()-start<250)
  assert.equal(providerCalls,1)
  const status=await hooks.tool.hi_status.execute({}, {sessionID:'p1'})
  assert.match(String(status),/Hi:/)
  await hooks.dispose?.()
  rmSync(root,{recursive:true,force:true})
})


test('provider inventory refresh completion schedules a second durable queue wake without blocking chat.message', async()=>{
  const source=readFileSync(new URL('../src/opencode/open-code-hooks.ts',import.meta.url),'utf8')
  assert.match(source,/refreshRuntimeInventory\('chat-message'\)\.then\(\(\)=>tasks\.wakeQueued\(\)\)\.catch\(\(\)=>\{\}\)/)
  assert.match(source,/createChatMessageHook[\s\S]*tasks\.wakeQueued\(\)/)
})
