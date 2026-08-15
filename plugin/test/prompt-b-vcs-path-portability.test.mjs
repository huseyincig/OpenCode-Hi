import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {normalizeBoundedProjectPath,isBoundedProjectPath} from '../dist/contracts/common.js'
import {normalizeWorkerResult,isWorkerResultContract} from '../dist/contracts/worker-result.js'
import {normalizeProjectPath,observeToolBefore,observeToolAfter,addEvidence} from '../dist/runtime/evidence/evidence-runtime.js'
import {MissionStore} from '../dist/runtime/mission/mission-store.js'
import {recordStagingInspection,assertSafeGitMutation} from '../dist/runtime/safety/staging-safety.js'
import {ChildExecutionCoordinator} from '../dist/runtime/task/child-execution-coordinator.js'
import {discoverPlaywrightChromium} from '../dist/opencode/playwright-browser-adapter.js'
import {hiStateRoot,runtimeStatePath} from '../dist/runtime/storage/locations.js'
import {RuntimePersistence} from '../dist/runtime/state/persistence.js'
import {readFileSync} from 'node:fs'
import {startAssessedMission} from './helpers/semantic.mjs'

test('PROMPT B bounded repository path identity normalizes relative Windows separators and preserves UTF-8 spaces and long names',()=>{
  assert.equal(normalizeBoundedProjectPath('src\\nested\\a.ts'),'src/nested/a.ts')
  assert.equal(normalizeBoundedProjectPath('./src/a.ts'),'src/a.ts')
  assert.equal(normalizeBoundedProjectPath('docs/çok uzun klasör/日本語 file.md'),'docs/çok uzun klasör/日本語 file.md')
  assert.equal(isBoundedProjectPath('a/'.repeat(120)+'z.ts'),true)
  for(const x of ['../secret','src/../secret','/etc/passwd','C:\\Windows\\secret','C:/Windows/secret','\\\\server\\share\\x','src//a.ts','src/./a.ts',''])assert.equal(normalizeBoundedProjectPath(x),undefined,x)
})

test('PROMPT B WorkerResult cannot persist absolute or traversal changed-file ownership',()=>{
  const clean=normalizeWorkerResult({status:'DONE',summary:'x',changed_files:['src\\a.ts','../outside','/etc/passwd','C:\\tmp\\x'],scope_expansions:[{file:'src\\helper.ts',reason:'needed',necessary:true},{file:'../escape',reason:'bad',necessary:true}],evidence:[],open_issues:[],needs_context:[]})
  assert.deepEqual(clean.changed_files,['src/a.ts']);assert.deepEqual(clean.scope_expansions,[{file:'src/helper.ts',reason:'needed',necessary:true}]);assert.equal(isWorkerResultContract(clean),true)
  assert.equal(isWorkerResultContract({...clean,changed_files:['../escape']}),false)
})

test('PROMPT B project path normalization drops absolute paths outside repository instead of claiming VCS ownership',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-pb-path-root-'))
  try{
    assert.equal(normalizeProjectPath(join(root,'src','a.ts'),root),'src/a.ts')
    assert.equal(normalizeProjectPath(join(root,'..','outside.ts'),root),'')
    assert.equal(normalizeProjectPath('../outside.ts',root),'')
    assert.equal(normalizeProjectPath('src\\inside.ts',root),'src/inside.ts')
    const store=new MissionStore(root),m=startAssessedMission(store,'path-write','path write');observeToolBefore(m,'write',{filePath:join(root,'..','outside.ts')},root);assert.deepEqual(m.vcs.changed_files,[])
  }finally{rmSync(root,{recursive:true,force:true})}
})

test('PROMPT B native diff ignores unbounded host paths while retaining bounded repository paths',async()=>{
  const client={session:{diff:async()=>({data:[{file:'src\\a.ts',patch:'a'},{file:'../escape',patch:'b'},{file:'/abs/x',patch:'c'}]})}}
  const worker={session_id:'child-path'};const c=new ChildExecutionCoordinator(client);const map=await c.captureNativeDiff(worker,'final')
  assert.deepEqual(Object.keys(map),['src/a.ts']);assert.match(worker.native_state_hash,/^[a-f0-9]{64}$/)
})

test('PROMPT B staged-set inspection fails closed on unbounded path and normal commit remains bounded to exact owned set',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'stage-path','stage path');m.vcs.changed_files=['src/a.ts']
  assert.throws(()=>recordStagingInspection(m,'git diff --cached --name-only',{stdout:'src/a.ts\n../escape\n'}),/unbounded repository path/)
  recordStagingInspection(m,'git diff --cached --name-only',{stdout:'src\\a.ts\n'});assert.deepEqual(m.vcs.staging_safety.verified_files,['src/a.ts']);assert.doesNotThrow(()=>assertSafeGitMutation(m,'git commit -m "bounded"'))
})


