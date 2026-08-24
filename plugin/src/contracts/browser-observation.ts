import { createHash } from 'node:crypto'

export const BROWSER_OBSERVATION_ACTIONS=['open','navigate','click','type','key','inspect','viewport','screenshot','wait','close'] as const
export type BrowserObservationAction=typeof BROWSER_OBSERVATION_ACTIONS[number]
export const BROWSER_OBSERVATION_RESULTS=['OBSERVED','FAILED'] as const
export type BrowserObservationResult=typeof BROWSER_OBSERVATION_RESULTS[number]
export interface BrowserViewport { width:number; height:number }

export interface BrowserObservationContract {
  observation_id:string
  task_id:string
  executor_version:string
  url:string
  action:BrowserObservationAction
  timestamp:number
  viewport?:BrowserViewport
  document_identity?:string
  dom_summary?:string
  console_errors:string[]
  network_errors:string[]
  screenshot_artifact_ref?:string
  result:BrowserObservationResult
}

const KEYS=new Set(['observation_id','task_id','executor_version','url','action','timestamp','viewport','document_identity','dom_summary','console_errors','network_errors','screenshot_artifact_ref','result'])
const ACTIONS=new Set<string>(BROWSER_OBSERVATION_ACTIONS),RESULTS=new Set<string>(BROWSER_OBSERVATION_RESULTS)
function record(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function bounded(v:unknown,max:number):v is string{return typeof v==='string'&&Boolean(v.trim())&&v.length<=max}
function boundedStrings(v:unknown,maxItems:number,maxChars:number):v is string[]{return Array.isArray(v)&&v.length<=maxItems&&v.every(x=>bounded(x,maxChars))}
function sha(v:unknown):v is string{return typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)}
function artifactRef(v:unknown):v is string{return typeof v==='string'&&/^hi-artifact:a_[a-f0-9]{24}$/.test(v)}
function validUrl(v:unknown):v is string{if(!bounded(v,4096))return false;try{const u=new URL(v);return u.protocol==='http:'||u.protocol==='https:'}catch{return false}}
function validViewport(v:unknown):v is BrowserViewport{return record(v)&&Object.keys(v).every(k=>k==='width'||k==='height')&&Number.isInteger(v.width)&&Number(v.width)>=240&&Number(v.width)<=3840&&Number.isInteger(v.height)&&Number(v.height)>=240&&Number(v.height)<=2160}

export function browserObservationId(input:{task_id:string;executor_version:string;url:string;action:BrowserObservationAction;timestamp:number;viewport?:BrowserViewport;document_identity?:string;screenshot_artifact_ref?:string;result:BrowserObservationResult}):string{
  const raw=[input.task_id,input.executor_version,input.url,input.action,String(input.timestamp),input.viewport?`${input.viewport.width}x${input.viewport.height}`:'',input.document_identity??'',input.screenshot_artifact_ref??'',input.result].join('\0')
  return`bo_${createHash('sha256').update(raw).digest('hex').slice(0,24)}`
}

export function isBrowserObservationContract(v:unknown):v is BrowserObservationContract{
  if(!record(v)||!Object.keys(v).every(k=>KEYS.has(k)))return false
  if(!bounded(v.observation_id,27)||!/^bo_[a-f0-9]{24}$/.test(v.observation_id)||!bounded(v.task_id,160)||!bounded(v.executor_version,160)||!validUrl(v.url))return false
  if(typeof v.action!=='string'||!ACTIONS.has(v.action)||typeof v.result!=='string'||!RESULTS.has(v.result))return false
  if(typeof v.timestamp!=='number'||!Number.isFinite(v.timestamp)||v.timestamp<=0)return false
  if(v.viewport!==undefined&&!validViewport(v.viewport))return false
  if(v.action==='viewport'&&v.result==='OBSERVED'&&!v.viewport)return false
  if(v.document_identity!==undefined&&!sha(v.document_identity))return false
  if(v.dom_summary!==undefined&&(!bounded(v.dom_summary,4000)||v.dom_summary.length>4000))return false
  if(!boundedStrings(v.console_errors,64,1000)||!boundedStrings(v.network_errors,64,1000))return false
  if(v.screenshot_artifact_ref!==undefined&&!artifactRef(v.screenshot_artifact_ref))return false
  if(v.action==='screenshot'&&v.result==='OBSERVED'&&!v.screenshot_artifact_ref)return false
  if(v.result==='OBSERVED'&&!v.viewport&&!v.document_identity&&!v.dom_summary&&!v.screenshot_artifact_ref&&v.console_errors.length===0&&v.network_errors.length===0)return false
  const expected=browserObservationId({task_id:v.task_id as string,executor_version:v.executor_version as string,url:v.url as string,action:v.action as BrowserObservationAction,timestamp:v.timestamp as number,viewport:v.viewport as BrowserViewport|undefined,document_identity:v.document_identity as string|undefined,screenshot_artifact_ref:v.screenshot_artifact_ref as string|undefined,result:v.result as BrowserObservationResult})
  return v.observation_id===expected
}
