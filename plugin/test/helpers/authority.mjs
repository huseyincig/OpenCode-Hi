import {openHumanDecision} from '../../dist/runtime/human-decision/runtime.js'

export function authorityProtocolResponse(m,response){
  const d=m.authority.human_decision
  if(!d||d.status!=='OPEN'||d.semantic_type!=='authority_request'||!d.authority_ref)throw new Error('open authority HumanDecision required')
  return{decision_id:d.decision_id,authority_ref:d.authority_ref,response}
}
export function authorityProtocolJson(m,response){return JSON.stringify(authorityProtocolResponse(m,response))}
export function plantPendingAuthority(m,hash,action='cwd=\ncommand=git push'){
  m.authority.authority={pending:{hash,action,created_at:Date.now()},approved:undefined,executing:undefined,completed_hashes:[]}
  return openHumanDecision(m,{semantic_type:'authority_request',reason_code:'authority-approval-required',summary:'Exact privileged action requires explicit structured authority.',response_schema:{kind:'authority-protocol',protocol:'approve-exact-action'},authority_ref:hash})
}
export function plantExecutingAuthority(m,hash,action='cwd=\ncommand=git push'){
  m.authority.authority={executing:{hash,action,started_at:Date.now()},approved:undefined,completed_hashes:[]}
  return openHumanDecision(m,{semantic_type:'authority_request',reason_code:'authority-execution-uncertain',summary:'Exact privileged action outcome requires structured reconciliation.',response_schema:{kind:'authority-protocol',protocol:'reconcile-action-outcome'},authority_ref:hash})
}
