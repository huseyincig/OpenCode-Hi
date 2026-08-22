import test from 'node:test'
import assert from 'node:assert/strict'
import {readSessionRuntimeStatus} from '../dist/opencode/client-adapter.js'

test('session status projection prefers the injected OpenCode SDK read even when a lifecycle server URL exists',async()=>{
  const originalFetch=globalThis.fetch
  let fetches=0,statusCalls=0
  globalThis.fetch=async()=>{fetches++;throw new Error('HTTP fallback must not run after valid native status')}
  try{
    const client={session:{status:async(...args)=>{statusCalls++;assert.equal(args.length,0,'match exact OpenCode 1.18.20 sdk.session.status() call shape');return{data:{}}}}}
    assert.equal(await readSessionRuntimeStatus(client,'child-idle',{serverUrl:'http://127.0.0.1:9',directory:'/workspace/fixture'}),'idle')
    assert.equal(statusCalls,1)
    assert.equal(fetches,0)
  }finally{globalThis.fetch=originalFetch}
})

test('session status read-only fallback uses the OpenCode GET directory query instead of an encoded directory header',async()=>{
  const originalFetch=globalThis.fetch
  let statusCalls=0
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(String(input))
    assert.equal(url.origin,'http://127.0.0.1:9')
    assert.equal(url.pathname,'/session/status')
    assert.equal(url.searchParams.get('directory'),'/workspace/fixture')
    const headers=new Headers(init.headers)
    assert.equal(headers.has('x-opencode-directory'),false,'GET directory ownership belongs to the canonical query projection')
    return new Response(JSON.stringify({'child-busy':{type:'busy'}}),{status:200,headers:{'content-type':'application/json'}})
  }
  try{
    const client={session:{status:async()=>{statusCalls++;throw new Error('simulated injected SDK read failure')}}}
    assert.equal(await readSessionRuntimeStatus(client,'child-busy',{serverUrl:'http://127.0.0.1:9',directory:'/workspace/fixture'}),'busy')
    assert.equal(statusCalls,1)
  }finally{globalThis.fetch=originalFetch}
})

test('session status fallback treats absence from a valid OpenCode status map as canonical idle',async()=>{
  const originalFetch=globalThis.fetch
  globalThis.fetch=async()=>new Response('{}',{status:200,headers:{'content-type':'application/json'}})
  try{
    assert.equal(await readSessionRuntimeStatus({session:{}},'child-idle',{serverUrl:'http://127.0.0.1:9',directory:'/workspace/fixture'}),'idle')
  }finally{globalThis.fetch=originalFetch}
})
