import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync,spawn,spawnSync} from 'node:child_process'
import {mkdtempSync,mkdirSync,readFileSync,rmSync,statSync,symlinkSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {fileURLToPath} from 'node:url'
import {createServer} from 'node:http'

const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)))
const CLI=join(ROOT,'scripts','opencode-hi.mjs')

function project(){return mkdtempSync(join(tmpdir(),'hi-node-setup-'))}
function run(...args){
  const r=spawnSync(process.execPath,[CLI,...args],{encoding:'utf8'})
  let json
  try{json=JSON.parse(r.stdout)}catch{assert.fail(`CLI did not return JSON: rc=${r.status}\nstdout=${r.stdout}\nstderr=${r.stderr}`)}
  return{...r,json}
}
async function runAsync(args,{env=process.env}={}){
  const child=spawn(process.execPath,[CLI,...args],{env,stdio:['ignore','pipe','pipe']});let stdout='',stderr=''
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x)
  const status=await new Promise(resolve=>child.once('close',resolve));let json
  try{json=JSON.parse(stdout)}catch{assert.fail(`CLI did not return JSON: rc=${status}\nstdout=${stdout}\nstderr=${stderr}`)}
  return{status,stdout,stderr,json}
}
function config(root,value={}){writeFileSync(join(root,'opencode.json'),JSON.stringify(value,null,2)+'\n')}


