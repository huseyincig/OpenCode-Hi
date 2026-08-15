import type { OpenCodeClient } from './types.js'
import {abortSession,createChildSession,sendPromptAsync,type OpenCodeLifecycleEndpoint} from './client-adapter.js'
import {NativeOpenCodeAdapter} from './native-adapter.js'
import type {ChildSessionPort} from '../runtime/host/port.js'

export function createOpenCodeChildSessionPort(client:OpenCodeClient,lifecycle:OpenCodeLifecycleEndpoint={}):ChildSessionPort{
  const native=new NativeOpenCodeAdapter(client)
  return{
    capabilities:{
      create:native.has('session-create'),prompt:native.has('prompt-async')||native.has('prompt-sync'),abort:native.has('abort'),
      diff:native.has('diff'),summarize:native.has('summarize'),fork:native.has('fork'),
    },
    async create(request){
      const {parentSessionID,title,role,model,variant,workspace,forkFromSession}=request
      const child=await createChildSession(client,parentSessionID,title,role,model,variant,workspace?.workspaceID,lifecycle)
      return{child,fork:{requested:Boolean(forkFromSession),nativeAvailable:Boolean(forkFromSession)&&native.has('fork'),used:false,reason:forkFromSession?'native fork cannot set specialist agent; created isolated child instead':undefined}}
    },
    prompt:(sessionID,text,role,model,variant,tools)=>sendPromptAsync(client,sessionID,text,role,model,variant,tools),
    abort:(sessionID)=>abortSession(client,sessionID,lifecycle),
    diff:(sessionID)=>native.diff(sessionID),
    summarize:(sessionID)=>native.summarize(sessionID),
  }
}
