import { join, resolve } from 'node:path'

export type ProjectStorageKind='POLICY'|'PROVENANCE'|'PROJECT_INTELLIGENCE'|'PROJECT_METHODOLOGY_CANDIDATE'|'DURABLE_ARTIFACT'|'PROJECT_METHODOLOGY_POLICY'|'PROJECT_METHODOLOGY_PROVENANCE'|'PROJECT_SKILL'

function safeSegment(value:string):string{
  const v=value.trim()
  if(!v||v==='.'||v==='..'||v.includes('/')||v.includes('\\')||!/[A-Za-z0-9]/.test(v))throw new Error(`Unsafe storage segment: ${value}`)
  return v.replace(/[^A-Za-z0-9._-]+/g,'-')
}

export function hiProjectRoot(projectRoot:string):string{return join(resolve(projectRoot),'.opencode','hi')}
export function projectPolicyPath(projectRoot:string,name:string):string{return join(hiProjectRoot(projectRoot),'policy',`${safeSegment(name)}.json`)}
export function projectProvenancePath(projectRoot:string,name:string):string{return join(hiProjectRoot(projectRoot),'provenance',`${safeSegment(name)}.json`)}
export function projectIntelligencePath(projectRoot:string,id:string):string{return join(hiProjectRoot(projectRoot),'project-intelligence','patterns',`${safeSegment(id)}.json`)}
export function projectMethodologyCandidatePath(projectRoot:string,id:string):string{return join(hiProjectRoot(projectRoot),'project-intelligence','methodology-candidates',`${safeSegment(id)}.json`)}
export function durableArtifactPath(projectRoot:string,kind:string,id:string):string{return join(hiProjectRoot(projectRoot),'artifacts',safeSegment(kind),`${safeSegment(id)}.json`)}
export function durableArtifactBinaryPath(projectRoot:string,kind:string,id:string,extension:string):string{return join(hiProjectRoot(projectRoot),'artifacts',safeSegment(kind),`${safeSegment(id)}.${safeSegment(extension).replace(/^\.+/,'')}`)}
export function projectMethodologyPolicyDir(projectRoot:string):string{return join(hiProjectRoot(projectRoot),'policy','methodologies')}
export function projectMethodologyPolicyPath(projectRoot:string,name:string):string{return join(projectMethodologyPolicyDir(projectRoot),`${safeSegment(name)}.json`)}
export function projectMethodologyProvenanceDir(projectRoot:string):string{return join(hiProjectRoot(projectRoot),'provenance','methodologies')}
export function projectMethodologyProvenancePath(projectRoot:string,name:string):string{return join(projectMethodologyProvenanceDir(projectRoot),`${safeSegment(name)}.json`)}
export function projectSkillRoot(projectRoot:string,skillName:string):string{return join(resolve(projectRoot),'.opencode','skills',safeSegment(skillName))}

export function storageLocation(projectRoot:string,kind:ProjectStorageKind,name:string,secondary?:string):string{
  switch(kind){
    case'POLICY':return projectPolicyPath(projectRoot,name)
    case'PROVENANCE':return projectProvenancePath(projectRoot,name)
    case'PROJECT_INTELLIGENCE':return projectIntelligencePath(projectRoot,name)
    case'PROJECT_METHODOLOGY_CANDIDATE':return projectMethodologyCandidatePath(projectRoot,name)
    case'DURABLE_ARTIFACT':if(!secondary)throw new Error('Durable artifact id required');return durableArtifactPath(projectRoot,name,secondary)
    case'PROJECT_METHODOLOGY_POLICY':return projectMethodologyPolicyPath(projectRoot,name)
    case'PROJECT_METHODOLOGY_PROVENANCE':return projectMethodologyProvenancePath(projectRoot,name)
    case'PROJECT_SKILL':return projectSkillRoot(projectRoot,name)
  }
}
