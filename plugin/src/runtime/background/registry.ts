import type { WorkerState } from '../mission/types.js'

export class BackgroundRegistry {
  #workers = new Map<string, WorkerState>()
  #spawn = new Map<string, Promise<WorkerState>>()
  list(): WorkerState[] { return [...this.#workers.values()] }
  get(id: string): WorkerState|undefined { return this.#workers.get(id) }
  set(w: WorkerState): void { this.#workers.set(w.id, w) }
  delete(id: string): void { this.#workers.delete(id) }
  pendingFor(parent: string): WorkerState[] { return this.list().filter(w => w.parent_session_id === parent && ['created','queued','starting','busy'].includes(w.status)) }
  async dedupeSpawn(fingerprint: string, spawn: () => Promise<WorkerState>): Promise<WorkerState> {
    const existing = this.#spawn.get(fingerprint); if (existing) return existing
    const p = spawn().finally(() => this.#spawn.delete(fingerprint)); this.#spawn.set(fingerprint, p); return p
  }
}
