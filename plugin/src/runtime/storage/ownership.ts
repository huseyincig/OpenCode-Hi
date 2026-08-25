import { join, resolve } from 'node:path'

function safeSegment(value:string):string{
  const v=value.trim()
  if(!v||v==='.'||v==='..'||v.includes('/')||v.includes('\\')||!/[A-Za-z0-9]/.test(v))throw new Error(`Unsafe storage segment: ${value}`)
  return v.replace(/[^A-Za-z0-9._-]+/g,'-')
}

export function hiProjectRoot(projectRoot:string):string{return join(resolve(projectRoot),'.opencode','hi')}
export function projectPolicyPath(projectRoot:string,name:string):string{return join(hiProjectRoot(projectRoot),'policy',`${safeSegment(name)}.json`)}
export function projectMethodologyCandidatePath(projectRoot:string,id:string):string{return join(hiProjectRoot(projectRoot),'project-intelligence','methodology-candidates',`${safeSegment(id)}.json`)}
export function projectTaskOutcomeMemoryPath(projectRoot:string):string{return join(hiProjectRoot(projectRoot),'project-intelligence','task-outcomes.jsonl')}
export function projectOperationalToolRoot(projectRoot:string):string{return join(hiProjectRoot(projectRoot),'tools')}
export function projectOperationalToolImplementationRoot(projectRoot:string,capability:string,implementation:string):string{return join(projectOperationalToolRoot(projectRoot),safeSegment(capability),safeSegment(implementation))}
export function projectOperationalToolReceiptPath(projectRoot:string,capability:string,implementation:string):string{return join(projectOperationalToolRoot(projectRoot),'receipts',safeSegment(capability),`${safeSegment(implementation)}.json`)}
export function projectOperationalToolLockPath(projectRoot:string,capability:string,implementation:string):string{return join(projectOperationalToolRoot(projectRoot),'.locks',`${safeSegment(capability)}--${safeSegment(implementation)}.lock`)}
export function durableArtifactPath(projectRoot:string,kind:string,id:string):string{return join(hiProjectRoot(projectRoot),'artifacts',safeSegment(kind),`${safeSegment(id)}.json`)}
export function durableArtifactBinaryPath(projectRoot:string,kind:string,id:string,extension:string):string{return join(hiProjectRoot(projectRoot),'artifacts',safeSegment(kind),`${safeSegment(id)}.${safeSegment(extension).replace(/^\.+/,'')}`)}
export function projectMethodologyPolicyDir(projectRoot:string):string{return join(hiProjectRoot(projectRoot),'policy','methodologies')}
export function projectMethodologyPolicyPath(projectRoot:string,name:string):string{return join(projectMethodologyPolicyDir(projectRoot),`${safeSegment(name)}.json`)}
export function projectMethodologyProvenanceDir(projectRoot:string):string{return join(hiProjectRoot(projectRoot),'provenance','methodologies')}
export function projectMethodologyProvenancePath(projectRoot:string,name:string):string{return join(projectMethodologyProvenanceDir(projectRoot),`${safeSegment(name)}.json`)}
export function projectSkillRoot(projectRoot:string,skillName:string):string{return join(resolve(projectRoot),'.opencode','skills',safeSegment(skillName))}
