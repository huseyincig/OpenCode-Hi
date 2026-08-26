import type { MissionState } from '../mission/types.js';
import type { TaskPreconditionResult } from './preconditions.js';
import type { WorkerEvidenceKind } from '../../contracts/evidence-kinds.js';
export declare function isTerminalCapabilityPrecondition(id: string): boolean;
export declare function isCapabilityBlocker(value: string): boolean;
export declare function firstCapabilityBlocker(m: MissionState): string | undefined;
/**
 * Bind static host/runtime preflight failures into durable mission state. The markers are scoped by
 * role and reconciled on every new preflight for that same role, so a real config/provider/resource
 * change clears the old marker instead of requiring manual state surgery.
 */
export declare function reconcileTaskCapabilityPreconditions(m: MissionState, role: string, result: TaskPreconditionResult): string[];
export declare function markCapabilityUnavailable(m: MissionState, input: {
    capability: string;
    reason: string;
    taskId?: string;
    workerId?: string;
}): string;
export declare function markVerificationCapabilityUnavailable(m: MissionState, input: {
    capability: string;
    reason: string;
    requiredKinds: WorkerEvidenceKind[];
    obligationIds: string[];
    taskId?: string;
    workerId?: string;
}): string;
export declare function clearCapabilityUnavailable(m: MissionState, capability: string): boolean;
