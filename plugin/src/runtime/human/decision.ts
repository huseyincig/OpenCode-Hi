export type HumanDecisionKind='AUTHORITY'|'PREFERENCE'|'AMBIGUITY'|'ANNOTATION'|'VISUAL_DECISION'|'BATCHED_QUESTIONS'
export type ActiveUserMessageKind='INTERRUPT'|'QUEUE'|'SIDEBAND'
export interface HumanQuestion{id:string;kind:HumanDecisionKind;question:string;dependsOn?:string[];material:boolean}
export function questionsWorthAsking(questions:HumanQuestion[]):HumanQuestion[]{return questions.filter(q=>q.material)}
export function batchIndependentQuestions(questions:HumanQuestion[]):HumanQuestion[][]{const useful=questionsWorthAsking(questions),groups:HumanQuestion[][]=[];let batch:HumanQuestion[]=[];for(const q of useful){if(q.dependsOn?.length){if(batch.length){groups.push(batch);batch=[]}groups.push([q])}else batch.push(q)}if(batch.length)groups.push(batch);return groups}
export function classifyActiveUserMessage(text:string):ActiveUserMessageKind{const t=text.trim();if(/\b(stop|cancel|abort|instead|change direction|do not|don't)\b/i.test(t))return'INTERRUPT';if(/\b(after that|then also|next)\b/i.test(t))return'QUEUE';return'SIDEBAND'}
