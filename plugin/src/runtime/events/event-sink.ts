/**
 * Thin mission-scoped event adapter.
 *
 * This is intentionally NOT a broker/event bus. OpenCode is the runtime event
 * source of truth. Hi only normalizes a small mission signal so core policy
 * code can be tested without depending on raw host event payloads.
 */
export interface RuntimeSignal {
  type:string
  mission_id:string
  at:number
  task_id?:string
  worker_id?:string
  payload?:Record<string,unknown>
}

export type RuntimeSignalSink=(signal:RuntimeSignal)=>void|Promise<void>

export function runtimeSignal(
  type:string,
  mission_id:string,
  extra:Omit<RuntimeSignal,'type'|'mission_id'|'at'>={}
):RuntimeSignal{
  return {type,mission_id,at:Date.now(),...extra}
}
