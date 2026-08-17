import type { WorkerState } from '../mission/types.js'

export class BackgroundRegistry {
  #workers = new Map<string, WorkerState>()
  #spawn = new Map<string, Promise<WorkerState>>()
  #waiters = new Map<string, Set<(changed:boolean)=>void>>()
  list(): WorkerState[] { return [...this.#workers.values()] }
  get(id: string): WorkerState|undefined { return this.#workers.get(id) }
  #notify(id:string):void{const waiters=this.#waiters.get(id);if(!waiters?.size)return;this.#waiters.delete(id);for(const resolve of waiters)resolve(true)}
  set(w: WorkerState): void { this.#workers.set(w.id, w);this.#notify(w.id) }
  delete(id: string): void { this.#workers.delete(id);this.#notify(id) }
  waitForChange(id:string,timeoutMs:number):Promise<boolean>{
    if(!this.#workers.has(id))return Promise.resolve(false)
    const bounded=Math.max(0,Math.min(60_000,Math.floor(timeoutMs)))
    if(bounded===0)return Promise.resolve(false)
    return new Promise(resolve=>{
      let settled=false
      const finish=(changed:boolean)=>{if(settled)return;settled=true;clearTimeout(timer);const set=this.#waiters.get(id);set?.delete(finish);if(set&&!set.size)this.#waiters.delete(id);resolve(changed)}
      const timer=setTimeout(()=>finish(false),bounded)
      const set=this.#waiters.get(id)??new Set<(changed:boolean)=>void>();set.add(finish);this.#waiters.set(id,set)
      if(!this.#workers.has(id))finish(true)
    })
  }
  pendingFor(parent: string): WorkerState[] { return this.list().filter(w => w.parent_session_id === parent && ['created','queued','starting','busy'].includes(w.status)) }
  async dedupeSpawn(fingerprint: string, spawn: () => Promise<WorkerState>): Promise<WorkerState> {
    const existing = this.#spawn.get(fingerprint); if (existing) return existing
    const p = spawn().finally(() => this.#spawn.delete(fingerprint)); this.#spawn.set(fingerprint, p); return p
  }
}
