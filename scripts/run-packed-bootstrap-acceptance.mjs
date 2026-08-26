#!/usr/bin/env node
import {mkdir,readFile,readdir,rm,stat} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)))
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'))
const version=pkg.version
const work=path.join(root,'.agent-work','tmp','packed-bootstrap-acceptance')
const packDir=path.join(work,'pack')
const project=path.join(work,'project')
const cache=path.join(root,'.agent-work','cache','packed-bootstrap-acceptance')
await rm(work,{recursive:true,force:true})
await mkdir(packDir,{recursive:true})
await mkdir(project,{recursive:true})
await mkdir(cache,{recursive:true})

const npmExecPath=process.env.npm_execpath
const npmCommand=npmExecPath?process.execPath:(process.platform==='win32'?'npm.cmd':'npm')
function npm(args,{cwd=root}={}){
  const full=npmExecPath?[npmExecPath,...args]:args
  const r=spawnSync(npmCommand,full,{cwd,encoding:'utf8',env:{...process.env,npm_config_cache:cache}})
  if(r.error)throw new Error(`could not launch npm: ${r.error.stack||r.error}`)
  if(r.status!==0)throw new Error(`npm ${args.join(' ')} failed (${r.status})\n${r.stdout||''}\n${r.stderr||''}`)
  return r.stdout
}

npm(['pack','--ignore-scripts','--pack-destination',packDir])
const tgzs=(await readdir(packDir)).filter(x=>x.endsWith('.tgz'))
if(tgzs.length!==1)throw new Error(`expected exactly one packed candidate, found ${tgzs.length}`)
const tgz=path.join(packDir,tgzs[0])
npm(['exec','--yes','--package',tgz,'--','opencode-hi','setup',project])

const config=JSON.parse(await readFile(path.join(project,'opencode.json'),'utf8'))
const expected=`opencode-hi@${version}`
if(JSON.stringify(config.plugin)!==JSON.stringify([expected]))throw new Error(`exact plugin registration mismatch: ${JSON.stringify(config.plugin)} != ${expected}`)
const ownership=JSON.parse(await readFile(path.join(project,'.opencode','hi','provenance','setup.json'),'utf8'))
if(ownership.schema!==2||ownership.plugin_spec!==expected)throw new Error('ownership receipt does not bind the exact packed candidate')
for(const forbidden of ['package.json','package-lock.json','node_modules']){
  try{await stat(path.join(project,forbidden));throw new Error(`application-root ${forbidden} was materialized by package-runner bootstrap`)}catch(error){if(error?.code!=='ENOENT')throw error}
}

async function tree(dir,prefix=''){
  const out=[]
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const rel=prefix?`${prefix}/${entry.name}`:entry.name
    out.push(rel)
    if(entry.isDirectory())out.push(...await tree(path.join(dir,entry.name),rel))
  }
  return out.sort()
}
const entries=await tree(project)
const receipt={
  schema:1,
  kind:'PACKED_PACKAGE_RUNNER_BOOTSTRAP',
  status:'PASS',
  platform:process.platform,
  architecture:process.arch,
  candidate:version,
  tarball:path.basename(tgz),
  plugin_spec:expected,
  application_root:{package_json:false,package_lock:false,node_modules:false,entries},
  ownership:{schema:ownership.schema,plugin_spec:ownership.plugin_spec},
  claim_boundary:'Packed-candidate package-runner bootstrap only; this does not claim registry publication or exact OpenCode host loading.'
}
await rm(work,{recursive:true,force:true})
console.log(JSON.stringify(receipt,null,2))
