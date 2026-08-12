export type SkillPermission='allow'|'ask'|'deny'
function isRecord(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function isPermission(v:unknown):v is SkillPermission{return v==='allow'||v==='ask'||v==='deny'}
function wildcard(pattern:string,value:string):boolean{const escaped=pattern.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*');return new RegExp(`^${escaped}$`).test(value)}
export function resolveSkillPermissionMap(config:Record<string,unknown>,agentId?:string):Record<string,SkillPermission>|undefined{
  const toMap=(raw:unknown)=>{const out:Record<string,SkillPermission>={};if(!isRecord(raw))return out;for(const [k,v] of Object.entries(raw))if(isPermission(v))out[k]=v;return out}
  const global=toMap((config as any)?.permission?.skill);const agent=agentId?toMap((config as any)?.agent?.[agentId]?.permission?.skill):{};const merged={...global,...agent};return Object.keys(merged).length?merged:undefined
}
export function resolveSkillToolEnabled(config:Record<string,unknown>,agentId?:string):boolean{if((config as any)?.tools?.skill===false)return false;if(agentId&&(config as any)?.agent?.[agentId]?.tools?.skill===false)return false;return true}
export function resolveSkillPermission(name:string,map?:Record<string,SkillPermission>):SkillPermission{if(!map)return'allow';if(map[name])return map[name];const matches=Object.keys(map).filter(p=>wildcard(p,name)).sort((a,b)=>b.length-a.length);return matches.length?map[matches[0]]:'allow'}
