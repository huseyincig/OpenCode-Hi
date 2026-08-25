import type { MissionState } from '../mission/types.js';
export declare const NON_PROGRESS_TOOL_NAMES: Set<string>;
export declare function durableProgressKey(event: MissionState['execution']['ledger'][number], currentGeneration?: number): string | undefined;
