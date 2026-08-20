import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync,spawnSync} from 'node:child_process'
import {mkdtempSync,mkdirSync,readFileSync,rmSync,statSync,symlinkSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {fileURLToPath} from 'node:url'

const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)))
const CLI=join(ROOT,'scripts','opencode-hi.mjs')

function project(){return mkdtempSync(join(tmpdir(),'hi-node-setup-'))}
function run(...args){
  const r=spawnSync(process.execPath,[CLI,...args],{encoding:'utf8'})
  let json
  try{json=JSON.parse(r.stdout)}catch{assert.fail(`CLI did not return JSON: rc=${r.status}\nstdout=${r.stdout}\nstderr=${r.stderr}`)}
  return{...r,json}
}
function config(root,value={}){writeFileSync(join(root,'opencode.json'),JSON.stringify(value,null,2)+'\n')}


test('M16 Node setup preserves foreign OpenCode config and writes exact owned registration without project node_modules',()=>{
  const root=project();try{
    config(root,{plugin:['foreign-plugin@9.1.0'],enabled_providers:['opencode','deepseek'],unknown_user_field:{keep:true}})
    const r=run('setup',root,'--version','9.8.7')
    assert.equal(r.status,0);assert.equal(r.json.status,'APPLIED');assert.equal(r.json.plugin_spec,'opencode-hi@9.8.7')
    const d=JSON.parse(readFileSync(join(root,'opencode.json'),'utf8'))
    assert.deepEqual(d.plugin,['foreign-plugin@9.1.0','opencode-hi@9.8.7'])
    assert.deepEqual(d.enabled_providers,['opencode','deepseek']);assert.deepEqual(d.unknown_user_field,{keep:true})
    const ownPath=join(root,'.opencode','hi','provenance','setup.json'),own=JSON.parse(readFileSync(ownPath,'utf8'))
    assert.equal(own.schema,2);assert.equal(own.plugin_spec,'opencode-hi@9.8.7');assert.equal(own.preserved.user_plugins,true)
    if(process.platform!=='win32')assert.equal(statSync(ownPath).mode&0o777,0o600)
    assert.throws(()=>readFileSync(join(root,'package-lock.json')))
    assert.throws(()=>statSync(join(root,'node_modules')))
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('M16 Node setup is idempotent and update changes only the owned Hi spec',()=>{
  const root=project();try{
    config(root,{plugin:['foreign@1'],enabled_providers:['deepseek'],custom:{x:1}})
    assert.equal(run('setup',root,'--version','1.0.0').json.status,'APPLIED')
    const second=run('setup',root,'--version','1.0.0');assert.equal(second.status,0);assert.equal(second.json.status,'NOOP')
    const up=run('update',root,'--version','1.0.1');assert.equal(up.status,0);assert.equal(up.json.status,'APPLIED')
    const d=JSON.parse(readFileSync(join(root,'opencode.json'),'utf8'))
    assert.deepEqual(d,{plugin:['foreign@1','opencode-hi@1.0.1'],enabled_providers:['deepseek'],custom:{x:1}})
    const rb=run('rollback',root);assert.equal(rb.status,0);assert.equal(rb.json.status,'APPLIED')
    assert.deepEqual(JSON.parse(readFileSync(join(root,'opencode.json'),'utf8')).plugin,['foreign@1','opencode-hi@1.0.0'])
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('M16 Node setup fails closed on malformed JSON and never rewrites it',()=>{
  const root=project();try{
    const path=join(root,'opencode.json'),bad='{not-json';writeFileSync(path,bad)
    const r=run('setup',root);assert.equal(r.status,2);assert.equal(r.json.status,'BLOCKED');assert.equal(r.json.reason,'invalid-json-input')
    assert.equal(readFileSync(path,'utf8'),bad)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('M16 Node setup fails closed on JSONC instead of dropping comments',()=>{
  const root=project();try{
    const path=join(root,'opencode.jsonc'),text='{\n  // keep me\n  "plugin": []\n}\n';writeFileSync(path,text)
    const r=run('setup',root);assert.equal(r.status,2);assert.equal(r.json.reason,'jsonc-safe-mutation-not-supported')
    assert.equal(readFileSync(path,'utf8'),text)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('M16 Node update refuses user-owned or drifted registrations without ownership proof',()=>{
  const root=project();try{
    config(root,{plugin:['opencode-hi@1.0.0']})
    const r=run('update',root,'--version','1.0.1');assert.equal(r.status,2);assert.equal(r.json.reason,'ownership-proof-missing')
    assert.deepEqual(JSON.parse(readFileSync(join(root,'opencode.json'),'utf8')).plugin,['opencode-hi@1.0.0'])
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('M16 Node doctor distinguishes package registration truth from pending effective runtime routing',()=>{
  const root=project();try{
    config(root,{plugin:[]});assert.equal(run('setup',root,'--version','1.0.0').status,0)
    const d=run('doctor',root);assert.equal(d.status,0);assert.equal(d.json.status,'WARN')
    assert.ok(d.json.warnings.includes('routing-policy-pending-effective-runtime'))
    assert.match(d.json.note,/Effective provider\/model capability truth/)
    assert.ok(d.json.actions.some(x=>x.includes('Restart OpenCode')))
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('M16 Node managed-state symlink escape is rejected when the platform permits symlink creation',t=>{
  const root=project(),outside=project();try{
    config(root,{plugin:[]});mkdirSync(join(root,'.opencode'),{recursive:true})
    try{symlinkSync(outside,join(root,'.opencode','hi'),'dir')}catch(error){t.skip(`symlink unavailable: ${error.code??error}`);return}
    const r=run('setup',root);assert.equal(r.status,2);assert.equal(r.json.reason,'managed-path-escapes-project-or-uses-symlink')
  }finally{rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true})}
})

test('M16 package-runner help is Node-native and exposes setup/update/doctor normal path',()=>{
  const out=execFileSync(process.execPath,[CLI,'--help'],{encoding:'utf8'})
  assert.match(out,/npx opencode-hi setup/);assert.match(out,/npx opencode-hi update/);assert.match(out,/npx opencode-hi doctor/)
  assert.doesNotMatch(out,/python3/)
})
