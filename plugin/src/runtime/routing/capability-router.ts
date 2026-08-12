import type { Category, NormalizedMissionIntent } from '../mission/types.js'

export interface CapabilityDecision { role: string; category: Category; capabilities: string[]; reason: string[] }

export type AutonomyProfile = 'basic' | 'standard' | 'powerful' | 'smart'

export interface ProfileSettingsLite {
  specialistThreshold: 'low' | 'medium' | 'high'
  reviewThreshold: 'low' | 'medium' | 'high'
}

// Default profile is `standard` (matches DEFAULT_HHC_CONFIG.profile.standard).
// Lower threshold → more specialist dispatch; higher threshold → fewer.
function thresholdFrom(value: 'low' | 'medium' | 'high'): number {
  return value === 'low' ? 1 : value === 'medium' ? 2 : 3
}

export function routeCapabilities(intent: NormalizedMissionIntent, profile: ProfileSettingsLite = { specialistThreshold: 'medium', reviewThreshold: 'medium' }): CapabilityDecision {
  const caps = [...new Set(intent.requiredCapabilities)]
  const text = `${intent.taskKind} ${caps.join(' ')}`.toLowerCase()
  const specialistT = thresholdFrom(profile.specialistThreshold)
  const reviewT = thresholdFrom(profile.reviewThreshold)

  // Security-sensitive IMPLEMENTATION remains owned by a write-capable implementer.
  // Independent security assurance is a separate bounded review obligation/worker.
  // A review-dominant security task may route directly to the read-only specialist.
  if (/security|auth|permission|secret|vuln/.test(text)) {
    if (intent.taskKind === 'review') return { role:'security-reviewer', category:'critical', capabilities:caps, reason:['security review dominant task'] }
    return { role:'coder', category:'critical', capabilities:caps, reason:['security-sensitive implementation remains write-capable; independent security review is separate'] }
  }

  // QA-reviewer dispatch is gated by the profile's reviewThreshold.
  // basic profile = high threshold = only review-heavy tasks get QA.
  if (/review|audit|qa|verify|test/.test(text) && !/implement|fix|build/.test(text)) {
    if (reviewT <= 1) return { role:'qa-reviewer', category:intent.risk==='high'?'critical':'standard', capabilities:caps, reason:['verification/review dominant task'] }
    // standard/powerful: QA dispatched for non-trivial review; basic: only when high-risk.
    if (intent.risk === 'high' || caps.includes('qa-review') || caps.includes('security-review')) return { role:'qa-reviewer', category:intent.risk==='high'?'critical':'standard', capabilities:caps, reason:['verification/review dominant task'] }
  }

  // Architect dispatch is gated by the profile's specialistThreshold.
  // powerful profile = low threshold = architect for any cross-cutting,
  // medium = architect for repo-wide or explicit design, basic = only
  // explicit architecture keyword.
  if (/architecture|design|migration|repo-wide/.test(text) || intent.scope==='repo-wide') {
    if (specialistT <= 1) return { role:'architect', category:intent.risk==='high'?'critical':'deep', capabilities:caps, reason:['cross-cutting design or repo-wide scope'] }
    if (specialistT === 2 && (intent.scope === 'repo-wide' || /architecture|design|migration/.test(text))) return { role:'architect', category:intent.risk==='high'?'critical':'deep', capabilities:caps, reason:['cross-cutting design or repo-wide scope'] }
  }

  if (/docs|documentation|readme/.test(text)) return { role:'coder', category:'quick', capabilities:caps, reason:['documentation-dominant task'] }

  const base = { role:'coder' as const, category:intent.scope==='local'&&intent.risk==='low'?'quick' as const:intent.risk==='high'?'critical' as const:'standard' as const, capabilities:caps, reason:['default child implementation path'] as string[] }
  // Deterministic evidence LLM skip: low-risk local-scope change with a
  // small diff is verified by tests + typecheck + diff alone. Skip the
  // qa-reviewer to avoid a deterministic-verifiable second LLM opinion.
  if (intent.risk === 'low' && intent.scope === 'local' && caps.includes('verification')) {
    const trimmed = caps.filter(c => c !== 'review' && c !== 'verification')
    return { role:'coder', category:'quick', capabilities:trimmed.length ? trimmed : caps, reason:[...base.reason,'deterministic-evidence-skips-qa-reviewer'] }
  }
  return base
}
