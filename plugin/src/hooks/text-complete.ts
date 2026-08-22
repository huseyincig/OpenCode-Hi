import type { BackgroundRegistry } from '../runtime/background/registry.js'
import { MissionStore } from '../runtime/mission/mission-store.js'
import { projectControlDecision } from '../runtime/completion/control-projection.js'
import { appendLedger } from '../runtime/ledger/ledger.js'

/**
 * OpenCode awaits experimental.text.complete before publishing the completed
 * text part. Keep parent prose non-terminal until Hi's canonical completion
 * owner says the mission may stop. Child text is owned by WorkerResult parsing
 * and user-action-required text must remain visible.
 */
export function createTextCompleteHook(store:MissionStore,background?:BackgroundRegistry,projectRoot?:string){
  return async(input:any,output:any)=>{
    const sid=String(input?.sessionID??input?.sessionId??'')
    if(!sid||background?.list().some(w=>w.session_id===sid))return
    const m=store.get(sid)
    if(!m||m.identity.status!=='active'||m.identity.semantic_assessment.status==='pending')return
    const decision=projectControlDecision(m,projectRoot)
    if(decision.action==='DONE'||decision.action==='USER_ACTION_REQUIRED')return
    const original=String(output?.text??'')
    if(!original.trim())return
    output.text=''
    const messageID=String(input?.messageID??'')
    if(!m.execution.ledger.some(e=>e.type==='assistant.text-withheld'&&e.payload?.message_id===messageID)){
      appendLedger(m,'assistant.text-withheld',{payload:{message_id:messageID||undefined,part_id:String(input?.partID??'')||undefined,decision:decision.action,open_obligations:decision.open_obligations.map(o=>o.id).slice(0,8),missing_evidence:decision.missing_evidence.map(e=>e.kind).slice(0,8),reason:'canonical-completion-not-ready'}})
    }
  }
}
