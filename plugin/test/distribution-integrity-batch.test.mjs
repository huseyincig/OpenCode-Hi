import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {basename,join} from 'node:path'
import {createHash} from 'node:crypto'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import { startAssessedMission } from './helpers/semantic.mjs'
import {assertReleaseChainPrecondition,notePrivilegedReleaseOutcome,recordRemoteReleaseVerification} from '../dist/runtime/safety/release-chain.js'
import {evaluateCompletion} from '../dist/runtime/completion/evaluator.js'

const H='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const I='sha512-abc123', S='1111111111111111111111111111111111111111'
function sha(b){return createHash('sha256').update(b).digest('hex')}
function depFixture(root){const lock={lockfileVersion:3,packages:{'':{version:'2.0.10',devDependencies:{typescript:'^5.8.0'},peerDependencies:{'@opencode-ai/plugin':'>=1.14.0'}},'node_modules/@opencode-ai/plugin':{version:'1.18.16',license:'MIT'},'node_modules/typescript':{version:'5.9.3',license:'Apache-2.0',dev:true}}};writeFileSync(join(root,'plugin','package-lock.json'),JSON.stringify(lock));writeFileSync(join(root,'THIRD_PARTY_NOTICES.md'),'`@opencode-ai/plugin` MIT\n`typescript` Apache-2.0\n');const rows=[{path:'node_modules/@opencode-ai/plugin',name:'@opencode-ai/plugin',version:'1.18.16',license:'MIT',relation:'direct-peer'},{path:'node_modules/typescript',name:'typescript',version:'5.9.3',license:'Apache-2.0',relation:'direct-dev'}];const h=createHash('sha256');for(const r of rows){for(const k of ['path','name','version','license','relation']){h.update(r[k]);h.update('\0')}h.update('\n')}const digest=h.digest('hex'),sbom={schema:1,format:'Hi-SBOM',product:'OpenCode-Hi',version:'2.0.10',dependency_lock:'plugin/package-lock.json',dependency_graph_sha256:digest,component_count:2,direct_component_count:2,components:rows};const sp=join(root,'dist','SBOM-2.0.10.json');writeFileSync(sp,JSON.stringify(sbom,null,2)+'\n');return{digest,sbom:sp}}
function provenanceManifest(root,asset,version='2.0.10'){const dep=depFixture(root),files={};for(const rel of ['VERSION','package.json','plugin/package.json','CHANGELOG.md']){const path=join(root,...rel.split('/'));files[rel]=sha(readFileSync(path))}const h=createHash('sha256');for(const rel of Object.keys(files).sort()){h.update(rel+'\0');h.update(files[rel]+'\0')}return{schema:5,version,archive:basename(asset),archive_sha256:sha(readFileSync(asset)),files,provenance:{schema:1,builder:'scripts/release-build.py',deterministic_zip:true,canonical_zip_time:'2026-01-01T00:00:00Z',inputs_sha256:h.digest('hex'),input_file_count:Object.keys(files).length},supply_chain:{schema:1,dependency_lock:'plugin/package-lock.json',dependency_graph_sha256:dep.digest,component_count:2,sbom:'SBOM-2.0.10.json',sbom_sha256:sha(readFileSync(dep.sbom)),third_party_notices_sha256:sha(readFileSync(join(root,'THIRD_PARTY_NOTICES.md')))}}}
function pkgFixture(){
  const root=mkdtempSync(join(tmpdir(),'hi-publish-'));mkdirSync(join(root,'src'),{recursive:true});mkdirSync(join(root,'plugin'),{recursive:true})
  writeFileSync(join(root,'VERSION'),'2.0.10\n')
  writeFileSync(join(root,'package.json'),JSON.stringify({name:'opencode-hi',version:'2.0.10',files:['src']}))
  writeFileSync(join(root,'package-lock.json'),JSON.stringify({name:'opencode-hi',version:'2.0.10',packages:{'':{name:'opencode-hi',version:'2.0.10'}}}))
  writeFileSync(join(root,'src','index.js'),'export const v=1\n')
  const store=new MissionStore(root),m=startAssessedMission(store,'pkg','publish package',{task_kind:'release-readiness',scope:'external',risk:'authority-boundary',requested_external_actions:['package-publish']})
  const pack=[{name:'opencode-hi',version:'2.0.10,',integrity:I,shasum:S,filename:'opencode-hi-2.0.10.tgz',files:[{path:'package.json'},{path:'src/index.js'}]}]
  pack[0].version='2.0.10'
  return{root,m,pack}
}

