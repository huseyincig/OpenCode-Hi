import { createHash } from 'node:crypto'
import { existsSync,readFileSync,statSync } from 'node:fs'
import { relative,resolve,sep } from 'node:path'
import { semanticContextId,type SemanticContextContract,type SemanticContextSymbol } from '../../contracts/semantic-context.js'
import type { SemanticContextAdapter,SemanticContextAdapterInput,SemanticContextResult } from './adapter.js'
const DECL=/(?:^|\n)\s*(?:export\s+)?(?:declare\s+)?(interface|type|class|function|enum)\s+([A-Za-z_$][\w$]*)[^\n{=]*(?:=\s*[^\n;]+;?|\{)?/g

function extractTypeScript(source:string,names:string[]=[],maxChars=5000):SemanticContextResult{
  const wanted=new Set(names),symbols:SemanticContextSymbol[]=[]
  let used=0
  for(const match of source.matchAll(DECL)){
    const kind=match[1] as SemanticContextSymbol['kind'],name=match[2],rawStart=match.index??0,start=source[rawStart]==='\n'?rawStart+1:rawStart
    if(wanted.size&&!wanted.has(name))continue
    let end=source.indexOf('\n',start)
    if(kind==='interface'||kind==='class'||kind==='enum'){
      let depth=0,seen=false
      for(let i=start;i<source.length;i++){
        if(source[i]==='{'){depth++;seen=true}
        else if(source[i]==='}'&&seen){depth--;if(depth===0){end=i+1;break}}
      }
    }
    if(end<0)end=Math.min(source.length,start+600)
    const raw=source.slice(start,end),leading=raw.length-raw.trimStart().length,trimmedStart=start+leading,full=raw.trim();if(!full)continue
    const separator=symbols.length?2:0,remaining=Math.max(0,maxChars-used-separator);if(remaining<=0)break
    const signature=full.slice(0,remaining);if(!signature)break
    const actualEnd=Math.min(end,trimmedStart+signature.length)
    symbols.push({kind,name,signature,start:trimmedStart,end:actualEnd});used+=separator+signature.length
    if(used>=maxChars)break
  }
  const text=symbols.map(s=>s.signature).join('\n\n')
  return{symbols,text,sourceChars:source.length,contextChars:text.length}
}

export class TypeScriptSemanticContextAdapter implements SemanticContextAdapter{
  languageIds():string[]{return['typescript','typescriptreact']}
  supports(file:string):boolean{return/\.tsx?$/i.test(file)}
  extract(input:SemanticContextAdapterInput):SemanticContextResult{return extractTypeScript(input.source,input.names??[],input.maxChars)}
}

export const TYPE_SCRIPT_SEMANTIC_CONTEXT_ADAPTER=new TypeScriptSemanticContextAdapter()
export const SEMANTIC_CONTEXT_ADAPTERS:readonly SemanticContextAdapter[]=[TYPE_SCRIPT_SEMANTIC_CONTEXT_ADAPTER]
export function extractTypeScriptSemanticContext(source:string,names:string[]=[],maxChars=5000):SemanticContextResult{return TYPE_SCRIPT_SEMANTIC_CONTEXT_ADAPTER.extract({source,file:'inline.ts',names,maxChars})}

export function semanticContextsForTargets(projectRoot:string,targets:string[],consumerTaskRef:string,maxChars=3000,adapters:readonly SemanticContextAdapter[]=SEMANTIC_CONTEXT_ADAPTERS):SemanticContextContract[]{
  const root=resolve(projectRoot),out:SemanticContextContract[]=[];let used=0
  for(const target of [...new Set(targets)].slice(0,6)){
    const adapter=adapters.find(candidate=>candidate.supports(target));if(!adapter)continue
    const full=resolve(root,target);if(full!==root&&!full.startsWith(root+sep))continue
    try{
      if(!existsSync(full)||!statSync(full).isFile()||statSync(full).size>524288)continue
      const source=readFileSync(full,'utf8'),left=Math.max(0,maxChars-used);if(left<128)break
      const maxText=Math.min(1400,Math.max(0,left-96)),r=adapter.extract({source,file:target,names:[],maxChars:maxText});if(!r.text)continue
      const languageIds=adapter.languageIds();if(!languageIds.includes('typescript')&&!languageIds.includes('typescriptreact'))continue
      const rel=relative(root,full).replace(/\\/g,'/'),source_ref=`file:${rel}`,source_hash=createHash('sha256').update(source).digest('hex'),selected_ranges=r.symbols.map(s=>({start:s.start,end:s.end}))
      const contract:SemanticContextContract={id:semanticContextId({consumer_task_ref:consumerTaskRef,source_ref,source_hash,selected_ranges}),source_ref,source_hash,language_adapter:'typescript',symbols:r.symbols,relationships:[],selected_ranges,consumer_task_ref:consumerTaskRef,budget:{max_chars:maxText,used_chars:r.text.length},created_at:Date.now(),text:r.text}
      out.push(contract);used+=renderSemanticContext(contract).length
    }catch{}
  }
  return out
}

export function typescriptSemanticContextsForTargets(projectRoot:string,targets:string[],consumerTaskRef:string,maxChars=3000):SemanticContextContract[]{return semanticContextsForTargets(projectRoot,targets,consumerTaskRef,maxChars,[TYPE_SCRIPT_SEMANTIC_CONTEXT_ADAPTER])}

export function renderSemanticContext(contract:SemanticContextContract):string{return`semantic-typescript:${contract.source_ref.slice('file:'.length)}\n${contract.text}`}
