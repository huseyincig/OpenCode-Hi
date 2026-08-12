export type KnowledgeClass='PROJECT_KNOWLEDGE'|'ARCHITECTURE_POLICY'|'REUSABLE_METHODOLOGY'|'TEMPORARY_EVIDENCE'
export type SkillIntegrationDecision='DIRECT_PORT'|'ADAPT'|'MERGE_INTO_EXISTING'|'CLEAN_ROOM'|'IDEA_ONLY'|'REJECT'
export interface KnowledgeInput{kind?:string;text:string;requestedMutation?:boolean;overlapsExistingSkill?:boolean;reusable?:boolean;license?:'permissive'|'copyleft'|'unknown';hasTriggerContract?:boolean}
export interface KnowledgeDecision{classification:KnowledgeClass;skillDecision?:SkillIntegrationDecision;mutate:boolean;reason:string[]}
export function classifyKnowledge(input:KnowledgeInput):KnowledgeDecision{const t=input.text.toLowerCase(),reason:string[]=[];let classification:KnowledgeClass
  if(/\b(test failure|build log|current error|one-time|response status)\b/.test(t)){classification='TEMPORARY_EVIDENCE';reason.push('mission-specific transient evidence')}
  else if(/\b(must|shall|policy|architecture decision|boundary|idempotent)\b/.test(t)){classification='ARCHITECTURE_POLICY';reason.push('durable project decision or policy')}
  else if(input.reusable||/\b(procedure|methodology|workflow|review sequence|migration steps)\b/.test(t)){classification='REUSABLE_METHODOLOGY';reason.push('reusable HOW knowledge')}
  else {classification='PROJECT_KNOWLEDGE';reason.push('repository/project fact or convention')}
  let skillDecision:SkillIntegrationDecision|undefined
  if(classification==='REUSABLE_METHODOLOGY'){
    if(input.overlapsExistingSkill){skillDecision='MERGE_INTO_EXISTING';reason.push('existing skill already owns the methodology')}
    else if(!input.hasTriggerContract){skillDecision='IDEA_ONLY';reason.push('distinct trigger/do-not-trigger/exit contract is not established')}
    else if(input.license==='copyleft'){skillDecision='CLEAN_ROOM';reason.push('license forbids source copy into current distribution strategy')}
    else if(input.license==='unknown'){skillDecision='IDEA_ONLY';reason.push('copy permission is not established')}
    else skillDecision='ADAPT'
  }
  return{classification,skillDecision,mutate:input.requestedMutation===true,reason}
}
