/** Native OpenCode transport schema. Hi semantic/provenance validators remain authoritative after transport validation. */
export declare const WORKER_RESULT_JSON_SCHEMA: Record<string, unknown>;
/** retryCount=0 keeps recovery ownership in Hi; OpenCode validates one native structured result but never hides a retry loop. */
export declare function workerResultOutputFormat(): {
    type: 'json_schema';
    schema: Record<string, unknown>;
    retryCount: 0;
};
