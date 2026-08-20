#!/usr/bin/env node
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'

function fail(message){console.error(`npm-oidc-release verification failed: ${message}`);process.exit(1)}
function json(path){try{return JSON.parse(readFileSync(path,'utf8'))}catch(error){fail(`cannot read ${path}: ${error.message}`)}}
function text(path){try{return readFileSync(path,'utf8').trim()}catch(error){fail(`cannot read ${path}: ${error.message}`)}}
function git(...args){try{return execFileSync('git',args,{encoding:'utf8'}).trim()}catch(error){fail(`git ${args.join(' ')} failed: ${String(error.stderr||error.message).trim()}`)}}

const [mode,...args]=process.argv.slice(2)
const pkg=json('package.json')
const runtime=json('plugin/package.json')
const rootLock=json('package-lock.json')
const lock=json('plugin/package-lock.json')
const rootLockVersion=rootLock?.packages?.['']?.version
const lockVersion=lock?.packages?.['']?.version
const version=text('VERSION')
const expectedRepository='git+https://github.com/huseyincig/OpenCode-Hi.git'

function identity(){
  if(pkg.name!=='opencode-hi')fail(`unexpected package name ${pkg.name}`)
  if(pkg.version!==version)fail(`root package version ${pkg.version} != VERSION ${version}`)
  if(runtime.version!==version)fail(`runtime package version ${runtime.version} != VERSION ${version}`)
  if(rootLockVersion!==version)fail(`root distribution lock version ${rootLockVersion} != VERSION ${version}`)
  if(lockVersion!==version)fail(`runtime lock version ${lockVersion} != VERSION ${version}`)
  if(pkg.peerDependencies?.['@opencode-ai/plugin']!=='1.18.19')fail('root @opencode-ai/plugin peer must equal accepted 1.18.19')
  if(pkg.dependencies?.['@opencode-ai/sdk']!=='1.18.19')fail('root @opencode-ai/sdk dependency must equal accepted 1.18.19')
  if(pkg.optionalDependencies?.['playwright-core']!=='1.62.1')fail('root playwright-core optional dependency must equal accepted 1.62.1')
  if(pkg.repository?.url!==expectedRepository)fail(`repository.url must exactly equal ${expectedRepository}`)
  if(pkg.publishConfig?.access!=='public')fail('publishConfig.access must be public')
}

if(mode==='preflight'){
  identity()
  const tag=args[0]
  if(!tag)fail('preflight requires an exact release tag')
  if(tag!==`v${version}`)fail(`release tag ${tag} != v${version}`)
  const head=git('rev-parse','HEAD')
  const tagCommit=git('rev-list','-n','1',`refs/tags/${tag}`)
  if(tagCommit!==head)fail(`tag ${tag} resolves to ${tagCommit}, not checked-out HEAD ${head}`)
  const tagType=git('cat-file','-t',`refs/tags/${tag}`)
  if(tagType!=='tag')fail(`tag ${tag} must be annotated; observed git object type ${tagType}`)
  console.log(JSON.stringify({status:'PASS',name:pkg.name,version,tag,head,tag_object_type:tagType,repository:pkg.repository.url}))
  process.exit(0)
}

if(mode==='registry'){
  identity()
  const [packPath,viewPath]=args
  if(!packPath||!viewPath)fail('registry requires pack JSON and npm view JSON paths')
  const packRaw=json(packPath)
  const pack=Array.isArray(packRaw)?packRaw[0]:packRaw
  const viewRaw=json(viewPath)
  const view=Array.isArray(viewRaw)?viewRaw[0]:viewRaw
  if(!pack||typeof pack!=='object')fail('pack receipt is empty')
  if(!view||typeof view!=='object')fail('registry receipt is empty')
  if(pack.name!==pkg.name||pack.version!==version)fail(`pack identity ${pack.name}@${pack.version} != ${pkg.name}@${version}`)
  if(typeof pack.integrity!=='string'||!pack.integrity)fail('pack integrity missing')
  if(typeof pack.shasum!=='string'||!pack.shasum)fail('pack shasum missing')
  const registryVersion=view.version
  const registryIntegrity=view?.dist?.integrity??view['dist.integrity']
  const registryShasum=view?.dist?.shasum??view['dist.shasum']
  if(registryVersion!==version)fail(`registry version ${registryVersion} != ${version}`)
  if(registryIntegrity!==pack.integrity)fail('registry integrity does not match fresh pack proof')
  if(registryShasum!==pack.shasum)fail('registry shasum does not match fresh pack proof')
  console.log(JSON.stringify({status:'PASS',name:pkg.name,version,integrity:pack.integrity,shasum:pack.shasum}))
  process.exit(0)
}

fail('usage: verify-npm-oidc-release.mjs preflight <tag> | registry <pack.json> <view.json>')
