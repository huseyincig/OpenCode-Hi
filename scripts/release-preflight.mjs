#!/usr/bin/env node
import {execFileSync,spawnSync} from 'node:child_process'
import {existsSync,readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {dirname,join} from 'node:path'

const ROOT=fileURLToPath(new URL('..',import.meta.url)).replace(/[\\/]$/,'')
const readJson=path=>JSON.parse(readFileSync(`${ROOT}/${path}`,'utf8'))
const text=path=>readFileSync(`${ROOT}/${path}`,'utf8').trim()
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim()
const gitCommonDir=git('rev-parse','--path-format=absolute','--git-common-dir')
const repositoryRoot=dirname(gitCommonDir)
const releasePython=process.platform==='win32'?join(repositoryRoot,'.agent-work','venv-release','Scripts','python.exe'):join(repositoryRoot,'.agent-work','venv-release','bin','python')
const executionEnv={...process.env,...(!process.env.OPENCODE_HI_PYTHON&&existsSync(releasePython)?{OPENCODE_HI_PYTHON:releasePython}:{})}
function blocked(reason,detail){process.stdout.write(JSON.stringify({status:'BLOCKED',kind:'EXACT_SHA_NO_PUBLISH_PREFLIGHT',reason,...(detail?{detail}:{}),mutation_performed:false},null,2)+'\n');process.exit(2)}
function run(command,args,timeout=30000){return spawnSync(command,args,{cwd:ROOT,encoding:'utf8',timeout,maxBuffer:32*1024*1024,env:executionEnv})}
function gate(name,command,args,timeout=900000){const r=run(command,args,timeout);if(r.status!==0)blocked(`${name}-failed`,`${(r.stdout||'').slice(-2500)}\n${(r.stderr||'').slice(-2500)}`);return{name,status:'PASS'}}

const args=process.argv.slice(2);let expected
while(args.length){const flag=args.shift();if(flag==='--sha')expected=args.shift();else blocked('unsupported-argument',String(flag))}
if(!expected||!/^[0-9a-f]{40}$/i.test(expected))blocked('exact-sha-required','Use --sha <40-hex committed HEAD>.')
const head=git('rev-parse','HEAD')
if(head!==expected)blocked('head-sha-mismatch',`expected=${expected} observed=${head}`)
const dirty=git('status','--porcelain')
if(dirty)blocked('worktree-not-clean','Commit or deliberately remove all candidate changes before exact-SHA release preflight.')

const version=text('VERSION'),pkg=readJson('package.json'),runtime=readJson('plugin/package.json'),rootLock=readJson('package-lock.json'),runtimeLock=readJson('plugin/package-lock.json'),product=readJson('data/product.json')
const versions=[pkg.version,runtime.version,rootLock.version,rootLock.packages?.['']?.version,runtimeLock.version,runtimeLock.packages?.['']?.version,product.version]
if(versions.some(v=>v!==version))blocked('version-parity-drift',JSON.stringify({VERSION:version,observed:versions}))
const node=process.platform==='win32'?'node.exe':'node',npm=process.platform==='win32'?'npm.cmd':'npm'
const hostCurrency=gate('opencode-host-current',node,['scripts/run-python.mjs','scripts/opencode_upstream_tracker.py','--registry-only','--require-current'],60000)
const identity=gate('release-identity',node,['scripts/verify-npm-oidc-release.mjs','identity'],60000)
const tag=`v${version}`
const localTag=run('git',['rev-parse','--verify','--quiet',`refs/tags/${tag}`]);if(localTag.status===0)blocked('candidate-tag-already-exists',tag)
const remoteTag=run('git',['ls-remote','--tags','origin',`refs/tags/${tag}`,`refs/tags/${tag}^{}`]);if(remoteTag.status!==0)blocked('remote-tag-check-failed',(remoteTag.stderr||remoteTag.stdout||'').slice(-500));if(remoteTag.stdout.trim())blocked('remote-candidate-tag-already-exists',tag)

const sourceCheck=gate('canonical-source-verification',npm,['run','check'])
const packedDocs=gate('packed-public-documentation',npm,['run','docs:pack-check'])
const postGateDirty=git('status','--porcelain');if(postGateDirty)blocked('verification-generated-drift','Canonical checks changed tracked/untracked candidate state. Regenerate, review, and commit exact evidence/docs before release preflight.')
const pack=run(npm,['pack','--dry-run','--json','--ignore-scripts'],120000);if(pack.status!==0)blocked('npm-pack-dry-run-failed',(pack.stderr||pack.stdout||'').slice(-1000))
let packRow;try{const parsed=JSON.parse(pack.stdout);packRow=Array.isArray(parsed)?parsed[0]:parsed}catch(error){blocked('npm-pack-proof-invalid',String(error))}
if(packRow?.name!=='opencode-hi'||packRow?.version!==version)blocked('npm-pack-identity-drift',JSON.stringify({name:packRow?.name,version:packRow?.version}))
const names=new Set((packRow?.files??[]).map(x=>x.path));for(const required of ['plugin/dist/plugin.js','scripts/opencode-hi.mjs','VERSION','README.md'])if(!names.has(required))blocked('npm-pack-required-file-missing',required)

const view=run(npm,['view',`opencode-hi@${version}`,'version','--json'],60000);
if(view.status===0)blocked('candidate-version-already-published',`opencode-hi@${version}`)
const registryText=`${view.stdout||''}\n${view.stderr||''}`;if(!/E404|No match found|404 Not Found/i.test(registryText))blocked('npm-registry-availability-check-failed',registryText.slice(-800))

process.stdout.write(JSON.stringify({status:'READY_NO_PUBLISH',kind:'EXACT_SHA_NO_PUBLISH_PREFLIGHT',mutation_performed:false,source:{commit:head,tree:git('rev-parse','HEAD^{tree}')},package:{name:'opencode-hi',version,tag,pack:{filename:packRow.filename,integrity:packRow.integrity,shasum:packRow.shasum,file_count:(packRow.files??[]).length}},checks:{exact_sha:true,clean_worktree:true,version_parity:true,opencode_host_current:hostCurrency.status,release_identity:identity.status,canonical_source_verification:sourceCheck.status,packed_public_documentation:packedDocs.status,post_gate_clean:true,local_tag_absent:true,remote_tag_absent:true,npm_version_absent:true,pack_dry_run:true},claim_boundary:'Read-only preflight only. This command never creates a Git tag, pushes refs, creates a GitHub release, or publishes to npm.'},null,2)+'\n')
