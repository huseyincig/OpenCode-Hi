import test from 'node:test'
import assert from 'node:assert/strict'
import {lastAssistantError,lastAssistantModel} from '../dist/opencode/client-adapter.js'

test('OpenCode assistant error projection preserves exact V1 named-error identity and message',()=>{
  const error=lastAssistantError([{info:{id:'m1',role:'assistant',error:{name:'ContextOverflowError',data:{message:'maximum context length exceeded'}}},parts:[]}])
  assert.deepEqual(error,{name:'ContextOverflowError',message:'maximum context length exceeded'})
})

test('assistant error projection ignores user messages and accepts direct message error shape',()=>{
  const error=lastAssistantError([
    {info:{role:'assistant'},parts:[]},
    {info:{role:'user',error:{name:'Wrong',data:{message:'must not win'}}},parts:[]},
    {message:{role:'assistant',error:{name:'APIError',message:'429 upstream rate limit'}},parts:[]},
  ])
  assert.deepEqual(error,{name:'APIError',message:'429 upstream rate limit'})
})


test('assistant error projection never leaks an older failed attempt into a newer successful assistant message',()=>{
  const error=lastAssistantError([
    {info:{role:'assistant',error:{name:'APIError',data:{message:'old provider failure'}}},parts:[]},
    {info:{role:'assistant'},parts:[{type:'text',text:'new successful result'}]},
  ])
  assert.equal(error,undefined)
})


test('OpenCode 1.18.20 APIError projection preserves bounded retry truth without provider payload leakage',()=>{
  const error=lastAssistantError([{info:{role:'assistant',error:{name:'APIError',data:{message:'network_error',isRetryable:true,statusCode:503,responseBody:'provider-secret-body',responseHeaders:{authorization:'secret'}}}},parts:[]}])
  assert.deepEqual(error,{name:'APIError',message:'network_error',isRetryable:true,statusCode:503})
  assert.equal('responseBody' in error,false)
  assert.equal('responseHeaders' in error,false)
})


test('OpenCode assistant projection preserves exact prompt ancestry and creation time',()=>{
  const model=lastAssistantModel([{info:{id:'msg_000000000002bbbbbbbbbbbbbb',role:'assistant',providerID:'p',modelID:'m',variant:'fast',parentID:'msg_000000000001aaaaaaaaaaaaaa',time:{created:123,completed:456}},parts:[{type:'text',text:'ok'}]}])
  assert.deepEqual(model,{model:'p/m',variant:'fast',message_id:'msg_000000000002bbbbbbbbbbbbbb',parent_id:'msg_000000000001aaaaaaaaaaaaaa',created_at:123})
})