test('Node setup preserves foreign OpenCode config and writes exact owned registration without project node_modules',()=>{
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
    assert.throws(()=>statSync(join(root,'.opencode','hi','policy','routing.json')),'non-TTY setup must leave runtime-ranked routing initialization pending')
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('Node setup is idempotent and update changes only the owned Hi spec',()=>{
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

test('Node setup fails closed on malformed JSON and never rewrites it',()=>{
  const root=project();try{
    const path=join(root,'opencode.json'),bad='{not-json';writeFileSync(path,bad)
    const r=run('setup',root);assert.equal(r.status,2);assert.equal(r.json.status,'BLOCKED');assert.equal(r.json.reason,'invalid-json-input')
    assert.equal(readFileSync(path,'utf8'),bad)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('Node setup fails closed on JSONC instead of dropping comments',()=>{
  const root=project();try{
    const path=join(root,'opencode.jsonc'),text='{\n  // keep me\n  "plugin": []\n}\n';writeFileSync(path,text)
    const r=run('setup',root);assert.equal(r.status,2);assert.equal(r.json.reason,'jsonc-safe-mutation-not-supported')
    assert.equal(readFileSync(path,'utf8'),text)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('Node update refuses user-owned or drifted registrations without ownership proof',()=>{
  const root=project();try{
    config(root,{plugin:['opencode-hi@1.0.0']})
    const r=run('update',root,'--version','1.0.1');assert.equal(r.status,2);assert.equal(r.json.reason,'ownership-proof-missing')
    assert.deepEqual(JSON.parse(readFileSync(join(root,'opencode.json'),'utf8')).plugin,['opencode-hi@1.0.0'])
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('Node doctor distinguishes package registration truth from pending effective runtime routing',()=>{
  const root=project();try{
    config(root,{plugin:[]});assert.equal(run('setup',root,'--version','1.0.0').status,0)
    const d=run('doctor',root);assert.equal(d.status,0);assert.equal(d.json.status,'WARN')
    assert.ok(d.json.warnings.includes('settings-policy-not-yet-persisted'));assert.equal(d.json.routing.initialization,'automatic-unpersisted')
    assert.match(d.json.note,/Effective provider\/model capability truth/)
    assert.ok(d.json.actions.some(x=>x.includes('Adaptive + Automatic')&&x.includes('hi_settings')))
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('Node managed-state symlink escape is rejected when the platform permits symlink creation',t=>{
  const root=project(),outside=project();try{
    config(root,{plugin:[]});mkdirSync(join(root,'.opencode'),{recursive:true})
    try{symlinkSync(outside,join(root,'.opencode','hi'),'dir')}catch(error){t.skip(`symlink unavailable: ${error.code??error}`);return}
    const r=run('setup',root);assert.equal(r.status,2);assert.equal(r.json.reason,'managed-path-escapes-project-or-uses-symlink')
  }finally{rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true})}
})

test('package-runner help is Node-native and exposes setup/update/doctor normal path',()=>{
  const out=execFileSync(process.execPath,[CLI,'--help'],{encoding:'utf8'})
  assert.match(out,/npx opencode-hi setup/);assert.match(out,/npx opencode-hi reconfigure/);assert.match(out,/--non-interactive/);assert.match(out,/npx opencode-hi update/);assert.match(out,/npx opencode-hi doctor/);for(const cmd of ['state','reprofile','roles','rotate','check-update'])assert.match(out,new RegExp(`npx opencode-hi ${cmd}`))
  assert.doesNotMatch(out,/python3/)
})


test('0.2.4 friendly install ensures an owned registration while setup remains strict first-install',()=>{
  const root=project();try{
    config(root,{plugin:['foreign@1'],custom:{keep:true}})
    const first=run('install',root,'--version','1.0.0');assert.equal(first.status,0);assert.equal(first.json.status,'APPLIED');assert.equal(first.json.operation,'install')
    const ensured=run('install',root,'--version','1.0.1');assert.equal(ensured.status,0);assert.equal(ensured.json.status,'APPLIED');assert.equal(ensured.json.operation,'upgrade');assert.equal(ensured.json.from_plugin_spec,'opencode-hi@1.0.0');assert.equal(ensured.json.to_plugin_spec,'opencode-hi@1.0.1')
    assert.deepEqual(JSON.parse(readFileSync(join(root,'opencode.json'),'utf8')),{plugin:['foreign@1','opencode-hi@1.0.1'],custom:{keep:true}})
    const strict=run('setup',root,'--version','1.0.2');assert.equal(strict.status,2);assert.equal(strict.json.reason,'existing-owned-install-use-update')
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('0.2.4 state is read-only and reprofile changes only executionPolicy',()=>{
  const root=project();try{
    config(root,{plugin:[]});assert.equal(run('install',root,'--version','1.0.0').status,0)
    const routing=join(root,'.opencode','hi','policy','routing.json');mkdirSync(join(root,'.opencode','hi','policy'),{recursive:true});writeFileSync(routing,JSON.stringify({schema:1,type:'hi-routing',executionPolicy:'minimal',foreignTop:{keep:true},routing:{strategy:'quality',futureField:{keep:true}}},null,2)+'\n')
    const before=readFileSync(routing,'utf8'),state=run('state',root);assert.equal(state.status,0);assert.equal(state.json.package_runner_version,'0.2.4');assert.equal(state.json.registered_plugin_spec,'opencode-hi@1.0.0');assert.equal(state.json.routing.execution_policy,'minimal');assert.equal(readFileSync(routing,'utf8'),before)
    const changed=run('reprofile',root,'--profile','adaptive');assert.equal(changed.status,0);assert.equal(changed.json.status,'APPLIED');assert.equal(changed.json.to_execution_policy,'adaptive')
    const doc=JSON.parse(readFileSync(routing,'utf8'));assert.equal(doc.executionPolicy,'adaptive');assert.deepEqual(doc.foreignTop,{keep:true});assert.equal(doc.routing.strategy,'quality');assert.deepEqual(doc.routing.futureField,{keep:true})
    assert.equal(run('reprofile',root,'--profile','adaptive').json.status,'NOOP')
    const bad=run('reprofile',root,'--profile','turbo');assert.equal(bad.status,2);assert.equal(bad.json.reason,'unsupported-execution-profile')
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('0.2.4 roles and rotate mutate only explicit child routing leaves and reject primary role ownership',()=>{
  const root=project();try{
    config(root,{plugin:[]});assert.equal(run('install',root).status,0)
    const routing=join(root,'.opencode','hi','policy','routing.json');mkdirSync(join(root,'.opencode','hi','policy'),{recursive:true});writeFileSync(routing,JSON.stringify({schema:1,type:'hi-routing',unknownTop:'keep',routing:{strategy:'cost-quality',futureField:{keep:true},roleModels:{'future-role':['future/model']},roleVariants:{'future-role':{'future/model':'x'}}}},null,2)+'\n')
    const set=run('roles',root,'--set','coder=p/a,p/b,p/c','--set','researcher=p/r','--set','technical-writer=p/docs','--set','test-engineer=p/test','--variant','coder:p/a=high');assert.equal(set.status,0);assert.equal(set.json.status,'APPLIED');assert.deepEqual(set.json.roleModels.coder,['p/a','p/b','p/c']);assert.deepEqual(set.json.roleModels.researcher,['p/r']);assert.deepEqual(set.json.roleModels['technical-writer'],['p/docs']);assert.deepEqual(set.json.roleModels['test-engineer'],['p/test']);assert.equal(set.json.roleVariants.coder['p/a'],'high')
    let doc=JSON.parse(readFileSync(routing,'utf8'));assert.equal(doc.unknownTop,'keep');assert.deepEqual(doc.routing.futureField,{keep:true});assert.deepEqual(doc.routing.roleModels['future-role'],['future/model']);assert.equal(doc.routing.roleVariants['future-role']['future/model'],'x')
    const rotated=run('rotate',root,'--role','coder');assert.equal(rotated.status,0);assert.deepEqual(rotated.json.before,['p/a','p/b','p/c']);assert.deepEqual(rotated.json.after,['p/b','p/c','p/a'])
    doc=JSON.parse(readFileSync(routing,'utf8'));assert.deepEqual(doc.routing.roleModels.coder,['p/b','p/c','p/a']);assert.deepEqual(doc.routing.roleModels['future-role'],['future/model']);assert.equal(doc.routing.roleVariants.coder['p/a'],'high')
    const primary=run('roles',root,'--set','manager=p/main');assert.equal(primary.status,2);assert.equal(primary.json.reason,'role-model-primary-owned-by-opencode')
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('config control plane shows and atomically changes work mode, limits and role preferences while preserving unknown fields',()=>{
  const root=project();try{
    config(root,{plugin:[]});assert.equal(run('install',root,'--version','1.0.0').status,0)
    const routing=join(root,'.opencode','hi','policy','routing.json');mkdirSync(join(root,'.opencode','hi','policy'),{recursive:true});writeFileSync(routing,JSON.stringify({schema:1,type:'hi-routing',unknownTop:{keep:true},execution:{topology:'adaptive',maxAgents:4,parallelism:2,future:'keep'},routing:{futureField:{keep:true},roleModels:{architect:['p/old'],'future-role':['p/future']}}},null,2)+'\n')
    const shown=run('config',root);assert.equal(shown.status,0);assert.equal(shown.json.work_mode,'adaptive');assert.equal(shown.json.execution.max_agents,4);assert.deepEqual(shown.json.role_models.architect,['p/old'])
    const changed=run('config',root,'--mode','multi','--max-agents','3','--parallelism','2','--model-pool','p/a,p/b,p/c','--set','coder=p/a,p/b','--clear-role','architect');assert.equal(changed.status,0);assert.equal(changed.json.status,'APPLIED');assert.equal(changed.json.work_mode,'multi');assert.deepEqual(changed.json.allowed_models,['p/a','p/b','p/c']);assert.deepEqual(changed.json.role_models.coder,['p/a','p/b']);assert.equal(changed.json.role_models.architect,undefined);assert.equal(changed.json.restart_required,false)
    const doc=JSON.parse(readFileSync(routing,'utf8'));assert.deepEqual(doc.unknownTop,{keep:true});assert.equal(doc.execution.future,'keep');assert.deepEqual(doc.routing.futureField,{keep:true});assert.deepEqual(doc.routing.roleModels['future-role'],['p/future'])
    const before=readFileSync(routing,'utf8'),bad=run('config',root,'--mode','single','--max-agents','99','--set','coder=p/x');assert.equal(bad.status,2);assert.equal(bad.json.reason,'invalid-execution-limit');assert.equal(readFileSync(routing,'utf8'),before)
    const single=run('config',root,'--mode','single','--max-agents','8','--parallelism','8');assert.equal(single.status,0);assert.equal(single.json.execution.max_agents,1);assert.equal(single.json.execution.parallelism,1)
    const reset=run('config',root,'--reset');assert.equal(reset.status,0);assert.equal(reset.json.work_mode,'adaptive');assert.deepEqual(reset.json.allowed_models,[]);assert.deepEqual(reset.json.role_models,{});assert.deepEqual(JSON.parse(readFileSync(routing,'utf8')).routing.roleModels['future-role'],['p/future'])
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('0.2.4 check-update uses npm registry metadata without mutating project state',async()=>{
  const root=project(),server=createServer((req,res)=>{assert.equal(req.url,'/opencode-hi/latest');res.setHeader('content-type','application/json');res.end(JSON.stringify({name:'opencode-hi',version:'1.2.0'}))})
  try{
    config(root,{plugin:[]});assert.equal(run('install',root,'--version','1.0.0').status,0);const before=readFileSync(join(root,'opencode.json'),'utf8')
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});const address=server.address();assert.ok(address&&typeof address==='object')
    const r=await runAsync(['check-update',root],{env:{...process.env,npm_config_registry:`http://127.0.0.1:${address.port}`}});assert.equal(r.status,0);assert.equal(r.json.status,'OK');assert.equal(r.json.current_version,'1.0.0');assert.equal(r.json.latest_version,'1.2.0');assert.equal(r.json.update_available,true);assert.match(r.json.recommended_command,/opencode-hi@1\.2\.0 install/);assert.equal(readFileSync(join(root,'opencode.json'),'utf8'),before)
  }finally{await new Promise(resolve=>server.close(()=>resolve()));rmSync(root,{recursive:true,force:true})}
})



async function runInteractive(args,answers){
  const child=spawn(process.execPath,[CLI,...args],{env:process.env,stdio:['pipe','pipe','pipe']});let stdout='',stderr=''
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x)
  child.stdin.end(answers.join('\n')+'\n')
  const status=await new Promise(resolve=>child.once('close',resolve));let json
  try{json=JSON.parse(stdout)}catch{assert.fail(`Interactive CLI did not return final JSON: rc=${status}\nstdout=${stdout}\nstderr=${stderr}`)}
  return{status,stdout,stderr,json}
}

test('interactive setup asks only primary mode; specialist/model policy stays internal until runtime chat configuration',async()=>{
  const root=project();try{
    config(root,{plugin:['foreign@1'],custom:{keep:true}})
    const r=await runInteractive(['setup',root,'--version','1.0.0','--interactive'],[
      '3', // manager
      'y',
    ])
    assert.equal(r.status,0);assert.equal(r.json.status,'APPLIED');assert.equal(r.json.plugin_spec,'opencode-hi@1.0.0');assert.equal(r.json.configuration.status,'APPLIED')
    assert.match(r.stderr,/Primary working mode/i);assert.doesNotMatch(r.stderr,/Task topology|Execution profile|Child model routing|Routing strategy/i)
    const doc=JSON.parse(readFileSync(join(root,'.opencode','hi','policy','routing.json'),'utf8'))
    assert.equal(doc.primaryMode,'manager');assert.equal(doc.executionPolicy,undefined);assert.equal(doc.execution,undefined);assert.equal(doc.models,undefined);assert.equal(doc.routing?.strategy,undefined)
    assert.deepEqual(JSON.parse(readFileSync(join(root,'opencode.json'),'utf8')).custom,{keep:true})
    assert.match(r.json.configuration.next,/Hi ayarlarını göster|hi_settings/i)
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('reconfigure changes only primary mode and preserves all advanced/unknown routing fields',async()=>{
  const root=project();try{
    config(root,{plugin:[]});assert.equal(run('install',root,'--version','1.0.0').status,0)
    const routing=join(root,'.opencode','hi','policy','routing.json');mkdirSync(join(root,'.opencode','hi','policy'),{recursive:true});writeFileSync(routing,JSON.stringify({schema:1,type:'hi-routing',primaryMode:'manager',executionPolicy:'minimal',unknownTop:{keep:true},execution:{topology:'single-agent',maxAgents:1,parallelism:1,future:'keep'},models:{mode:'adaptive',future:'keep'},routing:{strategy:'quality',futureField:{keep:true},roleModels:{coder:['p/a']}}},null,2)+'\n')
    const before=readFileSync(routing,'utf8')
    const cancelled=await runInteractive(['reconfigure',root,'--interactive'],['','n']);assert.equal(cancelled.status,0);assert.equal(cancelled.json.status,'CANCELLED');assert.equal(readFileSync(routing,'utf8'),before)
    const applied=await runInteractive(['reconfigure',root,'--interactive'],['2','y'])
    assert.equal(applied.status,0);assert.equal(applied.json.status,'APPLIED');assert.doesNotMatch(applied.stderr,/Task topology|Execution profile|Child model routing|Routing strategy/i)
    const doc=JSON.parse(readFileSync(routing,'utf8'));assert.equal(doc.primaryMode,'working-manager');assert.equal(doc.executionPolicy,'minimal');assert.equal(doc.execution.topology,'single-agent');assert.equal(doc.models.mode,'adaptive');assert.equal(doc.routing.strategy,'quality')
    assert.deepEqual(doc.unknownTop,{keep:true});assert.equal(doc.execution.future,'keep');assert.equal(doc.models.future,'keep');assert.deepEqual(doc.routing.futureField,{keep:true});assert.deepEqual(doc.routing.roleModels.coder,['p/a'])
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('0.2.4 release preflight can route canonical checks through an explicit Python interpreter without host-path hardcoding',t=>{
  const runner=join(ROOT,'scripts','run-python.mjs'),preflight=readFileSync(join(ROOT,'scripts','release-preflight.mjs'),'utf8'),runnerSource=readFileSync(runner,'utf8')
  assert.match(runnerSource,/OPENCODE_HI_PYTHON/)
  assert.match(preflight,/OPENCODE_HI_PYTHON/)
  assert.match(preflight,/venv-release/)
  assert.match(preflight,/git-common-dir/)
  const candidates=process.platform==='win32'?['python','python3']:['python3','python']
  const py=candidates.find(cmd=>spawnSync(cmd,['--version'],{stdio:'ignore'}).status===0)
  if(!py){t.skip('no Python interpreter available for override probe');return}
  const r=spawnSync(process.execPath,[runner,'-c',"print('HI_PY_OVERRIDE_OK')"],{cwd:ROOT,encoding:'utf8',env:{...process.env,OPENCODE_HI_PYTHON:py}})
  assert.equal(r.status,0,`${r.stdout}\n${r.stderr}`);assert.match(r.stdout,/HI_PY_OVERRIDE_OK/)
})

test('0.2.4 exact-SHA release preflight is fail-closed and contains no publication mutation command',()=>{
  const path=join(ROOT,'scripts','release-preflight.mjs'),source=readFileSync(path,'utf8')
  for(const forbidden of ['npm publish','git push','gh release create','git tag -','git tag v'])assert.equal(source.includes(forbidden),false,forbidden)
  for(const required of ["['run','check']","['run','docs:pack-check']","['pack','--dry-run','--json','--ignore-scripts']","['scripts/verify-npm-oidc-release.mjs','identity']"])assert.equal(source.includes(required),true,required)
  const verifier=readFileSync(join(ROOT,'scripts','verify-npm-oidc-release.mjs'),'utf8');assert.match(verifier,/mode==='identity'/)
  const gitSafeEnv={...process.env,GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'safe.directory',GIT_CONFIG_VALUE_0:ROOT}
  const r=spawnSync(process.execPath,[path,'--sha','0000000000000000000000000000000000000000'],{cwd:ROOT,encoding:'utf8',env:gitSafeEnv});assert.equal(r.status,2,`${r.stdout}\n${r.stderr}`);const out=JSON.parse(r.stdout);assert.equal(out.status,'BLOCKED');assert.equal(out.reason,'head-sha-mismatch');assert.equal(out.mutation_performed,false)
  assert.equal(JSON.parse(readFileSync(join(ROOT,'package.json'),'utf8')).scripts['release:preflight'],'node scripts/release-preflight.mjs')
})
