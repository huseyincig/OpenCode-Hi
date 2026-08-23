import type { OpenCodeClient } from './types.js'
import { createOpencodeClient as createOpenCodeV2Client } from '@opencode-ai/sdk/v2/client'
import { EMPTY_TOKEN_USAGE,addTokenUsage,type ExecutionTokenUsage,type HostUsageObservation } from '../contracts/execution-usage.js'
export function dataOf<T=any>(value:any):T { return (value && typeof value==='object' && 'data' in value) ? value.data as T : value as T }

// `prompt_async` is an immediate OpenCode host-acceptance mutation. This bounds only that acknowledgement; provider execution remains OpenCode-owned.
const HOST_MUTATION_ACK_TIMEOUT_MS=15_000
class OpenCodeMutationAckTimeoutError extends Error{readonly code='ETIMEDOUT';constructor(operation:string,timeoutMs:number){super(`OpenCode ${operation} acknowledgement timed out after ${timeoutMs}ms`);this.name='OpenCodeMutationAckTimeoutError'}}
async function awaitPromptAsyncAck<T>(invoke:(signal:AbortSignal)=>Promise<T>,operation:string,timeoutMs:number):Promise<T>{
  const bounded=Number.isFinite(timeoutMs)&&timeoutMs>0?Math.floor(timeoutMs):HOST_MUTATION_ACK_TIMEOUT_MS,controller=new AbortController(),pending=Promise.resolve().then(()=>invoke(controller.signal));pending.catch(()=>{})
  let timer:ReturnType<typeof setTimeout>|undefined
  try{return await Promise.race([pending,new Promise<T>((_resolve,reject)=>{timer=setTimeout(()=>{const error=new OpenCodeMutationAckTimeoutError(operation,bounded);controller.abort(error);reject(error)},bounded)})])}
  finally{if(timer)clearTimeout(timer)}
}
function mutationResultError(value:any):unknown{return value&&typeof value==='object'&&'error' in value&&value.error?value.error:undefined}
function mutationErrorText(value:unknown):string{if(value instanceof Error&&value.message.trim())return value.message.trim();if(value&&typeof value==='object'){const v=value as any;for(const item of [v?.data?.message,v?.message,v?.name])if(typeof item==='string'&&item.trim())return item.trim()}return String(value)}
function assertMutationAccepted(value:any,operation:string):void{const rejected=mutationResultError(value);if(rejected===undefined)return;if(rejected instanceof Error)throw rejected;const error=new Error(`OpenCode ${operation} rejected: ${mutationErrorText(rejected)}`);(error as any).cause=rejected;throw error}

export async function createChildSession(client:OpenCodeClient,parentID:string,title:string,agent?:string,model?:string,variant?:string,workspaceID?:string,endpoint:OpenCodeLifecycleEndpoint={}):Promise<any>{
  const identity=modelIdentity(model)
  if(workspaceID&&endpoint.serverUrl&&endpoint.directory){
    const v2=createOpenCodeV2Client({baseUrl:endpoint.serverUrl,directory:endpoint.directory}),session=v2?.session
    if(!session||typeof session.create!=='function')throw new Error('OpenCode canonical v2 session.create unavailable for workspace binding')
    const params:any={parentID,title,workspace:workspaceID,workspaceID};if(agent)params.agent=agent;if(identity)params.model={id:identity.modelID,providerID:identity.providerID,...(variant?{variant}:{})}
    return dataOf(await session.create(params))
  }
  const edge=client as any
  if(typeof edge?.session?.create!=='function') throw new Error('OpenCode session.create unavailable')
  const body:any={parentID,title};if(agent)body.agent=agent;if(workspaceID)body.workspaceID=workspaceID;if(identity)body.model={id:identity.modelID,providerID:identity.providerID,...(variant?{variant}: {})}
  return dataOf(await edge.session.create({body}))
}


export function modelIdentity(model?:string):{providerID:string;modelID:string}|undefined{
  if(!model)return undefined;const slash=model.indexOf('/');if(slash<=0||slash===model.length-1)return undefined
  return{providerID:model.slice(0,slash),modelID:model.slice(slash+1)}
}

