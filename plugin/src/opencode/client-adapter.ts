import type { OpenCodeClient } from './types.js'
import { createOpencodeClient as createOpenCodeV2Client } from '@opencode-ai/sdk/v2/client'
import { EMPTY_TOKEN_USAGE,addTokenUsage,type ExecutionTokenUsage,type HostUsageObservation } from '../contracts/execution-usage.js'
export function dataOf<T=any>(value:any):T { return (value && typeof value==='object' && 'data' in value) ? value.data as T : value as T }

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

export async function sendPromptAsync(client:OpenCodeClient,sessionID:string,text:string,agent?:string,model?:string,variant?:string,tools?:Record<string,boolean>):Promise<void>{
  const edge=client as any
  const body:any={parts:[{type:'text',text}]};if(agent)body.agent=agent;const identity=modelIdentity(model);if(identity)body.model=identity;if(variant)body.variant=variant;if(tools&&Object.keys(tools).length)body.tools=tools
  if(typeof edge?.session?.promptAsync==='function'){await edge.session.promptAsync({path:{id:sessionID},body});return}
  if(typeof edge?.session?.prompt_async==='function'){await edge.session.prompt_async({path:{id:sessionID},body});return}
  if(typeof edge?.session?.prompt==='function'){await edge.session.prompt({path:{id:sessionID},body});return}
  throw new Error('OpenCode session prompt API unavailable')
}

export async function listMessages(client:OpenCodeClient,sessionID:string,limit=20):Promise<any[]>{
  const edge=client as any
  if(typeof edge?.session?.messages==='function') return dataOf(await edge.session.messages({path:{id:sessionID},query:{limit}})) ?? []
  if(typeof edge?.session?.message?.list==='function') return dataOf(await edge.session.message.list({path:{id:sessionID},query:{limit}})) ?? []
  return []
}

export async function sendSyntheticContinuation(client:OpenCodeClient,sessionID:string,text:string,metadata:Record<string,unknown>):Promise<boolean>{
  const edge=client as any
  const fn=typeof edge?.session?.promptAsync==='function'?edge.session.promptAsync.bind(edge.session):typeof edge?.session?.prompt_async==='function'?edge.session.prompt_async.bind(edge.session):typeof edge?.session?.prompt==='function'?edge.session.prompt.bind(edge.session):undefined
  if(!fn)return false
  await fn({path:{id:sessionID},body:{parts:[{type:'text',text,synthetic:true,metadata}],noReply:false}})
  return true
}

export interface OpenCodeLifecycleEndpoint{serverUrl?:string;directory?:string}
function lifecycleHeaders(directory?:string):Record<string,string>{
  const headers:Record<string,string>={}
  if(directory)headers['x-opencode-directory']=encodeURIComponent(directory)
  const password=process.env.OPENCODE_SERVER_PASSWORD
  if(password){const username=process.env.OPENCODE_SERVER_USERNAME??'opencode';headers.Authorization=`Basic ${btoa(`${username}:${password}`)}`}
  return headers
}
export async function abortSession(client:OpenCodeClient,sessionID:string,endpoint:OpenCodeLifecycleEndpoint={}):Promise<'server'|'client'|'unavailable'>{
  const edge=client as any
  if(endpoint.serverUrl){
    try{
      const base=endpoint.serverUrl.replace(/\/$/,'')
      const response=await fetch(`${base}/session/${encodeURIComponent(sessionID)}/abort`,{method:'POST',headers:lifecycleHeaders(endpoint.directory),signal:AbortSignal.timeout(5000)})
      if(response.ok)return'server'
    }catch{}
  }
  if(typeof edge?.session?.abort==='function'){await edge.session.abort({path:{id:sessionID}});return'client'}
  return'unavailable'
}
export async function listProviders(client:OpenCodeClient):Promise<unknown>{const edge=client as any;if(typeof edge?.provider?.list==='function')return dataOf(await edge.provider.list());if(typeof edge?.config?.providers==='function')return dataOf(await edge.config.providers());return undefined}
export function eventSessionID(event:any):string|undefined{return event?.properties?.sessionID??event?.properties?.sessionId??event?.properties?.id??event?.properties?.info?.id??event?.sessionID}
export function lastAssistantText(messages:any[]):string{for(let i=messages.length-1;i>=0;i--){const msg=messages[i];const info=msg?.info??msg?.message??msg;if(info?.role&&info.role!=='assistant')continue;const parts=msg?.parts??info?.parts??[];const text=parts.filter((p:any)=>p?.type==='text'&&typeof p.text==='string').map((p:any)=>p.text).join('\n').trim();if(text)return text}return''}

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
