import {spawn} from 'node:child_process'
import {existsSync,mkdirSync,readFileSync} from 'node:fs'
import {homedir,platform} from 'node:os'
import {dirname,join,resolve} from 'node:path'
import {discoverChromiumInRoots} from './discovery.js'
import {projectOperationalToolImplementationRoot} from '../storage/ownership.js'
import {discoverOperationalToolOnPath} from '../tools/provisioning.js'

export interface BrowserBootstrapRunResult{exitCode:number|null;stdout:string;stderr:string;timedOut:boolean}
export interface BrowserBootstrapResult{available:boolean;attempted:boolean;cachePath:string;version?:string;executablePath?:string;reason?:string}
export interface PlaywrightBrowserBootstrapOptions{
  package_root:string
  project_root?:string
  cache_path?:string
  timeout_ms?:number
  run_process?:(command:string,args:string[],options:{cwd:string;env:Record<string,string|undefined>;timeoutMs:number})=>Promise<BrowserBootstrapRunResult>
  package_json_path?:string
  cli_path?:string
  node_executable?:string
  find_executable?:(cachePath:string)=>string|undefined
}
function bounded(text:string,max=8000):string{return text.length<=max?text:text.slice(text.length-max)}
export function configuredPlaywrightCoreVersion(packageRoot:string):string|undefined{
  try{const p=JSON.parse(readFileSync(join(packageRoot,'package.json'),'utf8')),raw=p?.dependencies?.['playwright-core']??p?.optionalDependencies?.['playwright-core'];return typeof raw==='string'&&/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(raw)?raw:undefined}catch{return undefined}
}
export function hiPlaywrightCachePath(version:string,env:Record<string,string|undefined>=process.env,home=homedir(),os=platform()):string{
  if(env.HI_BROWSER_CACHE?.trim())return resolve(env.HI_BROWSER_CACHE.trim(),version)
  if(os==='win32')return join(env.LOCALAPPDATA?.trim()||join(home,'AppData','Local'),'opencode-hi','playwright',version)
  if(os==='darwin')return join(home,'Library','Caches','opencode-hi','playwright',version)
  return join(env.XDG_CACHE_HOME?.trim()||join(home,'.cache'),'opencode-hi','playwright',version)
}
function locatePlaywrightCore(packageRoot:string,packageJsonOverride?:string,cliOverride?:string):{packageJson:string;cli:string}|undefined{
  if(packageJsonOverride&&cliOverride)return{packageJson:packageJsonOverride,cli:cliOverride}
  const direct:string[]=[];let cursor=packageRoot
  for(let i=0;i<5;i++){direct.push(join(cursor,'node_modules','playwright-core','package.json'));direct.push(join(cursor,'playwright-core','package.json'));const parent=dirname(cursor);if(parent===cursor)break;cursor=parent}
  const packageJson=packageJsonOverride??[...new Set(direct)].find(existsSync)
  if(!packageJson)return undefined
  const cli=cliOverride??join(dirname(packageJson),'cli.js')
  return existsSync(cli)?{packageJson,cli}:undefined
}
async function runBounded(command:string,args:string[],options:{cwd:string;env:Record<string,string|undefined>;timeoutMs:number}):Promise<BrowserBootstrapRunResult>{
  return new Promise(resolveRun=>{
    let stdout='',stderr='',settled=false,timer:ReturnType<typeof setTimeout>|undefined
    const child=spawn(command,args,{cwd:options.cwd,env:options.env,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']})
    const finish=(exitCode:number|null,timedOut:boolean)=>{if(settled)return;settled=true;if(timer)clearTimeout(timer);resolveRun({exitCode,stdout:bounded(stdout),stderr:bounded(stderr),timedOut})}
    child.stdout?.on('data',chunk=>{stdout=bounded(stdout+String(chunk))});child.stderr?.on('data',chunk=>{stderr=bounded(stderr+String(chunk))})
    child.once('error',error=>{stderr=bounded(stderr+String(error));finish(null,false)})
    child.once('close',code=>finish(code,false))
    timer=setTimeout(()=>{try{child.kill('SIGTERM')}catch{};finish(null,true)},options.timeoutMs)
  })
}

/** One-shot, process-local, Hi-owned Chromium bootstrap. Never mutates the application project. */
export class PlaywrightBrowserBootstrap{
  readonly packageRoot:string
  readonly version?:string
  readonly cachePath:string
  readonly #timeoutMs:number
  readonly #run:NonNullable<PlaywrightBrowserBootstrapOptions['run_process']>
  readonly #packageJsonOverride?:string
  readonly #cliOverride?:string
  readonly #nodeExecutable?:string
  readonly #findExecutable:(cachePath:string)=>string|undefined
  #attempt?:Promise<BrowserBootstrapResult>
  #last?:BrowserBootstrapResult
  constructor(options:PlaywrightBrowserBootstrapOptions){
    this.packageRoot=resolve(options.package_root);this.version=configuredPlaywrightCoreVersion(this.packageRoot);this.cachePath=options.cache_path??(options.project_root?join(projectOperationalToolImplementationRoot(options.project_root,'browser-execution','playwright-chromium'),this.version??'unresolved'):hiPlaywrightCachePath(this.version??'unresolved'));this.#timeoutMs=Math.min(Math.max(options.timeout_ms??300_000,10_000),600_000);this.#run=options.run_process??runBounded;this.#packageJsonOverride=options.package_json_path;this.#cliOverride=options.cli_path;this.#nodeExecutable=options.node_executable??discoverOperationalToolOnPath('node');this.#findExecutable=options.find_executable??(cache=>discoverChromiumInRoots([cache]))
  }
  status():BrowserBootstrapResult|undefined{return this.#last?{...this.#last}:undefined}
  discover():string|undefined{return this.version?this.#findExecutable(this.cachePath):undefined}
  async ensure():Promise<BrowserBootstrapResult>{
    const existing=this.version?this.#findExecutable(this.cachePath):undefined
    if(existing){const ready={available:true,attempted:false,cachePath:this.cachePath,version:this.version,executablePath:existing};this.#last=ready;return{...ready}}
    if(this.#last?.attempted&&!this.#last.available)return{...this.#last}
    if(this.#attempt)return{...await this.#attempt}
    this.#attempt=this.#runOnce();try{return{...await this.#attempt}}finally{this.#attempt=undefined}
  }
  async #runOnce():Promise<BrowserBootstrapResult>{
    if(!this.version){return this.#remember({available:false,attempted:false,cachePath:this.cachePath,reason:'playwright-core exact runtime version is not configured'})}
    const located=locatePlaywrightCore(this.packageRoot,this.#packageJsonOverride,this.#cliOverride)
    if(!located)return this.#remember({available:false,attempted:false,cachePath:this.cachePath,version:this.version,reason:'playwright-core runtime package/CLI is unavailable'})
    if(!this.#nodeExecutable)return this.#remember({available:false,attempted:false,cachePath:this.cachePath,version:this.version,reason:'Node.js runtime is unavailable for Playwright CLI bootstrap'})
    let actual:string|undefined;try{actual=JSON.parse(readFileSync(located.packageJson,'utf8'))?.version}catch{}
    if(actual!==this.version)return this.#remember({available:false,attempted:false,cachePath:this.cachePath,version:this.version,reason:`playwright-core version mismatch: configured=${this.version}; installed=${actual??'unknown'}`})
    mkdirSync(this.cachePath,{recursive:true})
    const result=await this.#run(this.#nodeExecutable,[located.cli,'install','chromium'],{cwd:this.packageRoot,env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:this.cachePath},timeoutMs:this.#timeoutMs})
    if(result.timedOut)return this.#remember({available:false,attempted:true,cachePath:this.cachePath,version:this.version,reason:'playwright chromium bootstrap timed out'})
    if(result.exitCode!==0)return this.#remember({available:false,attempted:true,cachePath:this.cachePath,version:this.version,reason:`playwright chromium bootstrap failed: ${bounded(result.stderr||result.stdout||`exit ${result.exitCode}`,1200)}`})
    const executable=this.#findExecutable(this.cachePath)
    if(!executable)return this.#remember({available:false,attempted:true,cachePath:this.cachePath,version:this.version,reason:'playwright chromium bootstrap completed but no matching executable was discovered'})
    return this.#remember({available:true,attempted:true,cachePath:this.cachePath,version:this.version,executablePath:executable})
  }
  #remember(result:BrowserBootstrapResult):BrowserBootstrapResult{this.#last=result;return result}
}