export async function sendPromptAsync(client:OpenCodeClient,sessionID:string,text:string,agent?:string,model?:string,variant?:string,tools?:Record<string,boolean>,ackTimeoutMs=HOST_MUTATION_ACK_TIMEOUT_MS):Promise<void>{
  const edge=client as any
  const body:any={parts:[{type:'text',text}]};if(agent)body.agent=agent;const identity=modelIdentity(model);if(identity)body.model=identity;if(variant)body.variant=variant;if(tools&&Object.keys(tools).length)body.tools=tools
  if(typeof edge?.session?.promptAsync==='function'){const result=await awaitPromptAsyncAck(signal=>edge.session.promptAsync({path:{id:sessionID},body,signal,throwOnError:true}),`session.prompt_async:${sessionID}`,ackTimeoutMs);assertMutationAccepted(result,`session.prompt_async:${sessionID}`);return}
  if(typeof edge?.session?.prompt==='function'){const result=await edge.session.prompt({path:{id:sessionID},body,throwOnError:true});assertMutationAccepted(result,`session.prompt:${sessionID}`);return}
  throw new Error('OpenCode session prompt API unavailable')
}

export async function listMessages(client:OpenCodeClient,sessionID:string,limit=20):Promise<any[]>{
  const edge=client as any
  if(typeof edge?.session?.messages==='function') return dataOf(await edge.session.messages({path:{id:sessionID},query:{limit}})) ?? []
  return []
}

export async function sendSyntheticContinuation(client:OpenCodeClient,sessionID:string,text:string,metadata:Record<string,unknown>,ackTimeoutMs=HOST_MUTATION_ACK_TIMEOUT_MS):Promise<boolean>{
  const edge=client as any,body={parts:[{type:'text',text,synthetic:true,metadata}],noReply:false}
  if(typeof edge?.session?.promptAsync==='function'){const result=await awaitPromptAsyncAck(signal=>edge.session.promptAsync({path:{id:sessionID},body,signal,throwOnError:true}),`session.prompt_async:${sessionID}`,ackTimeoutMs);assertMutationAccepted(result,`session.prompt_async:${sessionID}`);return true}
  if(typeof edge?.session?.prompt==='function'){const result=await edge.session.prompt({path:{id:sessionID},body,throwOnError:true});assertMutationAccepted(result,`session.prompt:${sessionID}`);return true}
  return false
}

