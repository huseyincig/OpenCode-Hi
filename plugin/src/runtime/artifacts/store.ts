import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { durableArtifactPath } from '../storage/ownership.js'
export interface DurableArtifact{id:string;kind:string;summary:string;content:string;sha256:string;createdAt:number;sourceHash?:string;freshness:'FRESH'|'POTENTIALLY_STALE'}
export class ArtifactStore{
  readonly #items=new Map<string,DurableArtifact>()
  constructor(readonly projectRoot?:string){}
  #persist(item:DurableArtifact):void{if(!this.projectRoot)return;const path=durableArtifactPath(this.projectRoot,item.kind,item.id);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(item,null,2)+'\n','utf8')}
  add(kind:string,summary:string,content:string,sourceHash?:string):DurableArtifact{const sha256=createHash('sha256').update(content).digest('hex'),id=`a_${sha256.slice(0,16)}`,item:DurableArtifact={id,kind,summary,content,sha256,createdAt:Date.now(),sourceHash,freshness:'FRESH'};this.#items.set(id,item);this.#persist(item);return{...item}}
  get(id:string):DurableArtifact|undefined{const a=this.#items.get(id);return a?{...a}:undefined}
  markStaleBySource(sourceHash:string):number{let n=0;for(const a of this.#items.values())if(a.sourceHash===sourceHash&&a.freshness==='FRESH'){a.freshness='POTENTIALLY_STALE';this.#persist(a);n++}return n}
}
