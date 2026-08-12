import { spawn, type ChildProcess } from 'node:child_process'
export type ProcessStatus='running'|'exited'|'failed'|'stopped'
export interface ProcessState{processId:string;ownerTask:string;purpose:string;cwd:string;status:ProcessStatus;startedAt:number;expectedSignal?:string;cleanupPolicy:'stop-on-mission-end'|'retain'|'handoff';exitCode?:number|null}
export class ProcessGovernor{
  readonly #states=new Map<string,ProcessState>();readonly #children=new Map<string,ChildProcess>()
  start(command:string,args:string[],input:{ownerTask:string;purpose:string;cwd:string;cleanupPolicy?:ProcessState['cleanupPolicy'];expectedSignal?:string}):ProcessState{const child=spawn(command,args,{cwd:input.cwd,stdio:'ignore',shell:false});const id=`p_${child.pid??Date.now()}_${Math.random().toString(36).slice(2,7)}`,state:ProcessState={processId:id,ownerTask:input.ownerTask,purpose:input.purpose,cwd:input.cwd,status:'running',startedAt:Date.now(),expectedSignal:input.expectedSignal,cleanupPolicy:input.cleanupPolicy??'stop-on-mission-end'};this.#states.set(id,state);this.#children.set(id,child);child.once('exit',(code)=>{const current=this.#states.get(id);if(current){current.exitCode=code;current.status=code===0?'exited':'failed'}this.#children.delete(id)});return{...state}}
  get(id:string):ProcessState|undefined{const s=this.#states.get(id);return s?{...s}:undefined}
  list():ProcessState[]{return[...this.#states.values()].map(s=>({...s}))}
  stop(id:string):boolean{const child=this.#children.get(id),state=this.#states.get(id);if(!state)return false;if(child&&!child.killed)child.kill('SIGTERM');state.status='stopped';this.#children.delete(id);return true}
  cleanupMission():string[]{const stopped:string[]=[];for(const s of this.#states.values())if(s.status==='running'&&s.cleanupPolicy==='stop-on-mission-end'&&this.stop(s.processId))stopped.push(s.processId);return stopped}
}
