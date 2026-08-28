export const DEFAULT_ASSESSMENT={
  material:true,
  message_kind:'mission',
  task_kind:'implementation',
  scope:'local',
  risk:'medium',
  ambiguity:'none',
  dependency_class:'independent',
  required_capabilities:['implementation'],
  requested_external_actions:[],
  likely_verification:[],
  verification_cases:[],
  nonvisual_request_units:[],
  likely_targets:[],
  intent_signals:[],
  suppressed_intent_signals:[],
}

/** @param {import('../../dist/runtime/mission/mission-store.js').MissionStore} store @returns {import('../../dist/runtime/mission/types.js').MissionState} */
export function startAssessedMission(store,sessionID,text='opaque request',overrides={}){
  const m=store.start(sessionID,text)
  store.applyInitialSemanticAssessment(sessionID,{...DEFAULT_ASSESSMENT,...overrides})
  return m
}

/** @param {import('../../dist/runtime/mission/mission-store.js').MissionStore} store @returns {import('../../dist/runtime/mission/types.js').MissionState} */
export function applyStructuredFollowup(store,sessionID,text='opaque follow-up',overrides={}){
  const m=store.get(sessionID)
  if(!m)throw new Error('No mission for structured follow-up fixture')
  if(m.identity.semantic_assessment.status!=='pending')store.beginFollowupSemanticAssessment(sessionID,text)
  const base={
    material:true,
    message_kind:'amendment',
    task_kind:m.identity.intent.taskKind==='unclassified'?'implementation':m.identity.intent.taskKind,
    scope:m.identity.intent.scope,
    risk:m.identity.intent.risk,
    ambiguity:m.identity.intent.ambiguity,
    dependency_class:m.identity.intent.dependencyClass,
    required_capabilities:[...m.identity.intent.requiredCapabilities],
    requested_external_actions:[...(m.identity.intent.requestedExternalActions??[])],
    likely_verification:[...m.identity.intent.likelyVerification],
    likely_targets:[...(m.identity.intent.likelyTargets??[])],
    intent_signals:[],
    suppressed_intent_signals:[],
  }
  return store.applyFollowupSemanticAssessment(sessionID,{...base,...overrides})
}


export async function assessPluginMission(hooks,sessionID,overrides={}){
  const assessment={...DEFAULT_ASSESSMENT,...overrides};if(assessment.likely_verification?.includes('visual-check')&&!assessment.verification_cases?.length)assessment.verification_cases=[{id:'vc_visual-smoke',subject:'bounded visual smoke',required_browser_actions:['inspect'],source_units:['ru1']}]
  const raw=await hooks.tool.hi_intent_assess.execute({revision:1,assessment_json:JSON.stringify(assessment)},{sessionID})
  const result=JSON.parse(String(raw))
  if(result.status==="INVALID_ASSESSMENT")throw new Error(result.error)
  return result
}
