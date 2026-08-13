import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {mkdtempSync,writeFileSync,chmodSync,statSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync,execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import { startAssessedMission } from './helpers/semantic.mjs'
import {createToolBeforeHook} from '../dist/hooks/tool-before.js'
import {createToolAfterHook} from '../dist/hooks/tool-after.js'
import {evaluateCompletion} from '../dist/runtime/completion/evaluator.js'

const execFileAsync=promisify(execFile)
function run(cwd,file,args,env={}){return execFileSync(file,args,{cwd,encoding:'utf8',env:{...process.env,...env}}).trim()}
async function runAsync(cwd,file,args,env={}){const {stdout}=await execFileAsync(file,args,{cwd,encoding:'utf8',env:{...process.env,...env}});return stdout.trim()}
function git(cwd,...args){return run(cwd,'git',args)}
async function listen(server){await new Promise((res,rej)=>{server.once('error',rej);server.listen(0,'127.0.0.1',res)});return server.address().port}

function ghShim(path){writeFileSync(path,`#!/usr/bin/env node
const http=require('node:http'),fs=require('node:fs');
const base=new URL(process.env.Hi_RELEASE_BASE),a=process.argv.slice(2);
function req(method,path,body){return new Promise((resolve,reject)=>{const data=body?Buffer.from(JSON.stringify(body)):undefined;const r=http.request({hostname:base.hostname,port:base.port,path,method,headers:data?{'content-type':'application/json','content-length':data.length}:{}},x=>{let b='';x.setEncoding('utf8');x.on('data',c=>b+=c);x.on('end',()=>x.statusCode>=200&&x.statusCode<300?resolve(b):reject(new Error('HTTP '+x.statusCode+' '+b))) });r.on('error',reject);if(data)r.write(data);r.end()})}
(async()=>{if(a[0]!=='release')throw new Error('unsupported');if(a[1]==='create'){let target;const pos=[];for(let i=2;i<a.length;i++){if(a[i]==='--target'){target=a[++i];continue}if(a[i].startsWith('-'))continue;pos.push(a[i])}const tag=pos.shift(),assets=pos.filter(x=>fs.existsSync(x)).map(x=>({name:x.split(/[\\\\/]/).pop(),size:fs.statSync(x).size}));process.stdout.write(await req('POST','/releases',{tagName:tag,targetCommitish:target,assets}));return}if(a[1]==='view'){let tag;for(let i=2;i<a.length;i++){if(a[i]==='--json'||a[i]==='--repo'||a[i]==='-R'){i++;continue}if(a[i].startsWith('-'))continue;tag=a[i];break}process.stdout.write(await req('GET','/releases/'+encodeURIComponent(tag)));return}throw new Error('unsupported')})().catch(e=>{console.error(e.message);process.exit(1)})
`);chmodSync(path,0o755)}

test('real branch+annotated-tag push and hosted release HTTP transaction are remotely verified end to end', async()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-hosted-release-')), remote=join(root,'remote.git'), work=join(root,'work'), bin=join(root,'gh')
  execFileSync('git',['init','--bare','--initial-branch=main',remote]);execFileSync('git',['init','-b','main',work])
  git(work,'config','user.name','Hi Test');git(work,'config','user.email','hi@example.invalid')
  writeFileSync(join(work,'tracked.txt'),'release\n');git(work,'add','tracked.txt');git(work,'commit','-m','release candidate');git(work,'remote','add','origin',remote)
  const asset=join(work,'artifact.zip');writeFileSync(asset,'artifact-bytes')
  ghShim(bin)
  const releases=new Map(), server=http.createServer((req,res)=>{let body='';req.setEncoding('utf8');req.on('data',c=>body+=c);req.on('end',()=>{if(req.method==='POST'&&req.url==='/releases'){const x=JSON.parse(body);releases.set(x.tagName,x);res.writeHead(201,{'content-type':'application/json'});return res.end(JSON.stringify({url:`local://${x.tagName}`}))}const m=req.url?.match(/^\/releases\/(.+)$/);if(req.method==='GET'&&m){const x=releases.get(decodeURIComponent(m[1]));if(!x){res.writeHead(404);return res.end('missing')}res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify(x))}res.writeHead(404);res.end('not found')})})
  const port=await listen(server), env={Hi_RELEASE_BASE:`http://127.0.0.1:${port}`}
  try{
    const store=new MissionStore(root),m=startAssessedMission(store,'hosted-release-session','push and create release v2.0.10',{task_kind:'release-readiness',scope:'external',risk:'authority-boundary',requested_external_actions:['git-push','release-create']})
    const before=createToolBeforeHook(store,undefined,work),after=createToolAfterHook(store,undefined,undefined,work)
    const push='git push origin main';await before({sessionID:m.session_id,tool:'bash',args:{command:push,cwd:work}},{args:{command:push,cwd:work}});const po=git(work,'push','origin','main');await after({sessionID:m.session_id,tool:'bash',args:{command:push,cwd:work}},{stdout:po,metadata:{exit:0}})
    const head=git(work,'rev-parse','HEAD');await after({sessionID:m.session_id,tool:'bash',args:{command:'git rev-parse HEAD',cwd:work}},{stdout:head+'\n',metadata:{exit:0}});const br=git(work,'ls-remote','origin','refs/heads/main');await after({sessionID:m.session_id,tool:'bash',args:{command:'git ls-remote origin refs/heads/main',cwd:work}},{stdout:br+'\n',metadata:{exit:0}});assert.equal(m.release_chain?.push?.remote_verified,true)

    const tagCmd='git tag -a v2.0.10 -m v2.0.10';await before({sessionID:m.session_id,tool:'bash',args:{command:tagCmd,cwd:work}},{args:{command:tagCmd,cwd:work}});git(work,'tag','-a','v2.0.10','-m','v2.0.10');await after({sessionID:m.session_id,tool:'bash',args:{command:tagCmd,cwd:work}},{stdout:'',metadata:{exit:0}});assert.equal(m.release_chain?.push?.remote_verified,true,'local tag creation must not invalidate current revision push proof')
    const tagPush='git push origin v2.0.10';await before({sessionID:m.session_id,tool:'bash',args:{command:tagPush,cwd:work}},{args:{command:tagPush,cwd:work}});const tpo=git(work,'push','origin','v2.0.10');await after({sessionID:m.session_id,tool:'bash',args:{command:tagPush,cwd:work}},{stdout:tpo,metadata:{exit:0}});assert.equal(m.release_chain?.push?.remote_verified,true,'tag push must not overwrite branch/current revision proof');assert.equal(m.release_chain?.tag_push?.expected_tag,'v2.0.10');assert.equal(m.release_chain?.tag_push?.remote_verified,false)
    const tagProbe=git(work,'ls-remote','origin','refs/tags/v2.0.10','refs/tags/v2.0.10^{}');await after({sessionID:m.session_id,tool:'bash',args:{command:'git ls-remote origin refs/tags/v2.0.10 refs/tags/v2.0.10^{}',cwd:work}},{stdout:tagProbe+'\n',metadata:{exit:0}});assert.equal(m.release_chain?.tag_push?.remote_verified,true);assert.equal(m.release_chain?.tag_push?.peeled_tag_hash,head)

    const releaseCmd=`gh release create v2.0.10 --target main ${asset}`;await before({sessionID:m.session_id,tool:'bash',args:{command:releaseCmd,cwd:work}},{args:{command:releaseCmd,cwd:work}});const created=await runAsync(work,bin,['release','create','v2.0.10','--target','main',asset],env);await after({sessionID:m.session_id,tool:'bash',args:{command:releaseCmd,cwd:work}},{stdout:created,metadata:{exit:0}});assert.equal(m.release_chain?.release?.remote_verified,false)
    const viewCmd='gh release view v2.0.10 --json tagName,targetCommitish,assets';const viewed=await runAsync(work,bin,['release','view','v2.0.10','--json','tagName,targetCommitish,assets'],env);await after({sessionID:m.session_id,tool:'bash',args:{command:viewCmd,cwd:work}},{stdout:viewed,metadata:{exit:0}});assert.equal(m.release_chain?.release?.view_verified,true);assert.deepEqual(m.release_chain?.release?.observed_assets?.map(x=>x.name),['artifact.zip']);assert.equal(m.release_chain?.release?.assets_verified,true);assert.equal(m.release_chain?.release?.remote_verified,false,'hosted metadata alone cannot replace exact remote tag commit verification')
    await after({sessionID:m.session_id,tool:'bash',args:{command:'git ls-remote origin refs/tags/v2.0.10 refs/tags/v2.0.10^{}',cwd:work}},{stdout:tagProbe+'\n',metadata:{exit:0}});assert.equal(m.release_chain?.release?.remote_verified,true)
    m.obligations.forEach(o=>o.status='closed');m.tasks.forEach(t=>t.status='completed');m.evidence.fresh=true;const c=evaluateCompletion(m);assert.ok(!c.reasons.includes('release-chain:release-remote-unverified'))
    assert.equal(releases.get('v2.0.10')?.targetCommitish,'main');assert.equal(releases.get('v2.0.10')?.assets?.[0]?.size,statSync(asset).size)
  } finally {await new Promise(r=>server.close(r))}
})
