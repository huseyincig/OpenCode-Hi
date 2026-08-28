import { type ExternalActionType } from './external-action.js';
import { type VerificationCase } from './verification-case.js';
export declare const TASK_STATUSES: readonly ["created", "queued", "running", "waiting", "completed", "failed", "cancelled", "blocked"];
export type TaskContractStatus = typeof TASK_STATUSES[number];
export declare const TASK_EXTERNAL_ACTIONS: readonly ["git-push", "release-create", "package-publish", "deploy"];
export type TaskExternalAction = ExternalActionType;
export interface TaskContract {
    id: string;
    mission_id: string;
    objective: string;
    status: TaskContractStatus;
    role: string;
    category: string;
    scope: string[];
    constraints: string[];
    dependencies: string[];
    requiredEvidence: string[];
    verification_cases?: VerificationCase[];
    obligation_ids: string[];
    context_artifacts: unknown[];
    execution_profile?: unknown;
    gate_ids: string[];
    worker_id?: string;
    result?: unknown;
    diff_cleanliness?: {
        collateral: string[];
        accepted_expansions: string[];
        native_verified_reverts?: string[];
    };
    external_action_requirements: TaskExternalAction[];
    created_at: number;
    updated_at: number;
}
export declare function isTaskContract(v: unknown): v is TaskContract;
