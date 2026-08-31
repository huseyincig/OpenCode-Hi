function unavailable(name) { throw new Error(`UNSUPPORTED_CAPABILITY: OpenCode V2 Promise context does not expose ${name}`); }
export class V2UnavailableProcessExecutor {
    async health() { return { available: false, detail: 'V2 Promise context exposes shell policy hooks but no owned PTY lifecycle API' }; }
    async spawn() { return unavailable('process lifecycle'); }
    ;
    async write() { return unavailable('process lifecycle'); }
    ;
    async read() { return unavailable('process lifecycle'); }
    ;
    async observe() { return unavailable('process lifecycle'); }
    ;
    async wait() { return unavailable('process lifecycle'); }
    ;
    async kill() { return unavailable('process lifecycle'); }
    ;
    async cleanup() { return unavailable('process lifecycle'); }
    ;
    async reconcile(contract) { return { disposition: 'ORPHANED', contract: { ...contract, status: 'ORPHANED', cleanup_state: 'QUARANTINED', termination_reason: contract.termination_reason ?? 'V2 Promise host does not expose owned process lifecycle for reconciliation' } }; }
}
export class V2UnavailableWorkspaceExecutor {
    async health() { return { available: false, detail: 'V2 Promise context exposes location binding but no workspace provision/remove API' }; }
    async sourceBaseline() { return unavailable('workspace lifecycle'); }
    ;
    async provision() { return unavailable('workspace lifecycle'); }
    ;
    async reintegrate() { return unavailable('workspace lifecycle'); }
    ;
    async reconcile(lease) { return { disposition: 'ORPHANED', lease: { ...lease, status: 'ORPHANED', cleanup_state: 'QUARANTINED' } }; }
    ;
    async cleanup() { return unavailable('workspace lifecycle'); }
}
