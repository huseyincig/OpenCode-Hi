import { realpathSync } from 'node:fs'
import { isAbsolute,relative,resolve,sep } from 'node:path'
import { normalizeBoundedProjectPath } from '../../contracts/common.js'

export type NewTaskScopeAdmissionReason='unchanged'|'repository-discovery-unbound-normalized'|'repository-scope-unbound'|'repository-scope-invalid'
export interface NewTaskScopeAdmission{
  accepted:boolean
  scope:string[]
  reason:NewTaskScopeAdmissionReason
  unbound:string[]
  canonical_targets:string[]
}

function uniqueBounded(items:readonly string[]):{values:string[];invalid:string[]}{
  const values:string[]=[],invalid:string[]=[]
  for(const raw of items){const bounded=normalizeBoundedProjectPath(raw);if(!bounded){invalid.push(raw);continue}if(!values.includes(bounded))values.push(bounded)}
  return{values,invalid}
}

/**
 * A model-supplied read scope becomes canonical repository authority only when it
 * resolves to a current project-contained filesystem identity. An exact Mission
 * target is authoritative only when repository-shaped authority can be established:
 * it resolves to a current project identity or is an unmistakably file-shaped future
 * target. Semantic slash terms remain discovery hints rather than filesystem scope.
 */
export function projectContainedExistingScope(projectRoot:string,candidate:string):boolean{
  try{
    const project=realpathSync(projectRoot),actual=realpathSync(resolve(projectRoot,candidate)),rel=relative(project,actual)
    return rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith(`..${sep}`))
  }catch{return false}
}

/**
 * A non-existent Mission target can still be repository authority when it is
 * unmistakably file-shaped (for example `src/future.ts` or `.env`). Arbitrary
 * extensionless slash terms are not enough: natural-language concepts such as
 * `session/auth` must remain search/discovery hints until a real source path is
 * observed.
 */
function explicitFutureFileScope(candidate:string):boolean{
  const basename=candidate.split('/').filter(Boolean).at(-1)??''
  if(!basename)return false
  if(basename.startsWith('.')&&basename.length>1)return true
  const dot=basename.lastIndexOf('.')
  return dot>0&&dot<basename.length-1
}

function repositoryAuthoritativeTarget(projectRoot:string,candidate:string):boolean{
  return projectContainedExistingScope(projectRoot,candidate)||explicitFutureFileScope(candidate)
}

/**
 * Reconcile scope only for NEW repository-explorer tasks. Exact task resume must
 * never call this function to rewrite an existing canonical Task contract.
 *
 * Empty repository-explorer scope is an existing Hi contract for unknown-target
 * bounded discovery: exact current-attempt read receipts later promote the actual
 * inspected source scope. When every supplied scope token is unbound model prose
 * and the Mission has no canonical target yet, normalize to that discovery mode
 * instead of granting a fake path authority. Mixed or otherwise unbound scopes
 * fail closed rather than silently dropping entries.
 */
export function admitNewTaskScope(input:{projectRoot:string;role:string;ambiguity:string;missionTargets?:readonly string[];requestedScope:readonly string[]}):NewTaskScopeAdmission{
  if(input.role!=='repository-explorer')return{accepted:true,scope:[...input.requestedScope],reason:'unchanged',unbound:[],canonical_targets:[]}
  const requested=uniqueBounded(input.requestedScope),candidateTargets=uniqueBounded((input.missionTargets??[]).filter(target=>!/^https?:\/\//i.test(target))).values,targets=candidateTargets.filter(target=>repositoryAuthoritativeTarget(input.projectRoot,target))
  if(requested.invalid.length)return{accepted:false,scope:requested.values,reason:'repository-scope-invalid',unbound:[...requested.invalid],canonical_targets:targets}
  if(!requested.values.length)return{accepted:true,scope:[],reason:'unchanged',unbound:[],canonical_targets:targets}
  const canonical=new Set(targets),unbound=requested.values.filter(candidate=>!canonical.has(candidate)&&!projectContainedExistingScope(input.projectRoot,candidate))
  if(!unbound.length)return{accepted:true,scope:requested.values,reason:'unchanged',unbound:[],canonical_targets:targets}
  const unknownDiscovery=input.ambiguity!=='none'&&targets.length===0&&unbound.length===requested.values.length
  if(unknownDiscovery)return{accepted:true,scope:[],reason:'repository-discovery-unbound-normalized',unbound,canonical_targets:targets}
  return{accepted:false,scope:requested.values,reason:'repository-scope-unbound',unbound,canonical_targets:targets}
}
