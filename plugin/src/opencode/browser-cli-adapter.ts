import {createHash} from 'node:crypto'
import {browserObservationId,type BrowserObservationAction,type BrowserObservationContract} from '../contracts/browser-observation.js'
import type {BrowserCommandRunner,BrowserExecutionContext,BrowserExecutor,BrowserInspectRequest,BrowserTarget,BrowserWaitRequest} from '../runtime/browser/executor.js'

export interface BrowserCliAdapterOptions{
  runner:BrowserCommandRunner
  cwd:string
  executable?:string
  session_id:string
  allowed_origins:readonly string[]
  timeout_ms?:number
}

const MAX_OUTPUT=4000
function bounded(value:string,max=MAX_OUTPUT):string{return value.length<=max?value:value.slice(0,max)}
function validTarget(value:string):boolean{return /^@e\d{1,6}$/.test(value)}
function safeUrl(value:string,allowed:ReadonlySet<string>):string{
  let u:URL
  try{u=new URL(value)}catch{throw new Error('Browser URL must be absolute http(s)')}
  if(!['http:','https:'].includes(u.protocol))throw new Error('Browser URL must use http(s)')
  if(!allowed.has(u.origin))throw new Error(`Browser target origin is outside configured scope: ${u.origin}`)
  u.username='';u.password=''
  return u.toString()
}
function documentIdentity(text:string):string{return createHash('sha256').update(text).digest('hex')}

export class BrowserCliAdapter implements BrowserExecutor{
  private readonly runner:BrowserCommandRunner
  private readonly cwd:string
  private readonly executable:string
  private readonly sessionId:string
  private readonly allowedOrigins:ReadonlySet<string>
  private readonly timeoutMs:number
  private currentUrl?:string
  constructor(options:BrowserCliAdapterOptions){
    if(!options.session_id.trim()||options.session_id.length>160)throw new Error('Browser session_id is required and bounded')
    if(!options.allowed_origins.length)throw new Error('Browser allowed_origins cannot be empty')
    this.runner=options.runner;this.cwd=options.cwd;this.executable=options.executable??'agent-browser';this.sessionId=options.session_id;this.timeoutMs=options.timeout_ms??30000
    this.allowedOrigins=new Set(options.allowed_origins.map(x=>new URL(x).origin))
  }
  private async command(context:BrowserExecutionContext,action:BrowserObservationAction,args:string[],url:string,successSummary?:string):Promise<BrowserObservationContract>{
    const timestamp=Date.now()
    const r=await this.runner.run([this.executable,...args],{cwd:this.cwd,timeout_ms:this.timeoutMs,env:{AGENT_BROWSER_SESSION:this.sessionId}})
    const raw=bounded((r.stdout||r.stderr||'').trim())
    const ok=r.exit_code===0
    const result=ok?'OBSERVED':'FAILED' as const
    const obs:BrowserObservationContract={
      observation_id:'',task_id:context.task_id,executor_version:context.executor_version,url,action,timestamp,
      ...(ok?{document_identity:documentIdentity(raw||successSummary||action),dom_summary:bounded(raw||successSummary||action)}:{}),
      console_errors:[],network_errors:ok?[]:[bounded(r.stderr||r.stdout||`browser command exited ${r.exit_code}`,1000)],
      ...(action==='screenshot'&&ok&&context.screenshot_artifact_ref?{screenshot_artifact_ref:context.screenshot_artifact_ref}:{}),
      result
    }
    if(action==='screenshot'&&ok&&!context.screenshot_artifact_ref){obs.result='FAILED';obs.document_identity=undefined;obs.dom_summary=undefined;obs.network_errors=['screenshot output requires canonical artifact binding before observation can succeed']}
    obs.observation_id=browserObservationId(obs)
    return obs
  }
  async health():Promise<{available:boolean;version?:string;reason?:string}>{
    const r=await this.runner.run([this.executable,'--version'],{cwd:this.cwd,timeout_ms:5000,env:{AGENT_BROWSER_SESSION:this.sessionId}})
    const text=bounded((r.stdout||r.stderr||'').trim(),160)
    return r.exit_code===0?{available:true,version:text||'observed'}:{available:false,reason:text||`exit ${r.exit_code}`}
  }
  async open(c:BrowserExecutionContext,url:string){const u=safeUrl(url,this.allowedOrigins);const o=await this.command(c,'open',['open',u],u);if(o.result==='OBSERVED')this.currentUrl=u;return o}
  async navigate(c:BrowserExecutionContext,url:string){const u=safeUrl(url,this.allowedOrigins);const o=await this.command(c,'navigate',['navigate',u],u);if(o.result==='OBSERVED')this.currentUrl=u;return o}
  async click(c:BrowserExecutionContext,target:BrowserTarget){if(!this.currentUrl)throw new Error('Browser session has no active URL');if(!validTarget(target.value))throw new Error('Browser click target must be an observed @eN reference');return this.command(c,'click',['click',target.value],this.currentUrl)}
  async type(c:BrowserExecutionContext,target:BrowserTarget,value:string){if(!this.currentUrl)throw new Error('Browser session has no active URL');if(!validTarget(target.value))throw new Error('Browser type target must be an observed @eN reference');if(!value||value.length>2000)throw new Error('Browser type value is required and bounded');return this.command(c,'type',['type',target.value,value],this.currentUrl)}
  async inspect(c:BrowserExecutionContext,request:BrowserInspectRequest={}){if(!this.currentUrl)throw new Error('Browser session has no active URL');if(request.selector)throw new Error('Browser CLI adapter does not claim selector-scoped inspect support');return this.command(c,'inspect',['snapshot'],this.currentUrl)}
  async screenshot(c:BrowserExecutionContext){if(!this.currentUrl)throw new Error('Browser session has no active URL');return this.command(c,'screenshot',['screenshot'],this.currentUrl)}
  async wait(c:BrowserExecutionContext,request:BrowserWaitRequest){if(!this.currentUrl)throw new Error('Browser session has no active URL');if(!Number.isInteger(request.milliseconds)||request.milliseconds<0||request.milliseconds>30000)throw new Error('Browser wait must be 0..30000ms');return this.command(c,'wait',['wait',String(request.milliseconds)],this.currentUrl,`waited ${request.milliseconds}ms`)}
  async close(c:BrowserExecutionContext){if(!this.currentUrl)throw new Error('Browser session has no active URL');const url=this.currentUrl;const o=await this.command(c,'close',['close'],url,'browser session closed');if(o.result==='OBSERVED')this.currentUrl=undefined;return o}
}
