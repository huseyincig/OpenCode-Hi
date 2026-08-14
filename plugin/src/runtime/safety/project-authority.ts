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
export class ProjectAuthorityStore{
  readonly path:string
  #state:AuthorityFile
  constructor(root:string){this.path=projectPolicyPath(root,'authority');this.#state=this.#load()}
  #load():AuthorityFile{try{if(!existsSync(this.path))return empty();const raw=JSON.parse(readFileSync(this.path,'utf8'));if(raw?.schema!==1||!raw?.grants||typeof raw.grants!=='object')return empty();return raw}catch{return empty()}}
  has(cls:PersistentAuthorityClass):boolean{return Boolean(this.#state.grants[cls])}
  grant(cls:PersistentAuthorityClass):void{this.#state.grants[cls]={approved_at:Date.now(),source:'native-always'};mkdirSync(dirname(this.path),{recursive:true});writeFileSync(this.path,JSON.stringify(this.#state,null,2)+'\n','utf8')}
  grants():PersistentAuthorityClass[]{return(Object.keys(this.#state.grants) as PersistentAuthorityClass[]).filter(x=>this.has(x))}
}
function norm(s:string):string{return s.trim().toLowerCase().replace(/\s+/g,' ')}
export function authorityClassForPatterns(patterns:string[]):PersistentAuthorityClass|undefined{const p=patterns.map(norm);if(p.some(x=>/^git push(?:\s|\*)/.test(x)))return'git-push';if(p.some(x=>/^gh release create(?:\s|\*)/.test(x)))return'release-create';if(p.some(x=>/^(npm|pnpm|bun) publish(?:\s|\*)?/.test(x)||/^yarn npm publish(?:\s|\*)?/.test(x)))return'package-publish';if(p.some(x=>/^(docker push|kubectl apply|kubectl delete|terraform apply|vercel deploy|netlify deploy)(?:\s|\*)?/.test(x)))return'deploy';return undefined}
export function authorityPatterns(cls:PersistentAuthorityClass):string[]{return CLASS_PATTERNS[cls]}
function wildcard(pattern:string,value:string):boolean{const esc=pattern.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\?/g,'.');return new RegExp(`^${esc}$`,'i').test(value)}
function explicitDecision(bash:any,pattern:string):'allow'|'ask'|'deny'|undefined{if(typeof bash==='string')return bash==='deny'?'deny':undefined;if(!bash||typeof bash!=='object')return undefined;let decision: any;for(const [k,v] of Object.entries(bash)){if(k==='*')continue;if(wildcard(k,pattern.replace(/\*$/,''))||wildcard(k,pattern))decision=v}return['allow','ask','deny'].includes(decision)?decision:undefined}
/** Merge Hi's authority prompt/persistent grants without ever weakening a user/native explicit deny. */
export function applyProjectAuthorityPermissions(config:Record<string,unknown>,store:ProjectAuthorityStore):void{
  const permission=(config.permission&&typeof config.permission==='object'&&!Array.isArray(config.permission)?config.permission:{}) as Record<string,any>
  const existing=permission.bash
  if(existing==='deny'){config.permission=permission;return}
  const bash:Record<string,any>=existing&&typeof existing==='object'&&!Array.isArray(existing)?{...existing}:{'*':typeof existing==='string'?existing:'allow'}
  // Project-local VCS bookkeeping is reversible and should not create approval spam in autonomous flows.
  for(const pattern of ['git status*','git diff *','git add *','git commit *','git merge *','git tag *'])if(explicitDecision(existing,pattern)===undefined)bash[pattern]='allow'
  for(const cls of Object.keys(CLASS_PATTERNS) as PersistentAuthorityClass[])for(const pattern of CLASS_PATTERNS[cls]){
    const user=explicitDecision(existing,pattern)
    if(user==='deny'||user==='allow')continue
    bash[pattern]=store.has(cls)?'allow':'ask'
  }
  // Persistent normal-push approval never widens to destructive history rewrites.
  if(explicitDecision(existing,'git push --force*')===undefined)bash['git push --force*']='ask'
  if(explicitDecision(existing,'git push -f *')===undefined)bash['git push -f *']='ask'
  permission.bash=bash;config.permission=permission
}
