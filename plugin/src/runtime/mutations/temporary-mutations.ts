import type { MissionState, TemporaryMutation } from '../mission/types.js'
import { payloadHash } from '../safety/idempotency.js'
import { appendLedger } from '../ledger/ledger.js'
import { redactDurableText } from '../privacy/boundary.js'
export function registerTemporaryMutation(m:MissionState,input:{kind:string;description:string;rollback_command?:string;rollback_mode?:'command'|'native-revert';session_id?:string;message_id?:string}):TemporaryMutation{
  const mode=input.rollback_mode??'command',rollbackCommand=mode==='native-revert'?`native-revert:${input.session_id??m.identity.session_id}:${input.message_id??''}`:String(input.rollback_command??'').trim()
  if(mode==='command'&&!rollbackCommand)throw new Error('rollback_command is required for command rollback')
  if(mode==='command'&&redactDurableText(rollbackCommand)!==rollbackCommand)throw new Error('rollback_command must not contain credentials or secret values; use a credential-free rollback or native revert')
  const item:TemporaryMutation={id:`tm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`,kind:input.kind,description:redactDurableText(input.description),rollback_command:rollbackCommand,rollback_hash:payloadHash(rollbackCommand),rollback_mode:mode,session_id:input.session_id,message_id:input.message_id,status:'active',created_at:Date.now()};m.vcs.temporary_mutations??=[];m.vcs.temporary_mutations.push(item);appendLedger(m,'temporary-mutation.registered',{payload:{id:item.id,kind:item.kind,rollback_hash:item.rollback_hash,rollback_mode:mode,session_id:item.session_id}});return item
}
export function matchRollback(m:MissionState,command:string):TemporaryMutation|undefined{const h=payloadHash(command.trim());return(m.vcs.temporary_mutations??[]).find(x=>(x.status==='active'||x.status==='failed')&&(x.rollback_mode??'command')==='command'&&x.rollback_hash===h)}
export function resolveRollback(m:MissionState,item:TemporaryMutation,success:boolean,detail?:string):void{item.status=success?'rolled-back':'failed';item.resolved_at=success?Date.now():undefined;item.detail=detail?redactDurableText(detail).slice(0,500):undefined;appendLedger(m,success?'temporary-mutation.rolled-back':'temporary-mutation.rollback-failed',{payload:{id:item.id,detail:item.detail,rollback_mode:item.rollback_mode??'command'}})}
