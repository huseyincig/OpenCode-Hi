import {existsSync,readFileSync,realpathSync} from 'node:fs'
import {join,relative,resolve} from 'node:path'
import {resolveSkillPermission,type SkillPermission} from './permissions.js'
import {builtinMethodologyCatalog,methodologyLimits,type HiMethodologyCatalogEntry} from '../methodology/catalog.js'

export type SkillProvider='project'|'personal'|'hi'
export interface SkillCandidate{name:string;provider:SkillProvider;path:string;valid:boolean;enabled:boolean;orchestrationRisk:boolean;permission?:SkillPermission;canonicalForMethodology?:boolean}
export type SkillPreflightOutcome='allow'|'ask'|'deny'|'disabled'|'missing'|'invalid'|'incompatible'|'resource-unavailable'|'unknown-policy'|'budget-exceeded'|'composition-deferred'
export interface SkillPreflightResult{name:string;outcome:SkillPreflightOutcome;provider?:SkillProvider;path?:string}
export interface SkillPlan{selected:SkillCandidate[];requested:string[];missing:string[];outcomes:SkillPreflightResult[];reason:string[]}

function requestedMethodologies(methodologyNeeds:string[]):string[]{return[...new Set(methodologyNeeds)]}
function canonical(path:string):string{try{return realpathSync(path)}catch{return resolve(path)}}
function parseFrontmatter(text:string):Record<string,string>{const m=text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);if(!m)return{};const out:Record<string,string>={};for(const raw of m[1].split(/\r?\n/)){if(/^\s/.test(raw))continue;const hit=raw.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);if(!hit)continue;let value=hit[2].trim();if(value.length>=2&&((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'"))))value=value.slice(1,-1);out[hit[1]]=value}return out}
function confined(root:string,target:string):boolean{const rel=relative(canonical(root),canonical(target));return rel===''||(rel!=='..'&&!rel.startsWith('../')&&!rel.startsWith('..\\'))}
function exactSkill(root:string,name:string):{path:string;valid:boolean}|undefined{const raw=join(root,name,'SKILL.md');if(!existsSync(raw))return undefined;try{const actual=canonical(raw);if(!confined(root,actual))return{path:actual,valid:false};const fm=parseFrontmatter(readFileSync(actual,'utf8'));return{path:actual,valid:fm.name===name&&Boolean(fm.description)}}catch{return{path:resolve(raw),valid:false}}}
function configuredSkillPaths(hostConfig:Record<string,unknown>):string[]{const skills=hostConfig.skills&&typeof hostConfig.skills==='object'&&!Array.isArray(hostConfig.skills)?hostConfig.skills as Record<string,unknown>:{};return[...new Set((Array.isArray(skills.paths)?skills.paths:[]).filter((x):x is string=>typeof x==='string'&&x.trim().length>0).map(x=>canonical(x.trim())))]}
function nativeSkillRoots(projectRoot:string,hiRoot:string,hostConfig:Record<string,unknown>):Array<{root:string;provider:SkillProvider}>{const home=process.env.HOME??process.env.USERPROFILE??'',configDir=process.env.OPENCODE_CONFIG_DIR?resolve(process.env.OPENCODE_CONFIG_DIR):join(home,'.config','opencode'),raw:Array<{root:string;provider:SkillProvider}>=[{root:join(projectRoot,'.opencode','skills'),provider:'project'},{root:join(projectRoot,'.claude','skills'),provider:'project'},{root:join(projectRoot,'.agents','skills'),provider:'project'},{root:join(hiRoot,'skills'),provider:'hi'},{root:join(configDir,'skills'),provider:'personal'},{root:join(home,'.claude','skills'),provider:'personal'},{root:join(home,'.agents','skills'),provider:'personal'},...configuredSkillPaths(hostConfig).map(root=>({root,provider:'personal' as const}))],out:Array<{root:string;provider:SkillProvider}>=[],seen=new Set<string>();for(const item of raw){const root=canonical(item.root);if(seen.has(root))continue;seen.add(root);out.push({root,provider:item.provider})}return out}

/**
 * Narrow native-skill compatibility probe. It does not inventory or load the skill catalog.
 * Only methodology names already selected by Hi policy are checked for canonical availability
 * and same-name shadows across the OpenCode discovery roots. OpenCode owns actual discovery,
 * permission enforcement, body loading and bundled resource access.
 */
export function methodologySkillCandidates(requestedNames:string[],projectRoot:string,hiRoot:string,hostConfig:Record<string,unknown>,catalog:HiMethodologyCatalogEntry[]=builtinMethodologyCatalog()):SkillCandidate[]{
  const roots=nativeSkillRoots(projectRoot,hiRoot,hostConfig),out:SkillCandidate[]=[]
  for(const name of [...new Set(requestedNames)]){
    const policy=catalog.find(item=>item.name===name);if(!policy)continue
    const intendedRoot=canonical(policy.provider==='hi'?join(hiRoot,'skills'):join(projectRoot,'.opencode','skills'))
    const intended=exactSkill(intendedRoot,name)
    if(intended)out.push({name,provider:policy.provider,path:intended.path,valid:intended.valid,enabled:true,orchestrationRisk:false,canonicalForMethodology:true})
    const seen=new Set<string>(intended?[intended.path]:[])
    for(const root of roots){const hit=exactSkill(root.root,name);if(!hit||seen.has(hit.path))continue;seen.add(hit.path);out.push({name,provider:root.provider,path:hit.path,valid:hit.valid,enabled:true,orchestrationRisk:true,canonicalForMethodology:false})}
  }
  return out
}

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
    const foreign=all.filter(candidate=>candidate.canonicalForMethodology===false||candidate.provider!==expectedProvider)
    if(foreign.length){outcomeByName.set(name,{name,outcome:'invalid'});missing.push(name);continue}
    const candidate=all.find(item=>item.provider===expectedProvider&&item.canonicalForMethodology!==false&&item.valid&&item.enabled)
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
