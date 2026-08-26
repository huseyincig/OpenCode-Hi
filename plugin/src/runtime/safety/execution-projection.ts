export type ExecutionDialect='posix'|'powershell'
export type ExecutionOrigin='root'|'command-substitution'|'process-substitution'|'backtick'|'shell-wrapper'|'transparent-wrapper'|'pipeline-consumer'|'embedded-execution'|'powershell-script-block'
export type EffectiveCwdRisk='stable'|'root'|'home'|'system'|'unknown'
export interface ExecutionFragment{
  text:string
  dialect:ExecutionDialect
  origin:ExecutionOrigin
  depth:number
  cwdRisk:EffectiveCwdRisk
  dynamic:boolean
}
export interface ExecutionProjection{
  fragments:ExecutionFragment[]
  uncertain:boolean
  uncertainty:string[]
  workUnits:number
}

const MAX_INPUT_CHARS=131_072
const MAX_DEPTH=8
const MAX_FRAGMENTS=96
const MAX_WORK_UNITS=524_288
const CACHE_MAX=96
const CACHE=new Map<string,ExecutionProjection>()
const CHILD_CAPABLE_HEADS=new Set(['sudo','env','nice','nohup','command','builtin','time','sh','bash','zsh','dash','powershell','powershell.exe','pwsh','pwsh.exe','eval','source','.','find','xargs','parallel','awk','gawk','nawk','mawk','python','python3','node','perl','ruby'])

interface WorkState{units:number;uncertainty:Set<string>;fragments:ExecutionFragment[]}
interface Segment{text:string;cwdRisk:EffectiveCwdRisk}