export interface OpenCodeLifecycleEndpoint{serverUrl?:string;directory?:string}
function lifecycleHeaders(directory?:string):Record<string,string>{
  const headers:Record<string,string>={}
  if(directory)headers['x-opencode-directory']=encodeURIComponent(directory)
  const password=process.env.OPENCODE_SERVER_PASSWORD
  if(password){const username=process.env.OPENCODE_SERVER_USERNAME??'opencode';headers.Authorization=`Basic ${btoa(`${username}:${password}`)}`}
  return headers
}
export type AbortSessionResult='server'|'server-reconciled'|'client'|'client-reconciled'|'unavailable'
export type SessionRuntimeStatus='idle'|'busy'|'retry'|'unknown'
export function sessionRuntimeStatusFromStatus(value:unknown,sessionID:string):SessionRuntimeStatus{
  const statusMap=dataOf<any>(value)
  if(!statusMap||typeof statusMap!=='object'||Array.isArray(statusMap))return'unknown'
  const status=statusMap[sessionID]
  // Exact OpenCode 1.18.19 removes idle sessions from the status map; absence is canonical idle.
  if(status===undefined)return'idle'
  if(!status||typeof status!=='object')return'unknown'
  const type=String(status.type??'').toLowerCase()
  return type==='idle'||type==='busy'||type==='retry'?type:'unknown'
}
function sessionIdleFromStatus(value:unknown,sessionID:string):boolean|undefined{const status=sessionRuntimeStatusFromStatus(value,sessionID);return status==='idle'?true:status==='busy'||status==='retry'?false:undefined}
export async function readSessionRuntimeStatus(client:OpenCodeClient,sessionID:string,endpoint:OpenCodeLifecycleEndpoint={}):Promise<SessionRuntimeStatus>{
  const edge=client as any,call=edge?.session?.status
  if(typeof call==='function'){
    try{const status=sessionRuntimeStatusFromStatus(await call.call(edge.session),sessionID);if(status!=='unknown')return status}catch{}
  }
  if(endpoint.serverUrl){
    try{const base=endpoint.serverUrl.replace(/\/$/,''),url=new URL(`${base}/session/status`);if(endpoint.directory)url.searchParams.set('directory',endpoint.directory);const response=await fetch(url,{method:'GET',headers:lifecycleHeaders(),signal:AbortSignal.timeout(5000)});if(!response.ok)return'unknown';return sessionRuntimeStatusFromStatus(await response.json(),sessionID)}catch{return'unknown'}
  }
  return'unknown'
}
async function reconcileServerAbort(base:string,sessionID:string,directory?:string):Promise<boolean>{
  try{
    const response=await fetch(`${base}/session/status`,{method:'GET',headers:lifecycleHeaders(directory),signal:AbortSignal.timeout(5000)})
    if(!response.ok)return false
    return sessionIdleFromStatus(await response.json(),sessionID)===true
  }catch{return false}
}
async function reconcileClientAbort(edge:any,sessionID:string):Promise<boolean>{
  if(typeof edge?.session?.status!=='function')return false
  try{return sessionIdleFromStatus(await edge.session.status(),sessionID)===true}catch{return false}
}
export async function abortSession(client:OpenCodeClient,sessionID:string,endpoint:OpenCodeLifecycleEndpoint={}):Promise<AbortSessionResult>{
  const edge=client as any
  if(endpoint.serverUrl){
    const base=endpoint.serverUrl.replace(/\/$/,'')
    try{
      const response=await fetch(`${base}/session/${encodeURIComponent(sessionID)}/abort`,{method:'POST',headers:lifecycleHeaders(endpoint.directory),signal:AbortSignal.timeout(5000)})
      if(response.ok){try{if(await response.json()===true)return'server'}catch{}}
    }catch{}
    return await reconcileServerAbort(base,sessionID,endpoint.directory)?'server-reconciled':'unavailable'
  }
  if(typeof edge?.session?.abort!=='function')return'unavailable'
  try{
    const result=await edge.session.abort({path:{id:sessionID}})
    if((result===true||dataOf(result)===true)&&!(result&&typeof result==='object'&&result.error))return'client'
  }catch{}
  return await reconcileClientAbort(edge,sessionID)?'client-reconciled':'unavailable'
}
export async function listProviders(client:OpenCodeClient):Promise<unknown>{const edge=client as any;if(typeof edge?.provider?.list==='function')return dataOf(await edge.provider.list());return undefined}
export async function listAvailableModels(endpoint:OpenCodeLifecycleEndpoint={}):Promise<unknown[]|undefined>{
  if(!endpoint.serverUrl)return undefined
  try{
    const client=createOpenCodeV2Client({baseUrl:endpoint.serverUrl,directory:endpoint.directory,headers:lifecycleHeaders(endpoint.directory)}),model=client?.v2?.model
    if(!model||typeof model.list!=='function')return undefined
    const payload=dataOf<any>(await model.list(endpoint.directory?{location:{directory:endpoint.directory}}:undefined))
    if(Array.isArray(payload))return payload
    return Array.isArray(payload?.data)?payload.data:undefined
  }catch{return undefined}
}
export function eventSessionID(event:any):string|undefined{return event?.properties?.sessionID??event?.properties?.sessionId??event?.properties?.id??event?.properties?.info?.id??event?.sessionID}
export function lastAssistantText(messages:any[]):string{for(let i=messages.length-1;i>=0;i--){const msg=messages[i];const info=msg?.info??msg?.message??msg;if(info?.role&&info.role!=='assistant')continue;const parts=msg?.parts??info?.parts??[];const text=parts.filter((p:any)=>p?.type==='text'&&typeof p.text==='string').map((p:any)=>p.text).join('\n').trim();if(text)return text}return''}

export interface AssistantErrorEvidence{name?:string;message:string;isRetryable?:boolean;statusCode?:number}
export function assistantErrorEvidence(value:any):AssistantErrorEvidence|undefined{if(value==null)return undefined;if(typeof value==='string'){const message=value.trim();return message?{message}:undefined}if(typeof value!=='object')return undefined;const name=typeof value.name==='string'&&value.name.trim()?value.name.trim():undefined,data=value.data&&typeof value.data==='object'?value.data:value,messageCandidates=[value.message,data?.message,value.error?.message,value.cause?.message],message=messageCandidates.find(x=>typeof x==='string'&&x.trim())?.trim(),isRetryable=typeof data?.isRetryable==='boolean'?data.isRetryable:undefined,statusCode=Number.isInteger(data?.statusCode)&&data.statusCode>=0?data.statusCode:undefined;if(!message&&!name)return undefined;return{...(name?{name}:{}),message:message??name!,...(isRetryable!==undefined?{isRetryable}:{}),...(statusCode!==undefined?{statusCode}:{})}}
export function lastAssistantError(messages:any[]):AssistantErrorEvidence|undefined{for(let i=messages.length-1;i>=0;i--){const msg=messages[i],info=msg?.info??msg?.message??msg;if(info?.role&&info.role!=='assistant')continue;return assistantErrorEvidence(info?.error??msg?.error)}return undefined}

