import {createHash} from 'node:crypto'
import type {ContextFreshness,ContextPriority,ContextProtection} from '../../contracts/context-reference.js'

export interface ContextProjectionGroup{
  id:string
  items:string[]
  priority:ContextPriority
  protection:ContextProtection
  freshness:ContextFreshness
  required?:boolean
  content_hash?:string
  source_ref?:string
}
export interface ContextProjectionDecision{
  selected:ContextProjectionGroup[]
  omitted:string[]
  used_chars:number
  budget_chars:number
  complete:boolean
  missing_required:string[]
  duplicate_groups:string[]
}
const P:Record<ContextPriority,number>={low:2,normal:6,high:12}
const F:Record<ContextFreshness,number>={FRESH:4,UNKNOWN:2,POTENTIALLY_STALE:.5}
const R:Record<ContextProtection,number>={PROTECTED:8,COMPRESSIBLE:2,PURGEABLE:0}
function text(g:ContextProjectionGroup):string{return g.items.filter(Boolean).join('\n')}
function cost(g:ContextProjectionGroup):number{return text(g).length}
function digest(g:ContextProjectionGroup):string{return g.content_hash??createHash('sha256').update(text(g)).digest('hex')}
function mandatory(g:ContextProjectionGroup):boolean{return g.required===true||g.protection==='PROTECTED'}
function score(g:ContextProjectionGroup):number{return P[g.priority]+F[g.freshness]+R[g.protection]}
function canonicalGroups(groups:readonly ContextProjectionGroup[]):{groups:ContextProjectionGroup[];duplicates:string[]}{
  const seenOptional=new Set<string>(),seenAny=new Set<string>(),out:ContextProjectionGroup[]=[],duplicates:string[]=[]
  for(const raw of groups){const g={...raw,items:raw.items.map(String).filter(Boolean)};if(!g.id||!g.items.length)continue;const key=digest(g),must=mandatory(g);if(!must&&seenAny.has(key)){duplicates.push(g.id);continue}out.push(g);seenAny.add(key);if(!must)seenOptional.add(key)}
  return{groups:out,duplicates}
}
export function projectContextGroups(groups:readonly ContextProjectionGroup[],budgetChars:number):ContextProjectionDecision{
  if(!Number.isFinite(budgetChars)||budgetChars<0)throw new Error('context projection budget must be finite and non-negative')
  const canonical=canonicalGroups(groups),selected:ContextProjectionGroup[]=[],omitted:string[]=[],missing_required:string[]=[];let used=0
  const required=canonical.groups.filter(mandatory),optional=canonical.groups.map((g,index)=>({g,index})).filter(x=>!mandatory(x.g)).sort((a,b)=>score(b.g)-score(a.g)||a.index-b.index).map(x=>x.g)
  for(const g of required){const c=cost(g);if(used+c>budgetChars){missing_required.push(g.id);continue}selected.push(g);used+=c}
  if(missing_required.length)return{selected,omitted:[...optional.map(g=>g.id),...missing_required],used_chars:used,budget_chars:budgetChars,complete:false,missing_required,duplicate_groups:canonical.duplicates}
  for(const g of optional){const c=cost(g);if(used+c<=budgetChars){selected.push(g);used+=c}else omitted.push(g.id)}
  return{selected,omitted,used_chars:used,budget_chars:budgetChars,complete:true,missing_required,duplicate_groups:canonical.duplicates}
}
export function renderProjectedContext(decision:ContextProjectionDecision):string[]{return decision.selected.flatMap(g=>g.items)}
