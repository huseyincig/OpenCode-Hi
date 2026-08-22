import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeOpenCodeEvent, permissionEventID, eventStatus } from '../dist/opencode/event-adapter.js'

test('permission event id is stable across asked/replied payload shapes',()=>{
  assert.equal(permissionEventID(normalizeOpenCodeEvent({type:'permission.asked',properties:{id:'p-1'}})),'p-1')
  assert.equal(permissionEventID(normalizeOpenCodeEvent({type:'permission.replied',properties:{permissionID:'p-1',response:'allow'}})),'p-1')
})


test('OpenCode 1.18 object-shaped session status is normalized', () => {
  assert.equal(eventStatus(normalizeOpenCodeEvent({type:'session.status',properties:{status:{type:'busy'}}})),'busy')
  assert.equal(eventStatus(normalizeOpenCodeEvent({type:'session.status',properties:{status:{type:'idle'}}})),'idle')
  assert.equal(eventStatus(normalizeOpenCodeEvent({type:'session.status',properties:{status:'completed'}})),'completed')
})


test('OpenCode 1.18.20 session.error normalization preserves bounded API retry metadata only',()=>{
  const ev=normalizeOpenCodeEvent({type:'session.error',properties:{sessionID:'s-1',error:{name:'APIError',data:{message:'network_error',isRetryable:true,statusCode:503,responseBody:'provider-secret-body'}}}})
  assert.deepEqual(ev.error,{name:'APIError',message:'network_error',isRetryable:true,statusCode:503})
  assert.equal('responseBody' in ev.error,false)
})
