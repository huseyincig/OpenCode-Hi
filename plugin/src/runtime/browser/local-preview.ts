import {createServer,type Server} from 'node:http'
import {createReadStream,existsSync,realpathSync,statSync} from 'node:fs'
import {extname,relative,resolve,sep} from 'node:path'
import {normalizeBoundedProjectPath} from '../../contracts/common.js'

const MIME:Readonly<Record<string,string>>={'.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'}
interface PreviewLease{taskID:string;root:string;server:Server;origin:string;scope:string[]}
export interface LocalPreviewResult{task_id:string;origin:string;url:string;root:string;target:string;reused:boolean}
function within(root:string,candidate:string):boolean{const rel=relative(root,candidate);return rel===''||(!rel.startsWith(`..${sep}`)&&rel!=='..'&&!rel.startsWith('/')&&!/^[A-Za-z]:[\\/]/.test(rel))}
function safeRealRoot(root:string):string{const resolved=resolve(root);if(!existsSync(resolved)||!statSync(resolved).isDirectory())throw new Error(`Preview root is not a directory: ${resolved}`);return realpathSync(resolved)}
function scopePath(value:string):string|undefined{return normalizeBoundedProjectPath(value.trim().replace(/\/+$/,''))??undefined}
function canonicalScope(scope:string[]):string[]{return[...new Set(scope.map(scopePath).filter((x):x is string=>Boolean(x)))].sort()}
function sameScope(a:string[],b:string[]):boolean{return a.length===b.length&&a.every((value,index)=>value===b[index])}
function admittedPath(target:string,scope:string[]):boolean{const admitted=canonicalScope(scope);return !admitted.length||admitted.some(item=>target===item||target.startsWith(`${item}/`))}
function requestedTarget(raw:string,scope:string[]):string{
  const target=normalizeBoundedProjectPath(raw);if(!target)throw new Error(`Preview target must be a bounded project-relative path: ${raw}`)
  const admitted=scope.map(scopePath).filter((x):x is string=>Boolean(x))
  if(admitted.length&&!admittedPath(target,admitted))throw new Error(`Preview target is outside the visual task scope: ${target}`)
  return target
}
function encodedPath(target:string):string{return'/'+target.split('/').map(encodeURIComponent).join('/')}

/** Task-owned, loopback-only static preview. No npm/dev-server install or project mutation. */
export class LocalPreviewManager{
  readonly #leases=new Map<string,PreviewLease>()
  constructor(private readonly workingDirectory:string){}
  async start(taskID:string,targetRaw:string,scope:string[]):Promise<LocalPreviewResult>{
    const root=safeRealRoot(this.workingDirectory),effectiveScope=canonicalScope(scope),target=requestedTarget(targetRaw,effectiveScope),targetAbs=resolve(root,target)
    if(!within(root,targetAbs)||!existsSync(targetAbs)||!statSync(targetAbs).isFile())throw new Error(`Preview target does not exist inside the working directory: ${target}`)
    const targetReal=realpathSync(targetAbs);if(!within(root,targetReal))throw new Error(`Preview target resolves outside the working directory: ${target}`)
    const current=this.#leases.get(taskID);if(current&&current.root===root&&sameScope(current.scope,effectiveScope))return{task_id:taskID,origin:current.origin,url:current.origin+encodedPath(target),root,target,reused:true}
    if(current)await this.stop(taskID)
    const server=createServer((req,res)=>{
      if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return}
      let raw:string;try{raw=decodeURIComponent((req.url??'/').split('?')[0]??'/')}catch{res.writeHead(400);res.end('Bad Request');return}
      const bounded=normalizeBoundedProjectPath(raw.replace(/^\/+/,''));if(!bounded||bounded.split('/').some(part=>part.startsWith('.'))||!admittedPath(bounded,effectiveScope)){res.writeHead(403);res.end('Forbidden');return}
      const abs=resolve(root,bounded);if(!within(root,abs)||!existsSync(abs)){res.writeHead(404);res.end('Not Found');return}
      let real:string;try{real=realpathSync(abs)}catch{res.writeHead(404);res.end('Not Found');return}
      if(!within(root,real)||!statSync(real).isFile()){res.writeHead(403);res.end('Forbidden');return}
      res.setHeader('Content-Type',MIME[extname(real).toLowerCase()]??'application/octet-stream')
      res.setHeader('Cache-Control','no-store')
      res.setHeader('X-Content-Type-Options','nosniff')
      if(req.method==='HEAD'){res.writeHead(200);res.end();return}
      createReadStream(real).on('error',()=>{if(!res.headersSent)res.writeHead(500);res.end()}).pipe(res)
    })
    await new Promise<void>((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',()=>{server.off('error',fail);ok()})})
    const address=server.address();if(!address||typeof address==='string'){server.close();throw new Error('Preview server did not receive a TCP port')}
    server.unref();const origin=`http://127.0.0.1:${address.port}`;this.#leases.set(taskID,{taskID,root,server,origin,scope:effectiveScope})
    return{task_id:taskID,origin,url:origin+encodedPath(target),root,target,reused:false}
  }
  async stop(taskID:string):Promise<boolean>{const lease=this.#leases.get(taskID);if(!lease)return false;this.#leases.delete(taskID);await new Promise<void>(resolve=>lease.server.close(()=>resolve()));return true}
  async dispose():Promise<void>{await Promise.all([...this.#leases.keys()].map(id=>this.stop(id)));this.#leases.clear()}
  active(taskID:string):boolean{return this.#leases.has(taskID)}
}
