import { eventSessionID } from './client-adapter.js'

export type HhcNativeEventKind =
  | 'session-idle'|'session-error'|'session-deleted'|'session-status'|'session-diff'|'session-compacted'
  | 'todo-updated'|'permission-asked'|'permission-replied'|'file-edited'|'file-watcher-updated'
  | 'lsp-diagnostics'|'installation-updated'|'unknown'

export interface NormalizedOpenCodeEvent {kind:HhcNativeEventKind;rawType:string;sessionID?:string;properties:any;raw:any}
const MAP:Record<string,HhcNativeEventKind>={
  'session.idle':'session-idle','session.error':'session-error','session.deleted':'session-deleted','session.status':'session-status','session.diff':'session-diff','session.compacted':'session-compacted',
  'todo.updated':'todo-updated','permission.asked':'permission-asked','permission.replied':'permission-replied','file.edited':'file-edited','file.watcher.updated':'file-watcher-updated',
  'lsp.client.diagnostics':'lsp-diagnostics','installation.updated':'installation-updated',
}
export function normalizeOpenCodeEvent(event:any):NormalizedOpenCodeEvent{const rawType=String(event?.type??'');return{kind:MAP[rawType]??'unknown',rawType,sessionID:eventSessionID(event),properties:event?.properties??{},raw:event}}

function collectStrings(value:any,out:Set<string>,depth=0):void{
  if(depth>5||value==null)return
  if(typeof value==='string'){
    if(/[\\/]/.test(value)||/\.[A-Za-z0-9]{1,8}$/.test(value))out.add(value)
    return
  }
  if(Array.isArray(value)){for(const x of value)collectStrings(x,out,depth+1);return}
  if(typeof value==='object')for(const [k,v] of Object.entries(value))if(['file','path','filePath','filename','files','paths','diff','changes'].includes(k)||depth<2)collectStrings(v,out,depth+1)
}
export function eventFilePaths(event:NormalizedOpenCodeEvent):string[]{const out=new Set<string>();collectStrings(event.properties,out);return[...out].filter(x=>!x.includes('\n')).slice(0,200)}

export function permissionReply(event:NormalizedOpenCodeEvent):'once'|'always'|'reject'|'unknown'{const v=String(event.properties?.response??event.properties?.decision??event.properties?.reply??'').toLowerCase();return v.includes('always')?'always':v.includes('once')||v.includes('allow')||v.includes('approve')?'once':v.includes('deny')||v.includes('reject')?'reject':'unknown'}
export function permissionDecision(event:NormalizedOpenCodeEvent):'allow'|'deny'|'unknown'{const v=permissionReply(event);return v==='once'||v==='always'?'allow':v==='reject'?'deny':'unknown'}
export function permissionPatterns(event:NormalizedOpenCodeEvent):string[]{const p=event.properties??{};const raw=p.patterns??p.always??p.permission?.patterns??p.request?.patterns;return Array.isArray(raw)?raw.filter((x:any)=>typeof x==='string'):[]}

export function permissionEventID(event:NormalizedOpenCodeEvent):string|undefined{const p=event.properties??{};const raw=p.id??p.permissionID??p.permissionId??p.requestID??p.requestId??p.permission?.id??p.request?.id;return typeof raw==='string'&&raw.trim()?raw.trim():undefined}
