import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'

export interface WorktreeState { branch:string; path:string; baseRef:string; createdAt:number; status:'active'|'removed' }
function git(cwd:string,args:string[]):string{const out=spawnSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],shell:false});if(out.status!==0)throw new Error(`git ${args[0]} failed: ${String(out.stderr??'').trim()}`);return String(out.stdout??'').trim()}
function safeBranch(branch:string):string{const b=branch.trim();if(!b||b.length>160||/[\s;&|`$<>\\]/.test(b)||b.startsWith('-')||b.includes('..')||b.includes('@{'))throw new Error('Unsafe worktree branch name');return b}
function confined(root:string,target:string):boolean{const r=resolve(root),t=resolve(target);return t===r||t.startsWith(r+sep)}
export class WorktreeRuntime{
  readonly #states=new Map<string,WorktreeState>()
  constructor(private repoRoot:string,private worktreeRoot:string){}
  create(branchInput:string,baseRef='HEAD'):WorktreeState{const branch=safeBranch(branchInput),root=resolve(this.worktreeRoot),path=resolve(root,branch.replace(/\//g,'__'));if(!confined(root,path))throw new Error('Worktree path escapes configured root');mkdirSync(dirname(path),{recursive:true});if(existsSync(path))throw new Error('Worktree path already exists');git(this.repoRoot,['rev-parse','--is-inside-work-tree']);git(this.repoRoot,['worktree','add','-b',branch,path,baseRef]);const state:WorktreeState={branch,path,baseRef,createdAt:Date.now(),status:'active'};this.#states.set(branch,state);return{...state}}
  remove(branchInput:string):boolean{const branch=safeBranch(branchInput),state=this.#states.get(branch);if(!state||state.status!=='active')return false;git(this.repoRoot,['worktree','remove',state.path,'--force']);state.status='removed';if(existsSync(state.path))rmSync(state.path,{recursive:true,force:true});return true}
  get(branch:string):WorktreeState|undefined{const s=this.#states.get(branch);return s?{...s}:undefined}
  list():WorktreeState[]{return[...this.#states.values()].map(x=>({...x}))}
}
