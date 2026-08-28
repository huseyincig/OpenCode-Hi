import { type BrowserObservationAction } from './browser-observation.js';
export interface VerificationCase {
    id: string;
    subject: string;
    required_browser_actions: BrowserObservationAction[];
    source_units?: string[];
}
export declare function verificationCaseValidationError(v: unknown): string | undefined;
export declare function isVerificationCase(v: unknown): v is VerificationCase;
