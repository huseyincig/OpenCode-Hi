import { existsSync,readFileSync,readdirSync,realpathSync } from 'node:fs'
import { dirname,join,relative,resolve } from 'node:path'
import { resolveSkillPermission,type SkillPermission } from './permissions.js'
import { builtinMethodologyCatalog, methodologyLimits, type HiMethodologyCatalogEntry } from '../methodology/catalog.js'
export type SkillProvider='project'|'personal'|'hi'
export interface SkillCandidate{name:string;provider:SkillProvider;path:string;valid:boolean;enabled:boolean;orchestrationRisk:boolean;permission?:SkillPermission}
export interface SkillDiscoveryRoot{path:string;provider:SkillProvider}
export type SkillPreflightOutcome='allow'|'ask'|'deny'|'disabled'|'missing'|'invalid'|'incompatible'|'resource-unavailable'|'unknown-policy'|'budget-exceeded'|'composition-deferred'
export interface SkillPreflightResult{name:string;outcome:SkillPreflightOutcome;provider?:SkillProvider;path?:string}
export interface SkillPlan{selected:SkillCandidate[];requested:string[];missing:string[];outcomes:SkillPreflightResult[];reason:string[]}

function requestedMethodologies(methodologyNeeds:string[]):string[]{return [...new Set(methodologyNeeds)]}

