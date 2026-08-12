import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeOpenCodeEvent, permissionEventID } from '../dist/opencode/event-adapter.js'

test('permission event id is stable across asked/replied payload shapes',()=>{
  assert.equal(permissionEventID(normalizeOpenCodeEvent({type:'permission.asked',properties:{id:'p-1'}})),'p-1')
  assert.equal(permissionEventID(normalizeOpenCodeEvent({type:'permission.replied',properties:{permissionID:'p-1',response:'allow'}})),'p-1')
})
