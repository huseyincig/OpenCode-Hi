import { createHash } from 'node:crypto'
import { existsSync,readFileSync,readdirSync,realpathSync,statSync } from 'node:fs'
import { dirname,join,resolve } from 'node:path'
import { configuredSkillPaths,discoverSkills,indexSkillResources,parseSkillFrontmatter,skillDiscoveryRoots,type SkillCandidate,type SkillProvider,type SkillResource } from './registry.js'

export interface SkillCatalogRecord{
  skill_id:string
  provider:SkillProvider
  skill_path:string
  realpath:string
  mtime_ms:number
  content_sha256:string
  frontmatter:Record<string,string>
  resource_map:SkillResource[]
  valid:boolean
  enabled:boolean
  orchestrationRisk:boolean
}
interface DirFingerprint{path:string;exists:boolean;mtime_ms:number;entries_sha256:string}
interface FileFingerprint{path:string;mtime_ms:number;size:number;sha256:string}
interface CatalogCache{key:string;items:SkillCandidate[];records:SkillCatalogRecord[];dirs:DirFingerprint[];files:FileFingerprint[]}

function hash(content:string):string{return createHash('sha256').update(content).digest('hex')}
function real(path:string):string{try{return realpathSync(path)}catch{return resolve(path)}}
function dirFingerprint(path:string):DirFingerprint{try{const stat=statSync(path);if(!stat.isDirectory())return{path,exists:false,mtime_ms:0,entries_sha256:''};const entries=readdirSync(path,{withFileTypes:true}).map(entry=>`${entry.isDirectory()?'d':entry.isFile()?'f':entry.isSymbolicLink()?'l':'o'}:${entry.name}`).sort().join('\n');return{path,exists:true,mtime_ms:stat.mtimeMs,entries_sha256:hash(entries)}}catch{return{path,exists:false,mtime_ms:0,entries_sha256:''}}}
function fileFingerprint(path:string):FileFingerprint|undefined{try{const stat=statSync(path);if(!stat.isFile())return undefined;const content=readFileSync(path,'utf8');return{path,mtime_ms:stat.mtimeMs,size:stat.size,sha256:hash(content)}}catch{return undefined}}
function sameDir(a:DirFingerprint,b:DirFingerprint):boolean{return a.path===b.path&&a.exists===b.exists&&a.mtime_ms===b.mtime_ms&&a.entries_sha256===b.entries_sha256}
function sameFile(a:FileFingerprint,b:FileFingerprint|undefined):boolean{return Boolean(b&&a.path===b.path&&a.mtime_ms===b.mtime_ms&&a.size===b.size&&a.sha256===b.sha256)}
function cloneResource(r:SkillResource):SkillResource{return{...r}}
function cloneRecord(r:SkillCatalogRecord):SkillCatalogRecord{return{...r,frontmatter:{...r.frontmatter},resource_map:r.resource_map.map(cloneResource)}}

function rootChildDirectories(paths:string[]):string[]{const out=new Set<string>();for(const root of paths){if(!existsSync(root))continue;try{for(const entry of readdirSync(root,{withFileTypes:true}))if(entry.isDirectory())out.add(real(join(root,entry.name)))}catch{}}return[...out]}

function resourceDirectories(skill:SkillCandidate):string[]{
  const base=real(dirname(skill.path)),out=new Set<string>([base])
  for(const kind of ['references','scripts','assets','examples']){
    const root=join(base,kind);if(!existsSync(root))continue
    const walk=(dir:string):void=>{out.add(real(dir));try{for(const entry of readdirSync(dir,{withFileTypes:true}))if(entry.isDirectory())walk(join(dir,entry.name))}catch{}}
    walk(root)
  }
  return[...out].sort()
}

export class SkillCatalogIndex{
  #cache?:CatalogCache
  #fullScans=0
  #fingerprintChecks=0
  constructor(readonly projectRoot:string,readonly hiRoot?:string){}
  #key(hostConfig:Record<string,unknown>):string{return JSON.stringify(configuredSkillPaths(hostConfig))}
  #needsRefresh(hostConfig:Record<string,unknown>):boolean{
    if(!this.#cache||this.#cache.key!==this.#key(hostConfig))return true
    this.#fingerprintChecks++
    for(const expected of this.#cache.dirs)if(!sameDir(expected,dirFingerprint(expected.path)))return true
    for(const expected of this.#cache.files)if(!sameFile(expected,fileFingerprint(expected.path)))return true
    return false
  }
  refresh(hostConfig:Record<string,unknown>):SkillCatalogRecord[]{
    const paths=configuredSkillPaths(hostConfig),key=JSON.stringify(paths),roots=skillDiscoveryRoots(this.projectRoot,this.hiRoot,paths),items=discoverSkills(this.projectRoot,this.hiRoot,paths)
    const records:SkillCatalogRecord[]=items.map(skill=>{const content=(()=>{try{return readFileSync(skill.path,'utf8')}catch{return''}})(),fp=fileFingerprint(skill.path);return{skill_id:skill.name,provider:skill.provider,skill_path:skill.path,realpath:real(skill.path),mtime_ms:fp?.mtime_ms??0,content_sha256:fp?.sha256??hash(content),frontmatter:parseSkillFrontmatter(content),resource_map:indexSkillResources(skill),valid:skill.valid,enabled:skill.enabled,orchestrationRisk:skill.orchestrationRisk}})
    const dirPaths=new Set<string>(roots.map(root=>root.path));for(const dir of rootChildDirectories(roots.map(root=>root.path)))dirPaths.add(dir);for(const skill of items)for(const dir of resourceDirectories(skill))dirPaths.add(dir)
    const dirs=[...dirPaths].sort().map(dirFingerprint),files=records.map(record=>fileFingerprint(record.skill_path)).filter((x):x is FileFingerprint=>Boolean(x))
    this.#cache={key,items,records,dirs,files};this.#fullScans++
    return records.map(cloneRecord)
  }
  records(hostConfig:Record<string,unknown>):SkillCatalogRecord[]{if(this.#needsRefresh(hostConfig))this.refresh(hostConfig);return(this.#cache?.records??[]).map(cloneRecord)}
  candidates(hostConfig:Record<string,unknown>):SkillCandidate[]{if(this.#needsRefresh(hostConfig))this.refresh(hostConfig);return(this.#cache?.items??[]).map(item=>({...item}))}
  diagnostics():{full_scans:number;fingerprint_checks:number;cached_records:number}{return{full_scans:this.#fullScans,fingerprint_checks:this.#fingerprintChecks,cached_records:this.#cache?.records.length??0}}
  invalidate():void{this.#cache=undefined}
  invalidateChanged(files:string[]):boolean{
    const changed=files.some(file=>{const normalized=file.replace(/\\/g,'/').replace(/^\.\//,'');return /(^|\/)(?:\.opencode|\.claude|\.agents)\/skills\//.test(normalized)||/(^|\/)skills\/[^/]+\/(?:SKILL\.md|references\/|scripts\/|assets\/|examples\/)/.test(normalized)||/(^|\/)\.opencode\/hi\/(?:policy|provenance)\/methodologies\//.test(normalized)})
    if(changed)this.invalidate()
    return changed
  }
}
