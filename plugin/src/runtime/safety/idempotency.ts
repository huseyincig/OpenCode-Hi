import { createHash } from 'node:crypto'
import type { MissionState } from '../mission/types.js'

function stable(value:unknown):string{
  if(value===null||typeof value!=='object')return JSON.stringify(value)
  if(Array.isArray(value))return`[${value.map(stable).join(',')}]`
  const obj=value as Record<string,unknown>;return`{${Object.keys(obj).sort().map(k=>`${JSON.stringify(k)}:${stable(obj[k])}`).join(',')}}`
}
function hash(payload:unknown):string{return createHash('sha256').update(stable(payload)).digest('hex')}
export function claimAction(m:MissionState,actionID:string,payload:unknown):'new'|'duplicate'|'conflict'{m.authority.applied_actions??={};const h=hash(payload);const old=m.authority.applied_actions[actionID];if(!old){m.authority.applied_actions[actionID]=h;return'new'}return old===h?'duplicate':'conflict'}
export function payloadHash(payload:unknown):string{return hash(payload)}
