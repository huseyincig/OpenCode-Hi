import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawn} from 'node:child_process'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {createToolBeforeHook} from '../dist/hooks/tool-before.js'
import {createToolAfterHook} from '../dist/hooks/tool-after.js'
import {requireAuthority,approvePendingAuthority} from '../dist/runtime/safety/authority.js'
import {assertReleaseChainPrecondition,recordRemoteReleaseVerification} from '../dist/runtime/safety/release-chain.js'

function run(cmd,args,{cwd,env}={}){return new Promise((resolveRun,reject)=>{const p=spawn(cmd,args,{cwd,env:{...process.env,...env}});let stdout='',stderr='';p.stdout.on('data',d=>stdout+=d);p.stderr.on('data',d=>stderr+=d);p.on('error',reject);p.on('close',code=>resolveRun({code,stdout,stderr}))})}

async function registry(){
  let published
  const server=http.createServer((req,res)=>{
    const chunks=[];req.on('data',d=>chunks.push(d));req.on('end',()=>{
      const path=decodeURIComponent((req.url??'').split('?')[0])
      if(req.method==='PUT'&&path==='/opencode-hi'){
        published=JSON.parse(Buffer.concat(chunks).toString('utf8'))
        res.writeHead(201,{'content-type':'application/json'});res.end('{"ok":true}');return
      }
      if(req.method==='GET'&&path==='/opencode-hi'){
        if(!published){res.writeHead(404,{'content-type':'application/json'});res.end('{"error":"not found"}');return}
        const clean={...published};delete clean._attachments
        res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(clean));return
      }
      res.writeHead(404,{'content-type':'application/json'});res.end('{"error":"not found"}')
    })
  })
  await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)})
  const addr=server.address();return{server,url:`http://127.0.0.1:${addr.port}/`,get:()=>published}
}

test('real npm registry publish/view round-trip is bound to Hi pack proof, authority, and registry integrity',async(t)=>{
  const root=resolve(process.cwd(),'..'),reg=await registry();t.after(()=>reg.server.close())
  const cfg=mkdtempSync(join(tmpdir(),'hi-npmrc-'));t.after(()=>rmSync(cfg,{recursive:true,force:true}))
  const npmrc=join(cfg,'.npmrc');writeFileSync(npmrc,`registry=${reg.url}\n//${new URL(reg.url).host}/:_authToken=hi-local-test\n`)
  const env={NPM_CONFIG_USERCONFIG:npmrc,NPM_CONFIG_CACHE:join(cfg,'cache')}
  const pack=await run('npm',['pack','--dry-run','--json','--ignore-scripts'],{cwd:root,env});assert.equal(pack.code,0,pack.stderr)
  const packJson=JSON.parse(pack.stdout);assert.equal(packJson[0].name,'opencode-hi');assert.equal(packJson[0].version,'0.1.0');assert.ok(packJson[0].integrity);assert.ok(packJson[0].shasum)

  const store=new MissionStore(root),m=store.start('real-npm','publish package');recordRemoteReleaseVerification(m,'npm pack --dry-run --json',{stdout:pack.stdout,metadata:{exit:0}},root)
  assert.doesNotThrow(()=>assertReleaseChainPrecondition(m,'npm publish',root))
  try{requireAuthority(m,'npm publish',root)}catch{};assert.equal(approvePendingAuthority(m,'approve'),true)
  const before=createToolBeforeHook(store),after=createToolAfterHook(store)
  await before({sessionID:'real-npm',tool:'bash',args:{command:'npm publish',cwd:root}},{args:{command:'npm publish',cwd:root}})
  const pub=await run('npm',['publish','--ignore-scripts','--access','public'],{cwd:root,env});assert.equal(pub.code,0,pub.stderr)
  await after({sessionID:'real-npm',tool:'bash',args:{command:'npm publish',cwd:root}},{title:'publish',output:pub.stdout+pub.stderr,metadata:{exit:0}})
  assert.equal(m.release_chain?.package?.outcome,'success');assert.equal(m.release_chain?.package?.remote_verified,false)

  const uploaded=reg.get();assert.equal(uploaded?.versions?.['0.1.0']?.dist?.integrity,packJson[0].integrity);assert.equal(uploaded?.versions?.['0.1.0']?.dist?.shasum,packJson[0].shasum)
  const view=await run('npm',['view','opencode-hi@0.1.0','--json'],{cwd:root,env});assert.equal(view.code,0,view.stderr)
  const seen=JSON.parse(view.stdout);assert.equal(seen.version,'0.1.0');assert.equal(seen.dist.integrity,packJson[0].integrity);assert.equal(seen.dist.shasum,packJson[0].shasum)
  recordRemoteReleaseVerification(m,'npm view opencode-hi@0.1.0 --json',{stdout:view.stdout,metadata:{exit:0}},root)
  assert.equal(m.release_chain?.package?.remote_verified,true)
  assert.ok(!m.blockers.includes('release-chain:package-remote-unverified'))
})
