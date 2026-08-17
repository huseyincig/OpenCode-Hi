import type { BackgroundRegistry } from '../runtime/background/registry.js'
import type { MissionStore } from '../runtime/mission/mission-store.js'
import { ownershipContract } from '../runtime/skills/methodology.js'
import { pruneDuplicateProviderToolOutputs } from '../runtime/context/provider-duplicate-pruning.js'
import { appendLedger } from '../runtime/ledger/ledger.js'
const NATIVE_HOUSEKEEPING_AGENTS=new Set(['title','summary','compaction'])
function isNativeHousekeeping(input:any):boolean{return NATIVE_HOUSEKEEPING_AGENTS.has(String(input?.agent??input?.agentName??'').toLowerCase())}


function sessionID(input:any):string|undefined{return input?.sessionID??input?.sessionId??input?.session?.id}
function textPartLike(ref:any,text:string):any{return ref&&typeof ref==='object'?{...ref,type:'text',text}:{type:'text',text}}
function containsContract(parts:any[],needle:string):boolean{return parts.some(p=>p?.type==='text'&&typeof p.text==='string'&&p.text.includes(needle))}

export function createMessagesTransformHook(store:MissionStore,background:BackgroundRegistry){
  return async(input:any,output:any)=>{
    const sid=sessionID(input);if(!sid||isNativeHousekeeping(input)||!Array.isArray(output?.messages)||!output.messages.length)return
    output.messages=pruneDuplicateProviderToolOutputs(output.messages).messages
    const firstUserIndex=output.messages.findIndex((m:any)=>m?.info?.role==='user'),firstUser=firstUserIndex>=0?output.messages[firstUserIndex]:undefined;if(!firstUser||!Array.isArray(firstUser.parts))return
    const child=background.list().find(w=>w.session_id===sid)
    const mission=child?store.get(child.parent_session_id):store.get(sid)
    if(!mission)return
    if(child&&((child.parent_mission_id!==undefined&&child.parent_mission_id!==mission.identity.mission_id)||(child.generation_at_spawn!==undefined&&child.generation_at_spawn!==mission.continuation.generation)))return
    const worker=child?mission.execution.workers.find(w=>w.id===child.id):undefined
    const kind=child?'child':'parent',contract=ownershipContract(kind,worker?.selected_methodologies??[]),marker=kind==='child'?'Hi CHILD CONTROL-PLANE CONTRACT':'Hi CONTROL-PLANE CONTRACT'
    if(firstUser.parts.some((p:any)=>p?.type==='text'&&p.text===contract))return
    if(containsContract(firstUser.parts,marker)){appendLedger(mission,'host.composition-collision',{task_id:worker?.task_id,worker_id:worker?.id,payload:{surface:'messages-transform',reason:'hi-contract-marker-without-canonical-contract',kind}})}
    const ref=firstUser.parts[firstUser.parts.length-1]??firstUser.parts[0],projectedUser={...firstUser,parts:[...firstUser.parts,textPartLike(ref,contract)]}
    output.messages=[...output.messages];output.messages[firstUserIndex]=projectedUser
  }
}
