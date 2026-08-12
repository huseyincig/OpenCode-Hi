import type { LedgerEvent, MissionState } from '../mission/types.js'

const MAX_EVENTS=200
const MAX_STRING=600
const MAX_ARRAY=24
const MAX_KEYS=32
const MAX_DEPTH=3
const CRITICAL=new Set(['mission.started','mission.completed','mission.stopped','user.action.required','authority.execution.uncertain'])

function id(): string { return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` }

function bounded(value:unknown,depth=0):unknown{
  if(value===null||value===undefined||typeof value==='number'||typeof value==='boolean')return value
  if(typeof value==='string')return value.length<=MAX_STRING?value:`${value.slice(0,MAX_STRING)}…[truncated]`
  if(depth>=MAX_DEPTH)return '[bounded]'
  if(Array.isArray(value))return value.slice(0,MAX_ARRAY).map(v=>bounded(v,depth+1))
  if(typeof value==='object'){
    const out:Record<string,unknown>={};let n=0
    for(const [k,v] of Object.entries(value as Record<string,unknown>)){if(n++>=MAX_KEYS)break;out[k.slice(0,120)]=bounded(v,depth+1)}
    return out
  }
  return String(value).slice(0,MAX_STRING)
}

function trimLedger(events:LedgerEvent[]):void{
  while(events.length>MAX_EVENTS){
    const removable=events.findIndex((e,i)=>i<events.length-1&&!CRITICAL.has(e.type))
    events.splice(removable>=0?removable:0,1)
  }
}

export function appendLedger(mission: MissionState, type: string, detail: Omit<LedgerEvent, 'id'|'at'|'mission_id'|'type'> = {}): LedgerEvent {
  const payload=detail.payload===undefined?undefined:bounded(detail.payload) as Record<string,unknown>
  const event: LedgerEvent = { id: id(), at: Date.now(), mission_id: mission.mission_id, type:type.slice(0,160), task_id:detail.task_id?.slice(0,160), worker_id:detail.worker_id?.slice(0,160), payload }
  mission.ledger.push(event)
  trimLedger(mission.ledger)
  mission.updated_at = event.at
  return event
}
