import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { durableArtifactPath, hiProjectRoot } from '../storage/ownership.js'
import { artifactContentHash,isArtifactContract,newArtifactId,type ArtifactContract,type ArtifactPrivacyClass } from '../../contracts/artifact.js'
import { buildCompressionArtifact,isCompressionArtifact,type CompressionArtifact } from '../../contracts/compression-artifact.js'
import type { ContextReferenceContract } from '../../contracts/context-reference.js'

export type DurableContextArtifact=ArtifactContract

export class ContextArtifactStore{
  readonly #items=new Map<string,ArtifactContract>()
  constructor(readonly projectRoot?:string){this.#load()}
  #load():void{
    if(!this.projectRoot)return
    const root=join(hiProjectRoot(this.projectRoot),'artifacts');if(!existsSync(root))return
    for(const kind of readdirSync(root,{withFileTypes:true})){
      if(!kind.isDirectory())continue
      const dir=join(root,kind.name)
      for(const entry of readdirSync(dir,{withFileTypes:true})){
        if(!entry.isFile()||!entry.name.endsWith('.json'))continue
        try{const raw=JSON.parse(readFileSync(join(dir,entry.name),'utf8'));if(isArtifactContract(raw)&&entry.name===`${raw.artifact_id}.json`)this.#items.set(raw.artifact_id,structuredClone(raw))}catch{}
      }
    }
  }
  #persist(item:ArtifactContract):void{
    if(!this.projectRoot)return
    const path=durableArtifactPath(this.projectRoot,item.kind,item.artifact_id);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(item,null,2)+'\n','utf8')
  }
  #put(item:ArtifactContract):ArtifactContract{this.#items.set(item.artifact_id,item);this.#persist(item);return structuredClone(item)}
  #sourceFilesForCompression(sources:ContextReferenceContract[]):string[]{const files:string[]=[];for(const source of sources){if(source.source_ref.startsWith('file:'))files.push(source.source_ref.slice(5));if(source.source_ref.startsWith('hi-artifact:')){const parent=this.#items.get(source.source_ref.slice('hi-artifact:'.length));if(parent)files.push(...parent.provenance.source_files)}}return[...new Set(files)].slice(0,32)}
  addCompression(sources:ContextReferenceContract[],summary:string,options:{consumerScope:string;modelIdentity:string;policyVersion?:string}):CompressionArtifact{
    const id=newArtifactId(),compression=buildCompressionArtifact(id,sources,summary,{consumerScope:options.consumerScope,modelIdentity:options.modelIdentity,policyVersion:options.policyVersion}),content=JSON.stringify(compression)
    const privacy:ArtifactPrivacyClass=sources.every(s=>s.privacy_class==='redacted')?'redacted':'project-private'
    const item:ArtifactContract={artifact_id:id,kind:'context-compression',content_ref:'inline-body',content,content_hash:artifactContentHash(content),summary:compression.summary,producer:'hi-context-compression',provenance:{source_files:this.#sourceFilesForCompression(sources)},created_at:compression.created_at,retention_class:this.projectRoot?'project':'session',privacy_class:privacy,consumer_refs:[options.consumerScope],freshness:compression.freshness}
    this.#put(item);return structuredClone(compression)
  }
  getCompression(id:string):CompressionArtifact|undefined{const item=this.#items.get(id);if(!item||item.kind!=='context-compression')return undefined;try{const parsed=JSON.parse(item.content);if(!isCompressionArtifact(parsed)||parsed.id!==item.artifact_id||parsed.summary!==item.summary||parsed.created_at!==item.created_at)return undefined;const view={...parsed,freshness:item.freshness};return isCompressionArtifact(view)?structuredClone(view):undefined}catch{return undefined}}
  add(kind:string,summary:string,content:string,sourceFiles:string[]=[],options:{producer?:string;privacyClass?:ArtifactPrivacyClass;consumerRefs?:string[]}={}):ArtifactContract{
    const item:ArtifactContract={
      artifact_id:newArtifactId(),kind,content_ref:'inline-body',content,content_hash:artifactContentHash(content),summary,
      producer:options.producer??'context-artifact-store',provenance:{source_files:[...new Set(sourceFiles)].slice(0,32)},created_at:Date.now(),
      retention_class:this.projectRoot?'project':'session',privacy_class:options.privacyClass??'project-private',consumer_refs:[...new Set(options.consumerRefs??[])].slice(0,32),freshness:'FRESH'
    }
    return this.#put(item)
  }
  get(id:string):ArtifactContract|undefined{const a=this.#items.get(id);return a?structuredClone(a):undefined}
  bindConsumer(id:string,consumerRef:string):ArtifactContract|undefined{const a=this.#items.get(id);if(!a)return undefined;a.consumer_refs=[...new Set([...a.consumer_refs,consumerRef])].slice(0,64);this.#persist(a);return structuredClone(a)}
  invalidateChanged(files:string[]):number{
    const changed=new Set(files);let n=0
    for(const a of this.#items.values())if(a.freshness==='FRESH'&&a.provenance.source_files.some(f=>changed.has(f))){a.freshness='POTENTIALLY_STALE';this.#persist(a);n++}
    return n
  }
}
