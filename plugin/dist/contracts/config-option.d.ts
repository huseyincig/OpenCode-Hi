export type ConfigOptionClassification = 'runtime' | 'diagnostic' | 'schema-marker';
export type ConfigSafetySemantics = 'preference' | 'constraint' | 'authority-boundary' | 'capacity';
export interface ConfigOptionContract {
    id: string;
    path: string;
    classification: ConfigOptionClassification;
    type: string;
    defaultValue: unknown;
    owner: string;
    sourceSurfaces: string[];
    precedenceOrder: string[];
    validator: string;
    safetySemantics: ConfigSafetySemantics;
    runtimeConsumer?: string;
    executorEffect?: string;
    diagnosticConsumer?: string;
    diagnosticEffect?: string;
    behavioralAcceptanceRefs: string[];
    doctorProjection?: string;
}
export declare function validateConfigOption(value: unknown, field?: string): ConfigOptionContract;
export declare function validateConfigOptionCatalog(values: unknown[]): ConfigOptionContract[];