test('PROMPT B path identity preserves case, spaces, Unicode and CRLF-separated staged names without conflation',()=>{
  assert.equal(normalizeBoundedProjectPath('SRC/A.ts'),'SRC/A.ts');assert.equal(normalizeBoundedProjectPath('src/a.ts'),'src/a.ts')
  const store=new MissionStore(),m=startAssessedMission(store,'stage-crlf','stage crlf');m.vcs.changed_files=['SRC/A.ts','docs/çalışma notu.md']
  recordStagingInspection(m,'git diff --cached --name-only',{stdout:'SRC/A.ts\r\ndocs/çalışma notu.md\r\n'})
  assert.deepEqual(m.vcs.staging_safety.verified_files,['SRC/A.ts','docs/çalışma notu.md']);assert.doesNotThrow(()=>assertSafeGitMutation(m,'git commit -m "unicode"'))
})

test('PROMPT B browser executable discovery uses env/platform cache roots and contains no host-user literal dependency',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-pb-browser-cache-')),cache=join(root,'cache'),browser=join(cache,'ms-playwright','chromium-999','chrome-linux','chrome')
  const old={HI_BROWSER_EXECUTABLE:process.env.HI_BROWSER_EXECUTABLE,PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH,XDG_CACHE_HOME:process.env.XDG_CACHE_HOME,LOCALAPPDATA:process.env.LOCALAPPDATA}
  try{
    mkdirSync(join(cache,'ms-playwright','chromium-999','chrome-linux'),{recursive:true});writeFileSync(browser,'x')
    delete process.env.HI_BROWSER_EXECUTABLE;delete process.env.PLAYWRIGHT_BROWSERS_PATH;delete process.env.LOCALAPPDATA;process.env.XDG_CACHE_HOME=cache
    assert.equal(discoverPlaywrightChromium(p=>p===browser),browser)
    process.env.HI_BROWSER_EXECUTABLE=join(root,'explicit-chrome');assert.equal(discoverPlaywrightChromium(p=>p===process.env.HI_BROWSER_EXECUTABLE),process.env.HI_BROWSER_EXECUTABLE)
    const source=readFileSync(new URL('../src/opencode/playwright-browser-adapter.ts',import.meta.url),'utf8');assert.doesNotMatch(source,/\/root\/|\/home\/node\//)
  }finally{for(const [k,v] of Object.entries(old))v===undefined?delete process.env[k]:process.env[k]=v;rmSync(root,{recursive:true,force:true})}
})

test('PROMPT B runtime state location honors explicit then XDG then LOCALAPPDATA roots without project-root or hardcoded-home dependency',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-pb-state-loc-')),project=join(root,'project'),explicit=join(root,'explicit'),xdg=join(root,'xdg'),local=join(root,'local')
  const old={OPENCODE_HI_STATE_DIR:process.env.OPENCODE_HI_STATE_DIR,XDG_STATE_HOME:process.env.XDG_STATE_HOME,LOCALAPPDATA:process.env.LOCALAPPDATA}
  try{
    process.env.OPENCODE_HI_STATE_DIR=explicit;process.env.XDG_STATE_HOME=xdg;process.env.LOCALAPPDATA=local;assert.ok(hiStateRoot(project).startsWith(explicit))
    delete process.env.OPENCODE_HI_STATE_DIR;assert.ok(hiStateRoot(project).startsWith(xdg))
    delete process.env.XDG_STATE_HOME;assert.ok(hiStateRoot(project).startsWith(local));assert.equal(runtimeStatePath(project).startsWith(project),false)
  }finally{for(const [k,v] of Object.entries(old))v===undefined?delete process.env[k]:process.env[k]=v;rmSync(root,{recursive:true,force:true})}
})

test('PROMPT B verification command that may mutate files invalidates earlier Evidence before recording the new verification result',()=>{
  const store=new MissionStore(),m=startAssessedMission(store,'verify-mutates','verification mutation');addEvidence(m,{kind:'targeted-tests',summary:'old pass',scope:['src/a.ts'],source:'test',pass:true,outcome:'passed'});assert.equal(m.execution.evidence.fresh,true)
  observeToolBefore(m,'bash',{command:'npm run build'},process.cwd());assert.equal(m.execution.evidence.fresh,false);assert.ok(m.execution.evidence.items[0].invalidated_at)
  observeToolAfter(m,'bash',{command:'npm run build'},{stdout:'ok',metadata:{exit:0}},process.cwd());assert.equal(m.execution.evidence.items.at(-1).kind,'build');assert.equal(m.execution.evidence.items.at(-1).outcome,'passed')
})

test('PROMPT B unusable runtime state root fails visibly rather than silently claiming persistence',()=>{
  const root=mkdtempSync(join(tmpdir(),'hi-pb-state-denied-')),notDir=join(root,'not-a-directory'),old=process.env.OPENCODE_HI_STATE_DIR
  try{writeFileSync(notDir,'file');process.env.OPENCODE_HI_STATE_DIR=notDir;const p=new RuntimePersistence(join(root,'project'));assert.throws(()=>p.save([],true),/ENOTDIR|not a directory/i)}finally{old===undefined?delete process.env.OPENCODE_HI_STATE_DIR:process.env.OPENCODE_HI_STATE_DIR=old;rmSync(root,{recursive:true,force:true})}
})
