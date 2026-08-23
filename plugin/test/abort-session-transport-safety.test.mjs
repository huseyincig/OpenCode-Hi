import test from 'node:test'
import assert from 'node:assert/strict'
import {abortSession} from '../dist/opencode/client-adapter.js'
import {createOpenCodeChildSessionPort} from '../dist/opencode/child-session-port.js'

test('server abort ambiguity reconciles through status without replaying SDK abort',async()=>{
  const originalFetch=globalThis.fetch
  const calls=[]
  let sdkAbort=0
  globalThis.fetch=async(input,init={})=>{
    const url=String(input),method=String(init.method??'GET').toUpperCase();calls.push({method,url})
    if(method==='POST'&&url==='http://127.0.0.1:9/session/child-1/abort')return new Response(JSON.stringify({error:'ambiguous'}),{status:503,headers:{'content-type':'application/json'}})
    if(method==='GET'&&url==='http://127.0.0.1:9/session/status')return new Response('{}',{status:200,headers:{'content-type':'application/json'}})
    throw new Error(`unexpected request: ${method} ${url}`)
  }
  try{
    const client={session:{abort:async()=>{sdkAbort++;return{data:true}}}}
    assert.equal(await abortSession(client,'child-1',{serverUrl:'http://127.0.0.1:9'}),'server-reconciled')
    assert.equal(sdkAbort,0,'an ambiguous server mutation must never trigger SDK abort replay')
    assert.deepEqual(calls,[
      {method:'POST',url:'http://127.0.0.1:9/session/child-1/abort'},
      {method:'GET',url:'http://127.0.0.1:9/session/status'},
      {method:'GET',url:'http://127.0.0.1:9/permission'},
    ])
  }finally{globalThis.fetch=originalFetch}
})

test('server abort ambiguity fails closed while host still reports busy',async()=>{
  const originalFetch=globalThis.fetch
  let sdkAbort=0
  globalThis.fetch=async(input,init={})=>{
    const url=String(input),method=String(init.method??'GET').toUpperCase()
    if(method==='POST'&&url.endsWith('/session/child-2/abort'))throw new Error('connection lost after dispatch')
    if(method==='GET'&&url.endsWith('/session/status'))return new Response(JSON.stringify({'child-2':{type:'busy'}}),{status:200,headers:{'content-type':'application/json'}})
    throw new Error(`unexpected request: ${method} ${url}`)
  }
  try{
    const client={session:{abort:async()=>{sdkAbort++;return{data:true}}}}
    assert.equal(await abortSession(client,'child-2',{serverUrl:'http://127.0.0.1:9'}),'unavailable')
    assert.equal(sdkAbort,0,'busy reconciliation must fail closed instead of replaying the mutation')
  }finally{globalThis.fetch=originalFetch}
})


test('acknowledged server abort fails closed while the cancelled child still owns a pending native permission',async()=>{
  const originalFetch=globalThis.fetch
  const calls=[]
  globalThis.fetch=async(input,init={})=>{
    const url=String(input),method=String(init.method??'GET').toUpperCase();calls.push({method,url})
    if(method==='POST'&&url==='http://127.0.0.1:9/session/child-permission/abort')return new Response('true',{status:200,headers:{'content-type':'application/json'}})
    if(method==='GET'&&url==='http://127.0.0.1:9/permission')return new Response(JSON.stringify([{id:'per-stale',sessionID:'child-permission',permission:'bash',patterns:['pwd'],metadata:{},always:['pwd']}]),{status:200,headers:{'content-type':'application/json'}})
    throw new Error(`unexpected request: ${method} ${url}`)
  }
  try{
    assert.equal(await abortSession({session:{}},'child-permission',{serverUrl:'http://127.0.0.1:9'}),'unavailable')
    assert.deepEqual(calls,[
      {method:'POST',url:'http://127.0.0.1:9/session/child-permission/abort'},
      {method:'GET',url:'http://127.0.0.1:9/permission'},
    ])
  }finally{globalThis.fetch=originalFetch}
})

test('acknowledged server abort ignores pending native permissions owned by other sessions',async()=>{
  const originalFetch=globalThis.fetch
  globalThis.fetch=async(input,init={})=>{
    const url=String(input),method=String(init.method??'GET').toUpperCase()
    if(method==='POST'&&url==='http://127.0.0.1:9/session/child-clean/abort')return new Response('true',{status:200,headers:{'content-type':'application/json'}})
    if(method==='GET'&&url==='http://127.0.0.1:9/permission')return new Response(JSON.stringify([{id:'per-other',sessionID:'other-child',permission:'bash',patterns:['pwd'],metadata:{},always:['pwd']}]),{status:200,headers:{'content-type':'application/json'}})
    throw new Error(`unexpected request: ${method} ${url}`)
  }
  try{assert.equal(await abortSession({session:{}},'child-clean',{serverUrl:'http://127.0.0.1:9'}),'server')}
  finally{globalThis.fetch=originalFetch}
})

test('SDK abort chooses one mutation and uses SDK status only for ambiguous acknowledgement',async()=>{
  let aborts=0,statuses=0
  const ambiguous={session:{
    abort:async()=>{aborts++;return{error:{message:'ambiguous'}}},
    status:async()=>{statuses++;return{data:{}}},
  }}
  assert.equal(await abortSession(ambiguous,'child-3'),'client-reconciled')
  assert.equal(aborts,1);assert.equal(statuses,1)

  aborts=0;statuses=0
  const acknowledged={session:{
    abort:async()=>{aborts++;return{data:true}},
    status:async()=>{statuses++;return{data:{'child-3':{type:'busy'}}}},
  }}
  assert.equal(await abortSession(acknowledged,'child-3'),'client')
  assert.equal(aborts,1);assert.equal(statuses,0)
})

test('lifecycle server independently exposes abort capability',()=>{
  const port=createOpenCodeChildSessionPort({session:{}},{serverUrl:'http://127.0.0.1:9'})
  assert.equal(port.capabilities.abort,true)
})
