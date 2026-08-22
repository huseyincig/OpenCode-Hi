import type { OpenCodePluginContext } from './types.js'
import type { AvailableModel } from '../runtime/routing/model-resolver.js'
import { normalizeModelCapabilityProfile } from '../contracts/model.js'
import { detectOpenCodeCapabilities } from './capabilities.js'
import { NativeOpenCodeAdapter } from './native-adapter.js'
import { lastAssistantError,lastAssistantModel,lastAssistantText,lastAssistantUsage,listAvailableModels,listMessages,listProviders,readSessionRuntimeStatus,sendSyntheticContinuation } from './client-adapter.js'
import type { HostPort } from '../runtime/host/port.js'

function providerModels(raw:unknown):AvailableModel[]{
  const edge=raw as any
  const root=edge?.all??edge?.providers??edge??[]
  const providers=Array.isArray(root)?root:Object.values(root??{})
  const connectedRaw=Array.isArray(edge?.connected)?edge.connected:undefined
  const connected=connectedRaw?new Set(connectedRaw.map((x:any)=>typeof x==='string'?x:String(x?.id??x?.providerID??x?.name??'')).filter(Boolean)):undefined
  const out:AvailableModel[]=[]
  for(const p of providers as any[]){
    const pid=p?.id??p?.providerID??p?.name
    const provider=pid?String(pid):undefined
    if(connected&&provider&&!connected.has(provider))continue
    const models=p?.models??p?.model??[]
    const list=Array.isArray(models)?models:Object.values(models??{})
    for(const model of list as any[]){
      const id=model?.id??model?.modelID??model?.name
      if(!id)continue
      const rawID=String(id)
      const canonical=provider&&!rawID.startsWith(`${provider}/`)?`${provider}/${rawID}`:rawID
      const variantsRaw=model?.variants??model?.variant
      const variants=Array.isArray(variantsRaw)?variantsRaw.map(String):(variantsRaw&&typeof variantsRaw==='object'?Object.keys(variantsRaw):[])
      const visionCapable=model?.capabilities?.input?.image===true
      out.push(normalizeModelCapabilityProfile({id:canonical,provider,cost:Number(model?.cost?.input??model?.cost??0)||0,quality:Number(model?.quality??0)||0,writeCapable:model?.write!==false,visionCapable,tags:Array.isArray(model?.tags)?model.tags.map(String):[],variants},'runtime-inventory',`provider:${provider??'unknown'}/${canonical}`))
    }
  }
  return out
}

function availableModels(raw:unknown[]):AvailableModel[]{
  const out:AvailableModel[]=[]
  for(const model of raw as any[]){
    if(model?.enabled!==true)continue
    const provider=typeof model?.providerID==='string'&&model.providerID.trim()?model.providerID.trim():undefined
    const id=typeof model?.id==='string'&&model.id.trim()?model.id.trim():undefined
    if(!provider||!id)continue
    const canonical=id.startsWith(`${provider}/`)?id:`${provider}/${id}`
    const input=model?.capabilities?.input
    const visionCapable=Array.isArray(input)?input.some((x:any)=>String(x).toLowerCase()==='image'):input?.image===true
    const variants=Array.isArray(model?.variants)?model.variants.map((x:any)=>typeof x==='string'?x:x?.id).filter((x:any)=>typeof x==='string'&&x.trim()).map((x:string)=>x.trim()):[]
    const tags=[typeof model?.family==='string'?model.family:undefined,typeof model?.status==='string'?model.status:undefined].filter((x):x is string=>Boolean(x&&x.trim()))
    out.push(normalizeModelCapabilityProfile({id:canonical,provider,cost:0,quality:0,writeCapable:true,visionCapable,tags,variants},'runtime-inventory',`available-model:${canonical}`))
  }
  return out
}

export function createHostPort(ctx:OpenCodePluginContext):HostPort{
  const capabilities=detectOpenCodeCapabilities(ctx.client)
  const native=new NativeOpenCodeAdapter(ctx.client)
  let models:AvailableModel[]=[]
  let inventoryRefresh:Promise<number>|undefined
  const log=async(level:'debug'|'info'|'warn'|'error',message:string,extra?:Record<string,unknown>)=>{try{await ctx.client?.app?.log?.({body:{service:'hi',level,message,extra}})}catch{}}
  const refreshRuntimeInventory=async(reason:string):Promise<number>=>{
    if(inventoryRefresh)return inventoryRefresh
    inventoryRefresh=(async()=>{try{
      const scoped=await listAvailableModels({serverUrl:ctx.serverUrl?String(ctx.serverUrl):undefined,directory:ctx.directory})
      if(scoped!==undefined)models=availableModels(scoped)
      else{const raw=await listProviders(ctx.client);models=providerModels(raw)}
      await log('info','Hi runtime inventory refreshed',{reason,models:models.length,source:scoped!==undefined?'directory-available-models':'connected-provider-catalog-fallback'})
      return models.length
    }catch(error){await log('warn','Hi runtime inventory refresh failed',{reason,error:String(error)});return models.length}finally{inventoryRefresh=undefined}})()
    return inventoryRefresh
  }
  const readAssistantResult=async(sessionID:string,limit=12)=>{const messages=await listMessages(ctx.client,sessionID,limit);return{text:lastAssistantText(messages),model:lastAssistantModel(messages),usage:lastAssistantUsage(messages),error:lastAssistantError(messages)}}
  const sessionStatus=(sessionID:string)=>readSessionRuntimeStatus(ctx.client,sessionID,{serverUrl:ctx.serverUrl?String(ctx.serverUrl):undefined,directory:ctx.directory})
  const continueSession=(sessionID:string,text:string,metadata:Record<string,unknown>)=>sendSyntheticContinuation(ctx.client,sessionID,text,metadata)
  return {capabilities,nativeSession:{diff:(sessionID)=>native.diff(sessionID),revert:(sessionID,messageID)=>native.revert(sessionID,messageID)},log,refreshRuntimeInventory,getModels:()=>models,readAssistantResult,sessionStatus,continueSession}
}
