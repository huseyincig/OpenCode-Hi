import type { MissionState } from '../mission/types.js'
import { appendLedger } from '../ledger/ledger.js'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { classifyExternalCommand, commandTokens, gitCommandParts, ghCommandParts, npmLikeCommandParts } from './command-classifier.js'

function norm(command:string):string{return command.trim().replace(/\s+/g,' ')}
function trimQuotes(s:string):string{return s.replace(/^['"]|['"]$/g,'')}
function tokens(command:string):string[]{return commandTokens(command).map(trimQuotes)}
function hex40(s:string):boolean{return /^[0-9a-f]{40}$/i.test(s)}

function releaseVersion(tag:string|undefined):string|undefined{if(!tag)return undefined;const v=tag.replace(/^v/i,'');return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(v)?v:undefined}
function jsonVersion(path:string):string|undefined{try{const j=JSON.parse(readFileSync(path,'utf8'));return typeof j?.version==='string'?j.version.trim():undefined}catch{return undefined}}
function sha256File(path:string):string|undefined{try{return createHash('sha256').update(readFileSync(path)).digest('hex')}catch{return undefined}}
function digestManifestInputs(root:string,files:Record<string,string>):string|undefined{try{const h=createHash('sha256'),base=resolve(root);for(const rel0 of Object.keys(files).sort()){const rel=rel0.replace(/\\/g,'/').replace(/^\.\//,'');let full=resolve(base,rel);if(!existsSync(full)&&/^SBOM-[^/]+\.json$/.test(rel))full=resolve(base,'dist',rel);if(full!==base&&!full.startsWith(base+'/')&&!full.startsWith(base+'\\'))return undefined;const actual=sha256File(full);if(!actual||actual!==files[rel0])return undefined;h.update(rel+'\0');h.update(actual+'\0')}return h.digest('hex')}catch{return undefined}}
function packageJson(root:string):any|undefined{try{return JSON.parse(readFileSync(join(root,'package.json'),'utf8'))}catch{return undefined}}
function packageStateHash(root:string,files:string[]):string|undefined{try{const base=resolve(root),h=createHash('sha256');for(const rel0 of [...new Set(files.map(String))].sort()){const rel=rel0.replace(/\\/g,'/').replace(/^\.\//,'');const full=resolve(base,rel);if(full!==base&&!full.startsWith(base+'/')&&!full.startsWith(base+'\\'))return undefined;h.update(rel+'\0');if(!existsSync(full))h.update('MISSING');else h.update(readFileSync(full));h.update('\0')}return h.digest('hex')}catch{return undefined}}
function packageLockVersion(root:string):string|undefined{for(const path of [join(root,'package-lock.json'),join(root,'plugin','package-lock.json')]){if(!existsSync(path))continue;try{const j=JSON.parse(readFileSync(path,'utf8'));const rootVersion=j?.packages?.['']?.version;return typeof rootVersion==='string'?rootVersion:typeof j?.version==='string'?j.version:undefined}catch{return undefined}}return undefined}
function dependencyGraph(root:string):{digest:string;count:number;direct:Array<{name:string;license:string}>;locks:string[]}|undefined{try{
  const lockPaths=['package-lock.json','plugin/package-lock.json'].filter(rel=>existsSync(join(root,...rel.split('/'))));if(!lockPaths.length)return undefined
  const multi=lockPaths.length>1,rows:Array<{path:string;name:string;version:string;license:string;relation:string}>=[]
  for(const rel of lockPaths){const lock=JSON.parse(readFileSync(join(root,...rel.split('/')),'utf8')),packages=lock?.packages??{},rm=packages['']??{},runtime=new Set(Object.keys(rm.dependencies??{})),optional=new Set(Object.keys(rm.optionalDependencies??{})),dev=new Set(Object.keys(rm.devDependencies??{})),peer=new Set(Object.keys(rm.peerDependencies??{})),prefix=rel==='package-lock.json'?'root':'plugin';for(const [path0,meta0] of Object.entries(packages)){if(!path0)continue;const meta:any=meta0??{},basePath=String(path0).replace(/\\/g,'/'),name=String(meta.name??(basePath.includes('node_modules/')?basePath.split('node_modules/').pop():basePath)??basePath),relation=runtime.has(name)?'direct-runtime':optional.has(name)?'direct-optional':peer.has(name)?'direct-peer':dev.has(name)?'direct-dev':'transitive',path=multi?`${prefix}:${basePath}`:basePath;rows.push({path,name,version:String(meta.version??''),license:String(meta.license??'UNKNOWN'),relation})}}
  rows.sort((a,b)=>a.path.localeCompare(b.path));const h=createHash('sha256');for(const r of rows){for(const k of ['path','name','version','license','relation'] as const){h.update(r[k]);h.update('\0')}h.update('\n')}return{digest:h.digest('hex'),count:rows.length,direct:rows.filter(r=>r.relation!=='transitive').map(r=>({name:r.name,license:r.license})),locks:lockPaths}
}catch{return undefined}}
function validateSupplyChain(root:string,manifest:any):string[]{const issues:string[]=[],sc=manifest?.supply_chain,g=dependencyGraph(root);if(manifest?.schema<5||![1,2].includes(sc?.schema)||typeof sc?.dependency_graph_sha256!=='string'||typeof sc?.sbom!=='string'||typeof sc?.third_party_notices_sha256!=='string')return['release-supply-chain-missing'];const declaredLocks=Array.isArray(sc?.dependency_locks)?sc.dependency_locks:typeof sc?.dependency_lock==='string'?[sc.dependency_lock]:[];if(!g||g.digest!==sc.dependency_graph_sha256||g.count!==sc.component_count)issues.push('dependency-graph-drift');if(g&&JSON.stringify(declaredLocks)!==JSON.stringify(g.locks))issues.push('dependency-lock-set-drift');if(sc?.schema===2){const hashes=sc?.dependency_lock_sha256&&typeof sc.dependency_lock_sha256==='object'?sc.dependency_lock_sha256:{};for(const rel of declaredLocks){const actual=sha256File(join(root,String(rel)));if(!actual||hashes[String(rel)]!==actual)issues.push('dependency-lock-sha256-drift:'+String(rel))}}const sbomPath=join(root,'dist',sc.sbom);try{const sb=JSON.parse(readFileSync(sbomPath,'utf8'));const sbLocks=Array.isArray(sb?.dependency_locks)?sb.dependency_locks:typeof sb?.dependency_lock==='string'?[sb.dependency_lock]:[];let sbomOk=sb?.dependency_graph_sha256===g?.digest&&sb?.component_count===g?.count&&JSON.stringify(sbLocks)===JSON.stringify(g?.locks??[])&&sha256File(sbomPath)===sc.sbom_sha256;if(sc?.schema===2)sbomOk=sbomOk&&sb?.schema===2&&JSON.stringify(sb?.dependency_lock_sha256??{})===JSON.stringify(sc?.dependency_lock_sha256??{});if(!sbomOk)issues.push('sbom-drift')}catch{issues.push('sbom-missing-or-invalid')}const notices=join(root,'THIRD_PARTY_NOTICES.md'),text=existsSync(notices)?readFileSync(notices,'utf8'):'';if(sha256File(notices)!==sc.third_party_notices_sha256)issues.push('third-party-notices-drift');for(const d of g?.direct??[]){if(!text.includes('`'+d.name+'`')||(d.license!=='UNKNOWN'&&!text.includes(d.license)))issues.push('third-party-notices-incomplete:'+d.name)}return issues}

function changelogHasVersion(path:string,version:string):boolean{try{return new RegExp(`^##\\s+(?:\\[)?v?${version.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}(?:\\])?(?:\\s|$)`,'mi').test(readFileSync(path,'utf8'))}catch{return false}}
function releaseAssets(command:string,root:string):string[]{const t=tokens(command);if(t[0]!=='gh'||t[1]!=='release'||t[2]!=='create')return[];const valueFlags=new Set(['--target','--title','--notes','--notes-file','--repo','-R','--discussion-category']);let tagSeen=false;const out:string[]=[];for(let i=3;i<t.length;i++){const x=t[i];if(valueFlags.has(x)){i++;continue}if(x.startsWith('--')||x.startsWith('-'))continue;if(!tagSeen){tagSeen=true;continue}const path=/^(?:[A-Za-z]:[\\/]|\/)/.test(x)?x:resolve(root,x);if(existsSync(path))out.push(path)}return out}
function inspectReleaseQuality(root:string,command:string):{ok:boolean;version?:string;issues:string[];assets:Array<{path:string;sha256?:string;manifest_match?:boolean}>}{
  const tag=parseReleaseTag(command),version=releaseVersion(tag),issues:string[]=[],assets:Array<{path:string;sha256?:string;manifest_match?:boolean}>=[]
  if(!version){issues.push('release-tag-version-unparseable');return{ok:false,issues,assets}}
  const vf=join(root,'VERSION'),pkg=join(root,'package.json'),ppkg=join(root,'plugin','package.json'),cl=join(root,'CHANGELOG.md')
  if(existsSync(vf)&&readFileSync(vf,'utf8').trim()!==version)issues.push('VERSION-mismatch')
  const pv=jsonVersion(pkg);if(pv&&pv!==version)issues.push('package-version-mismatch')
  const ppv=jsonVersion(ppkg);if(ppv&&ppv!==version)issues.push('plugin-package-version-mismatch')
  if(existsSync(cl)&&!changelogHasVersion(cl,version))issues.push('CHANGELOG-version-missing')
  let manifest:any;const mp=join(root,'dist',`RELEASE-MANIFEST-${version}.json`);if(existsSync(mp))try{manifest=JSON.parse(readFileSync(mp,'utf8'))}catch{issues.push('release-manifest-invalid')}
  if(manifest){const prov=manifest?.provenance,files=manifest?.files;if(manifest?.schema<5||prov?.schema!==1||prov?.builder!=='scripts/release-build.py'||prov?.deterministic_zip!==true||typeof prov?.inputs_sha256!=='string'||!files||typeof files!=='object')issues.push('release-provenance-missing');else{const current=digestManifestInputs(root,files);if(!current||current!==prov.inputs_sha256)issues.push('release-provenance-source-drift')}issues.push(...validateSupplyChain(root,manifest))}
  for(const path of releaseAssets(command,root)){const digest=sha256File(path),a={path,sha256:digest,manifest_match:undefined as boolean|undefined};if(manifest&&basename(path)===manifest.archive){a.manifest_match=typeof manifest.archive_sha256==='string'&&digest===manifest.archive_sha256;if(!a.manifest_match)issues.push(`asset-sha256-mismatch:${basename(path)}`)}assets.push(a)}
  return{ok:issues.length===0,version,issues,assets}
}

export function isGitPush(command:string):boolean{return classifyExternalCommand(command).kind==='git-push'}
export function isReleaseCreate(command:string):boolean{return classifyExternalCommand(command).kind==='gh-release-create'}
export function isPackagePublish(command:string):boolean{return classifyExternalCommand(command).kind==='package-publish'}
export function missionRequiresPackagePublish(m:MissionState):boolean{return m.identity.intent.requestedExternalActions.includes('package-publish')}
export function missionRequiresReleaseCreate(m:MissionState):boolean{return m.identity.intent.requestedExternalActions.includes('release-create')}
export function isLocalReleaseMutation(command:string):boolean{return ['commit','merge','rebase','cherry-pick'].includes(gitCommandParts(command).sub??'')}

function parsePushExpectation(command:string):{remote:string;ref:string}|undefined{
  const p=gitCommandParts(command);if(p.sub!=='push')return undefined
  const args=p.rest.filter(x=>!x.startsWith('-')),remote=args[0]??'origin',spec=args[1]
  if(!spec||spec==='--tags'||spec==='tag')return undefined
  const rhs=(spec.includes(':')?spec.split(':').pop():spec)??''
  if(!rhs||rhs.startsWith('refs/tags/')||/^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(rhs))return undefined
  const ref=rhs.startsWith('refs/')?rhs:`refs/heads/${rhs.replace(/^HEAD$/,'')}`;if(ref.endsWith('/'))return undefined
  return{remote,ref}
}
function parseTagPushExpectation(command:string):{remote:string;tag:string}|undefined{
  const p=gitCommandParts(command);if(p.sub!=='push')return undefined
  const args=p.rest.filter(x=>!x.startsWith('-')),remote=args[0]??'origin'
  if(args[1]==='tag'&&args[2])return{remote,tag:args[2].replace(/^refs\/tags\//,'')}
  const spec=args[1];if(!spec)return undefined
  const rhs=(spec.includes(':')?spec.split(':').pop():spec)??''
  if(rhs.startsWith('refs/tags/'))return{remote,tag:rhs.replace(/^refs\/tags\//,'')}
  if(/^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(rhs))return{remote,tag:rhs}
  return undefined
}
function ghReleasePositional(command:string,verb:'create'|'view'):string|undefined{const p=ghCommandParts(command);if(p.sub!=='release'||p.rest[0]!==verb)return undefined;const t=p.rest.slice(1),valueFlags=new Set(['--target','--title','--notes','--notes-file','--repo','-R','--discussion-category','--json','--jq','--template']);for(let i=0;i<t.length;i++){const x=t[i];if(valueFlags.has(x)){i++;continue}if(x.startsWith('--')||x==='--latest'||x==='--web')continue;if(x.startsWith('-'))continue;return x}return undefined}
function parseReleaseTag(command:string):string|undefined{return ghReleasePositional(command,'create')}
function parseReleaseTarget(command:string):string|undefined{const t=tokens(command);for(let i=0;i<t.length;i++){if(t[i]==='--target'&&t[i+1])return t[i+1];if(t[i].startsWith('--target='))return t[i].slice('--target='.length)}return undefined}
function parseLsRemote(command:string,output:any):{remote?:string;ref?:string;hash?:string}|undefined{
  const p=gitCommandParts(command);if(p.sub!=='ls-remote')return undefined
  const args=p.rest.filter(x=>!x.startsWith('-'));const remote=args[0],requested=args[1]
  const text=typeof output?.stdout==='string'?output.stdout:typeof output?.output==='string'?output.output:''
  for(const line of text.split(/\r?\n/)){const m=line.trim().match(/^([0-9a-f]{40})\s+(.+)$/i);if(m)return{remote,ref:m[2],hash:m[1]}}
  return{remote,ref:requested}
}
function parseHead(command:string,output:any):string|undefined{const p=gitCommandParts(command);if(p.sub!=='rev-parse'||p.rest.join(' ')!=='HEAD')return undefined;const text=typeof output?.stdout==='string'?output.stdout:typeof output?.output==='string'?output.output:'';const h=text.trim().split(/\s+/)[0];return hex40(h)?h:undefined}
function parseUpstream(command:string,output:any):{remote:string;ref:string}|undefined{
  const p=gitCommandParts(command);if(p.sub!=='rev-parse'||p.rest.join(' ')!=='--abbrev-ref --symbolic-full-name @{u}')return undefined
  const text=typeof output?.stdout==='string'?output.stdout:typeof output?.output==='string'?output.output:'';const v=text.trim().split(/\s+/)[0];const i=v.indexOf('/');if(i<=0||i===v.length-1)return undefined;return{remote:v.slice(0,i),ref:`refs/heads/${v.slice(i+1)}`}
}
function parseRemoteTagProbe(command:string,output:any):{remote?:string;tag?:string;direct_hash?:string;peeled_hash?:string}|undefined{
  const p=gitCommandParts(command);if(p.sub!=='ls-remote')return undefined
  const args=p.rest.filter(x=>!x.startsWith('-'));const remote=args[0];const refs=args.slice(1);const requested=refs.find(x=>/^refs\/tags\//.test(x));if(!requested)return undefined
  const base=requested.replace(/\^\{\}$/,'');const tag=base.replace(/^refs\/tags\//,'');if(!tag)return undefined
  const text=typeof output?.stdout==='string'?output.stdout:typeof output?.output==='string'?output.output:'';let direct_hash:string|undefined,peeled_hash:string|undefined
  for(const line of text.split(/\r?\n/)){const m=line.trim().match(/^([0-9a-f]{40})\s+(.+)$/i);if(!m)continue;if(m[2]===base)direct_hash=m[1];else if(m[2]===`${base}^{}`)peeled_hash=m[1]}
  return{remote,tag,direct_hash,peeled_hash}
}
function parseReleaseView(command:string,output:any):{tag?:string;target?:string;assets?:Array<{name:string;size?:number}>}|undefined{
  const tag=ghReleasePositional(command,'view');if(!tag)return undefined
  const text=typeof output?.stdout==='string'?output.stdout:typeof output?.output==='string'?output.output:''
  try{const j=JSON.parse(text);return{tag:typeof j?.tagName==='string'?j.tagName:tag,target:typeof j?.targetCommitish==='string'?j.targetCommitish:undefined,assets:Array.isArray(j?.assets)?j.assets.map((a:any)=>({name:String(a?.name??a?.label??''),size:typeof a?.size==='number'?a.size:undefined})).filter((a:any)=>a.name):undefined}}catch{return undefined}
}
function parsePackDryRun(command:string,output:any,root?:string):{name?:string;version?:string;integrity?:string;shasum?:string;filename?:string;files:string[];state_hash?:string}|undefined{const p=npmLikeCommandParts(command),all=p.invocation?.args??[];if(!['npm','pnpm'].includes(p.exe??'')||p.sub!=='pack'||!all.some(x=>x==='--dry-run'||x.startsWith('--dry-run='))||!all.some(x=>x==='--json'||x.startsWith('--json=')))return undefined;const text=typeof output?.stdout==='string'?output.stdout:typeof output?.output==='string'?output.output:'';try{const j=JSON.parse(text),x=Array.isArray(j)?j[0]:j;if(!x||typeof x!=='object')return undefined;const files=Array.isArray(x.files)?x.files.map((f:any)=>typeof f==='string'?f:f?.path).filter((v:any)=>typeof v==='string'):[];return{name:typeof x.name==='string'?x.name:typeof x.id==='string'?String(x.id).replace(/@[^@]+$/,''):undefined,version:typeof x.version==='string'?x.version:undefined,integrity:typeof x.integrity==='string'?x.integrity:undefined,shasum:typeof x.shasum==='string'?x.shasum:undefined,filename:typeof x.filename==='string'?x.filename:undefined,files,state_hash:root&&files.length?packageStateHash(root,files):undefined}}catch{return undefined}}
function parseRegistryView(command:string,output:any):{name?:string;version?:string;integrity?:string;shasum?:string}|undefined{const p=npmLikeCommandParts(command);if(!['npm','pnpm'].includes(p.exe??'')||p.sub!=='view')return undefined;const spec=p.rest[0];if(!spec)return undefined;const text=typeof output?.stdout==='string'?output.stdout:typeof output?.output==='string'?output.output:'';try{const j=JSON.parse(text);const dist=j?.dist??{};let name=typeof j?.name==='string'?j.name:undefined,version=typeof j?.version==='string'?j.version:undefined;if(!name||!version){const m=spec.match(/^(@[^/]+\/[^@]+|[^@]+)@(.+)$/);if(m){name??=m[1];version??=m[2]}}return{name,version,integrity:typeof dist?.integrity==='string'?dist.integrity:typeof j?.['dist.integrity']==='string'?j['dist.integrity']:undefined,shasum:typeof dist?.shasum==='string'?dist.shasum:typeof j?.['dist.shasum']==='string'?j['dist.shasum']:undefined}}catch{return undefined}}
function clearReleaseBlockers(m:MissionState,prefix?:string):void{m.execution.blockers=m.execution.blockers.filter(b=>!b.startsWith(prefix??'release-chain:'))}
function addBlocker(m:MissionState,reason:string):void{const b=`release-chain:${reason}`;if(!m.execution.blockers.includes(b))m.execution.blockers.push(b)}
function reevaluatePushRemote(m:MissionState):void{
  const p=m.release.release_chain?.push;if(!p||p.outcome!=='success'||!p.expected_remote||!p.expected_ref||!p.local_head||!p.remote_hash)return
  if(!p.expected_remote&&p.observed_remote)p.expected_remote=p.observed_remote;if(!p.expected_ref&&p.observed_ref)p.expected_ref=p.observed_ref;const ok=!!p.expected_remote&&!!p.expected_ref&&p.local_head.toLowerCase()===p.remote_hash.toLowerCase()&&p.observed_remote===p.expected_remote&&p.observed_ref===p.expected_ref
  p.remote_verified=ok;p.remote_verified_at=ok?Date.now():undefined
  if(ok){clearReleaseBlockers(m,'release-chain:push-remote-');appendLedger(m,'release-chain.push.remote-verified',{payload:{remote:p.expected_remote,ref:p.expected_ref,hash:p.local_head}})}
  else{addBlocker(m,'push-remote-drift');appendLedger(m,'release-chain.push.remote-drift',{payload:{expected_remote:p.expected_remote,expected_ref:p.expected_ref,local_head:p.local_head,observed_remote:p.observed_remote,observed_ref:p.observed_ref,remote_hash:p.remote_hash}})}
}
function reevaluateTagPushRemote(m:MissionState):void{
  const t=m.release.release_chain?.tag_push;if(!t||t.outcome!=='success'||!t.expected_tag||!t.expected_commit)return
  const tagHash=t.peeled_tag_hash??t.direct_tag_hash
  const ok=!!tagHash&&tagHash.toLowerCase()===t.expected_commit.toLowerCase()&&(!t.expected_remote||!t.observed_remote||t.expected_remote===t.observed_remote)
  t.remote_verified=ok;t.remote_verified_at=ok?Date.now():undefined
  if(ok){clearReleaseBlockers(m,'release-chain:tag-push-');appendLedger(m,'release-chain.tag-push.remote-verified',{payload:{remote:t.expected_remote,tag:t.expected_tag,commit:t.expected_commit,annotated:!!t.peeled_tag_hash}})}
  else if(tagHash){addBlocker(m,'tag-push-remote-drift');appendLedger(m,'release-chain.tag-push.remote-drift',{payload:{expected_remote:t.expected_remote,expected_tag:t.expected_tag,expected_commit:t.expected_commit,observed_remote:t.observed_remote,direct_tag_hash:t.direct_tag_hash,peeled_tag_hash:t.peeled_tag_hash}})}
}
function reevaluatePackageRemote(m:MissionState):void{const p=m.release.release_chain?.package;if(!p||p.outcome!=='success'||!p.name||!p.version||!p.registry_version)return;const versionOk=p.registry_version===p.version;const integrityOk=!p.pack_integrity||p.registry_integrity===p.pack_integrity;const shasumOk=!p.pack_shasum||p.registry_shasum===p.pack_shasum;const ok=versionOk&&integrityOk&&shasumOk;p.remote_verified=ok;p.remote_verified_at=ok?Date.now():undefined;if(ok){clearReleaseBlockers(m,'release-chain:package-remote-');appendLedger(m,'release-chain.package.remote-verified',{payload:{name:p.name,version:p.version,integrity:p.registry_integrity,shasum:p.registry_shasum}})}else{addBlocker(m,'package-remote-drift');appendLedger(m,'release-chain.package.remote-drift',{payload:{name:p.name,expected_version:p.version,registry_version:p.registry_version,expected_integrity:p.pack_integrity,registry_integrity:p.registry_integrity,expected_shasum:p.pack_shasum,registry_shasum:p.registry_shasum}})}}
function reevaluateReleaseRemote(m:MissionState):void{
  const r=m.release.release_chain?.release,p=m.release.release_chain?.push;if(!r||r.outcome!=='success'||!r.expected_tag||!r.expected_commit)return
  const viewOk=r.view_verified===true
  const tagHash=r.peeled_tag_hash??r.direct_tag_hash
  const tagOk=!!tagHash&&tagHash.toLowerCase()===r.expected_commit.toLowerCase()
  const targetOk=!r.expected_target||!r.observed_target||(hex40(r.expected_target)?r.observed_target.toLowerCase()===r.expected_target.toLowerCase():r.observed_target===r.expected_target)
  const remoteOk=!r.expected_remote||!r.observed_remote||r.expected_remote===r.observed_remote
  const expectedAssets=m.release.release_chain?.quality?.assets?.map(a=>a.path)??[];const observed=new Set(r.observed_assets?.map(a=>a.name)??[]);const assetsOk=expectedAssets.length===0||expectedAssets.every(x=>observed.has(x));r.assets_verified=assetsOk
  const ok=viewOk&&tagOk&&targetOk&&remoteOk&&assetsOk
  r.remote_verified=ok;r.remote_verified_at=ok?Date.now():undefined
  if(ok){clearReleaseBlockers(m,'release-chain:release-remote-');appendLedger(m,'release-chain.release.remote-verified',{payload:{tag:r.expected_tag,commit:r.expected_commit,remote:r.expected_remote,annotated:!!r.peeled_tag_hash,target:r.observed_target,assets_verified:r.assets_verified,assets:r.observed_assets?.map(a=>a.name)}})}
  else if(r.view_verified!==undefined||tagHash){addBlocker(m,'release-remote-drift');appendLedger(m,'release-chain.release.remote-drift',{payload:{expected_tag:r.expected_tag,expected_commit:r.expected_commit,expected_target:r.expected_target,expected_remote:r.expected_remote,observed_tag:r.observed_tag,observed_target:r.observed_target,observed_remote:r.observed_remote,direct_tag_hash:r.direct_tag_hash,peeled_tag_hash:r.peeled_tag_hash,push_hash:p?.local_head,expected_assets:expectedAssets,observed_assets:r.observed_assets?.map(a=>a.name)}})}
}

export function noteLocalReleaseMutation(m:MissionState,command:string,success:boolean):void{
  if(!success||!isLocalReleaseMutation(command))return
  const at=Date.now();m.release.release_chain={...(m.release.release_chain??{}),local_revision_at:at,last_local_command:norm(command).slice(0,240),push:undefined,release:undefined,package:m.release.release_chain?.package?{...m.release.release_chain.package,remote_verified:false}:undefined,blocked_reason:undefined}
  clearReleaseBlockers(m);appendLedger(m,'release-chain.local-revision',{payload:{command:norm(command).slice(0,180),downstream:'push-and-release-invalidated'}})
}

export function assertReleaseChainPrecondition(m:MissionState,command:string,projectRoot?:string):void{
  if(isPackagePublish(command)){if(!projectRoot)throw new Error('Hi package publish integrity: project root is required.');const pkg=packageJson(projectRoot),version=typeof pkg?.version==='string'?pkg.version:undefined,name=typeof pkg?.name==='string'?pkg.name:undefined,versionFile=existsSync(join(projectRoot,'VERSION'))?readFileSync(join(projectRoot,'VERSION'),'utf8').trim():version,lockVersion=packageLockVersion(projectRoot),pp=m.release.release_chain?.package;const issues:string[]=[];if(!name||!version)issues.push('package-identity-missing');if(versionFile&&version&&versionFile!==version)issues.push('package-version-mismatch');if(lockVersion&&version&&lockVersion!==version)issues.push('package-lock-version-mismatch');if(!pp?.pack_verified_at||pp.name!==name||pp.version!==version||!pp.pack_state_hash)issues.push('package-pack-unverified');else if(packageStateHash(projectRoot,pp.pack_files??[])!==pp.pack_state_hash)issues.push('package-surface-changed-after-pack');if(issues.length){for(const issue of issues)addBlocker(m,issue);appendLedger(m,'release-chain.package.preflight-failed',{payload:{name,version,lockVersion,issues}});throw new Error(`Hi package publish integrity: publish is blocked (${issues.join(', ')}). Run a fresh npm pack --dry-run --json and keep package/version/lock state unchanged before publish.`)}clearReleaseBlockers(m,'release-chain:package-pack-');clearReleaseBlockers(m,'release-chain:package-surface-');clearReleaseBlockers(m,'release-chain:package-version-');clearReleaseBlockers(m,'release-chain:package-lock-');clearReleaseBlockers(m,'release-chain:package-identity-');appendLedger(m,'release-chain.package.preflight-verified',{payload:{name,version,pack_integrity:pp?.pack_integrity,pack_shasum:pp?.pack_shasum,pack_state_hash:pp?.pack_state_hash}});return}
  if(!isReleaseCreate(command))return
  const requestedTag=parseReleaseTag(command),tagPush=m.release.release_chain?.tag_push
  if(tagPush?.expected_tag&&requestedTag&&tagPush.expected_tag===requestedTag){
    let tr:string|undefined
    if(tagPush.outcome!=='success')tr=`tag-push-${tagPush.outcome}`
    else if(!tagPush.remote_verified)tr='tag-push-remote-unverified'
    if(tr){m.release.release_chain={...(m.release.release_chain??{}),blocked_reason:tr};addBlocker(m,tr);appendLedger(m,'release-chain.blocked',{payload:{reason:tr,command:norm(command).slice(0,180),policy:'release-create-requires-remotely-verified-explicit-tag-push'}});throw new Error(`Hi release-chain safety: release creation is blocked (${tr}). The explicit release tag push must be remotely verified before creating the release.`)}
  }
  if(projectRoot){const q=inspectReleaseQuality(projectRoot,command);if(!q.ok){for(const issue of q.issues)addBlocker(m,`quality-${issue}`);appendLedger(m,'release-chain.quality.failed',{payload:{version:q.version,issues:q.issues,assets:q.assets.map(a=>({path:basename(a.path),sha256:a.sha256,manifest_match:a.manifest_match}))}});throw new Error(`Hi release quality: release creation is blocked (${q.issues.join(', ')}). VERSION/package/plugin package/CHANGELOG and any supplied release asset must match the release tag and manifest.`)}m.release.release_chain={...(m.release.release_chain??{}),quality:{version:q.version,verified:true,verified_at:Date.now(),assets:q.assets.map(a=>({path:basename(a.path),sha256:a.sha256,manifest_match:a.manifest_match}))}};clearReleaseBlockers(m,'release-chain:quality-');appendLedger(m,'release-chain.quality.verified',{payload:{version:q.version,assets:q.assets.map(a=>({path:basename(a.path),sha256:a.sha256,manifest_match:a.manifest_match}))}})}
  const chain=m.release.release_chain,push=chain?.push
  let reason:string|undefined
  if(!push||push.outcome!=='success'||(chain?.local_revision_at&&push.at<chain.local_revision_at))reason=push?.outcome==='failure'?'push-failed':push?.outcome==='unknown'?'push-unknown':'push-not-proven-after-local-revision'
  else if(!push.remote_verified)reason='push-remote-unverified'
  if(reason){m.release.release_chain={...(chain??{}),blocked_reason:reason};addBlocker(m,reason);appendLedger(m,'release-chain.blocked',{payload:{reason,command:norm(command).slice(0,180),policy:'release-create-requires-current-remotely-verified-push'}});throw new Error(`Hi release-chain safety: release creation is blocked (${reason}). A successful git push for the current local revision must be proven and remote state must be verified before creating the release.`)}
}

export function notePrivilegedReleaseOutcome(m:MissionState,command:string,outcome:'success'|'failure'|'unknown'):void{
  const at=Date.now(),c=norm(command)
  if(isGitPush(command)){
    const tagExp=parseTagPushExpectation(command)
    if(tagExp){const commit=m.release.release_chain?.push?.local_head;m.release.release_chain={...(m.release.release_chain??{}),tag_push:{outcome,at,command:c.slice(0,240),expected_remote:tagExp.remote,expected_tag:tagExp.tag,expected_commit:commit,remote_verified:outcome==='success'?false:undefined},release:undefined,blocked_reason:outcome==='success'?undefined:`tag-push-${outcome}`};clearReleaseBlockers(m,'release-chain:tag-push-');if(outcome!=='success')addBlocker(m,`tag-push-${outcome}`);else addBlocker(m,'tag-push-remote-unverified');appendLedger(m,`release-chain.tag-push.${outcome}`,{payload:{command:c.slice(0,180),expected_remote:tagExp.remote,expected_tag:tagExp.tag,expected_commit:commit}});return}
    const exp=parsePushExpectation(command)
    m.release.release_chain={...(m.release.release_chain??{}),push:{outcome,at,command:c.slice(0,240),expected_remote:exp?.remote,expected_ref:exp?.ref,remote_verified:outcome==='success'?false:undefined},release:undefined,blocked_reason:outcome==='success'?undefined:`push-${outcome}`}
    clearReleaseBlockers(m);if(outcome!=='success')addBlocker(m,`push-${outcome}`);else addBlocker(m,'push-remote-unverified')
    appendLedger(m,`release-chain.push.${outcome}`,{payload:{command:c.slice(0,180),expected_remote:exp?.remote,expected_ref:exp?.ref}});return
  }
  if(isPackagePublish(command)){const pkg=m.release.release_chain?.package;m.release.release_chain={...(m.release.release_chain??{}),package:{...(pkg??{}),outcome,published_at:at,remote_verified:outcome==='success'?false:undefined},blocked_reason:outcome==='success'?undefined:`package-${outcome}`};clearReleaseBlockers(m,'release-chain:package-');if(outcome!=='success')addBlocker(m,`package-${outcome}`);else addBlocker(m,'package-remote-unverified');appendLedger(m,`release-chain.package.${outcome}`,{payload:{command:c.slice(0,180),name:pkg?.name,version:pkg?.version,pack_integrity:pkg?.pack_integrity}});return
  }
  if(isReleaseCreate(command)){
    const tag=parseReleaseTag(command),target=parseReleaseTarget(command),push=m.release.release_chain?.push
    m.release.release_chain={...(m.release.release_chain??{}),release:{outcome,at,command:c.slice(0,240),expected_tag:tag,expected_target:target,expected_commit:push?.local_head,expected_remote:push?.expected_remote,remote_verified:outcome==='success'?false:undefined},blocked_reason:outcome==='success'?undefined:`release-${outcome}`}
    clearReleaseBlockers(m);if(outcome!=='success')addBlocker(m,`release-${outcome}`);else addBlocker(m,'release-remote-unverified')
    appendLedger(m,`release-chain.release.${outcome}`,{payload:{command:c.slice(0,180),expected_tag:tag,expected_target:target,expected_commit:push?.local_head,expected_remote:push?.expected_remote}})
  }
}

export function recordRemoteReleaseVerification(m:MissionState,command:string,output:any,projectRoot?:string):void{
  const exit=(()=>{for(const v of [output?.metadata?.exit,output?.exit]){if(typeof v==='number')return v;if(typeof v==='string'&&/^-?\d+$/.test(v))return Number(v)}return undefined})()
  if(exit!==undefined&&exit!==0)return
  const pack=parsePackDryRun(command,output,projectRoot);if(pack){const current=projectRoot?packageJson(projectRoot):undefined;m.release.release_chain={...(m.release.release_chain??{}),package:{...(m.release.release_chain?.package??{}),name:pack.name??current?.name,version:pack.version??current?.version,pack_integrity:pack.integrity,pack_shasum:pack.shasum,pack_filename:pack.filename,pack_files:pack.files,pack_state_hash:pack.state_hash,pack_verified_at:Date.now(),remote_verified:false}};clearReleaseBlockers(m,'release-chain:package-pack-');clearReleaseBlockers(m,'release-chain:package-surface-');appendLedger(m,'release-chain.package.pack-verified',{payload:{name:pack.name,version:pack.version,integrity:pack.integrity,shasum:pack.shasum,filename:pack.filename,file_count:pack.files.length,state_hash:pack.state_hash}});return}
  const registry=parseRegistryView(command,output);if(registry&&m.release.release_chain?.package){const p=m.release.release_chain.package;p.registry_version=registry.version;p.registry_integrity=registry.integrity;p.registry_shasum=registry.shasum;appendLedger(m,'release-chain.package.registry-probe',{payload:registry});reevaluatePackageRemote(m);return}
  const upstream=parseUpstream(command,output);if(upstream&&m.release.release_chain?.push){m.release.release_chain.push.expected_remote=upstream.remote;m.release.release_chain.push.expected_ref=upstream.ref;appendLedger(m,'release-chain.push.upstream',{payload:upstream});reevaluatePushRemote(m);return}
  const head=parseHead(command,output);if(head&&m.release.release_chain?.push){m.release.release_chain.push.local_head=head;appendLedger(m,'release-chain.push.local-head',{payload:{hash:head}});reevaluatePushRemote(m);return}
  const tagProbe=parseRemoteTagProbe(command,output);if(tagProbe){let handled=false;const tp=m.release.release_chain?.tag_push;if(tp&&(!tp.expected_tag||tp.expected_tag===tagProbe.tag)){tp.observed_remote=tagProbe.remote;tp.direct_tag_hash=tagProbe.direct_hash;tp.peeled_tag_hash=tagProbe.peeled_hash;appendLedger(m,'release-chain.tag-push.tag-probe',{payload:{remote:tagProbe.remote,tag:tagProbe.tag,direct_hash:tagProbe.direct_hash,peeled_hash:tagProbe.peeled_hash}});reevaluateTagPushRemote(m);handled=true}if(m.release.release_chain?.release){const r=m.release.release_chain.release;r.observed_remote=tagProbe.remote;r.direct_tag_hash=tagProbe.direct_hash;r.peeled_tag_hash=tagProbe.peeled_hash;appendLedger(m,'release-chain.release.tag-probe',{payload:{remote:tagProbe.remote,tag:tagProbe.tag,direct_hash:tagProbe.direct_hash,peeled_hash:tagProbe.peeled_hash}});reevaluateReleaseRemote(m);handled=true}if(handled)return}
  const remote=parseLsRemote(command,output);if(remote&&m.release.release_chain?.push){const p=m.release.release_chain.push;p.observed_remote=remote.remote;p.observed_ref=remote.ref;p.remote_hash=remote.hash;appendLedger(m,'release-chain.push.remote-probe',{payload:{remote:remote.remote,ref:remote.ref,hash:remote.hash}});reevaluatePushRemote(m);return}
  const rv=parseReleaseView(command,output);if(rv&&m.release.release_chain?.release){const r=m.release.release_chain.release;r.observed_tag=rv.tag;r.observed_target=rv.target;r.observed_assets=rv.assets;r.view_verified=!!r.expected_tag&&rv.tag===r.expected_tag&&(!r.expected_target||!rv.target||(hex40(r.expected_target)?rv.target.toLowerCase()===r.expected_target.toLowerCase():rv.target===r.expected_target));appendLedger(m,r.view_verified?'release-chain.release.view-verified':'release-chain.release.view-drift',{payload:{expected_tag:r.expected_tag,expected_target:r.expected_target,observed_tag:rv.tag,target:rv.target,assets:rv.assets?.map(a=>a.name)}});reevaluateReleaseRemote(m)}
}
