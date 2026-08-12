declare const process: { cwd(): string; env: Record<string,string|undefined> }
declare module 'node:crypto' {
  export interface Hash { update(data:any): Hash; digest(encoding:'hex'): string }
  export function createHash(algorithm:string): Hash
}
declare module 'node:fs' {
  export function existsSync(path:any): boolean
  export function readFileSync(path:any): any
  export function readFileSync(path:any, encoding:'utf8'): string
  export function readdirSync(path:any, options?:any): any[]
  export function realpathSync(path:any): string
  export function mkdirSync(path:any, options?:any): any
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
  export const sep: string
}

declare module 'node:url' { export function fileURLToPath(url:any): string }
declare module 'node:child_process' {
  export interface ChildProcess { pid?: number; killed:boolean; kill(signal?:string):boolean; once(event:'exit', listener:(code:number|null)=>void):this }
  export function spawn(command:string,args:string[],options?:any):ChildProcess
  export function spawnSync(command:string,args:string[],options?:any):{status:number|null;stdout?:string|Buffer;stderr?:string|Buffer}
}
declare module 'node:os' { export function tmpdir(): string; export function homedir(): string }
