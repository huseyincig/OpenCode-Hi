const KEY=Symbol.for('hi.active-runtime-instances')
type Owner=object
type Registry={legacy:Map<string,string>;byOwner:WeakMap<Owner,Map<string,string>>}
function registry():Registry{const g=globalThis as any;const existing=g[KEY];if(existing?.legacy instanceof Map&&existing?.byOwner instanceof WeakMap)return existing;const next:Registry={legacy:new Map<string,string>(),byOwner:new WeakMap<Owner,Map<string,string>>()};g[KEY]=next;return next}
export interface InstanceLease{key:string;token:string;release:()=>void}
export function acquireHiRuntimeInstance(projectKey:string,owner?:Owner):InstanceLease{
  const key=projectKey||'unknown-project',r=registry(),bucket=owner?(r.byOwner.get(owner)??new Map<string,string>()):r.legacy
  if(owner&&!r.byOwner.has(owner))r.byOwner.set(owner,bucket)
  const existing=bucket.get(key)
  if(existing)throw new Error(`Duplicate OpenCode-Hi runtime detected for ${key}; refusing double hook registration.`)
  const token=`hi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;bucket.set(key,token)
  return{key,token,release:()=>{if(bucket.get(key)===token)bucket.delete(key)}}
}
