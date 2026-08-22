import type { OpenCodeClient } from './types.js'
import { dataOf, modelIdentity } from './client-adapter.js'

export type NativeCapabilityName =
  | 'session-create'|'prompt-async'|'prompt-sync'|'abort'|'status'|'children'|'todo'|'diff'|'fork'|'summarize'|'revert'|'unrevert'
  | 'provider-inventory'|'structured-log'
export type NativeOperationName=NativeCapabilityName|'version'
export type NativeOperationEffect='read-only'|'mutating'
const NATIVE_OPERATION_EFFECT:Record<NativeOperationName,NativeOperationEffect>={
  'session-create':'mutating','prompt-async':'mutating','prompt-sync':'mutating','abort':'mutating',
  status:'read-only',children:'read-only',todo:'read-only',diff:'read-only',
  fork:'mutating',summarize:'mutating',revert:'mutating',unrevert:'mutating',
  'provider-inventory':'read-only','structured-log':'mutating',version:'read-only',
}
export function nativeOperationEffect(name:NativeOperationName):NativeOperationEffect{return NATIVE_OPERATION_EFFECT[name]}

export interface NativeSessionSnapshot {
  status?: unknown
  children?: unknown[]
  todo?: unknown[]
  diff?: unknown
}

function fn(root:any,...names:string[]):((arg:any)=>Promise<any>)|undefined{
  for(const name of names){const v=root?.[name];if(typeof v==='function')return v.bind(root)}
  return undefined
}

export class NativeOpenCodeAdapter {
  constructor(readonly client:OpenCodeClient){}
  has(name:NativeCapabilityName):boolean{
    const s=this.client?.session
    switch(name){
      case 'session-create':return Boolean(fn(s,'create'))
      case 'prompt-async':return Boolean(fn(s,'promptAsync','prompt_async'))
      case 'prompt-sync':return Boolean(fn(s,'prompt'))
      case 'abort':return Boolean(fn(s,'abort'))
      case 'status':return Boolean(fn(s,'status','getStatus'))
      case 'children':return Boolean(fn(s,'children','child','listChildren'))
      case 'todo':return Boolean(fn(s,'todo','todos'))
      case 'diff':return Boolean(fn(s,'diff'))
      case 'fork':return Boolean(fn(s,'fork'))
      case 'summarize':return Boolean(fn(s,'summarize','summary'))
      case 'revert':return Boolean(fn(s,'revert'))
      case 'unrevert':return Boolean(fn(s,'unrevert'))
      case 'provider-inventory':return Boolean(fn(this.client?.provider,'list')||fn(this.client?.config,'providers'))
      case 'structured-log':return Boolean(fn(this.client?.app,'log'))
    }
  }
  async status(sessionID:string):Promise<any>{const call=fn(this.client?.session,'status','getStatus');return call?dataOf(await call({path:{id:sessionID}})):undefined}
  async children(sessionID:string):Promise<any[]>{const call=fn(this.client?.session,'children','child','listChildren');const value=call?dataOf<any>(await call({path:{id:sessionID}})):[];return Array.isArray(value)?value:(Array.isArray(value?.children)?value.children:[])}
  async todo(sessionID:string):Promise<any[]>{const call=fn(this.client?.session,'todo','todos');const value=call?dataOf<any>(await call({path:{id:sessionID}})):[];return Array.isArray(value)?value:(Array.isArray(value?.todos)?value.todos:[])}
  async diff(sessionID:string):Promise<any>{const call=fn(this.client?.session,'diff');return call?dataOf(await call({path:{id:sessionID}})):undefined}
  async fork(sessionID:string,title?:string):Promise<any>{const call=fn(this.client?.session,'fork');if(!call)throw new Error('OpenCode session.fork unavailable');return dataOf(await call({path:{id:sessionID},body:title?{title}:{}}))}
  async summarize(sessionID:string):Promise<any>{const call=fn(this.client?.session,'summarize','summary');if(!call)throw new Error('OpenCode session.summarize unavailable');return dataOf(await call({path:{id:sessionID}}))}
  async revert(sessionID:string,messageID?:string):Promise<any>{const call=fn(this.client?.session,'revert');if(!call)throw new Error('OpenCode session.revert unavailable');return dataOf(await call({path:{id:sessionID},body:messageID?{messageID}:{}}))}
  async unrevert(sessionID:string):Promise<any>{const call=fn(this.client?.session,'unrevert');if(!call)throw new Error('OpenCode session.unrevert unavailable');return dataOf(await call({path:{id:sessionID}}))}
  async prompt(sessionID:string,text:string,agent?:string,model?:string,variant?:string):Promise<void>{
    const body:any={parts:[{type:'text',text}]};if(agent)body.agent=agent;const identity=modelIdentity(model);if(identity)body.model=identity;if(variant)body.variant=variant
    const call=fn(this.client?.session,'promptAsync','prompt_async')??fn(this.client?.session,'prompt');if(!call)throw new Error('OpenCode session prompt API unavailable');await call({path:{id:sessionID},body})
  }
  async version():Promise<string|undefined>{const candidates:Array<[any,string[]]>=[ [this.client?.app,['version']], [this.client?.server,['version']], [this.client?.app,['info']] ];for(const [root,names] of candidates){const call=fn(root,...names);if(!call)continue;try{const value=dataOf<any>(await call({}));const raw=typeof value==='string'?value:value?.version??value?.opencodeVersion;if(raw)return String(raw)}catch{}}return process.env.OPENCODE_VERSION??process.env.OPENCODE_CLI_VERSION}
  async snapshot(sessionID:string):Promise<NativeSessionSnapshot>{
    const [status,children,todo,diff]=await Promise.allSettled([this.status(sessionID),this.children(sessionID),this.todo(sessionID),this.diff(sessionID)])
    return{status:status.status==='fulfilled'?status.value:undefined,children:children.status==='fulfilled'?children.value:undefined,todo:todo.status==='fulfilled'?todo.value:undefined,diff:diff.status==='fulfilled'?diff.value:undefined}
  }
}

export function effectiveConfigView(hostConfig:Record<string,unknown>|undefined):Record<string,unknown>{return hostConfig&&typeof hostConfig==='object'?hostConfig:{}}

export function configuredSubagentDepth(hostConfig:Record<string,unknown>|undefined):number|undefined{
  const raw=(hostConfig as any)?.subagent_depth
  return Number.isFinite(Number(raw))?Number(raw):undefined
}

export { providerPolicyView } from '../runtime/host/provider-policy.js'

export function configuredRemoteInstructions(hostConfig:Record<string,unknown>|undefined):string[]{
  const cfg:any=effectiveConfigView(hostConfig),raw=cfg?.instructions,items=Array.isArray(raw)?raw:(typeof raw==='string'?[raw]:[])
  return items.filter((x:any)=>typeof x==='string'&&/^https?:\/\//i.test(x)).map(String)
}

export function configuredPluginSpecs(hostConfig:Record<string,unknown>|undefined):string[]{
  const raw=(effectiveConfigView(hostConfig) as any)?.plugin
  return Array.isArray(raw)?raw.filter((x:any)=>typeof x==='string').map(String):[]
}

export function configuredShareMode(hostConfig:Record<string,unknown>|undefined):unknown{return (effectiveConfigView(hostConfig) as any)?.share}
