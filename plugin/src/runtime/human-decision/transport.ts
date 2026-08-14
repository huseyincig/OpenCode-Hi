import type { HumanDecisionContract,HumanDecisionResponseKind } from '../../contracts/human-decision.js'

export type HumanDecisionTransportState='OPEN'|'RESPONDED'|'CANCELLED'
export interface HumanDecisionTransportHandle{decision_id:string;transport:'chat';state:HumanDecisionTransportState;opened_at:number}
export interface HumanDecisionTransportResponse{decision_id:string;kind:HumanDecisionResponseKind;value:string|string[];received_at:number}
export type HumanDecisionAwaitResult={status:'RESPONDED';response:HumanDecisionTransportResponse}|{status:'CANCELLED';decision_id:string}|{status:'TIMEOUT';decision_id:string}

export interface HumanDecisionTransport{
  open(decision:HumanDecisionContract):HumanDecisionTransportHandle
  await(decisionId:string):Promise<HumanDecisionAwaitResult>
  cancel(decisionId:string):void
}

type Entry={decision:HumanDecisionContract;handle:HumanDecisionTransportHandle;response?:HumanDecisionTransportResponse;waiters:Set<(result:HumanDecisionAwaitResult)=>void>}

function boundedText(value:string,max=1000):string{return value.trim().slice(0,max)}
function responseFor(decision:HumanDecisionContract,value:string|string[]):HumanDecisionTransportResponse|undefined{
  const kind=decision.response_schema.kind
  if(kind==='choice'){
    const selected=Array.isArray(value)?value.map(x=>boundedText(String(x),240)).filter(Boolean):[boundedText(String(value),240)].filter(Boolean)
    if(selected.length!==1||!decision.response_schema.choices?.includes(selected[0]))return undefined
    return{decision_id:decision.decision_id,kind,value:selected[0],received_at:Date.now()}
  }
  const text=boundedText(Array.isArray(value)?value.join(', '):String(value))
  if(!text)return undefined
  return{decision_id:decision.decision_id,kind,value:text,received_at:Date.now()}
}

export class ChatHumanDecisionTransport implements HumanDecisionTransport{
  readonly #entries=new Map<string,Entry>()
  constructor(private readonly timeoutMs=300_000){}
  open(decision:HumanDecisionContract):HumanDecisionTransportHandle{
    for(const [id,entry] of this.#entries)if(id!==decision.decision_id&&entry.handle.state==='OPEN'&&entry.decision.blocking_scope.mission_id===decision.blocking_scope.mission_id)this.cancel(id)
    const existing=this.#entries.get(decision.decision_id)
    if(existing&&existing.handle.state==='OPEN'){existing.decision=structuredClone(decision);return structuredClone(existing.handle)}
    const handle:HumanDecisionTransportHandle={decision_id:decision.decision_id,transport:'chat',state:'OPEN',opened_at:Date.now()}
    this.#entries.set(decision.decision_id,{decision:structuredClone(decision),handle,waiters:new Set()})
    return structuredClone(handle)
  }
  async await(decisionId:string):Promise<HumanDecisionAwaitResult>{
    const entry=this.#entries.get(decisionId)
    if(!entry)return{status:'CANCELLED',decision_id:decisionId}
    if(entry.response)return{status:'RESPONDED',response:structuredClone(entry.response)}
    if(entry.handle.state==='CANCELLED')return{status:'CANCELLED',decision_id:decisionId}
    return new Promise(resolve=>{
      let timer:ReturnType<typeof setTimeout>|undefined
      const done=(result:HumanDecisionAwaitResult)=>{if(timer)clearTimeout(timer);entry.waiters.delete(done);resolve(result)}
      entry.waiters.add(done)
      timer=setTimeout(()=>done({status:'TIMEOUT',decision_id:decisionId}),Math.max(1,this.timeoutMs))
    })
  }
  cancel(decisionId:string):void{
    const entry=this.#entries.get(decisionId);if(!entry||entry.handle.state!=='OPEN')return
    entry.handle={...entry.handle,state:'CANCELLED'}
    for(const waiter of [...entry.waiters])waiter({status:'CANCELLED',decision_id:decisionId})
    entry.waiters.clear()
  }
  respond(decisionId:string,value:string|string[]):HumanDecisionTransportResponse|undefined{
    const entry=this.#entries.get(decisionId);if(!entry||entry.handle.state!=='OPEN'||entry.decision.status!=='OPEN')return undefined
    const response=responseFor(entry.decision,value);if(!response)return undefined
    entry.response=response;entry.handle={...entry.handle,state:'RESPONDED'}
    for(const waiter of [...entry.waiters])waiter({status:'RESPONDED',response:structuredClone(response)})
    entry.waiters.clear();return structuredClone(response)
  }
  handle(decisionId:string):HumanDecisionTransportHandle|undefined{const x=this.#entries.get(decisionId)?.handle;return x?structuredClone(x):undefined}
}

export function syncHumanDecisionTransport(decision:HumanDecisionContract|undefined,transport:HumanDecisionTransport):HumanDecisionTransportHandle|undefined{if(!decision)return undefined;if(decision.status==='OPEN')return transport.open(decision);transport.cancel(decision.decision_id);return undefined}
