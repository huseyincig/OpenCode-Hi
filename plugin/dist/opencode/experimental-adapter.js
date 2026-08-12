import { createSessionCompactingHook } from '../hooks/session-compacting.js';
/** Thin boundary around experimental OpenCode hooks. Core mission logic must not depend on hook names. */
export class ExperimentalOpenCodeAdapter {
    store;
    background;
    constructor(store, background) {
        this.store = store;
        this.background = background;
    }
    compacting() { return createSessionCompactingHook(this.store, this.background); }
    capabilityReport() { return { compactionBridge: 'experimental.session.compacting', businessStateCoupledToHookName: false }; }
}