export function parseSkillFrontmatter(text:string):Record<string,string>{const m=text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);if(!m)return{};const out:Record<string,string>={};for(const raw of m[1].split(/\r?\n/)){if(/^\s/.test(raw))continue;const hit=raw.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);if(!hit)continue;let value=hit[2].trim();if(value.length>=2&&((value.startsWith('\"')&&value.endsWith('\"'))||(value.startsWith("'")&&value.endsWith("'"))))value=value.slice(1,-1);out[hit[1]]=value}return out}
function validSkillFrontmatter(text:string,name:string):boolean{const fm=parseSkillFrontmatter(text);return fm.name===name&&Boolean(fm.description)}
function canonical(path:string):string{try{return realpathSync(path)}catch{return resolve(path)}}
function confined(root:string,target:string):boolean{const r=canonical(root),t=canonical(target),rel=relative(r,t);return rel===''||(rel!=='..'&&!rel.startsWith('../')&&!rel.startsWith('..\\'))}
function inspectDir(path:string,provider:SkillProvider):SkillCandidate[]{
  if(!existsSync(path))return[]
  const root=canonical(path),out:SkillCandidate[]=[]
  for(const name of readdirSync(path)){
    const skillDir=join(path,name),file=join(skillDir,'SKILL.md')
    if(!existsSync(file))continue
    let valid=false
    try{
      const actualDir=canonical(skillDir),actualFile=canonical(file)
      if(!confined(root,actualDir)||!confined(actualDir,actualFile)||dirname(actualFile)!==actualDir)continue
      valid=validSkillFrontmatter(readFileSync(actualFile,'utf8'),name)
      out.push({name,provider,path:actualFile,valid,enabled:true,orchestrationRisk:false})
    }catch{}
  }
  return out
}
export function configuredSkillPaths(hostConfig:Record<string,unknown>):string[]{const skills=(hostConfig.skills&&typeof hostConfig.skills==='object')?hostConfig.skills as Record<string,unknown>:{};const paths=Array.isArray(skills.paths)?skills.paths:[];return[...new Set(paths.filter((x):x is string=>typeof x==='string'&&x.trim().length>0).map(x=>canonical(x.trim())))]}
export function skillDiscoveryRoots(projectRoot:string,hiRoot?:string,extraPaths:string[]=[]):SkillDiscoveryRoot[]{const home=process.env.HOME??process.env.USERPROFILE??'',opencodeConfigDir=process.env.OPENCODE_CONFIG_DIR?resolve(process.env.OPENCODE_CONFIG_DIR):join(home,'.config','opencode'),raw:[string,SkillProvider][]=[[join(projectRoot,'.opencode','skills'),'project'],[join(projectRoot,'.claude','skills'),'project'],[join(projectRoot,'.agents','skills'),'project'],...(hiRoot?[[join(hiRoot,'skills'),'hi'] as [string,SkillProvider]]:[]),[join(opencodeConfigDir,'skills'),'personal'],[join(home,'.claude','skills'),'personal'],[join(home,'.agents','skills'),'personal'],...extraPaths.map(x=>[x,'personal'] as [string,SkillProvider])],out:SkillDiscoveryRoot[]=[],seen=new Set<string>();for(const [path,provider] of raw){const real=canonical(path);if(seen.has(real))continue;seen.add(real);out.push({path:real,provider})}return out}
export function discoverSkills(projectRoot:string,hiRoot?:string,extraPaths:string[]=[]):SkillCandidate[]{const out:SkillCandidate[]=[];for(const root of skillDiscoveryRoots(projectRoot,hiRoot,extraPaths))out.push(...inspectDir(root.path,root.provider));return out}
export function resolveSkillPlan(
  methodologyNeeds:string[],
  candidates:SkillCandidate[],
  permissionMap?:Record<string,SkillPermission>,
  skillToolEnabled=true,
  role='coder',
  catalog:HiMethodologyCatalogEntry[]=builtinMethodologyCatalog(),
  availableResources:ReadonlySet<string>=new Set<string>(),
):SkillPlan{
  const requested=requestedMethodologies(methodologyNeeds),selected:SkillCandidate[]=[],missing:string[]=[],outcomeByName=new Map<string,SkillPreflightResult>()
  const eligible:Array<{name:string;candidate:SkillCandidate;permission:SkillPermission;policy:HiMethodologyCatalogEntry;index:number}>=[]
  for(const [index,name] of requested.entries()){
    const policy=catalog.find(item=>item.name===name)
    if(!policy){outcomeByName.set(name,{name,outcome:'unknown-policy'});missing.push(name);continue}
    if(!policy.compatibleRoles.includes(role)){outcomeByName.set(name,{name,outcome:'incompatible'});missing.push(name);continue}
    if(policy.resourceRequirements.some(resource=>!availableResources.has(resource))){outcomeByName.set(name,{name,outcome:'resource-unavailable'});missing.push(name);continue}
    const expectedProvider:SkillProvider=policy.provider
    const all=candidates.filter(candidate=>candidate.name===name)
    const foreign=all.filter(candidate=>candidate.provider!==expectedProvider)
    if(foreign.length){outcomeByName.set(name,{name,outcome:'invalid'});missing.push(name);continue}
    const candidate=all.find(item=>item.provider===expectedProvider&&item.valid&&item.enabled)
    const permission=resolveSkillPermission(name,permissionMap)
    let outcome:SkillPreflightOutcome
    if(!all.length)outcome='missing'
    else if(!skillToolEnabled)outcome='disabled'
    else if(!all.some(item=>item.valid))outcome='invalid'
    else if(permission==='deny')outcome='deny'
    else if(candidate)outcome=permission==='ask'?'ask':'allow'
    else outcome='missing'
    if(candidate&&skillToolEnabled&&permission!=='deny'&&(outcome==='allow'||outcome==='ask'))eligible.push({name,candidate,permission,policy,index})
    else missing.push(name)
    outcomeByName.set(name,{name,outcome,provider:candidate?.provider,path:candidate?.path})
  }
  const priorityRank={high:3,normal:2,low:1} as const,costRank={low:0,medium:1,high:2} as const
  const ranked=[...eligible].sort((a,b)=>priorityRank[b.policy.priority]-priorityRank[a.policy.priority]||Number(b.policy.preferredRoles.includes(role))-Number(a.policy.preferredRoles.includes(role))||b.policy.weight-a.policy.weight||(costRank[a.policy.contextCost]+costRank[a.policy.executionCost]+costRank[a.policy.compositionCost])-(costRank[b.policy.contextCost]+costRank[b.policy.executionCost]+costRank[b.policy.compositionCost])||a.index-b.index)
  const chosen:Array<(typeof ranked)[number]>=[]
  const conflicts=(a:HiMethodologyCatalogEntry,b:HiMethodologyCatalogEntry)=>a.conflicts.includes(b.name)||b.conflicts.includes(a.name)
  const coexists=(a:HiMethodologyCatalogEntry,b:HiMethodologyCatalogEntry)=>a.usefulCoexistence.includes(b.name)||b.usefulCoexistence.includes(a.name)
  for(const item of ranked){
    let pick=false,outcome:SkillPreflightOutcome=item.permission==='ask'?'ask':'allow'
    if(chosen.length<methodologyLimits.typicalMax)pick=true
    else if(chosen.length>=methodologyLimits.hardMax)outcome='budget-exceeded'
    else if(chosen.some(other=>conflicts(item.policy,other.policy)))outcome='composition-deferred'
    else if(chosen[0]&&coexists(item.policy,chosen[0].policy))pick=true
    else outcome='composition-deferred'
    if(pick){chosen.push(item);selected.push({...item.candidate,permission:item.permission})}
    else outcomeByName.set(item.name,{name:item.name,outcome,provider:item.candidate.provider,path:item.candidate.path})
  }
  const outcomes=requested.map(name=>outcomeByName.get(name)??{name,outcome:'missing' as SkillPreflightOutcome})
  const asks=selected.filter(item=>item.permission==='ask').map(item=>item.name),deferred=outcomes.filter(item=>item.outcome==='composition-deferred').map(item=>item.name)
  const reason=[
    selected.length?`skills=${selected.map(item=>`${item.provider}:${item.name}`).join(',')}`:'skills=0',
    ...(asks.length?[`skill-permission-ask=${asks.join(',')}`]:[]),
    ...(deferred.length?[`methodology-composition-deferred=${deferred.join(',')}`]:[]),
    ...(!skillToolEnabled?['skill-tool-disabled; native-fallback']:[]),
    ...(missing.length?[`missing-or-denied-methodology-fallback=${missing.join(',')}`]:[]),
  ]
  return{selected,requested,missing,outcomes,reason}
}


