import type { MissionState } from '../mission/types.js';
export type BudgetMeasurement = 'exact' | 'derived' | 'unavailable';
export type BudgetEnforcement = 'hard' | 'observed-only' | 'unavailable';
export interface BudgetAxis {
    axis: string;
    used: number;
    limit?: number;
    unit: string;
    measurement: BudgetMeasurement;
    enforcement: BudgetEnforcement;
    status: 'within' | 'exhausted' | 'observed' | 'unavailable';
    source: string;
}
export interface ExecutionBudgetView {
    mission: BudgetAxis[];
    workers: Record<string, BudgetAxis[]>;
    processes: Record<string, BudgetAxis[]>;
}
export declare function executionBudgetView(m: MissionState, now?: number): ExecutionBudgetView;
