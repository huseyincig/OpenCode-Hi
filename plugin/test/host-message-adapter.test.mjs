import test from 'node:test'
import assert from 'node:assert/strict'
import {lastAssistantError,lastAssistantModel,lastMeaningfulAssistantActivity} from '../dist/opencode/client-adapter.js'

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


test('meaningful assistant activity ignores a newer open zero-token turn and retains completed tool progress',()=>{
  const activity=lastMeaningfulAssistantActivity([
    {info:{id:'msg-progress',role:'assistant',time:{created:100,completed:220},tokens:{input:10,output:24,reasoning:3,cache:{read:0,write:0}}},parts:[{type:'text',text:'checking browser'},{type:'tool',tool:'hi_browser_click',state:{status:'completed'}}]},
    {info:{id:'msg-open',role:'assistant',time:{created:230},tokens:{input:0,output:0,reasoning:0,cache:{read:0,write:0}}},parts:[{type:'step-start'}]},
  ])
  assert.deepEqual(activity,{message_id:'msg-progress',observed_at:220,output_tokens:24,reasoning_tokens:3,tool_calls:1,text_chars:16})
})
