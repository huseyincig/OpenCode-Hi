export type HumanDecisionKind = 'AUTHORITY' | 'PREFERENCE' | 'AMBIGUITY' | 'ANNOTATION' | 'VISUAL_DECISION' | 'BATCHED_QUESTIONS';
export type ActiveUserMessageKind = 'INTERRUPT' | 'QUEUE' | 'SIDEBAND';
export interface HumanQuestion {
    id: string;
    kind: HumanDecisionKind;
    question: string;
    dependsOn?: string[];
    material: boolean;
}
export declare function questionsWorthAsking(questions: HumanQuestion[]): HumanQuestion[];
export declare function batchIndependentQuestions(questions: HumanQuestion[]): HumanQuestion[][];
export declare function classifyActiveUserMessage(text: string): ActiveUserMessageKind;
