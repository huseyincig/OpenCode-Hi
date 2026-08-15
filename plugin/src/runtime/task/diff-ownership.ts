import { normalizeBoundedProjectPath } from '../../contracts/common.js'
import type { MissionTask,WorkerResult } from '../mission/types.js'

function norm(path:string):string{return normalizeBoundedProjectPath(path)??''}
function hasExt(path:string):boolean{return /\.[a-z0-9]+$/i.test(path.split('/').pop()??'')}
function within(file:string,target:string):boolean{const f=norm(file),t=norm(target);if(!f||!t)return false;if(f===t)return true;return !hasExt(t)&&f.startsWith(`${t}/`)}
function stem(path:string):string{return norm(path).replace(/\.(?:test|spec)\.[^.\/]+$/i,'').replace(/\.[^.\/]+$/,'')}
function autoRelated(file:string,scope:string[]):boolean{
  const f=norm(file),base=f.split('/').pop()??f
  if(scope.some(s=>stem(s)===stem(f)))return true
  if(/^(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/i.test(base)&&scope.some(s=>/package\.json$/i.test(norm(s))))return true
  return false
}
export interface DiffOwnershipAssessment{outside:string[];accepted:string[];collateral:string[]}
export interface ScopeExpansionClaim{file:string;reason:string;necessary:boolean}
export type ScopeExpansionAuthority='worker-proposal'|'control-plane'
export function assessChangedFileOwnership(scopeInput:string[],changedInput:string[],scopeExpansions:ScopeExpansionClaim[]=[],authority:ScopeExpansionAuthority='worker-proposal'):DiffOwnershipAssessment{
  const changed=[...new Set(changedInput.map(norm).filter(Boolean))],scope=[...new Set(scopeInput.map(norm).filter(Boolean))]
  if(!scope.length)return{outside:[],accepted:[],collateral:[]}
  const outside=changed.filter(file=>!scope.some(s=>within(file,s)))
  const declared=new Map(scopeExpansions.map(x=>[norm(x.file),x])),accepted:string[]=[],collateral:string[]=[]
  for(const file of outside){const claim=declared.get(file),controlPlaneAuthorized=authority==='control-plane'&&claim?.necessary===true;if(autoRelated(file,scope)||controlPlaneAuthorized)accepted.push(file);else collateral.push(file)}
  return{outside,accepted,collateral}
}
export function assessDiffOwnership(task:MissionTask,result:WorkerResult):DiffOwnershipAssessment{return assessChangedFileOwnership(task.scope??[],result.changed_files,result.scope_expansions??[],'worker-proposal')}
