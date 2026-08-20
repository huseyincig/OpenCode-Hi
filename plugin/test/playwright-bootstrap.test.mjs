import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {PlaywrightBrowserBootstrap,hiPlaywrightCachePath} from '../dist/runtime/browser/bootstrap.js'
import {PlaywrightBrowserAdapter} from '../dist/opencode/playwright-browser-adapter.js'

function fixture(){const root=mkdtempSync(join(tmpdir(),'hi-pw-bootstrap-')),pkg=join(root,'node_modules','playwright-core');mkdirSync(pkg,{recursive:true});writeFileSync(join(root,'package.json'),JSON.stringify({dependencies:{'playwright-core':'1.62.1'}}));writeFileSync(join(pkg,'package.json'),JSON.stringify({version:'1.62.1'}));writeFileSync(join(pkg,'cli.js'),'// fake');return{root,pkg,cleanup:()=>rmSync(root,{recursive:true,force:true})}}

test('Hi Playwright bootstrap is pinned, project-clean and dedupes concurrent first-use install',async()=>{
  const f=fixture();let runs=0,ready=false
  try{
    const cache=join(f.root,'external-hi-cache'),bootstrap=new PlaywrightBrowserBootstrap({package_root:f.root,cache_path:cache,find_executable:()=>ready?join(cache,'chromium-fake','chrome'):undefined,run_process:async(command,args,options)=>{runs++;assert.equal(command,process.execPath);assert.deepEqual(args,[join(f.pkg,'cli.js'),'install','chromium']);assert.equal(options.cwd,f.root);assert.equal(options.env.PLAYWRIGHT_BROWSERS_PATH,cache);ready=true;return{exitCode:0,stdout:'ok',stderr:'',timedOut:false}}})
    const [a,b]=await Promise.all([bootstrap.ensure(),bootstrap.ensure()])
    assert.equal(runs,1);assert.equal(a.available,true);assert.equal(b.available,true);assert.equal(a.version,'1.62.1');assert.ok(a.executablePath)
    assert.equal((await bootstrap.ensure()).available,true);assert.equal(runs,1)
  }finally{f.cleanup()}
})

test('failed Chromium bootstrap is one-shot and never loops on unchanged resource state',async()=>{
  const f=fixture();let runs=0
  try{const bootstrap=new PlaywrightBrowserBootstrap({package_root:f.root,cache_path:join(f.root,'cache'),find_executable:()=>undefined,run_process:async()=>{runs++;return{exitCode:1,stdout:'',stderr:'network unavailable',timedOut:false}}});const a=await bootstrap.ensure(),b=await bootstrap.ensure();assert.equal(a.available,false);assert.equal(a.attempted,true);assert.match(a.reason,/network unavailable/);assert.deepEqual(b,a);assert.equal(runs,1)}finally{f.cleanup()}
})

test('adapter refreshes discovery after a lazy bootstrap creates the executable',async()=>{
  const f=fixture();let ready=false
  try{const executable=join(f.root,'cache','chromium-1','chrome-linux','chrome'),adapter=new PlaywrightBrowserAdapter({browser_cache_paths:[join(f.root,'cache')],executable_exists:p=>ready&&p===executable,load_playwright:async()=>({chromium:{}})});assert.equal((await adapter.health()).available,false);mkdirSync(join(f.root,'cache','chromium-1','chrome-linux'),{recursive:true});writeFileSync(executable,'');ready=true;assert.equal((await adapter.health()).available,true)}finally{f.cleanup()}
})

test('Hi-owned browser cache is outside the application project by default',()=>{
  const cache=hiPlaywrightCachePath('1.62.1',{...process.env,HI_BROWSER_CACHE:undefined,XDG_CACHE_HOME:undefined},'/home/tester','linux')
  assert.equal(cache,'/home/tester/.cache/opencode-hi/playwright/1.62.1')
})

test('Hi-owned browser cache honors an explicit XDG cache root without touching the application project',()=>{
  const cache=hiPlaywrightCachePath('1.62.1',{HI_BROWSER_CACHE:undefined,XDG_CACHE_HOME:'/var/tmp/xdg-hi'},'/home/tester','linux')
  assert.equal(cache,'/var/tmp/xdg-hi/opencode-hi/playwright/1.62.1')
})
