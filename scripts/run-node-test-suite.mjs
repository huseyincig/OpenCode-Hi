#!/usr/bin/env node
import {mkdtempSync,mkdirSync,readFileSync,readdirSync,rmSync,writeFileSync,writeSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawnSync} from 'node:child_process'

const cwd=process.cwd()
const repositoryRoot=resolve(cwd,'..')
const testDir=resolve(cwd,'test')

// Release portability invariant: file: URLs are not filesystem paths on Windows.
// Fail locally before CI if an import.meta.url path is converted through URL.pathname
// instead of Node's platform-aware fileURLToPath().
const unsafeFileUrlPath=/new\s+URL\s*\([^;]*import\.meta\.url[^;]*\)\s*\.pathname\b/s
const portabilityFiles=[]
function collectPortabilityFiles(dir){
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    const path=resolve(dir,entry.name)
    if(entry.isDirectory()){if(!['node_modules','dist','.git'].includes(entry.name))collectPortabilityFiles(path);continue}
    if(/\.(?:ts|js|mjs|cjs|mts|cts)$/.test(entry.name))portabilityFiles.push(path)
  }
}
for(const dir of [resolve(repositoryRoot,'plugin','src'),resolve(repositoryRoot,'plugin','test'),resolve(repositoryRoot,'scripts')])collectPortabilityFiles(dir)
const unsafePathFiles=portabilityFiles.filter(path=>unsafeFileUrlPath.test(readFileSync(path,'utf8')))
if(unsafePathFiles.length){
  console.error('OpenCode-Hi portability guard: use fileURLToPath() instead of URL.pathname for import.meta.url filesystem paths:')
  for(const path of unsafePathFiles)console.error(`- ${path}`)
  process.exit(2)
}
const files=readdirSync(testDir).filter(x=>x.endsWith('.test.mjs')).sort().map(x=>join('test',x))
if(files.length===0){console.error('OpenCode-Hi test harness: no test/*.test.mjs files found');process.exit(2)}
const sandbox=mkdtempSync(join(tmpdir(),'opencode-hi-test-env-'))
for(const d of ['hi-state','xdg-state','xdg-cache','xdg-config','localappdata'])mkdirSync(join(sandbox,d),{recursive:true})
const gitGlobal=join(sandbox,'gitconfig')
writeFileSync(gitGlobal,'')
// Test-created repositories must not inherit a developer/runner Git EOL policy.
// Git command-scope config overrides system/global/local files, making LF-sensitive
// VCS fixtures deterministic on Windows and POSIX without changing product behavior.
const env={...process.env,
  OPENCODE_HI_STATE_DIR:join(sandbox,'hi-state'),
  XDG_STATE_HOME:join(sandbox,'xdg-state'),
  XDG_CACHE_HOME:join(sandbox,'xdg-cache'),
  XDG_CONFIG_HOME:join(sandbox,'xdg-config'),
  GIT_CONFIG_NOSYSTEM:'1',
  GIT_CONFIG_GLOBAL:gitGlobal,
  GIT_CONFIG_COUNT:'2',
  GIT_CONFIG_KEY_0:'core.autocrlf',
  GIT_CONFIG_VALUE_0:'false',
  GIT_CONFIG_KEY_1:'core.eol',
  GIT_CONFIG_VALUE_1:'lf',
}
if(process.platform==='win32')env.LOCALAPPDATA=join(sandbox,'localappdata')
let result
try{
  result=spawnSync(process.execPath,['--test','--test-timeout=120000',...files],{cwd,env,encoding:'utf8',maxBuffer:64*1024*1024,timeout:300000,killSignal:'SIGTERM'})
  if(result.stdout)writeSync(1,result.stdout)
  if(result.stderr)writeSync(2,result.stderr)
}finally{
  rmSync(sandbox,{recursive:true,force:true})
}
const summaryText=result?.stdout??''
const testsMatch=/ℹ tests (\d+)(?:\r?\n|$)/.exec(summaryText),passMatch=/ℹ pass (\d+)(?:\r?\n|$)/.exec(summaryText),failMatch=/ℹ fail (\d+)(?:\r?\n|$)/.exec(summaryText),cancelMatch=/ℹ cancelled (\d+)(?:\r?\n|$)/.exec(summaryText)
if(testsMatch&&passMatch&&failMatch&&cancelMatch)console.log(`HI_NODE_TEST_SUMMARY tests=${testsMatch[1]} pass=${passMatch[1]} fail=${failMatch[1]} cancelled=${cancelMatch[1]}`)
const knownLibuvTeardown=result?.signal==='SIGABRT'&&/uv__io_poll: Assertion `errno == EEXIST' failed/.test(result.stderr??'')&&/ℹ fail 0(?:\r?\n|$)/.test(result.stdout??'')&&/ℹ cancelled 0(?:\r?\n|$)/.test(result.stdout??'')
if(knownLibuvTeardown){console.error('OpenCode-Hi test harness: ignored known Node 24.19.0 libuv teardown after terminal zero-failure summary');process.exit(0)}
if(result?.error){console.error(result.error);process.exit(2)}
if(result?.signal){console.error(`OpenCode-Hi test harness: test process terminated by ${result.signal}`);process.exit(1)}
process.exit(result?.status??1)
