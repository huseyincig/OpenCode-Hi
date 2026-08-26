import { spawnSync } from 'node:child_process'
import type { MissionState } from '../mission/types.js'
import { appendLedger } from '../ledger/ledger.js'
import { gitCommandParts } from './command-classifier.js'
import { normalizeBoundedProjectPath } from '../../contracts/common.js'

function normFile(v:string):string{return normalizeBoundedProjectPath(v)??''}
function splitLines(text:string):string[]{const raw=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),files=raw.map(normFile);if(files.some(x=>!x))throw new Error('Hi staging safety: Git staged-set output contained an unbounded repository path');return[...new Set(files)]}
function commandText(output:any):string{if(typeof output==='string')return output;if(typeof output?.output==='string')return output.output;if(typeof output?.stdout==='string')return output.stdout;if(typeof output?.data==='string')return output.data;return''}
export function isStagingInspection(command:string):boolean{const p=gitCommandParts(command);if(p.sub!=='diff')return false;const a=p.rest;return a.includes('--name-only')&&(a.includes('--cached')||a.includes('--staged'))}
export function isGitStatusInspection(command:string):boolean{const p=gitCommandParts(command);if(p.sub!=='status')return false;return p.rest.some(x=>x==='-s'||x==='--short'||x==='--porcelain'||x==='--porcelain=v1'||x==='--porcelain=1')}
export function isGitCommit(command:string):boolean{return gitCommandParts(command).sub==='commit'}
export function isGitTopologyMutation(command:string):boolean{return ['switch','checkout','merge','rebase','cherry-pick'].includes(gitCommandParts(command).sub??'')}
export function broadGitStage(command:string):boolean{const p=gitCommandParts(command);if(p.sub!=='add')return false;return p.rest.some(x=>['-A','--all','-u','--update','.','./','*',':/'].includes(x))}
export function commitStagesTrackedChanges(command:string):boolean{const p=gitCommandParts(command);return p.sub==='commit'&&p.rest.some(x=>x==='--all'||/^-[a-zA-Z]*a[a-zA-Z]*$/.test(x))}
export function commitHasDirectPathspec(command:string):boolean{const p=gitCommandParts(command);if(p.sub!=='commit')return false;return p.rest.some(x=>['-o','--only','-i','--include'].includes(x))||p.rest.includes('--')}
export function mutatesGitIndex(command:string):boolean{const p=gitCommandParts(command);if(['add','reset','rm','mv'].includes(p.sub??''))return true;return p.sub==='restore'&&p.rest.includes('--staged')}
export function recordPreexistingUserBaseline(m:MissionState,baseline:Record<string,string>|undefined):void{
  if(!baseline||m.vcs.preexisting_user_baseline_captured)return;m.vcs.preexisting_user_changes={...baseline};m.vcs.preexisting_user_baseline_captured=true;appendLedger(m,'user-diff.baseline-captured',{payload:{files:Object.keys(baseline).slice(0,80),count:Object.keys(baseline).length,policy:'first-mission-native-baseline'}})
}
export function recordStagingInspection(m:MissionState,command:string,output:any):void{
  if(!isStagingInspection(command))return;const files=splitLines(commandText(output));m.vcs.staging_safety={verified_files:files,verified_at:Date.now(),source:command.slice(0,180)};if(m.vcs.git_topology_pending&&!m.vcs.git_topology_pending.ownership_captured){const conflict=m.vcs.git_topology_pending.conflict_files??[];m.vcs.git_topology_owned_files=[...new Set([...files,...conflict])];m.vcs.git_topology_pending.ownership_captured=true;appendLedger(m,'git.topology.staged-owned',{payload:{files:m.vcs.git_topology_owned_files.slice(0,80),operation:m.vcs.git_topology_pending.command.slice(0,180),policy:'first-cached-set-plus-known-conflicts'}})}appendLedger(m,'git.staging.inspected',{payload:{files:files.slice(0,80),count:files.length}})
}
function porcelainPaths(text:string):string[]{
  const out:string[]=[]
  for(const raw of text.split(/\r?\n/)){if(!raw.trim())continue;const body=raw.length>=3?raw.slice(3).trim():raw.trim();const target=body.includes(' -> ')?body.split(' -> ').pop()!:body;if(target){const file=normFile(target.replace(/^"|"$/g,''));out.push(file||'__INVALID_GIT_PATH__')}}
  return [...new Set(out.filter(Boolean))]
}
export function inspectCurrentGitChangedFiles(projectRoot?:string):string[]|undefined{
  if(!projectRoot)return undefined
  const r=spawnSync('git',['-c',`safe.directory=${projectRoot}`,'-C',projectRoot,'status','--porcelain=v1','--untracked-files=all'],{encoding:'utf8'})
  if(r.status!==0||typeof r.stdout!=='string')return undefined
  const files=porcelainPaths(r.stdout);return files.includes('__INVALID_GIT_PATH__')?undefined:files
}
export function inspectGitIgnoredFiles(projectRoot:string|undefined,candidates:string[]):string[]|undefined{
  if(!projectRoot)return undefined
  const bounded=[...new Set(candidates.map(normFile).filter(Boolean))];if(!bounded.length)return[]
  const r=spawnSync('git',['-c',`safe.directory=${projectRoot}`,'-C',projectRoot,'check-ignore','--stdin'],{encoding:'utf8',input:bounded.join('\n')+'\n'})
  if(![0,1].includes(r.status??-1)||typeof r.stdout!=='string')return undefined
  const files=splitLines(r.stdout);return files.filter(file=>bounded.includes(file))
}
export function recordGitStatusInspection(m:MissionState,command:string,output:any):void{
  if(!isGitStatusInspection(command))return;const text=commandText(output),files=porcelainPaths(text);m.vcs.git_topology_safety={clean:files.length===0,verified_files:files,verified_at:Date.now(),source:command.slice(0,180)};appendLedger(m,'git.worktree.inspected',{payload:{clean:files.length===0,files:files.slice(0,80),count:files.length}})
}
export function invalidateGitTopologyProof(m:MissionState):void{m.vcs.git_topology_safety=undefined}
export function beginGitTopologyMutation(m:MissionState,command:string):void{m.vcs.git_topology_pending={command:command.slice(0,300),started_at:Date.now()};m.vcs.git_topology_owned_files=[];appendLedger(m,'git.topology.started',{payload:{command:command.slice(0,180)}})}
export function completeGitTopologyMutation(m:MissionState,command:string,success:boolean,text:string):void{if(!isGitTopologyMutation(command))return;if(success){m.execution.blockers=m.execution.blockers.filter(b=>!b.startsWith('git-topology-conflict:'));appendLedger(m,'git.topology.completed',{payload:{command:command.slice(0,180)}});return}if(/conflict|resolve all conflicts|fix conflicts|could not apply/i.test(text)){const blocker=`git-topology-conflict:${command.trim().split(/\s+/).slice(0,3).join('-')}`;if(!m.execution.blockers.includes(blocker))m.execution.blockers.push(blocker);const conflicts=[...text.matchAll(/(?:conflict[^\n]*?in|merge conflict in)\s+([^\s\r\n]+)/ig)].map(x=>normFile(String(x[1]??'').replace(/[,:;]+$/,''))).filter(Boolean);if(m.vcs.git_topology_pending)m.vcs.git_topology_pending.conflict_files=[...new Set([...(m.vcs.git_topology_pending.conflict_files??[]),...conflicts])];appendLedger(m,'git.topology.conflict',{payload:{command:command.slice(0,180),blocker,conflict_files:conflicts.slice(0,40)}})}else appendLedger(m,'git.topology.failed',{payload:{command:command.slice(0,180)}})}
export function clearGitTopologyOwnershipAfterCommit(m:MissionState):void{m.vcs.git_topology_pending=undefined;m.vcs.git_topology_owned_files=[];m.execution.blockers=m.execution.blockers.filter(b=>!b.startsWith('git-topology-conflict:'));appendLedger(m,'git.topology.reconciled',{payload:{reason:'commit-completed'}})}
export function assertSafeGitMutation(m:MissionState,command:string):void{
  const pre=new Set(Object.keys(m.vcs.preexisting_user_changes??{}).map(normFile));
  if(broadGitStage(command)&&pre.size){appendLedger(m,'git.staging.blocked',{payload:{reason:'broad-stage-with-preexisting-user-diff',command:command.slice(0,180),user_files:[...pre].slice(0,40)}});throw new Error(`Hi staging safety: broad git staging is blocked because pre-existing user changes exist (${[...pre].slice(0,8).join(', ')}). Stage only Hi-owned files explicitly.`)}
  if(commitStagesTrackedChanges(command)&&pre.size){appendLedger(m,'git.commit.blocked',{payload:{reason:'commit-all-with-preexisting-user-diff',command:command.slice(0,180)}});throw new Error('Hi staging safety: git commit -a/--all is blocked while pre-existing user changes exist. Stage only Hi-owned files explicitly and commit without -a.')}
  if(commitHasDirectPathspec(command)){appendLedger(m,'git.commit.blocked',{payload:{reason:'direct-pathspec-bypasses-staged-proof',command:command.slice(0,180)}});throw new Error('Hi staging safety: pathspec/--only/--include commit modes are blocked because they bypass the verified staged-set contract. Stage Hi-owned files explicitly, inspect `git diff --cached --name-only`, then use a normal commit.')}
  if(isGitTopologyMutation(command)){
    if(pre.size){appendLedger(m,'git.topology.blocked',{payload:{reason:'preexisting-user-diff',command:command.slice(0,180),user_files:[...pre].slice(0,40)}});throw new Error(`Hi merge/rebase safety: branch topology changes are blocked while pre-existing user changes exist (${[...pre].slice(0,8).join(', ')}). Preserve/resolve those user-owned edits outside Hi before switch/checkout/merge/rebase/cherry-pick.`)}
    const proof=m.vcs.git_topology_safety;if(!proof||Date.now()-proof.verified_at>120000){appendLedger(m,'git.topology.blocked',{payload:{reason:'worktree-not-inspected',command:command.slice(0,180)}});throw new Error('Hi merge/rebase safety: run `git status --porcelain` immediately before switch/checkout/merge/rebase/cherry-pick. Branch topology mutation is blocked until worktree cleanliness is verified.')}
    if(!proof.clean){appendLedger(m,'git.topology.blocked',{payload:{reason:'worktree-dirty',command:command.slice(0,180),files:proof.verified_files.slice(0,40)}});throw new Error(`Hi merge/rebase safety: worktree is not clean (${proof.verified_files.slice(0,8).join(', ')}). Commit or safely reconcile Hi-owned changes first; never absorb user-owned dirty state into a merge/rebase.`)}
    appendLedger(m,'git.topology.allowed',{payload:{command:command.slice(0,180),proof_age_ms:Date.now()-proof.verified_at}});return
  }
  if(!isGitCommit(command))return
  const proof=m.vcs.staging_safety;if(!proof||Date.now()-proof.verified_at>120000){appendLedger(m,'git.commit.blocked',{payload:{reason:'staging-not-verified'}});throw new Error('Hi staging safety: inspect the exact staged set with `git diff --cached --name-only` immediately before commit. Commit is blocked until staged ownership is verified.')}
  const owned=new Set([...(m.vcs.changed_files??[]),...(m.vcs.git_topology_owned_files??[])].map(normFile));const staged=proof.verified_files.map(normFile);const user=staged.filter(f=>pre.has(f));const unrelated=staged.filter(f=>!owned.has(f));
  if(user.length||unrelated.length){appendLedger(m,'git.commit.blocked',{payload:{reason:'staged-files-not-hi-owned',user_files:user.slice(0,40),unrelated:unrelated.slice(0,40),owned:[...owned].slice(0,80)}});throw new Error(`Hi staging safety: commit contains staged files outside Hi-owned delta: ${[...new Set([...user,...unrelated])].slice(0,12).join(', ')}. Preserve pre-existing user changes and stage only Hi-owned files.`)}
  appendLedger(m,'git.commit.allowed',{payload:{staged:staged.slice(0,80),ownership:'hi-owned-only'}})
}
export function invalidateStagingProof(m:MissionState):void{m.vcs.staging_safety=undefined}
