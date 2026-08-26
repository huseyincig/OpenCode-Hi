import {projectExecutionSurface,type ExecutionFragment} from '../safety/execution-projection.js'
import {gitCommandParts} from '../safety/command-classifier.js'

export type ShellDecision='ALLOW'|'REWRITE'|'USER_ACTION_REQUIRED'|'DENY'
export type ShellHumanDecisionType='credential_action'|'operational_action'
export interface ShellPolicyResult{decision:ShellDecision;command:string;reason:string;human_decision_type?:ShellHumanDecisionType;reason_code?:string}
interface ShellCommandView{executable:string;args:string[];assignments:string[]}
function shellWords(source:string):string[]{
  const out:string[]=[];let cur='',quote:'"'|"'"|undefined,escape=false
  const flush=()=>{if(cur){out.push(cur);cur=''}}
  for(let i=0;i<source.length;i++){
    const ch=source[i]
    if(escape){cur+=ch;escape=false;continue}
    if(ch==='\\'&&quote!=="'"){escape=true;continue}
    if(quote){if(ch===quote)quote=undefined;else cur+=ch;continue}
    if(ch==='"'||ch==="'"){quote=ch;continue}
    if(/\s/.test(ch)){flush();continue}
    cur+=ch
  }
  flush();return out
}
function commandBasename(value:string|undefined):string{return(value??'').replace(/^.*[\\/]/,'').toLowerCase()}
function commandView(text:string):ShellCommandView|undefined{
  const tokens=shellWords(text);if(!tokens.length)return
  let i=0;const assignments:string[]=[]
  while(i<tokens.length&&/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i]))assignments.push(tokens[i++])
  const executable=commandBasename(tokens[i]);if(!executable)return
  return{executable,args:tokens.slice(i+1),assignments}
}
function interactiveAssessment(view:ShellCommandView|undefined,dialect:ExecutionFragment['dialect']):boolean{
  if(!view)return false
  const {executable,args}=view,a0=args[0]?.toLowerCase(),a1=args[1]?.toLowerCase()
  if(executable==='select'&&dialect==='posix')return true
  if(executable==='ssh')return !args.some(token=>/^-[^-]*T/.test(token))
  if(executable==='passwd')return true
  if(['npm','pnpm','yarn'].includes(executable)&&a0==='login')return true
  if(executable==='gh'&&a0==='auth'&&a1==='login')return true
  if(executable==='az'&&a0==='login')return true
  if(executable==='gcloud'&&(a0==='login'||a0==='auth'&&a1==='login'))return true
  if(executable==='aws'&&(a0==='login'||a0==='sso'&&a1==='login'||a0==='configure'&&a1==='sso'))return true
  return false
}
const CATASTROPHIC_FILESYSTEM=[
  /(?:^|[;&|]\s*)shred\s+[^;|&]*(?:\/dev\/|\/etc\/|\/home\/|~\/|\$HOME)/i,
  /(?:^|[;&|]\s*)mkfs(?:\.[A-Za-z0-9_-]+)?\s/i,
  /(?:^|[;&|]\s*)dd\s+[^;|&]*\bof=\/dev\//i,
]
const IRREVERSIBLE_EXTERNAL=[
  /\bgh\s+repo\s+delete\b/i,
  /\b(?:npm|pnpm|yarn)\s+unpublish\b/i,
  /\bterraform\s+destroy\b/i,
  /\b(?:aws|gcloud|az)\b[^;|&]*\b(?:delete|destroy|terminate)\b/i,
]
const SHORT_PASSWORD_COMMANDS=new Set(['mysql','mariadb','mysqldump','mariadb-dump','mysqladmin','mariadb-admin','sshpass'])
function plainSecretValue(value:string|undefined):boolean{
  if(!value)return false
  const normalized=value.replace(/^['"]|['"]$/g,'')
  return Boolean(normalized&&!/[${}`]/.test(normalized)&&!/^<[^>]+>$/.test(normalized)&&normalized!=='<HI_REDACTED_SECRET>')
}
function secretSensitiveAssessment(view:ShellCommandView|undefined):boolean{
  if(!view)return false
  for(const assignment of view.assignments){const match=/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(assignment);if(match&&/(?:password|passwd|secret|token|api_?key)$/i.test(match[1])&&plainSecretValue(match[2]))return true}
  const args=view.args
  for(let i=0;i<args.length;i++){
    const token=args[i]
    if(/^Authorization:\s*Bearer\s+[A-Za-z0-9._~+\/-]{12,}$/i.test(token))return true
    const long=/^--(?:password|secret|token|api[_-]?key)(?:=(.*))?$/i.exec(token)
    if(long&&plainSecretValue(long[1]??args[i+1]))return true
  }
  const shortPassword=SHORT_PASSWORD_COMMANDS.has(view.executable)||(['docker','podman'].includes(view.executable)&&args[0]?.toLowerCase()==='login')
  if(!shortPassword)return false
  for(let i=0;i<args.length;i++){const token=args[i];if(token==='-p'&&plainSecretValue(args[i+1]))return true;if(/^-p.+/.test(token)&&plainSecretValue(token.slice(2)))return true}
  return false
}
function words(text:string):string[]{return text.trim().split(/\s+/).filter(Boolean)}
function executableWords(text:string):string[]{const tokens=words(text);let i=0;while(i<tokens.length&&/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i]))i++;return tokens.slice(i)}
function executableText(text:string):string{return executableWords(text).join(' ')}
function rmAssessment(fragment:ExecutionFragment):'catastrophic'|'dynamic'|undefined{
  const tokens=executableWords(fragment.text);if(tokens[0]?.toLowerCase()!=='rm')return
  let recursive=false,force=false,i=1
  for(;i<tokens.length;i++){const token=tokens[i];if(token==='--') {i++;break}if(!token.startsWith('-')||token==='-')break;if(token==='--recursive')recursive=true;else if(token==='--force')force=true;else{if(/[rR]/.test(token.slice(1)))recursive=true;if(/f/.test(token.slice(1)))force=true}}
  if(!recursive)return
  const targets=tokens.slice(i);if(!targets.length)return'dynamic'
  for(const raw of targets){const target=raw.replace(/^['"]|['"]$/g,'');if(/^(?:\/$|\/(?:etc|usr|var|boot|root|home)(?:\/|$)|~\/?(?:$|\/)|\$HOME(?:\/|$)|\$\{HOME\}(?:\/|$)|\.\.(?:\/|$)|\*(?:\/|$))/.test(target))return'catastrophic';if((target==='.'||target==='./')&&fragment.cwdRisk!=='stable')return'catastrophic';if(target==='.'||target==='./')return'catastrophic';if(/(?:\$\(|`|<\(|>\(|\$\{|\$[A-Za-z_0-9@*?])/.test(target))return'dynamic'}
  for(const raw of targets){const target=raw.replace(/^['"]|['"]$/g,''),absolute=target.startsWith('/')||/^[A-Za-z]:[\\/]/.test(target);if(!absolute&&['root','home','system'].includes(fragment.cwdRisk))return'catastrophic';if(!absolute&&fragment.cwdRisk==='unknown')return'dynamic'}
  if(force&&fragment.origin==='pipeline-consumer')return'dynamic'
  return
}
function boundedGitClean(text:string):boolean{
  const tokens=executableWords(text),marker=tokens.indexOf('--');if(marker<0||marker===tokens.length-1)return false
  return tokens.slice(marker+1).every(path=>/^\.\/[A-Za-z0-9_.@/-]+$/.test(path)&&path!=='./'&&!path.includes('/../')&&!path.endsWith('/..'))
}
function gitAssessment(fragment:ExecutionFragment):'destructive'|'dynamic'|undefined{
  const text=executableText(fragment.text),parts=gitCommandParts(fragment.text),sub=parts.sub,rest=parts.rest
  if(!/^git\s+/i.test(text))return
  if(/^git\s+reset\b/i.test(text)){if(fragment.dynamic)return'dynamic';if(/(?:^|\s)--(?:hard|merge|keep)(?:\s|$)/i.test(text))return'destructive'}
  if(/^git\s+clean\b/i.test(text)&&/(?:^|\s)-(?:[^\s]*f[^\s]*)(?:\s|$)|(?:^|\s)--force(?:\s|$)/i.test(text)&&!boundedGitClean(text))return'destructive'
  if(/^git\s+checkout\s+--(?:\s|$)/i.test(text))return'destructive'
  if(/^git\s+restore\b/i.test(text)){const staged=/(?:^|\s)--staged(?:\s|$)/i.test(text),worktree=/(?:^|\s)--worktree(?:\s|$)/i.test(text);if(!staged||worktree)return'destructive'}
  if(sub==='branch'&&(rest.includes('-D')||rest.includes('--delete')&&rest.includes('--force')))return'destructive'
  if(sub==='stash'&&['drop','clear'].includes(rest[0]??''))return'destructive'
  if(sub==='tag'&&rest.some(x=>x==='-d'||x==='--delete'))return'destructive'
  if(sub==='reflog'&&rest[0]==='delete')return'destructive'
  if(sub==='worktree'&&rest[0]==='remove'&&rest.some(x=>x==='-f'||x==='--force'||/^-[^-]*f/.test(x)))return'destructive'
  if(sub==='rm'&&rest.some(x=>x==='-f'||x==='--force'||/^-[^-]*f/.test(x)))return'destructive'
  return
}
function powershellAssessment(fragment:ExecutionFragment):'destructive'|'dynamic'|undefined{
  const text=fragment.text.trim();if(fragment.dialect!=='powershell'||!/^Remove-Item\b/i.test(text)||!/(?:^|\s)-(?:Recurse|r)(?:\s|$)/i.test(text))return
  const tokens=words(text),targets=tokens.slice(1).filter(token=>!token.startsWith('-'));if(!targets.length)return'dynamic'
  for(const raw of targets){const target=raw.replace(/^['"]|['"]$/g,'');if(/(?:\$\(|`|\$\{|\$[A-Za-z_])/.test(target))return'dynamic';if(['.','./','~','$HOME','${HOME}','/'].includes(target))return'destructive';if(/^[A-Za-z]:[\\/]?$/.test(target)||/^[A-Za-z]:[\\/](?:Windows|Users|Program Files|ProgramData)(?:[\\/]|$)/i.test(target))return'destructive';if(/^\/(?:etc|usr|var|boot|root|home)(?:\/|$)/i.test(target))return'destructive'}
  for(const raw of targets){const target=raw.replace(/^['"]|['"]$/g,''),absolute=target.startsWith('/')||/^[A-Za-z]:[\\/]/.test(target);if(!absolute&&['root','home','system'].includes(fragment.cwdRisk))return'destructive';if(!absolute&&fragment.cwdRisk==='unknown')return'dynamic'}
  return
}
function windowsCmdAssessment(fragment:ExecutionFragment):'destructive'|'dynamic'|undefined{
  const tokens=words(fragment.text),head=tokens[0]?.toLowerCase();if(!['rmdir','rd','del','erase'].includes(head??''))return
  const recursive=tokens.slice(1).some(token=>/^\/s$/i.test(token));if(!recursive)return
  const targets=tokens.slice(1).filter(token=>!/^\/[A-Za-z]+$/.test(token));if(!targets.length)return'dynamic'
  for(const raw of targets){const target=raw.replace(/^['"]|['"]$/g,'').replaceAll('/','\\');if(/%[A-Za-z_][A-Za-z0-9_]*%|![A-Za-z_][A-Za-z0-9_]*!/.test(target))return'dynamic';if(target==='.'||target==='.\\'||target.startsWith('..\\'))return'destructive';if(/^[A-Za-z]:\\?$/.test(target)||/^[A-Za-z]:\\(?:Windows|Users|Program Files|ProgramData)(?:\\|$)/i.test(target))return'destructive';const absolute=/^[A-Za-z]:\\/.test(target)||/^\\\\/.test(target);if(!absolute&&['root','home','system'].includes(fragment.cwdRisk))return'destructive';if(!absolute&&fragment.cwdRisk==='unknown')return'dynamic'}
  return
}
function dynamicDestructiveShape(fragment:ExecutionFragment):boolean{
  if(!fragment.dynamic)return false
  const text=fragment.text
  return /\brm\b|\bgit\s+reset\b|\bRemove-Item\b|(?:^|\s)-[A-Za-z]*[rR][A-Za-z]*f[A-Za-z]*(?:\s|$)|\b(?:push|publish|delete|destroy)\b/i.test(text)
}
function userAction(command:string,reason:string,reasonCode:string):ShellPolicyResult{return{decision:'USER_ACTION_REQUIRED',command,reason,human_decision_type:'operational_action',reason_code:reasonCode}}
export function evaluateShellCommand(command:string):ShellPolicyResult{
  const c=command.trim();if(!c)return{decision:'DENY',command:c,reason:'empty command'}
  if(/^\s*yes\s*\|/i.test(c)||/\|\s*yes\s*$/i.test(c))return{decision:'DENY',command:c,reason:'blanket approval bypass is forbidden'}
  const projection=projectExecutionSurface(c)
  for(const fragment of projection.fragments){
    const text=fragment.text,executable=fragment.dialect==='posix'?executableText(text):text,view=commandView(text)
    if(interactiveAssessment(view,fragment.dialect))return{decision:'USER_ACTION_REQUIRED',command:c,reason:'interactive credential or terminal flow requires real user interaction',human_decision_type:'credential_action',reason_code:'interactive-shell'}
    if(secretSensitiveAssessment(view))return{decision:'USER_ACTION_REQUIRED',command:c,reason:'plaintext secret-sensitive command requires explicit user action and safer credential handling',human_decision_type:'credential_action',reason_code:'secret-sensitive-shell'}
    const rm=rmAssessment(fragment);if(rm==='catastrophic')return userAction(c,'catastrophic recursive filesystem mutation requires explicit user action','destructive-filesystem-action');if(rm==='dynamic')return userAction(c,'recursive filesystem mutation has a dynamically resolved target and requires explicit reconciliation','dynamic-destructive-target')
    const git=gitAssessment(fragment);if(git==='destructive')return userAction(c,'destructive Git worktree/index rewrite requires explicit user action','destructive-git-action');if(git==='dynamic')return userAction(c,'destructive Git operation contains dynamically resolved execution syntax','dynamic-destructive-git')
    const ps=powershellAssessment(fragment);if(ps==='destructive')return userAction(c,'recursive PowerShell filesystem mutation requires explicit user action','destructive-filesystem-action');if(ps==='dynamic')return userAction(c,'PowerShell filesystem mutation has dynamically resolved execution syntax','dynamic-destructive-target')
    const win=windowsCmdAssessment(fragment);if(win==='destructive')return userAction(c,'recursive Windows filesystem mutation requires explicit user action','destructive-filesystem-action');if(win==='dynamic')return userAction(c,'Windows filesystem mutation has a dynamically resolved target and requires explicit reconciliation','dynamic-destructive-target')
    if(fragment.origin==='pipeline-consumer'&&/^rm\s+(?:-[^\s]*[rR][^\s]*|--recursive)(?:\s|$)/i.test(text))return userAction(c,'pipeline-derived recursive delete target is runtime-dependent and requires explicit user action','dynamic-destructive-target')
    if(CATASTROPHIC_FILESYSTEM.some(r=>r.test(executable)))return userAction(c,'catastrophic filesystem mutation requires explicit user action','destructive-filesystem-action')
    if(IRREVERSIBLE_EXTERNAL.some(r=>r.test(executable)))return userAction(c,'irreversible external deletion/destruction requires explicit user action','irreversible-external-action')
    if(dynamicDestructiveShape(fragment))return userAction(c,'dynamically constructed destructive execution cannot be proven bounded','dynamic-execution-uncertain')
  }
  if(/^npm\s+init\b(?!.*\s-y\b)/i.test(c)&&projection.fragments.length===1&&projection.fragments[0].origin==='root')return{decision:'REWRITE',command:c.replace(/\bnpm\s+init\b/i,'npm init -y'),reason:'known safe non-interactive form'}
  return{decision:'ALLOW',command:c,reason:'bounded non-interactive execution projection admitted'}
}