test('package publish requires fresh pack proof and rejects surface/lock drift',()=>{
  const x=pkgFixture()
  assert.throws(()=>assertReleaseChainPrecondition(x.m,'npm publish',x.root),/package-pack-unverified/)
  recordRemoteReleaseVerification(x.m,'npm pack --dry-run --json',{stdout:JSON.stringify(x.pack),metadata:{exit:0}},x.root)
  assert.doesNotThrow(()=>assertReleaseChainPrecondition(x.m,'npm publish',x.root))
  writeFileSync(join(x.root,'src','index.js'),'export const v=2\n')
  assert.throws(()=>assertReleaseChainPrecondition(x.m,'npm publish',x.root),/package-surface-changed-after-pack/)
  writeFileSync(join(x.root,'src','index.js'),'export const v=1\n')
  writeFileSync(join(x.root,'package-lock.json'),JSON.stringify({version:'2.0.9',packages:{'':{version:'2.0.9'}}}))
  assert.throws(()=>assertReleaseChainPrecondition(x.m,'npm publish',x.root),/package-lock-version-mismatch/)
})

test('registry verification must match packed version and integrity before publish mission can complete',()=>{
  const x=pkgFixture();recordRemoteReleaseVerification(x.m,'npm pack --dry-run --json',{stdout:JSON.stringify(x.pack),metadata:{exit:0}},x.root);assertReleaseChainPrecondition(x.m,'npm publish',x.root);notePrivilegedReleaseOutcome(x.m,'npm publish','success')
  x.m.execution.obligations.forEach(o=>o.status='closed');x.m.execution.tasks=[];x.m.execution.workers=[];x.m.execution.evidence.fresh=true
  recordRemoteReleaseVerification(x.m,'npm view opencode-hi@2.0.10 --json',{stdout:JSON.stringify({name:'opencode-hi',version:'2.0.10',dist:{integrity:'sha512-wrong',shasum:S}}),metadata:{exit:0}},x.root)
  assert.equal(x.m.release.release_chain.package.remote_verified,false);assert.ok(x.m.execution.blockers.includes('release-chain:package-remote-drift'))
  assert.ok(evaluateCompletion(x.m).reasons.includes('release-chain:package-remote-unverified'))
  recordRemoteReleaseVerification(x.m,'npm view opencode-hi@2.0.10 --json',{stdout:JSON.stringify({name:'opencode-hi',version:'2.0.10',dist:{integrity:I,shasum:S}}),metadata:{exit:0}},x.root)
  assert.equal(x.m.release.release_chain.package.remote_verified,true);assert.ok(!x.m.execution.blockers.includes('release-chain:package-remote-drift'))
  assert.ok(!evaluateCompletion(x.m).reasons.includes('release-chain:package-remote-unverified'))
})

function releaseFixture(){
 const root=mkdtempSync(join(tmpdir(),'hi-assets-'));mkdirSync(join(root,'plugin'),{recursive:true});mkdirSync(join(root,'dist'),{recursive:true})
 writeFileSync(join(root,'VERSION'),'2.0.10\n');writeFileSync(join(root,'package.json'),JSON.stringify({version:'2.0.10'}));writeFileSync(join(root,'plugin','package.json'),JSON.stringify({version:'2.0.10'}));writeFileSync(join(root,'CHANGELOG.md'),'# Changelog\n\n## 2.0.10\n')
 const asset=join(root,'dist','OpenCode-Hi-2.0.10-DISTRIBUTABLE.zip'),bytes=Buffer.from('asset');writeFileSync(asset,bytes);writeFileSync(join(root,'dist','RELEASE-MANIFEST-2.0.10.json'),JSON.stringify(provenanceManifest(root,asset)))
 const m=new MissionStore(root).start('rel','create release');m.release.release_chain={push:{outcome:'success',at:Date.now(),command:'git push origin main',expected_remote:'origin',expected_ref:'refs/heads/main',local_head:H,observed_remote:'origin',observed_ref:'refs/heads/main',remote_hash:H,remote_verified:true}}
 return{root,m,asset}
}

test('release completion requires expected uploaded asset to appear in remote release asset list',()=>{
 const x=releaseFixture(),cmd=`gh release create v2.0.10 ${x.asset}`;assertReleaseChainPrecondition(x.m,cmd,x.root);notePrivilegedReleaseOutcome(x.m,cmd,'success')
 recordRemoteReleaseVerification(x.m,'gh release view v2.0.10 --json tagName,targetCommitish,assets',{stdout:JSON.stringify({tagName:'v2.0.10',targetCommitish:'main',assets:[]}),metadata:{exit:0}},x.root)
 recordRemoteReleaseVerification(x.m,'git ls-remote origin refs/tags/v2.0.10 refs/tags/v2.0.10^{}',{stdout:`${H}\trefs/tags/v2.0.10\n`,metadata:{exit:0}},x.root)
 assert.equal(x.m.release.release_chain.release.assets_verified,false);assert.equal(x.m.release.release_chain.release.remote_verified,false)
 const name=basename(x.asset);recordRemoteReleaseVerification(x.m,'gh release view v2.0.10 --json tagName,targetCommitish,assets',{stdout:JSON.stringify({tagName:'v2.0.10',targetCommitish:'main',assets:[{name,size:5}]}),metadata:{exit:0}},x.root)
 assert.equal(x.m.release.release_chain.release.assets_verified,true);assert.equal(x.m.release.release_chain.release.remote_verified,true)
})
