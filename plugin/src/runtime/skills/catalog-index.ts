import { configuredSkillPaths,discoverSkills,type SkillCandidate } from './registry.js'

export class SkillCatalogIndex{
  #cache?:{key:string;items:SkillCandidate[]}
  constructor(readonly projectRoot:string,readonly hiRoot?:string){}
  candidates(hostConfig:Record<string,unknown>):SkillCandidate[]{
    const paths=configuredSkillPaths(hostConfig),key=JSON.stringify(paths)
    if(!this.#cache||this.#cache.key!==key)this.#cache={key,items:discoverSkills(this.projectRoot,this.hiRoot,paths)}
    return this.#cache.items.map(item=>({...item}))
  }
  invalidate():void{this.#cache=undefined}
  invalidateChanged(files:string[]):boolean{
    const changed=files.some(file=>{const normalized=file.replace(/\\/g,'/').replace(/^\.\//,'');return /(^|\/)(?:\.opencode|\.claude|\.agents)\/skills\//.test(normalized)||/(^|\/)skills\/[^/]+\/SKILL\.md$/.test(normalized)})
    if(changed)this.invalidate()
    return changed
  }
}
