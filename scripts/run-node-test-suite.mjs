#!/usr/bin/env node
import {mkdtempSync,mkdirSync,readdirSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawnSync} from 'node:child_process'

const cwd=process.cwd()
const testDir=resolve(cwd,'test')
const files=readdirSync(testDir).filter(x=>x.endsWith('.test.mjs')).sort().map(x=>join('test',x))
if(files.length===0){console.error('OpenCode-Hi test harness: no test/*.test.mjs files found');process.exit(2)}
const sandbox=mkdtempSync(join(tmpdir(),'opencode-hi-test-env-'))
for(const d of ['hi-state','xdg-state','xdg-cache','xdg-config','localappdata'])mkdirSync(join(sandbox,d),{recursive:true})
const env={...process.env,
  OPENCODE_HI_STATE_DIR:join(sandbox,'hi-state'),
  XDG_STATE_HOME:join(sandbox,'xdg-state'),
  XDG_CACHE_HOME:join(sandbox,'xdg-cache'),
  XDG_CONFIG_HOME:join(sandbox,'xdg-config'),
}
if(process.platform==='win32')env.LOCALAPPDATA=join(sandbox,'localappdata')
let result
try{
  result=spawnSync(process.execPath,['--test','--test-timeout=120000',...files],{cwd,env,encoding:'utf8',maxBuffer:64*1024*1024,timeout:300000,killSignal:'SIGTERM'})
  if(result.stdout)process.stdout.write(result.stdout)
  if(result.stderr)process.stderr.write(result.stderr)
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
