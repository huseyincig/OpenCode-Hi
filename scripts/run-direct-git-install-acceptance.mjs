#!/usr/bin/env node
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)))
const work=path.join(root,'.agent-work','tmp','direct-git-install-acceptance')
const repository=process.env.GITHUB_REPOSITORY
const sha=process.env.GITHUB_SHA
const spec=process.env.OPENCODE_HI_GIT_SPEC || (repository&&sha ? `opencode-hi@git+https://github.com/${repository}.git#${sha}` : undefined)
if(!spec){console.error('direct-Git acceptance requires OPENCODE_HI_GIT_SPEC or GITHUB_REPOSITORY + GITHUB_SHA');process.exit(2)}
await rm(work,{recursive:true,force:true});await mkdir(work,{recursive:true})
await writeFile(path.join(work,'package.json'),JSON.stringify({private:true},null,2)+'\n','utf8')
const npmExecPath=process.env.npm_execpath
const npmCommand=npmExecPath?process.execPath:(process.platform==='win32'?'npm.cmd':'npm')
const npmArgs=npmExecPath?[npmExecPath,'install','--ignore-scripts','--no-audit','--no-fund','--save-exact',spec]:['install','--ignore-scripts','--no-audit','--no-fund','--save-exact',spec]
const install=spawnSync(npmCommand,npmArgs,{cwd:work,encoding:'utf8',env:{...process.env,npm_config_cache:path.join(root,'.agent-work','cache','direct-git-install')}})
if(install.error){console.error(`direct-Git acceptance could not launch npm: ${install.error.stack||install.error}`);process.exit(1)}
if(install.status!==0){process.stderr.write(install.stdout||'');process.stderr.write(install.stderr||'');process.exit(install.status??1)}
const target=path.join(work,'node_modules','opencode-hi')
const pkg=JSON.parse(await readFile(path.join(target,'package.json'),'utf8'))
const forbidden=['postinstall','build','preinstall','install','prepack','prepare'].filter(k=>pkg.scripts?.[k])
if(forbidden.length)throw new Error(`installed Git package contains preparation-trigger scripts: ${forbidden.join(',')}`)
if(pkg.peerDependencies?.['@opencode-ai/plugin']!=='1.18.19'||pkg.peerDependenciesMeta?.['@opencode-ai/plugin']?.optional!==true)throw new Error('OpenCode host plugin peer is not optional or does not match exact 1.18.19')
if(pkg.dependencies?.['@opencode-ai/sdk']!=='1.18.19')throw new Error('runtime SDK dependency drift from exact 1.18.19')
try{await readFile(path.join(work,'node_modules','effect','package.json'),'utf8');throw new Error('type-only host peer dependency graph unexpectedly installed effect')}catch(e){if(e?.code!=='ENOENT')throw e}
const entry=new URL(pkg.main,pathToFileURL(target+path.sep)).href
const mod=await import(entry)
if(typeof mod.default!=='function')throw new Error('installed Git package default plugin export missing')
console.log(JSON.stringify({status:'PASS',kind:'DIRECT_GIT_PLUGIN_INSTALL_ACCEPTANCE',spec,package:pkg.name,version:pkg.version,main:pkg.main,default_export:'function',host_peer_optional:true,forbidden_git_prepare_scripts:forbidden},null,2))
