function record(value:unknown):Record<string,unknown>|undefined{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined}
function canonical(value:unknown):unknown{
  if(Array.isArray(value))return value.map(canonical)
  const r=record(value);if(!r)return value
  return Object.fromEntries(Object.keys(r).sort().map(k=>[k,canonical(r[k])]))
}
function same(a:unknown,b:unknown):boolean{return JSON.stringify(canonical(a))===JSON.stringify(canonical(b))}
const HI_INJECTED_AGENTS=new WeakSet<object>()
export function isHiInjectedOpenCodeAgent(value:unknown):boolean{return Boolean(value&&typeof value==='object'&&HI_INJECTED_AGENTS.has(value as object))}
const DECISION_RANK:Record<string,number>={deny:0,ask:1,allow:2}
function decision(value:unknown):'deny'|'ask'|'allow'|undefined{return typeof value==='string'&&value in DECISION_RANK?value as 'deny'|'ask'|'allow':undefined}
function leavesAtMost(value:unknown,max:'deny'|'ask'|'allow'):boolean{const d=decision(value);if(d)return DECISION_RANK[d]<=DECISION_RANK[max];const r=record(value);if(!r)return false;return Object.values(r).every(v=>leavesAtMost(v,max))}
function permissionCompatible(actual:unknown,expected:unknown,path:string[]=[]):boolean{
  const ed=decision(expected),ad=decision(actual)
  if(ed){if(ad)return DECISION_RANK[ad]<=DECISION_RANK[ed];return leavesAtMost(actual,ed)}
  const e=record(expected);if(!e)return same(actual,expected)
  if(ad)return ad==='deny' // a blanket deny is always a safe narrowing
  const a=record(actual);if(!a)return false
  const wildcard=decision(e['*'])
  for(const [key,value] of Object.entries(e)){
    if(key==='*'){const candidate=a[key]??a['*'];if(candidate===undefined||!permissionCompatible(candidate,value,[...path,key]))return false;continue}
    const candidate=a[key]??a['*'];if(candidate===undefined||!permissionCompatible(candidate,value,[...path,key]))return false
  }
  for(const [key,value] of Object.entries(a)){
    if(key in e)continue
    if(path.at(-1)==='skill'&&key.startsWith('hi-project-')&&decision(value))continue
    if(wildcard){if(!permissionCompatible(value,wildcard,[...path,key]))return false;continue}
    if(!leavesAtMost(value,'deny'))return false
  }
  return true
}

/**
 * Compatibility check for a pre-existing host agent occupying a canonical Hi name.
 * Hi execution-critical semantics remain fixed, while harmless display metadata and
 * permission narrowings are allowed. Permission widening or host-level model/tool
 * constraints are collisions because they can invalidate Hi routing/authority semantics.
 */
export function matchesHiOpenCodeAgent(actual:unknown,expected:unknown):boolean{
  const a=record(actual),e=record(expected);if(!a||!e)return false
  if(a.mode!==e.mode||a.prompt!==e.prompt)return false
  if(typeof e.steps==='number'){
    if(typeof a.steps!=='number'||!Number.isFinite(a.steps)||a.steps<1||a.steps>e.steps)return false
  }else if(a.steps!==undefined&&!same(a.steps,e.steps))return false
  if(!permissionCompatible(a.permission,e.permission,['permission']))return false
  for(const [key,value] of Object.entries(e)){
    if(['permission','mode','prompt','steps','description'].includes(key))continue
    if(!same(a[key],value))return false
  }
  const harmless=new Set(['description','hidden','color'])
  for(const key of Object.keys(a)){
    if(key in e||harmless.has(key))continue
    // Agent-level routing/tool/disable/options changes are not treated as metadata.
    return false
  }
  return true
}

export interface HiAgentProjectionResult{collisions:string[];inserted:string[];compatibleExisting:string[]}
export function projectHiOpenCodeAgents(hostConfig:Record<string,unknown>,packaged:Record<string,unknown>):HiAgentProjectionResult{
  const existing=record(hostConfig.agent),agents=existing??{},collisions:string[]=[],inserted:string[]=[],compatibleExisting:string[]=[]
  for(const [name,definition] of Object.entries(packaged))if(agents[name]!==undefined){if(matchesHiOpenCodeAgent(agents[name],definition))compatibleExisting.push(name);else collisions.push(name)}
  if(collisions.length)return{collisions:collisions.sort(),inserted:[],compatibleExisting:compatibleExisting.sort()}
  for(const [name,definition] of Object.entries(packaged))if(agents[name]===undefined){agents[name]=structuredClone(definition);if(agents[name]&&typeof agents[name]==='object')HI_INJECTED_AGENTS.add(agents[name] as object);inserted.push(name)}
  if(!existing&&inserted.length)hostConfig.agent=agents
  return{collisions:[],inserted:inserted.sort(),compatibleExisting:compatibleExisting.sort()}
}

/** Backward-compatible helper retained for narrow callers/tests. */
export function bindHiOpenCodeAgents(hostConfig:Record<string,unknown>,packaged:Record<string,unknown>):string[]{return projectHiOpenCodeAgents(hostConfig,packaged).collisions}
