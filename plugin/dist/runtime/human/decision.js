export function questionsWorthAsking(questions) { return questions.filter(q => q.material); }
export function batchIndependentQuestions(questions) { const useful = questionsWorthAsking(questions), groups = []; let batch = []; for (const q of useful) {
    if (q.dependsOn?.length) {
        if (batch.length) {
            groups.push(batch);
            batch = [];
        }
        groups.push([q]);
    }
    else
        batch.push(q);
} if (batch.length)
    groups.push(batch); return groups; }
export function classifyActiveUserMessage(text) { const t = text.trim(); if (/\b(stop|cancel|abort|instead|change direction|do not|don't)\b/i.test(t))
    return 'INTERRUPT'; if (/\b(after that|then also|next)\b/i.test(t))
    return 'QUEUE'; return 'SIDEBAND'; }
