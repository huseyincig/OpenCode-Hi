import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { projectPolicyPath } from '../storage/ownership.js'
import type { ExternalActionType } from '../../contracts/external-action.js'

export type PersistentAuthorityClass=ExternalActionType
interface AuthorityFile{schema:1;grants:Partial<Record<PersistentAuthorityClass,{approved_at:number;source:'native-always'}>>}
const CLASS_PATTERNS:Record<PersistentAuthorityClass,string[]>={
  'git-push':['git push *'],
  'release-create':['gh release create *'],
  'package-publish':['npm publish*','pnpm publish*','bun publish*','yarn npm publish*'],
  'deploy':['docker push *','kubectl apply *','kubectl delete *','terraform apply *','vercel deploy*','netlify deploy*'],
}
function empty():AuthorityFile{return{schema:1,grants:{}}}
const AUTHORITY_CLASSES=new Set<PersistentAuthorityClass>(['git-push','release-create','package-publish','deploy'])
function authorityFile(value:unknown):AuthorityFile|undefined{
  if(!value||typeof value!=='object'||Array.isArray(value))return
  const raw=value as Record<string,unknown>;if(Object.keys(raw).some(key=>!['schema','grants'].includes(key))||raw.schema!==1||!raw.grants||typeof raw.grants!=='object'||Array.isArray(raw.grants))return
  const grants=raw.grants as Record<string,unknown>
  for(const [key,value] of Object.entries(grants)){
    if(!AUTHORITY_CLASSES.has(key as PersistentAuthorityClass)||!value||typeof value!=='object'||Array.isArray(value))return
    const grant=value as Record<string,unknown>,keys=Object.keys(grant)
    if(keys.length!==2||!keys.includes('approved_at')||!keys.includes('source')||typeof grant.approved_at!=='number'||!Number.isFinite(grant.approved_at)||grant.approved_at<=0||grant.source!=='native-always')return
  }
  return{schema:1,grants:grants as AuthorityFile['grants']}
}
export class ProjectAuthorityStore{
  readonly path:string
  #state:AuthorityFile
  constructor(root:string){this.path=projectPolicyPath(root,'authority');this.#state=this.#load()}
  #load():AuthorityFile{try{if(!existsSync(this.path))return empty();return authorityFile(JSON.parse(readFileSync(this.path,'utf8')))??empty()}catch{return empty()}}
  has(cls:PersistentAuthorityClass):boolean{return Boolean(this.#state.grants[cls])}
  grant(cls:PersistentAuthorityClass):void{this.#state.grants[cls]={approved_at:Date.now(),source:'native-always'};mkdirSync(dirname(this.path),{recursive:true});writeFileSync(this.path,JSON.stringify(this.#state,null,2)+'\n','utf8')}
  grants():PersistentAuthorityClass[]{return(Object.keys(this.#state.grants) as PersistentAuthorityClass[]).filter(x=>this.has(x))}
}
function norm(s:string):string{return s.trim().toLowerCase().replace(/\s+/g,' ')}
export function authorityClassForPatterns(patterns:string[]):PersistentAuthorityClass|undefined{const p=patterns.map(norm);if(p.some(x=>/^git push(?:\s|\*)/.test(x)))return'git-push';if(p.some(x=>/^gh release create(?:\s|\*)/.test(x)))return'release-create';if(p.some(x=>/^(npm|pnpm|bun) publish(?:\s|\*)?/.test(x)||/^yarn npm publish(?:\s|\*)?/.test(x)))return'package-publish';if(p.some(x=>/^(docker push|kubectl apply|kubectl delete|terraform apply|vercel deploy|netlify deploy)(?:\s|\*)?/.test(x)))return'deploy';return undefined}
function wildcard(pattern:string,value:string):boolean{const esc=pattern.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\?/g,'.');return new RegExp(`^${esc}$`,'i').test(value)}
type HostPermissionDecision='allow'|'ask'|'deny'
function decisionInfo(bash:any,pattern:string):{decision:HostPermissionDecision;source:'broad'|'specific'}|undefined{if(typeof bash==='string')return bash==='allow'||bash==='ask'||bash==='deny'?{decision:bash,source:'broad'}:undefined;if(!bash||typeof bash!=='object')return undefined;let result:{decision:HostPermissionDecision;source:'broad'|'specific'}|undefined;for(const [k,v] of Object.entries(bash))if((k==='*'||wildcard(k,pattern.replace(/\*$/,''))||wildcard(k,pattern))&&(v==='allow'||v==='ask'||v==='deny'))result={decision:v,source:k==='*'?'broad':'specific'};return result}
/** Merge Hi's authority prompt/persistent grants without ever weakening a user/native explicit deny. */
export function applyProjectAuthorityPermissions(config:Record<string,unknown>,store:ProjectAuthorityStore):void{
  const permission=(config.permission&&typeof config.permission==='object'&&!Array.isArray(config.permission)?config.permission:{}) as Record<string,any>
  const existing=permission.bash
  if(existing==='deny'){config.permission=permission;return}
  const bash:Record<string,any>=existing&&typeof existing==='object'&&!Array.isArray(existing)?{...existing}:{...(typeof existing==='string'?{'*':existing}:{})}
  // Local reversible bookkeeping follows an existing host/user decision. When none exists,
  // OpenCode V1 is permissive by default, so adding an explicit ALLOW is semantically neutral.
  for(const pattern of ['git status*','git diff *','git add *','git commit *','git merge *','git tag *'])if(decisionInfo(existing,pattern)===undefined)bash[pattern]='allow'
  // External effects are Hi authority hinges. A broad/default ALLOW may be narrowed to ASK,
  // or restored to ALLOW after exact persistent native approval. Specific user/plugin rules
  // and broad ASK/DENY remain authoritative and are never widened.
  for(const cls of Object.keys(CLASS_PATTERNS) as PersistentAuthorityClass[])for(const pattern of CLASS_PATTERNS[cls]){
    const info=decisionInfo(existing,pattern)
    if(info?.source==='specific'||info?.decision==='ask'||info?.decision==='deny')continue
    bash[pattern]=store.has(cls)?'allow':'ask'
  }
  // Persistent normal-push approval never widens to destructive history rewrites.
  for(const pattern of ['git push --force*','git push -f *']){const info=decisionInfo(existing,pattern);if(info?.source==='specific'||info?.decision==='ask'||info?.decision==='deny')continue;bash[pattern]='ask'}
  permission.bash=bash;config.permission=permission
}
