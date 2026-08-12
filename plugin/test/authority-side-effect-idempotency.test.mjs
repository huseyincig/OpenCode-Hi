import test from 'node:test'
import assert from 'node:assert/strict'
import { MissionStore } from '../dist/runtime/mission/mission-store.js'
import { createToolBeforeHook } from '../dist/hooks/tool-before.js'
import { createToolAfterHook, authorityOutcome } from '../dist/hooks/tool-after.js'
import { actionContract, approvePendingAuthority, requireAuthority } from '../dist/runtime/safety/authority.js'

function authorize(m,command,cwd){
  try{requireAuthority(m,command,cwd)}catch{}
  assert.equal(approvePendingAuthority(m,'approve'),true)
}

test('privileged bash success requires explicit exit=0 metadata', async()=>{
  const store=new MissionStore(); const m=store.start('s','deploy release')
  const before=createToolBeforeHook(store), after=createToolAfterHook(store)
  authorize(m,'git push','/repo')
  await before({sessionID:'s',tool:'bash',args:{command:'git push',cwd:'/repo'}},{args:{command:'git push',cwd:'/repo'}})
  assert.ok(m.authority?.executing)
  await after({sessionID:'s',tool:'bash',args:{command:'git push',cwd:'/repo'}},{title:'push',output:'Everything up-to-date',metadata:{exit:0}})
  assert.equal(m.authority?.executing,undefined)
  assert.ok(m.authority?.completed_hashes?.includes(actionContract('git push','/repo').hash))
})

test('empty or unstructured privileged output is UNKNOWN, never implicit success', async()=>{
  const store=new MissionStore(); const m=store.start('s','deploy release')
  const before=createToolBeforeHook(store), after=createToolAfterHook(store)
  authorize(m,'git push','/repo')
  await before({sessionID:'s',tool:'bash',args:{command:'git push',cwd:'/repo'}},{args:{command:'git push',cwd:'/repo'}})
  await after({sessionID:'s',tool:'bash',args:{command:'git push',cwd:'/repo'}},{title:'push',output:'',metadata:{}})
  assert.ok(m.authority?.executing,'unknown ACK must keep action in-flight/uncertain')
  assert.equal(m.status,'waiting-user')
  assert.ok(!(m.authority?.completed_hashes??[]).includes(actionContract('git push','/repo').hash))
  await assert.rejects(()=>before({sessionID:'s',tool:'bash',args:{command:'git push',cwd:'/repo'}},{args:{command:'git push',cwd:'/repo'}}),/already in-flight or completed/)
})

test('nonzero exit is deterministic failure but persistent/native authority may retry without a second HHC approval', async()=>{
  const store=new MissionStore(); const m=store.start('s','deploy release')
  const before=createToolBeforeHook(store), after=createToolAfterHook(store)
  authorize(m,'git push','/repo')
  await before({sessionID:'s',tool:'bash',args:{command:'git push',cwd:'/repo'}},{args:{command:'git push',cwd:'/repo'}})
  await after({sessionID:'s',tool:'bash',args:{command:'git push',cwd:'/repo'}},{title:'push',output:'rejected',metadata:{exit:1}})
  assert.equal(m.authority?.executing,undefined)
  assert.equal(m.status,'waiting-user')
  await before({sessionID:'s',tool:'bash',args:{command:'git push',cwd:'/repo'}},{args:{command:'git push',cwd:'/repo'}})
  assert.ok(m.authority?.executing,'retry may proceed after host permission resolution; HHC must not add a second approval gate')
})

test('authority outcome uses OpenCode bash metadata.exit and treats no exit signal as unknown',()=>{
  assert.equal(authorityOutcome({metadata:{exit:0}},''),'success')
  assert.equal(authorityOutcome({metadata:{exit:7}},'anything'),'failure')
  assert.equal(authorityOutcome({metadata:{}},'Everything up-to-date'),'unknown')
  assert.equal(authorityOutcome({metadata:{}},'transport connection lost'),'failure')
})

test('separate privileged action hashes own separate authority obligations',()=>{
  const store=new MissionStore(); const m=store.start('s','publish and deploy')
  try{requireAuthority(m,'npm publish','/repo')}catch{}
  try{requireAuthority(m,'git push','/repo')}catch{}
  const a=actionContract('npm publish','/repo').hash.slice(0,10)
  const b=actionContract('git push','/repo').hash.slice(0,10)
  assert.ok(m.obligations.some(o=>o.id===`o-authority-${a}`&&o.status==='open'))
  assert.ok(m.obligations.some(o=>o.id===`o-authority-${b}`&&o.status==='open'))
})
