import { createHash } from 'node:crypto'

export interface ProviderDuplicatePruningResult<T=any>{messages:T[];pruned_call_ids:string[];before_chars:number;after_chars:number}
export interface ProviderDuplicatePruningOptions{min_output_chars?:number}

const READ_TOOLS=new Set(['read','file.read','fs.read','read_file','readfile'])
const COMMAND_TOOLS=new Set(['bash','shell','command','exec','terminal'])

function hash(text:string):string{return createHash('sha256').update(text).digest('hex')}
function normPath(value:string):string{return value.trim().replace(/\\/g,'/').replace(/^\.\//,'').replace(/\/{2,}/g,'/')}
function normalized(value:unknown,key=''):unknown{
  if(Array.isArray(value))return value.map(v=>normalized(v,key))
  if(value&&typeof value==='object'){const out:Record<string,unknown>={};for(const k of Object.keys(value as Record<string,unknown>).sort())out[k]=normalized((value as Record<string,unknown>)[k],k);return out}
  if(typeof value==='string'&&['filepath','file','path','cwd','directory'].includes(key.toLowerCase()))return normPath(value)
  return value
}
function canonical(value:unknown):string{return JSON.stringify(normalized(value))}
function metaValue(part:any,...keys:string[]):unknown{for(const source of [part?.state?.metadata,part?.metadata])for(const key of keys)if(source&&source[key]!==undefined)return source[key];return undefined}
function stateIdentity(part:any):string|undefined{
  const value=metaValue(part,'stateHash','state_hash','repoStateHash','repo_state_hash','repositoryStateHash','repository_state_hash','workspaceStateHash','workspace_state_hash','sourceVersion','source_version','gitHead','git_head','head','diffHash','diff_hash')
  return value===undefined?undefined:canonical(value)
}
function inputOf(part:any):Record<string,unknown>{const input=part?.state?.input;return input&&typeof input==='object'&&!Array.isArray(input)?input:{}}
function outputOf(part:any):string|undefined{return part?.state?.status==='completed'&&typeof part?.state?.output==='string'?part.state.output:undefined}
function readPath(input:Record<string,unknown>):string|undefined{for(const key of ['filePath','filepath','file','path'])if(typeof input[key]==='string'&&String(input[key]).trim())return normPath(String(input[key]));return undefined}
function commandIdentity(input:Record<string,unknown>):string|undefined{const command=typeof input.command==='string'?input.command:typeof input.cmd==='string'?input.cmd:undefined;if(!command)return undefined;const cwd=typeof input.cwd==='string'?normPath(input.cwd):'';const env=input.env&&typeof input.env==='object'?hash(canonical(normalized(input.env))):undefined;return canonical({command:command.trim(),cwd,env_hash:env})}

export function providerToolOutputSignature(part:any):string|undefined{
  if(part?.type!=='tool'||typeof part?.tool!=='string'||part?.state?.status!=='completed'||part?.state?.attachments?.length)return undefined
  const output=outputOf(part);if(output===undefined)return undefined
  const tool=part.tool.trim().toLowerCase(),input=inputOf(part),outputHash=hash(output)
  if(READ_TOOLS.has(tool)){const path=readPath(input);if(!path)return undefined;return canonical({tool,path,input:normalized(input),observed_file_hash:outputHash})}
  if(COMMAND_TOOLS.has(tool)){const command=commandIdentity(input),state=stateIdentity(part);if(!command||!state)return undefined;return canonical({tool,command,state,output_hash:outputHash})}
  const state=stateIdentity(part);if(!state)return undefined
  return canonical({tool,input:normalized(input),state,output_hash:outputHash})
}

function projectedOutput(callID:string,keptCallID:string,signature:string):string{return`[Hi provider projection: duplicate ${callID} output omitted; equivalent latest result retained at ${keptCallID}; signature=${hash(signature).slice(0,16)}]`}

export function pruneDuplicateProviderToolOutputs<T=any>(messages:T[],options:ProviderDuplicatePruningOptions={}):ProviderDuplicatePruningResult<T>{
  const min=Math.max(64,options.min_output_chars??256),seen=new Map<string,string>(),prune=new Map<string,{kept:string;signature:string}>()
  let beforeChars=0,afterChars=0
  for(let mi=messages.length-1;mi>=0;mi--){const msg:any=messages[mi],parts=Array.isArray(msg?.parts)?msg.parts:[];for(let pi=parts.length-1;pi>=0;pi--){const part=parts[pi],output=outputOf(part);if(output===undefined)continue;beforeChars+=output.length;const signature=providerToolOutputSignature(part);if(!signature){afterChars+=output.length;continue}const callID=String(part.callID??part.id??`m${mi}p${pi}`),kept=seen.get(signature);if(!kept){seen.set(signature,callID);afterChars+=output.length;continue}const marker=projectedOutput(callID,kept,signature);if(output.length<min||marker.length>=output.length){afterChars+=output.length;continue}prune.set(`${mi}:${pi}`,{kept,signature});afterChars+=marker.length}}
  if(!prune.size)return{messages:[...messages],pruned_call_ids:[],before_chars:beforeChars,after_chars:afterChars}
  const projected=messages.map((raw:any,mi)=>{const parts=Array.isArray(raw?.parts)?raw.parts:undefined;if(!parts)return raw;let changed=false;const next=parts.map((part:any,pi:number)=>{const target=prune.get(`${mi}:${pi}`);if(!target)return part;changed=true;const callID=String(part.callID??part.id??`m${mi}p${pi}`);return{...part,state:{...part.state,output:projectedOutput(callID,target.kept,target.signature)}}});return changed?{...raw,parts:next}:raw}) as T[]
  return{messages:projected,pruned_call_ids:[...prune.keys()].map(key=>{const [mi,pi]=key.split(':').map(Number);const part:any=(messages as any[])[mi]?.parts?.[pi];return String(part?.callID??part?.id??key)}),before_chars:beforeChars,after_chars:afterChars}
}