export type SkillResourceKind='references'|'scripts'|'assets'|'examples'
export interface SkillResource{name:string;kind:SkillResourceKind;relativePath:string;absolutePath:string}
export function indexSkillResources(skill:SkillCandidate):SkillResource[]{
  if(!skill.valid)return[]
  const base=canonical(resolve(skill.path,'..')),out:SkillResource[]=[]
  for(const kind of ['references','scripts','assets','examples'] as SkillResourceKind[]){const root=join(base,kind);if(!existsSync(root))continue;const walk=(dir:string):void=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const raw=join(dir,entry.name);let actual:string;try{actual=realpathSync(raw)}catch{continue}if(actual!==base&&!actual.startsWith(`${base}/`)&&!actual.startsWith(`${base}\\`))continue;if(entry.isDirectory())walk(raw);else if(entry.isFile()){const relativePath=actual.slice(canonical(root).length).replace(/^[\\/]+/,'').replace(/\\/g,'/');out.push({name:skill.name,kind,relativePath,absolutePath:actual})}}};walk(root)}
  return out.sort((a,b)=>`${a.kind}/${a.relativePath}`.localeCompare(`${b.kind}/${b.relativePath}`))
}
export function readSkillResource(skill:SkillCandidate,kind:SkillResourceKind,relativePath:string):string{
  if(relativePath.includes('..')||relativePath.startsWith('/')||relativePath.startsWith('\\'))throw new Error('Unsafe skill resource path')
  const hit=indexSkillResources(skill).find(r=>r.kind===kind&&r.relativePath===relativePath.replace(/\\/g,'/'))
  if(!hit)throw new Error(`Skill resource not found: ${skill.name}/${kind}/${relativePath}`)
  return readFileSync(hit.absolutePath,'utf8')
}
