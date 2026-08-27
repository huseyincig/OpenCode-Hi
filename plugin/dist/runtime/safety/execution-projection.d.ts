export type ExecutionDialect = 'posix' | 'powershell';
export type ExecutionOrigin = 'root' | 'command-substitution' | 'process-substitution' | 'backtick' | 'shell-wrapper' | 'transparent-wrapper' | 'pipeline-consumer' | 'embedded-execution' | 'powershell-script-block';
export type EffectiveCwdRisk = 'stable' | 'root' | 'home' | 'system' | 'unknown';
export interface ExecutionFragment {
    text: string;
    dialect: ExecutionDialect;
    origin: ExecutionOrigin;
    depth: number;
    cwdRisk: EffectiveCwdRisk;
    dynamic: boolean;
}
export interface ExecutionProjection {
    fragments: ExecutionFragment[];
    uncertain: boolean;
    uncertainty: string[];
    workUnits: number;
}
export declare function hasTopLevelPosixBackgroundOperator(source: string): boolean;
export declare function projectExecutionSurface(command: string, dialect?: 'auto' | ExecutionDialect): ExecutionProjection;
/** True when the bounded executable projection contains an actual POSIX background job. Inert quoted/output text is not projected as executable child code. */
export declare function hasProjectedPosixBackgroundExecution(command: string): boolean;
