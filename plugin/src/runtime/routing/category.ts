import type { Category, NormalizedMissionIntent } from '../mission/types.js'

export function resolveCategory(intent: NormalizedMissionIntent): Category {
  if (intent.risk === 'high' || intent.risk === 'authority-boundary') return 'critical'
  if (intent.requiredCapabilities.includes('visual-qa')) return 'visual'
  if (intent.scope === 'repo-wide' || intent.taskKind === 'performance') return 'deep'
  if (intent.scope === 'local' && intent.taskKind !== 'bug-fix') return 'quick'
  return 'standard'
}

export function continuationBudget(category: Category): number {
  return category === 'quick' ? 2 : category === 'standard' || category === 'visual' ? 4 : category === 'deep' ? 6 : 5
}

export function roleForIntent(intent: NormalizedMissionIntent): string {
  if (intent.taskKind === 'review') return intent.requiredCapabilities.includes('security-review') ? 'security-reviewer' : 'qa-reviewer'
  if (intent.taskKind === 'performance' && intent.scope === 'repo-wide') return 'architect'
  if (intent.scope === 'repo-wide' && intent.taskKind !== 'implementation') return 'repository-explorer'
  return 'coder'
}
