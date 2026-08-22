import {createOpenCodeChildSessionPort} from '../../dist/opencode/child-session-port.js'
import {sendSyntheticContinuation} from '../../dist/opencode/client-adapter.js'

export const opencodeChildPort=(client={},lifecycle={})=>createOpenCodeChildSessionPort(client,lifecycle)
export const continuationPort=(client={})=>({continueSession:(sessionID,text,metadata)=>sendSyntheticContinuation(client,sessionID,text,metadata)})


export const makeHostPort=(overrides={})=>({
  capabilities:{childSessions:false,asyncPrompt:false,syncPrompt:false,abort:false,providerInventory:false,appLog:false,sessionStatus:false,childSessionList:false,sessionTodo:false,sessionDiff:false,sessionFork:false,sessionSummarize:false,sessionRevert:false,sessionUnrevert:false,workerRuntime:false,degraded:[],contracts:[]},
  nativeSession:{diff:async()=>undefined,revert:async()=>undefined},
  log:async()=>{},refreshRuntimeInventory:async()=>0,getModels:()=>[],readAssistantResult:async()=>({text:''}),continueSession:async()=>false,
  ...overrides,
})

export const makeChildSessionPort=(overrides={})=>({
  capabilities:{create:true,prompt:true,abort:true,status:true,diff:false,summarize:false,fork:false},
  create:async()=>({child:{id:'child-test'},fork:{requested:false,nativeAvailable:false,used:false}}),
  prompt:async()=>undefined,abort:async()=>'client',status:async()=>'idle',diff:async()=>undefined,summarize:async()=>undefined,
  ...overrides,
})
