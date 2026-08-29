import test from 'node:test'
import assert from 'node:assert/strict'
import {lastAssistantError,lastAssistantModel,lastIncompleteAssistantTurn,lastMeaningfulAssistantActivity} from '../dist/opencode/client-adapter.js'
import {createHostPort} from '../dist/opencode/host-port.js'

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


test('OpenCode assistant-result readback keeps settlement on the newest assistant while retaining bounded prior activity for restart recovery',async()=>{
  const calls=[]
  const staleStructured={status:'DONE',summary:'old attempt must not settle',changed_files:[],evidence:[],open_issues:[],needs_context:[]}
  const client={session:{messages:async request=>{calls.push(request);return{data:[
    {info:{id:'msg-old',role:'assistant',providerID:'p',modelID:'m',parentID:'msg-old-user',structured:staleStructured,time:{created:10,completed:20},tokens:{input:1,output:2,reasoning:0,cache:{read:0,write:0}},cost:0},parts:[{type:'text',text:'old compatibility text'},{type:'tool',tool:'hi_browser_close'}]},
    {info:{id:'msg-open',role:'assistant',providerID:'p',modelID:'m',parentID:'msg-current-user',time:{created:30},tokens:{input:0,output:0,reasoning:0,cache:{read:0,write:0}},cost:0},parts:[]},
  ]}}}}
  const host=createHostPort({directory:'/repo',worktree:'/repo',project:{},client,experimental_workspace:{register(){}},$:()=>{}})
  const result=await host.readAssistantResult('child-json-schema')
  assert.equal(calls.length,1)
  assert.deepEqual(calls[0],{path:{id:'child-json-schema'},query:{limit:20}})
  assert.equal(result.structured,undefined);assert.equal(result.text,'');assert.equal(result.model?.parent_id,'msg-current-user')
  assert.deepEqual(result.incomplete_turn,{message_id:'msg-open',parent_id:'msg-current-user',created_at:30,empty:true})
  assert.deepEqual(result.activity,{message_id:'msg-old',observed_at:20,output_tokens:2,reasoning_tokens:0,tool_calls:1,text_chars:22})
})

test('incomplete assistant turn projection rejects a completed newest message and marks an empty open successor',()=>{
  assert.equal(lastIncompleteAssistantTurn([{info:{id:'done',role:'assistant',time:{created:1,completed:2}},parts:[]}]),undefined)
  assert.deepEqual(lastIncompleteAssistantTurn([{info:{id:'open',role:'assistant',parentID:'user-1',time:{created:3},tokens:{output:0,reasoning:0}},parts:[]}]),{message_id:'open',parent_id:'user-1',created_at:3,empty:true})
})
