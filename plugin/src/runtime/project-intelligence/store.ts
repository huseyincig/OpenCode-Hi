import { existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync } from 'node:fs'
import { dirname,join } from 'node:path'
import { isProjectIntelligenceContract,projectIntelligenceFiles,type ProjectIntelligenceConsumer,type ProjectIntelligenceContract } from '../../contracts/project-intelligence.js'
import { hiProjectRoot,projectIntelligencePath } from '../storage/ownership.js'
import { retrieveProjectIntelligence,type ProjectIntelligenceRetrievalHit } from './retrieval.js'

function clone(item:ProjectIntelligenceContract):ProjectIntelligenceContract{return{...item,source_refs:item.source_refs.map(x=>({...x})),consumer_domains:[...item.consumer_domains]}}

export class ProjectIntelligenceStore{
  readonly #patterns=new Map<string,ProjectIntelligenceContract>()
  constructor(readonly projectRoot?:string){this.#load()}
  #load():void{
    if(!this.projectRoot)return
    const dir=join(hiProjectRoot(this.projectRoot),'project-intelligence','patterns')
    if(!existsSync(dir))return
    for(const entry of readdirSync(dir,{withFileTypes:true})){
      if(!entry.isFile()||!entry.name.endsWith('.json'))continue
      try{const raw=JSON.parse(readFileSync(join(dir,entry.name),'utf8'));if(isProjectIntelligenceContract(raw)&&entry.name===`${raw.id}.json`)this.#patterns.set(raw.id,clone(raw))}catch{}
    }
  }
  #persist(item:ProjectIntelligenceContract):void{if(!this.projectRoot)return;const path=projectIntelligencePath(this.projectRoot,item.id);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(item,null,2)+'\n','utf8')}
  upsert(item:ProjectIntelligenceContract):void{if(!isProjectIntelligenceContract(item))throw new Error('Invalid ProjectIntelligenceContract');const copy=clone(item);this.#patterns.set(item.id,copy);this.#persist(copy)}
  get(id:string):ProjectIntelligenceContract|undefined{const item=this.#patterns.get(id);return item?clone(item):undefined}
  retrieve(query:string,files:string[],consumer:ProjectIntelligenceConsumer='task-context',limit=6):ProjectIntelligenceRetrievalHit[]{return retrieveProjectIntelligence([...this.#patterns.values()],{query,files,consumer,limit})}
  relevantToFiles(files:string[],consumer:ProjectIntelligenceConsumer='task-context',limit=6):ProjectIntelligenceContract[]{
    const wanted=new Set(files)
    return[...this.#patterns.values()].filter(item=>item.lifecycle==='ACTIVE'&&item.freshness==='FRESH'&&item.consumer_domains.includes(consumer)&&projectIntelligenceFiles(item).some(file=>wanted.has(file))).sort((a,b)=>b.confidence-a.confidence||b.updated_at-a.updated_at).slice(0,limit).map(clone)
  }
  invalidateChanged(changedFiles:string[],currentHashes:Record<string,string>={}):string[]{
    const changed=new Set(changedFiles),invalidated:string[]=[]
    for(const item of this.#patterns.values()){
      const touched=item.source_refs.some(source=>{const file=source.ref.slice(5);return changed.has(file)||(currentHashes[file]!==undefined&&source.hash!==currentHashes[file])})
      if(touched&&item.freshness==='FRESH'){item.freshness='POTENTIALLY_STALE';item.updated_at=Date.now();this.#persist(item);invalidated.push(item.id)}
    }
    return invalidated
  }
  all():ProjectIntelligenceContract[]{return[...this.#patterns.values()].map(clone)}
}