function pushUncertainty(state:WorkState,reason:string):void{state.uncertainty.add(reason)}
function charge(state:WorkState,n:number):boolean{state.units+=Math.max(0,n);if(state.units<=MAX_WORK_UNITS)return true;pushUncertainty(state,'execution-projection-work-budget-exceeded');return false}
function trimBounded(text:string):string{return text.trim().slice(0,MAX_INPUT_CHARS)}
function detectDialect(source:string):ExecutionDialect{
  const s=source.trim()
  if(/^(?:Remove-Item|Write-Output|Get-Item|Set-Item|New-Item|Copy-Item|Move-Item|Start-Process|Invoke-Expression)\b/i.test(s))return'powershell'
  if(/^&\s*\{/.test(s)||/\b-(?:Recurse|Force|LiteralPath|Path)\b/i.test(s)&&/\bRemove-Item\b/i.test(s))return'powershell'
  return'posix'
}
function tokenDynamic(token:string|undefined):boolean{return Boolean(token&&/(?:\$\(|`|<\(|>\(|\$\{|\$[A-Za-z_0-9@*?])/.test(token))}
function hasActiveDynamicSyntax(source:string):boolean{
  let quote:'"'|"'"|undefined,escape=false
  for(let i=0;i<source.length;i++){
    const ch=source[i],next=source[i+1]
    if(escape){escape=false;continue}
    if(ch==='\\'&&quote!=="'"){escape=true;continue}
    if(quote){if(ch===quote)quote=undefined;if(quote==="'")continue}
    else if(ch==='"'||ch==="'"){quote=ch;continue}
    if(ch==='`'||ch==='$'&&(next==='('||next==='{'||/[A-Za-z_0-9@*?]/.test(next??''))||(ch==='<'||ch==='>')&&next==='(')return true
  }
  return false
}
function shellTokens(source:string):string[]{
  const out:string[]=[];let cur='',quote:'"'|"'"|undefined,escape=false
  const flush=()=>{if(cur){out.push(cur);cur=''}}
  for(let i=0;i<source.length;i++){
    const ch=source[i]
    if(escape){cur+=ch;escape=false;continue}
    if(ch==='\\'&&quote!=="'"){
      const next=source[i+1]
      if(quote==='"'&&!['$','`','"','\\','\n','\r'].includes(next??'')){cur+='\\';continue}
      if(!quote&&/^[A-Za-z]:/.test(cur)){cur+='\\';continue}
      escape=true;continue
    }
    if(quote){if(ch===quote)quote=undefined;else cur+=ch;continue}
    if(ch==='"'||ch==="'"){quote=ch;continue}
    if(/\s/.test(ch)){flush();continue}
    cur+=ch
  }
  flush();return out
}
function stripAssignmentPrefix(tokens:string[]):string[]{let i=0;while(i<tokens.length&&/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i]))i++;return tokens.slice(i)}
function simpleExecutableHead(source:string):string|undefined{const re=/\S+/g;for(let match=re.exec(source);match;match=re.exec(source)){const token=match[0];if(/^[A-Za-z_][A-Za-z0-9_]*=/.test(token))continue;return token.toLowerCase()}return undefined}
function childCapableHead(head:string|undefined):boolean{return Boolean(head&&(CHILD_CAPABLE_HEADS.has(head)||/^python\d+(?:\.\d+)*$/.test(head)))}
function shellCommandSource(tokens:string[],head:string|undefined):string|undefined{
  const shell=(head??'').toLowerCase();if(!['sh','bash','zsh','dash'].includes(shell))return
  const valueOptions=shell==='bash'?new Set(['-O','-o','--init-file','--rcfile']):new Set(['-o'])
  for(let i=1;i<tokens.length;i++){
    const token=tokens[i];if(!token||token==='--'||token==='-'||(!token.startsWith('-')&&!token.startsWith('+')))return
    if(valueOptions.has(token)){i++;continue}
    if(token.startsWith('--'))continue
    if(token[0]==='-'&&token.slice(1).includes('c'))return tokens[i+1]
  }
  return
}
function transparentChild(tokens:string[]):string[]|undefined{
  let i=0
  const wrapper=tokens[i]?.toLowerCase()
  if(wrapper==='sudo'){
    i++;while(i<tokens.length&&tokens[i].startsWith('-')){const opt=tokens[i++];if(['-u','--user','-g','--group','-h','--host','-C','--chdir'].includes(opt)&&i<tokens.length)i++}
    return tokens.slice(i)
  }
  if(wrapper==='env'){
    i++;while(i<tokens.length){const t=tokens[i];if(t==='-i'||t==='--ignore-environment'){i++;continue}if(t==='-u'||t==='--unset'){i+=2;continue}if(t.startsWith('-')){i++;continue}if(/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)){i++;continue}break}return tokens.slice(i)
  }
  if(['nice','nohup','command','builtin','time'].includes(wrapper??'')){
    i++;while(i<tokens.length&&tokens[i].startsWith('-'))i++;return tokens.slice(i)
  }
  return undefined
}
function maskPosixComments(source:string):string{
  const chars=[...source];let quote:'\"'|"'"|undefined,escape=false,inComment=false
  for(let i=0;i<chars.length;i++){
    const ch=chars[i]
    if(inComment){if(ch==='\n'){inComment=false;continue}if(ch!=='\r')chars[i]=' ';continue}
    if(escape){escape=false;continue}
    if(ch==='\\'&&quote!=="'"){escape=true;continue}
    if(quote){if(ch===quote)quote=undefined;continue}
    if(ch==='\"'||ch==="'"){quote=ch;continue}
    if(ch==='#'){const prev=i===0?'\n':chars[i-1];if(i===0||/[\s;&|()]/.test(prev)){chars[i]=' ';inComment=true}}
  }
  return chars.join('')
}
function quotedHeredocMask(source:string,state:WorkState,depth:number,cwdRisk:EffectiveCwdRisk):string{
  if(!source.includes('<<'))return source
  const chars=[...source],lines=source.split(/\n/);let offset=0
  for(let lineIndex=0;lineIndex<lines.length;lineIndex++){
    const line=lines[lineIndex],newlineLen=lineIndex<lines.length-1?1:0
    const matches=[...line.matchAll(/<<(-)?\s*(?:(['"])([^'"\n]+)\2|([A-Za-z_][A-Za-z0-9_]*))/g)]
    if(!matches.length){offset+=line.length+newlineLen;continue}
    const match=matches[0],delimiter=match[3]??match[4],quoted=Boolean(match[2]),stripTabs=Boolean(match[1]);if(!delimiter){offset+=line.length+newlineLen;continue}
    let bodyStart=offset+line.length+newlineLen,searchLine=lineIndex+1,bodyEnd=bodyStart,delimiterEnd=bodyStart,found=false
    while(searchLine<lines.length){const candidate=stripTabs?lines[searchLine].replace(/^\t+/,''):lines[searchLine];const lineStart=bodyEnd;const len=lines[searchLine].length+(searchLine<lines.length-1?1:0);if(candidate.trim()===delimiter){delimiterEnd=lineStart+len;found=true;break}bodyEnd+=len;searchLine++}
    if(!found){pushUncertainty(state,'unterminated-heredoc');break}
    const body=source.slice(bodyStart,bodyEnd);if(!quoted)scanNestedCarriers(body,'posix',depth,cwdRisk,state)
    for(let i=bodyStart;i<delimiterEnd;i++)if(chars[i]!=='\n'&&chars[i]!=='\r')chars[i]=' '
    lineIndex=searchLine;offset=delimiterEnd
  }
  return chars.join('')
}
function findBalanced(source:string,start:number,open:string,close:string):{inner:string;end:number}|undefined{
  let depth=1,quote:'"'|"'"|undefined,escape=false
  for(let i=start;i<source.length;i++){
    const ch=source[i]
    if(escape){escape=false;continue}
    if(ch==='\\'&&quote!=="'"){escape=true;continue}
    if(quote){if(ch===quote)quote=undefined;continue}
    if(ch==='"'||ch==="'"){quote=ch;continue}
    if(ch===open)depth++
    else if(ch===close){depth--;if(depth===0)return{inner:source.slice(start,i),end:i}}
  }
  return undefined
}
function findBacktick(source:string,start:number):{inner:string;end:number}|undefined{let escape=false;for(let i=start;i<source.length;i++){const ch=source[i];if(escape){escape=false;continue}if(ch==='\\'){escape=true;continue}if(ch==='`')return{inner:source.slice(start,i),end:i}}return undefined}
function scanNestedCarriers(source:string,dialect:ExecutionDialect,depth:number,cwdRisk:EffectiveCwdRisk,state:WorkState):void{
  if(dialect==='posix'&&!source.includes('$(')&&!source.includes('`')&&!source.includes('<(')&&!source.includes('>('))return
  if(dialect==='powershell'&&!source.includes('$('))return
  if(depth>=MAX_DEPTH){pushUncertainty(state,'nested-execution-depth-exceeded');return}
  let quote:'"'|"'"|undefined,escape=false
  for(let i=0;i<source.length;i++){
    const ch=source[i],next=source[i+1],next2=source[i+2]
    if(escape){escape=false;continue}
    if(ch==='\\'&&quote!=="'"){escape=true;continue}
    if(quote){
      if(ch===quote){quote=undefined;continue}
      if(quote==="'")continue
    }else if(ch==='"'||ch==="'"){quote=ch;continue}
    if(dialect==='powershell'&&ch==='`'){i++;continue}
    if(ch==='$'&&next==='('){
      if(next2==='('){const arithmetic=findBalanced(source,i+3,'(',')');if(!arithmetic){pushUncertainty(state,'unterminated-arithmetic-expansion');return}scanNestedCarriers(arithmetic.inner,dialect,depth+1,cwdRisk,state);i=arithmetic.end;continue}
      const nested=findBalanced(source,i+2,'(',')');if(!nested){pushUncertainty(state,'unterminated-command-substitution');return}scanProgram(nested.inner,dialect,depth+1,'command-substitution',cwdRisk,state);i=nested.end;continue
    }
    if(dialect==='posix'&&(ch==='<'||ch==='>')&&next==='('){const nested=findBalanced(source,i+2,'(',')');if(!nested){pushUncertainty(state,'unterminated-process-substitution');return}scanProgram(nested.inner,'posix',depth+1,'process-substitution',cwdRisk,state);i=nested.end;continue}
    if(dialect==='posix'&&ch==='`'){const nested=findBacktick(source,i+1);if(!nested){pushUncertainty(state,'unterminated-backtick-substitution');return}scanProgram(nested.inner,'posix',depth+1,'backtick',cwdRisk,state);i=nested.end;continue}
  }
}
function splitSegments(source:string,dialect:ExecutionDialect,initialCwd:EffectiveCwdRisk,state:WorkState):Segment[]{
  if(!/[;&|\n'"]/.test(source)){const text=source.trim();return text?[{text,cwdRisk:initialCwd}]:[]}
  const segments:Segment[]=[];let start=0,quote:'"'|"'"|undefined,escape=false,cwdRisk=initialCwd
  const emit=(end:number)=>{const text=source.slice(start,end).trim();if(text){segments.push({text,cwdRisk});cwdRisk=nextCwdRisk(text,dialect,cwdRisk)}}
  for(let i=0;i<source.length;i++){
    const ch=source[i],next=source[i+1]
    if(escape){escape=false;continue}
    if(dialect==='powershell'&&ch==='`'){escape=true;continue}
    if(ch==='\\'&&dialect==='posix'&&quote!=="'"){escape=true;continue}
    if(quote){if(ch===quote)quote=undefined;continue}
    if(ch==='"'||ch==="'"){quote=ch;continue}
    if(ch==='&'&&next==='&'||ch==='|'&&next==='|'){emit(i);i++;start=i+1;continue}
    if(ch===';'||ch==='|'||ch==='\n'){emit(i);start=i+1;continue}
  }
  emit(source.length)
  if(quote)pushUncertainty(state,`unterminated-${dialect}-quote`)
  return segments
}
function cwdTargetRisk(target:string|undefined,dialect:ExecutionDialect):EffectiveCwdRisk{
  if(!target||tokenDynamic(target)&&!['~','$HOME','${HOME}'].includes(target))return'unknown'
  const normalized=target.replaceAll('\\','/')
  if(['~','$HOME','${HOME}'].includes(target)||normalized.startsWith('~/')||normalized.startsWith('$HOME/')||normalized.startsWith('${HOME}/'))return'home'
  if(dialect==='powershell'){
    if(/^[A-Za-z]:\/?$/.test(normalized))return'root'
    if(/^[A-Za-z]:\/(?:Windows|Users|Program Files|ProgramData)(?:\/|$)/i.test(normalized))return'system'
    if(/^[A-Za-z]:\//.test(normalized))return'stable'
    return'unknown'
  }
  if(normalized==='/')return'root'
  if(/^\/(?:etc|usr|var|boot|root|home|bin|sbin|lib|proc|sys|dev|run|opt)(?:\/|$)/.test(normalized))return'system'
  return normalized.startsWith('/')?'stable':'unknown'
}
function nextCwdRisk(text:string,dialect:ExecutionDialect,current:EffectiveCwdRisk):EffectiveCwdRisk{
  const tokens=stripAssignmentPrefix(shellTokens(text)),head=tokens[0]?.toLowerCase()
  const locationHeads=dialect==='powershell'?['set-location','push-location','cd','chdir','sl','pushd']:['cd','pushd']
  if(!locationHeads.includes(head??''))return current
  return cwdTargetRisk(tokens[1],dialect)
}
function fragmentDynamic(text:string):boolean{
  if(!/[$`]|[<>]\(/.test(text))return false
  const tokens=stripAssignmentPrefix(shellTokens(text));if(!tokens.length)return false
  const executable=tokens.join(' ');if(!hasActiveDynamicSyntax(executable))return false
  const head=tokens[0]
  if(tokenDynamic(head))return true
  if(/^rm\b[^;&|\n]*\s(?:-[^\s]*[rR][^\s]*|--recursive)\b/i.test(executable))return true
  if(/^git\s+reset\b/i.test(executable))return true
  return false
}
function addFragment(text:string,dialect:ExecutionDialect,origin:ExecutionOrigin,depth:number,cwdRisk:EffectiveCwdRisk,state:WorkState):void{
  const bounded=trimBounded(text);if(!bounded)return
  if(state.fragments.length>=MAX_FRAGMENTS){pushUncertainty(state,'execution-fragment-limit-exceeded');return}
  if(!state.fragments.some(x=>x.text===bounded&&x.dialect===dialect&&x.origin===origin&&x.depth===depth&&x.cwdRisk===cwdRisk))state.fragments.push({text:bounded,dialect,origin,depth,cwdRisk,dynamic:fragmentDynamic(bounded)})
}
function xargsChild(tokens:string[]):string[]|undefined{
  let i=1
  const valueOptions=new Set(['-L','-n','-P','-s','-a','-E','-R','-S','-e','-d','-J','--max-args','--max-procs','--max-chars','--arg-file','--eof','--delimiter','--max-lines','--process-slot-var'])
  while(i<tokens.length){const token=tokens[i];if(token==='--'){i++;break}if(!token.startsWith('-')||token==='-')break;if(token==='-I'){i+=2;continue}if(token.startsWith('-I')&&token.length>2){i++;continue}if(token==='--replace'){i++;continue}if(token.startsWith('--replace=')){i++;continue}if(valueOptions.has(token)){i+=2;continue}i++}
  return i<tokens.length?tokens.slice(i):undefined
}
function findStartingTargets(tokens:string[]):string[]{
  const out:string[]=[];let i=1
  while(i<tokens.length&&['-H','-P'].includes(tokens[i]))i++
  if(tokens[i]==='--')i++
  while(i<tokens.length){const token=tokens[i];if(!token||token.startsWith('-')||['!','(',')'].includes(token))break;out.push(token);i++}
  return out.length?out:['.']
}
function deriveFindChildren(tokens:string[],depth:number,cwdRisk:EffectiveCwdRisk,state:WorkState):void{
  const targets=findStartingTargets(tokens)
  if(tokens.includes('-delete'))for(const target of targets.slice(0,8))addFragment(`rm -rf ${target}`,'posix','embedded-execution',depth+1,cwdRisk,state)
  for(let i=1;i<tokens.length;i++){
    const primary=tokens[i];if(!['-exec','-execdir','-ok','-okdir'].includes(primary))continue
    let end=i+1;while(end<tokens.length&&![';','+'].includes(tokens[end]))end++
    const childTokens=tokens.slice(i+1,end);if(childTokens.length){const childCwd=['-execdir','-okdir'].includes(primary)?'unknown':cwdRisk;for(const target of targets.slice(0,8)){const child=childTokens.map(token=>token.includes('{}')?token.replaceAll('{}',target):token).join(' ');scanProgram(child,'posix',depth+1,'embedded-execution',childCwd,state)}}
    i=end
  }
}
function inlineInterpreterSource(tokens:string[],head:string|undefined):string|undefined{
  const normalized=(head??'').replace(/^.*[\\/]/,'').toLowerCase(),python=/^python(?:\d+(?:\.\d+)*)?$/.test(normalized)
  const flags=python?new Set(['-c']):normalized==='node'?new Set(['-e','--eval','-p','--print']):normalized==='perl'?new Set(['-e','-E']):normalized==='ruby'?new Set(['-e']):undefined
  if(!flags)return
  for(let i=1;i<tokens.length;i++){const token=tokens[i];if(flags.has(token))return tokens[i+1];if(normalized==='node'&&token.startsWith('--eval='))return token.slice('--eval='.length);if((python||normalized==='perl'||normalized==='ruby')&&token.length>2&&flags.has(token.slice(0,2)))return token.slice(2)}
  return
}
function literalExecutionSink(code:string,head:string|undefined):string|undefined{
  const normalized=(head??'').replace(/^.*[\\/]/,'').toLowerCase()
  const pattern=/^python/.test(normalized)?/\b(?:os\.system|subprocess\.(?:run|call|Popen|check_call|check_output))\s*\(\s*(["'])(.*?)\1/s:normalized==='node'?/\b(?:execSync|exec|spawnSync|spawn)\s*\(\s*(["'])(.*?)\1/s:/\b(?:system|exec)\s*\(\s*(["'])(.*?)\1/s
  return pattern.exec(code)?.[2]
}
function deriveInterpreterChildren(tokens:string[],head:string|undefined,depth:number,cwdRisk:EffectiveCwdRisk,state:WorkState):void{
  const code=inlineInterpreterSource(tokens,head);if(code===undefined)return
  const child=literalExecutionSink(code,head);if(child!==undefined){scanProgram(child,'posix',depth+1,'embedded-execution',cwdRisk,state);return}
  const sink=/\b(?:system|exec|execSync|spawn|spawnSync|popen|subprocess|child_process|eval)\b/i.test(code),danger=/\brm\b|\bgit\b|\bRemove-Item\b|\b(?:delete|destroy|mkfs|dd)\b/i.test(code)
  if(sink&&danger)pushUncertainty(state,'dynamic-interpreter-execution-source')
}
function parallelJobs(tokens:string[]):string[]{
  let marker=tokens.indexOf(':::');if(marker<0)return[]
  let start=1;while(start<marker&&tokens[start].startsWith('-')){const option=tokens[start++];if(['-j','--jobs','--timeout','--delay','--wd','--workdir'].includes(option)&&start<marker)start++}
  const template=tokens.slice(start,marker);if(!template.length)return[]
  const groups:string[][]=[];let group:string[]=[];for(let i=marker+1;i<tokens.length;i++){if(tokens[i]===':::'){groups.push(group);group=[]}else group.push(tokens[i])}groups.push(group)
  if(groups.some(x=>!x.length))return[]
  let jobs:string[][]=[[]];for(const groupValues of groups){const next:string[][]=[];for(const job of jobs)for(const value of groupValues){next.push([...job,value]);if(next.length>=16)break}jobs=next;if(jobs.length>=16)break}
  const hasPlaceholder=template.some(token=>/\{(?:-?\d+)?\}/.test(token))
  return jobs.slice(0,16).map(job=>{if(!hasPlaceholder)return[...template,...job].join(' ');return template.map(token=>token.replace(/\{(-?\d*)\}/g,(_m,index)=>{if(index==='')return job[0]??'';const n=Number(index);return n>0?job[n-1]??'':job[job.length+n]??''})).join(' ')})
}
function deriveParallelChildren(tokens:string[],depth:number,cwdRisk:EffectiveCwdRisk,state:WorkState):void{
  const jobs=parallelJobs(tokens);if(!jobs.length){pushUncertainty(state,'parallel-child-execution-unresolved');return}for(const child of jobs)scanProgram(child,'posix',depth+1,'embedded-execution',cwdRisk,state)
}
function decodePowerShellEncoded(value:string,state:WorkState):string|undefined{
  if(value.length>MAX_INPUT_CHARS*2||value.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(value)){pushUncertainty(state,'powershell-encoded-command-invalid');return}
  const bytes=Buffer.from(value,'base64');if(!bytes.length||bytes.length%2!==0){pushUncertainty(state,'powershell-encoded-command-invalid');return}
  const decoded=bytes.toString('utf16le').replace(/\u0000+$/g,'').trim();if(!decoded){pushUncertainty(state,'powershell-encoded-command-empty');return}return decoded
}
function deriveChildren(text:string,dialect:ExecutionDialect,depth:number,cwdRisk:EffectiveCwdRisk,state:WorkState):void{
  if(depth>=MAX_DEPTH){pushUncertainty(state,'nested-execution-depth-exceeded');return}
  const tokens=stripAssignmentPrefix(shellTokens(text));if(!tokens.length)return
  const transparent=transparentChild(tokens)
  if(transparent?.length){const child=transparent.join(' ');addFragment(child,dialect,'transparent-wrapper',depth+1,cwdRisk,state);deriveChildren(child,dialect,depth+1,cwdRisk,state)}
  const head=(transparent?.[0]??tokens[0])?.toLowerCase(),args=transparent??tokens
  if(['sh','bash','zsh','dash'].includes(head??'')){
    const child=shellCommandSource(args,head);if(child)scanProgram(child,'posix',depth+1,'shell-wrapper',cwdRisk,state)
  }
  if(['powershell','powershell.exe','pwsh','pwsh.exe'].includes(head??'')){
    const encoded=args.findIndex((x,index)=>index>0&&['-encodedcommand','-enc','-e'].includes(x.toLowerCase()))
    if(encoded>=0){if(encoded+2!==args.length)pushUncertainty(state,'powershell-encoded-command-shape');else{const decoded=decodePowerShellEncoded(args[encoded+1],state);if(decoded)scanProgram(decoded,'powershell',depth+1,'shell-wrapper',cwdRisk,state)}}
    else{const i=args.findIndex((x,index)=>index>0&&['-command','-c'].includes(x.toLowerCase()));if(i>=0&&args[i+1])scanProgram(args.slice(i+1).join(' '),'powershell',depth+1,'shell-wrapper',cwdRisk,state)}
  }
  if(['cmd','cmd.exe'].includes(head??'')){
    const i=args.findIndex((x,index)=>index>0&&['/c','/k'].includes(x.toLowerCase()));if(i>=0&&args[i+1])scanProgram(args.slice(i+1).join(' '),'powershell',depth+1,'shell-wrapper',cwdRisk,state)
  }
  if(['eval','source','.'].includes(head??'')){
    const source=args.slice(1).filter(x=>x!=='--').join(' ')
    if(source){if(hasActiveDynamicSyntax(source))pushUncertainty(state,'dynamic-shell-execution-source');else scanProgram(source,'posix',depth+1,'embedded-execution',cwdRisk,state)}
  }
  if(head==='find')deriveFindChildren(args,depth,cwdRisk,state)
  if(head==='xargs'){
    const childTokens=xargsChild(args);if(childTokens?.length){const child=childTokens.join(' ');addFragment(child,dialect,'pipeline-consumer',depth+1,cwdRisk,state);const childHead=childTokens[0]?.toLowerCase(),ci=childTokens.findIndex((x,index)=>index>0&&x==='-c');if(['sh','bash','zsh','dash'].includes(childHead??'')&&ci>=0&&childTokens[ci+1])scanProgram(childTokens[ci+1],'posix',depth+2,'shell-wrapper',cwdRisk,state);else deriveChildren(child,dialect,depth+1,cwdRisk,state)}
  }
  if(head==='parallel')deriveParallelChildren(args,depth,cwdRisk,state)
  if(['awk','gawk','nawk','mawk'].includes(head??''))for(const match of text.matchAll(/\bsystem\s*\(\s*(["'])(.*?)\1\s*\)/g)){const child=match[2];if(child)scanProgram(child,'posix',depth+1,'embedded-execution',cwdRisk,state)}
  deriveInterpreterChildren(args,head,depth,cwdRisk,state)
  if(dialect==='powershell')for(const match of text.matchAll(/&\s*\{([^{}]*)\}/g)){const child=match[1];if(child)scanProgram(child,'powershell',depth+1,'powershell-script-block',cwdRisk,state)}
}
function scanProgram(source:string,dialect:ExecutionDialect,depth:number,origin:ExecutionOrigin,cwdRisk:EffectiveCwdRisk,state:WorkState):void{
  const bounded=source.slice(0,MAX_INPUT_CHARS);if(source.length>MAX_INPUT_CHARS)pushUncertainty(state,'execution-input-truncated');if(!charge(state,bounded.length))return
  if(depth>MAX_DEPTH){pushUncertainty(state,'nested-execution-depth-exceeded');return}
  if(dialect==='posix'&&!/[;&|\n'"\\$`<>]/.test(bounded)){
    const text=bounded.trim();if(!text)return
    if(state.fragments.length>=MAX_FRAGMENTS){pushUncertainty(state,'execution-fragment-limit-exceeded');return}
    if(!state.fragments.some(x=>x.text===text&&x.dialect==='posix'&&x.origin===origin&&x.depth===depth&&x.cwdRisk===cwdRisk))state.fragments.push({text,dialect:'posix',origin,depth,cwdRisk,dynamic:false})
    if(childCapableHead(simpleExecutableHead(text)))deriveChildren(text,'posix',depth,cwdRisk,state)
    return
  }
  const heredocMasked=dialect==='posix'?quotedHeredocMask(bounded,state,depth,cwdRisk):bounded
  const masked=dialect==='posix'?maskPosixComments(heredocMasked):heredocMasked
  scanNestedCarriers(masked,dialect,depth,cwdRisk,state)
  for(const segment of splitSegments(masked,dialect,cwdRisk,state)){addFragment(segment.text,dialect,origin,depth,segment.cwdRisk,state);deriveChildren(segment.text,dialect,depth,segment.cwdRisk,state)}
}
function cloneProjection(value:ExecutionProjection):ExecutionProjection{return{fragments:value.fragments.map(x=>({...x})),uncertain:value.uncertain,uncertainty:[...value.uncertainty],workUnits:value.workUnits}}
export function projectExecutionSurface(command:string,dialect:'auto'|ExecutionDialect='auto'):ExecutionProjection{
  const key=`${dialect}\u0000${command}`;const cached=CACHE.get(key);if(cached)return cloneProjection(cached)
  const state:WorkState={units:0,uncertainty:new Set(),fragments:[]},source=String(command??'');if(source.length>MAX_INPUT_CHARS)pushUncertainty(state,'execution-input-truncated')
  scanProgram(source,dialect==='auto'?detectDialect(source):dialect,0,'root','stable',state)
  const value:ExecutionProjection={fragments:state.fragments,uncertain:state.uncertainty.size>0,uncertainty:[...state.uncertainty],workUnits:state.units}
  CACHE.set(key,value);if(CACHE.size>CACHE_MAX)CACHE.delete(CACHE.keys().next().value as string)
  return cloneProjection(value)
}
