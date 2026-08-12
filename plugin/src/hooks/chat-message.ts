import { MissionStore } from '../runtime/mission/mission-store.js'
import { approvePendingAuthority,resolveUncertainAuthority } from '../runtime/safety/authority.js'
import { appendLedger } from '../runtime/ledger/ledger.js'
const STOP=/^\s*(stop|cancel|abort|esc)\s*[.!]?\s*$/i
const RESUME=/^\s*(resume|continue|proceed)\s*[.!]?\s*$/i
const AMEND=/\b(?:also|add|include|remove|update|change|fix|rename|make|ensure|plus)\b/i
const CONSTRAINT=/\b(?:do not|don't|dont|never|without|except|avoid)\b/i
const VERIFY=/\b(test(?:s|ing)?|verify|verification|lint|build|qa|check)\b/i
const MUTATION=/\b(?:fix|change|update|add|remove|implement|rename|edit|modify|apply|write)\b/i
export type FollowupKind='amend'|'verification'|'constraint'
export function classifyFollowup(text:string):FollowupKind|undefined{if(CONSTRAINT.test(text))return'constraint';if(VERIFY.test(text)&&!MUTATION.test(text))return'verification';if(AMEND.test(text))return'amend';return undefined}
function isHiInternal(output:any):boolean{const parts=output?.parts??output?.message?.parts??[];return parts.some((p:any)=>p?.type==='text'&&(p?.metadata?.hiInternalContinuation===true||(p?.synthetic===true&&p?.metadata?.hiInternalContinuation))) }
function extractText(value:any):string{const parts=value?.parts??value?.message?.parts??[];return parts.filter((p:any)=>p?.type==='text'&&typeof p.text==='string').map((p:any)=>p.text).join('\n').trim()}
function normalizeNativeUserText(text:string):string{
  const trimmed=text.trim()
  if(trimmed.length>=2&&trimmed[0]===trimmed.at(-1)){
    if(trimmed[0]==='\"'){try{const parsed=JSON.parse(trimmed);if(typeof parsed==='string')return parsed.trim()}catch{}}
    if(trimmed[0]==="'")return trimmed.slice(1,-1).trim()
  }
  return trimmed
}
function extractNativeUserText(input:any,output:any):string{
  // OpenCode 1.18.x chat.message exposes the current user message on output.message/output.parts.
  // CLI `opencode run` may wrap the entire text in one JSON-style quote layer; normalize only that outer layer.
  // Keep input.message only as a compatibility fallback for older hosts and unit fixtures.
  if(output?.message?.role==='user'||output?.role==='user')return normalizeNativeUserText(extractText(output))
  const legacy=input?.message
  if(legacy?.role==='user'||legacy?.role===undefined)return normalizeNativeUserText(extractText(legacy))
  return ''
}
const CASUAL=/^(?:(?:hey|hi|hello|thanks|thank you|good morning|good evening|good night)[,! .]*)+(?:answer in one sentence|one sentence|short answer|how are you)?[.! ]*$/i
function isClearlyNonMaterial(text:string):boolean{return !text.trim()||CASUAL.test(text.trim())}
export function createChatMessageHook(store:MissionStore,onStop?: (sessionID:string)=>Promise<void>,onAmend?: (sessionID:string,text:string,kind:FollowupKind)=>Promise<void>){return async(input:any,output:any)=>{
  const sid=input?.sessionID;if(!sid)return;
  if(isHiInternal(output))return;
  // User-controlled state transitions come only from the native user message.
  // OpenCode 1.18.x places that text on output.parts; input.message remains a legacy fallback.
  const userText=extractNativeUserText(input,output);
  if(!userText)return;
  const existing=store.get(sid);
  if(STOP.test(userText)){store.stop(sid,'explicit-user-stop');await onStop?.(sid);return}
  if(existing)store.noteUserMessage(sid);
  if(existing&&resolveUncertainAuthority(existing,userText))return;
  if(existing&&approvePendingAuthority(existing,userText)){store.resume(sid,'authority-approved');return}
  if(RESUME.test(userText)){if(existing?.authority?.pending||existing?.authority?.executing){appendLedger(existing,'continuation.rejected',{payload:{reason:'authority-requires-exact-confirmation'}});return}store.resume(sid,'explicit-resume-command');return}
  if(!existing||existing.status==='completed'||existing.status==='failed'){if(isClearlyNonMaterial(userText))return;store.start(sid,userText);return}
  // A stopped mission stays stopped unless the user used the explicit RESUME command above.
  // Any other message is a new mission; late callbacks from the old generation remain stale.
  if(existing.status==='stopped'||existing.user_interrupted){if(isClearlyNonMaterial(userText))return;store.start(sid,userText);return}
  if(existing.status==='waiting-user'){for(const t of existing.tasks)if(t.result?.open_issues.some(x=>x.includes('USER_ACTION_REQUIRED'))){t.result={...t.result,status:'NEEDS_CONTEXT',open_issues:t.result.open_issues.filter(x=>!x.includes('USER_ACTION_REQUIRED')),needs_context:[...new Set([...t.result.needs_context,'User supplied follow-up after USER_ACTION_REQUIRED'])]}}store.resume(sid,'new-user-message-while-waiting');appendLedger(existing,'user.message.resume',{payload:{preview:userText.slice(0,160)}});return}
  if(existing.status==='active'){const kind=classifyFollowup(userText);if(kind){store.amend(sid,userText,kind);await onAmend?.(sid,userText,kind);return}}
}}
