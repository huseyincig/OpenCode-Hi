import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { durableArtifactBinaryPath, durableArtifactPath, hiProjectRoot } from '../storage/ownership.js'
import { artifactContentHash,isArtifactContract,newArtifactId,type ArtifactContract,type ArtifactPrivacyClass } from '../../contracts/artifact.js'

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
    addBinary(kind:string,summary:string,bytes:Uint8Array,options:{extension:string;mediaType:string;producer?:string;privacyClass?:ArtifactPrivacyClass;consumerRefs?:string[]}):ArtifactContract{
    if(!this.projectRoot)throw new Error('Binary artifact persistence requires a project root')
    if(!bytes.byteLength||bytes.byteLength>10*1024*1024)throw new Error('Binary artifact must be 1 byte..10 MiB')
    if(!/^[A-Za-z0-9]{1,12}$/.test(options.extension))throw new Error('Binary artifact extension is invalid')
    if(!options.mediaType||options.mediaType.length>120)throw new Error('Binary artifact media type is invalid')
    const id=newArtifactId(),path=durableArtifactBinaryPath(this.projectRoot,kind,id,options.extension),sha=createHash('sha256').update(bytes).digest('hex')
    mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes)
    const manifest=JSON.stringify({media_type:options.mediaType,byte_sha256:sha,byte_size:bytes.byteLength,file:`${id}.${options.extension}`})
    const item:ArtifactContract={artifact_id:id,kind,content_ref:'inline-body',content:manifest,content_hash:artifactContentHash(manifest),summary,producer:options.producer??'context-artifact-store',provenance:{source_files:[]},created_at:Date.now(),retention_class:'project',privacy_class:options.privacyClass??'project-private',consumer_refs:[...new Set(options.consumerRefs??[])].slice(0,32),freshness:'FRESH'}
    return this.#put(item)
  }
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
