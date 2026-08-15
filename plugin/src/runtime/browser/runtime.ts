import type { BrowserExecutor,BrowserExecutionContext,BrowserInspectRequest,BrowserTarget,BrowserWaitRequest } from './executor.js'

export class BrowserRuntime{
  constructor(private readonly executor:BrowserExecutor){}
  health(){return this.executor.health()}
  open(c:BrowserExecutionContext,url:string){return this.executor.open(c,url)}
  navigate(c:BrowserExecutionContext,url:string){return this.executor.navigate(c,url)}
  click(c:BrowserExecutionContext,target:BrowserTarget){return this.executor.click(c,target)}
  type(c:BrowserExecutionContext,target:BrowserTarget,value:string){return this.executor.type(c,target,value)}
  inspect(c:BrowserExecutionContext,request?:BrowserInspectRequest){return this.executor.inspect(c,request)}
  screenshot(c:BrowserExecutionContext){return this.executor.screenshot(c)}
  wait(c:BrowserExecutionContext,request:BrowserWaitRequest){return this.executor.wait(c,request)}
  close(c:BrowserExecutionContext){return this.executor.close(c)}
  async dispose(){const x=this.executor as BrowserExecutor&{dispose?:()=>Promise<void>};if(x.dispose)await x.dispose()}
}
