import type { MissionStore } from '../runtime/mission/mission-store.js'
import type { BackgroundRegistry } from '../runtime/background/registry.js'
import { createSessionCompactingHook } from '../hooks/session-compacting.js'

/** Thin boundary around experimental OpenCode hooks. Core mission logic must not depend on hook names. */
export class ExperimentalOpenCodeAdapter {
  constructor(private store:MissionStore,private background:BackgroundRegistry){}
  compacting(){return createSessionCompactingHook(this.store,this.background)}
  capabilityReport(){return{compactionBridge:'experimental.session.compacting',businessStateCoupledToHookName:false}}
}
