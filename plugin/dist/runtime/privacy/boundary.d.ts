export interface Redaction {
    id: string;
    value: string;
    kind: 'secret' | 'token' | 'credential';
}
export interface PrivacyResult {
    providerText: string;
    redactions: Redaction[];
}
export declare function redactProviderContext(text: string): PrivacyResult;
export declare function restoreLocalText(text: string, redactions: Redaction[]): string;
export declare function containsPlaintextSecret(text: string, redactions: Redaction[]): boolean;
