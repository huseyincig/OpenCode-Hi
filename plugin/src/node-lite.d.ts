declare const process: { pid:number; cwd(): string; env: Record<string,string|undefined>; platform:string; execPath:string; kill(pid:number,signal?:string|number):boolean }
declare module 'node:crypto' {
  export interface Hash { update(data:any): Hash; digest(encoding:'hex'): string }
  export function createHash(algorithm:string): Hash
  export function randomUUID(): string
}
declare module 'node:fs' {
  export function existsSync(path:any): boolean
  export function readFileSync(path:any): any
  export function readFileSync(path:any, encoding:'utf8'): string
  export function createReadStream(path:any): { on(event:'error',listener:(error:Error)=>void):any; pipe(destination:any):any }
  export function readdirSync(path:any, options?:any): any[]
  export function realpathSync(path:any): string
  export function mkdirSync(path:any, options?:any): any
  export function openSync(path:any, flags:any, mode?:number): number
  export function fsyncSync(fd:number): void
  export function readSync(fd:number, buffer:any, offset:number, length:number, position:number|null): number
  export function closeSync(fd:number): void
  export function fstatSync(fd:number, options?:any): any
  export function lstatSync(path:any, options?:any): any
  export function renameSync(oldPath:any,newPath:any): void
  export function writeFileSync(path:any,data:any,encoding?:any): void
  export function statSync(path:any): any
  export function rmSync(path:any, options?:any): void
}
declare module 'node:path' {
  export function join(...paths:string[]): string
  export function resolve(...paths:string[]): string
  export function basename(path:string, suffix?:string): string
  export function dirname(path:string): string
  export function relative(from:string,to:string): string
  export function extname(path:string): string
  export const sep: string
}

declare module 'node:url' { export function fileURLToPath(url:any): string }
declare module 'node:child_process' {
  export interface ChildProcess { pid?: number; killed:boolean; stdout?:{on(event:'data',listener:(chunk:any)=>void):any}; stderr?:{on(event:'data',listener:(chunk:any)=>void):any}; kill(signal?:string):boolean; once(event:'exit'|'close', listener:(code:number|null)=>void):this; once(event:'error',listener:(error:Error)=>void):this }
  export function spawn(command:string,args:string[],options?:any):ChildProcess
  export function spawnSync(command:string,args:string[],options?:any):{status:number|null;stdout?:string|Buffer;stderr?:string|Buffer}
}
declare module 'node:os' { export function tmpdir(): string; export function homedir(): string; export function platform(): string }
declare const Buffer: { allocUnsafe(size:number): any; from(value:string,encoding:'base64'): { length:number; toString(encoding:'utf16le'):string } }
declare module 'node:http' {
  export interface Server {
    listen(port:number,host:string,listener:()=>void):this
    once(event:'error',listener:(error:Error)=>void):this
    off(event:'error',listener:(error:Error)=>void):this
    close(listener?:()=>void):this
    address(): string | {port:number} | null
    unref():this
  }
  export interface IncomingMessage { method?:string; url?:string }
  export interface ServerResponse { headersSent:boolean; setHeader(name:string,value:string):void; writeHead(status:number,headers?:Record<string,string>):this; end(data?:string):void }
  export function createServer(listener:(req:IncomingMessage,res:ServerResponse)=>void):Server
}
