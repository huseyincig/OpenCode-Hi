export class ProcessSpawnPermissionError extends Error {
    decision;
    reason;
    constructor(decision, reason) {
        super(`Hi ProcessExecutor spawn ${decision.toLowerCase()}: ${reason}`);
        this.decision = decision;
        this.reason = reason;
        this.name = 'ProcessSpawnPermissionError';
    }
}