export interface AssistantModelEvidence{model?:string;variant?:string;message_id?:string}
export function lastAssistantModel(messages:any[]):AssistantModelEvidence|undefined{
  for(let i=messages.length-1;i>=0;i--){
    const msg=messages[i],info=msg?.info??msg?.message??msg;if(info?.role&&info.role!=='assistant')continue
    const provider=info?.providerID??info?.providerId??info?.model?.providerID??info?.model?.providerId??info?.provider
    const modelID=info?.modelID??info?.modelId??info?.model?.modelID??info?.model?.modelId??info?.model?.id??(typeof info?.model==='string'?info.model:undefined)
    const canonical=provider&&modelID?`${String(provider)}/${String(modelID)}`:(typeof modelID==='string'&&modelID.includes('/')?modelID:undefined)
    if(canonical)return{model:canonical,variant:info?.variant??info?.model?.variant,message_id:info?.id??msg?.id}
  }
  return undefined
}

function usageTokens(value:any):ExecutionTokenUsage|undefined{
  const tokens=value?.tokens,cache=tokens?.cache
  const values=[tokens?.input,tokens?.output,tokens?.reasoning,cache?.read,cache?.write]
  if(values.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0))return undefined
  return{input:tokens.input,output:tokens.output,reasoning:tokens.reasoning,cache_read:cache.read,cache_write:cache.write}
}
export function lastAssistantUsage(messages:any[]):HostUsageObservation|undefined{
  for(let i=messages.length-1;i>=0;i--){
    const msg=messages[i],info=msg?.info??msg?.message??msg;if(info?.role&&info.role!=='assistant')continue
    const parts=msg?.parts??info?.parts??[],steps=parts.filter((p:any)=>p?.type==='step-finish')
    const provider=info?.providerID??info?.providerId??info?.model?.providerID??info?.model?.providerId??info?.provider,modelID=info?.modelID??info?.modelId??info?.model?.modelID??info?.model?.modelId??info?.model?.id??(typeof info?.model==='string'?info.model:undefined),model_identity=provider&&modelID?`${String(provider)}/${String(modelID)}`:(typeof modelID==='string'&&modelID.includes('/')?modelID:undefined),message_id=info?.id??msg?.id,observed_at=Number(info?.time?.completed??info?.time?.created)
    if(steps.length){
      let tokens={...EMPTY_TOKEN_USAGE},cost=0
      for(const step of steps){const parsed=usageTokens(step);if(!parsed||typeof step.cost!=='number'||!Number.isFinite(step.cost)||step.cost<0)return undefined;tokens=addTokenUsage(tokens,parsed);cost+=step.cost}
      return{...(message_id?{message_id:String(message_id)}:{}),...(model_identity?{model_identity}:{}),...(Number.isFinite(observed_at)&&observed_at>=0?{observed_at}:{}),token_source:'opencode-step-finish',coverage:'assistant-step-total',confidence:'exact',step_count:steps.length,tokens,monetary:{usd:cost,source:'opencode-calculated',confidence:'derived'}}
    }
    const tokens=usageTokens(info);if(!tokens)return undefined
    const cost=typeof info?.cost==='number'&&Number.isFinite(info.cost)&&info.cost>=0?info.cost:undefined
    return{...(message_id?{message_id:String(message_id)}:{}),...(model_identity?{model_identity}:{}),...(Number.isFinite(observed_at)&&observed_at>=0?{observed_at}:{}),token_source:'opencode-assistant-message',coverage:'assistant-message-reported',confidence:'exact',step_count:1,tokens,...(cost===undefined?{}:{monetary:{usd:cost,source:'opencode-calculated',confidence:'derived'}})}
  }
  return undefined
}
