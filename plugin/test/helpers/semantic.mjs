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
  likely_targets:[],
  intent_signals:[],
  suppressed_intent_signals:[],
}

export function startAssessedMission(store,sessionID,text='opaque request',overrides={}){
  const m=store.start(sessionID,text)
  store.applyInitialSemanticAssessment(sessionID,{...DEFAULT_ASSESSMENT,...overrides})
  return m
}

export function applyStructuredFollowup(store,sessionID,text='opaque follow-up',overrides={}){
  const m=store.get(sessionID)
  if(!m)throw new Error('No mission for structured follow-up fixture')
  if(m.semantic_assessment.status!=='pending')store.beginFollowupSemanticAssessment(sessionID,text)
  const base={
    material:true,
    message_kind:'amendment',
    task_kind:m.intent.taskKind==='unclassified'?'implementation':m.intent.taskKind,
    scope:m.intent.scope,
    risk:m.intent.risk,
    ambiguity:m.intent.ambiguity,
    dependency_class:m.intent.dependencyClass,
    required_capabilities:[...m.intent.requiredCapabilities],
    requested_external_actions:[...(m.intent.requestedExternalActions??[])],
    likely_verification:[...m.intent.likelyVerification],
    likely_targets:[...(m.intent.likelyTargets??[])],
    intent_signals:[],
    suppressed_intent_signals:[],
  }
  return store.applyFollowupSemanticAssessment(sessionID,{...base,...overrides})
}


export async function assessPluginMission(hooks,sessionID,overrides={}){
  const assessment={...DEFAULT_ASSESSMENT,...overrides}
  const raw=await hooks.tool.hi_intent_assess.execute({revision:1,assessment_json:JSON.stringify(assessment)},{sessionID})
  const result=JSON.parse(String(raw))
  if(result.status==="INVALID_ASSESSMENT")throw new Error(result.error)
  return result
}
