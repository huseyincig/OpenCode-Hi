import type { NormalizedMissionIntent, Risk } from '../mission/types.js'
import type { RepoContext } from './repo-context.js'
const AUTHORITY=/\b(publish|deploy|push|release\s+it|merge\s+and\s+push)\b/i
const SECURITY=/\b(auth|authentication|authorization|security|permission|token|secret|credential|password|oauth|session|cookie)\b/i
const BUG=/\b(bug|fix|broken|error|crash|500|repair|resolve|regression)\b/i
const BUG_ACTION=/\b(fix|repair|resolve|correct)\b/i
const DOC_TINY=/\b(readme|docs?|documentation|markdown|typo|spelling|document)\b/i
const TEST=/\b(test|verify|verification|check|qa|lint|build)\b/i
const TDD=/\b(tdd|test[- ]driven|test driven|test-first)\b/i
const PLAN=/\b(plan|planning|roadmap|tasarla|planla|mimari plan)\b/i
const DESIGN=/\b(design|architecture|trade[- ]?off|approach)\b/i
const REVIEW=/\b(review|audit|inspect|security review|code review)\b/i
const READ_ONLY_ACTION=/\b(read|inspect|examine|check|show|report|summari[sz]e|describe)\b/i
const READ_ONLY_CONSTRAINT=/\b(read[- ]?only|do not modify|don't modify|do not edit|don't edit|no changes?|without changes?|without modifying)\b/i
const INDEPENDENT_REVIEW=/\b(?:(?:independent|separate|second[- ]?pass|second opinion)\s+(?:(?:qa|security)\s*[- ]?)?(?:reviewer|review|audit|verification)|(?:delegate|assign|spawn|use)\s+(?:exactly\s+)?(?:one|1|an?)\s+(?:independent\s+)?(?:(?:qa|security)\s*[- ]?)?reviewer)\b/i
const VISUAL=/\b(ui|ux|visual|css|layout|responsive|frontend|interface)\b/i
const PERF=/\b(performance|speed|slow|optimi[sz]e|profile)\b/i
const RELEASE=/\b(release|changelog|version|publish preparation)\b/i
const SOURCE_VERIFY=/\b(official\s+(?:docs?|documentation|source)|source[- ]driven|upstream\s+(?:docs?|source)|current\s+(?:docs?|api)|framework\s+docs?|library\s+docs?|sdk\s+docs?|version[- ]specific)\b/i
const REVIEW_FEEDBACK=/\b(review\s+(?:feedback|comments?|findings?)|pr\s+comments?|address\s+review|review\s+bulgular|inceleme\s+geri\s+bildirim)\b/i
const API_DESIGN=/\b(design|create|define)\b[\s\S]{0,48}\b(api|interface|event|schema|protocol|command|endpoint|contract)\b/i
const WORKSPACE_ISOLATION=/\b(worktree|isolated\s+(?:workspace|checkout)|workspace\s+isolation)\b/i
const SKILL_AUTHORING=/\b(SKILL\.md|skill\s+(?:authoring|create|write|edit|routing))\b/i
const CONTRACT=/\b(api|schema|database|migration|contract|protocol|auth|permission|security|data model)\b/i
const EXPLICIT_TARGET=/\b(endpoint|table|column|field|route|file|dosya|class|function|method|model)\b/i
const SEQUENTIAL=/\b(after|before|then|depends|dependency)\b/i
const EXTERNAL_GATE=/\b(oauth|mfa|credential|secret|paid|payment|approval|production|prod|deploy|publish)\b/i
const REPO_WIDE=/\b(repo|repository|entire|all|overall|codebase)\b/i
const MULTI=/\b(?:(?:multiple|several)\s+(?:files?|modules?|packages?)|multiple|several)\b/i
// Bounded structural detection of multiple independent workstreams in the objective.
// These are NOT keyword hacks: each pattern requires a numeric/quantifier + a
// work-unit noun or a numbered list, so plain prose containing "independent"
// or "feature" without a count/scope marker does not trigger multi-stream.
// Plural suffixes (English -s, Turkish -ler/-lar) are tolerated on the work-unit noun.
// Note: \b is NOT used because JavaScript regex \w is ASCII-only; Turkish
// Word-boundary detection is explicit so enumerated work-unit matching remains deterministic.
// non-ASCII Turkish char and ASCII whitespace. Explicit lookbehind/lookahead
// against ASCII word chars is used instead.
const NUMBERED_WORKUNITS=/(?<![a-zA-Z0-9_])(\d+|two|three|four|five|six|seven|eight|nine|ten)\s+(?:independent|separate|different|parallel)\s+(?:tasks?|features?|modules?|components?|endpoints?|steps?|streams?|workstreams?|functions?)(?![a-zA-Z0-9_])/i
const NUMBERED_LIST=/(?:^|\n)\s*\d+[\.\)]\s+\S[\s\S]*?\n\s*\d+[\.\)]\s+\S/m
const ENUMERATED_MULTI=/(?<![a-zA-Z0-9_])(two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:independent|separate)\s+\S[\s\S]{0,60}?\s+(?:and|or)\s+\S(?![a-zA-Z0-9_])/i
const PATH=/(?:^|\s)([\w@.-]+\/(?:[\w@./-]+)|[\w@.-]+\.(?:ts|tsx|js|jsx|py|go|rs|php|json|md|css|scss|html))(?:\s|$)/g
const NEGATION_PREFIX=/\b(?:no|not|without|avoid|never)\b(?:\s+[a-z-]+){0,4}\s*$/i
function hasNonNegated(text:string,re:RegExp):boolean{const flags=re.flags.includes('g')?re.flags:re.flags+'g',scan=new RegExp(re.source,flags);for(const match of text.matchAll(scan)){const prefix=text.slice(Math.max(0,(match.index??0)-64),match.index);if(!NEGATION_PREFIX.test(prefix))return true}return false}
export function normalizeIntent(text:string,repo?:RepoContext):NormalizedMissionIntent{
  const raw=text.trim();const objective=raw.replace(/\s+/g,' ');const authority=hasNonNegated(objective,AUTHORITY),security=hasNonNegated(objective,SECURITY),release=hasNonNegated(objective,RELEASE);const risk:Risk=authority?'authority-boundary':security?'high':release?'medium':'low'
  const reviewIntent=(REVIEW.test(objective)||READ_ONLY_ACTION.test(objective)&&READ_ONLY_CONSTRAINT.test(objective))&&!BUG_ACTION.test(objective);const taskKind=reviewIntent?'review':DOC_TINY.test(objective)&&!security?'implementation':BUG.test(objective)?'bug-fix':PERF.test(objective)?'performance':release?'release-readiness':'implementation'
  // Numbered list detection must run on raw text — whitespace normalization
  // collapses newlines into single spaces, so by the time we test `objective`
  // the multiline structure is gone.
  const isMultiStream=NUMBERED_WORKUNITS.test(objective)||NUMBERED_LIST.test(raw)||ENUMERATED_MULTI.test(objective)
  const likelyTargets=[...objective.matchAll(PATH)].map(m=>m[1]).filter(Boolean).slice(0,8);const scope=authority?'external':REPO_WIDE.test(objective)?'repo-wide':isMultiStream?'multi-stream':likelyTargets.length>1||MULTI.test(objective)?'multi-file':'local'
  const requiredCapabilities:string[]=[];if(taskKind==='bug-fix')requiredCapabilities.push('repository-analysis','debugging','implementation');else if(taskKind==='review')requiredCapabilities.push('repository-analysis','review');else if(taskKind==='performance')requiredCapabilities.push('repository-analysis','performance-analysis','implementation');else if(taskKind==='release-readiness')requiredCapabilities.push('release-guardrails','verification');else requiredCapabilities.push('implementation')
  if(INDEPENDENT_REVIEW.test(objective))requiredCapabilities.push('independent-review');if(TDD.test(objective))requiredCapabilities.push('tdd-required');if(PLAN.test(objective)&&scope!=='local')requiredCapabilities.push('implementation-planning');if(DESIGN.test(objective)&&(scope!=='local'||/design|architecture/i.test(objective)))requiredCapabilities.push('design-exploration');if(SOURCE_VERIFY.test(objective))requiredCapabilities.push('source-verification');if(REVIEW_FEEDBACK.test(objective))requiredCapabilities.push('review-feedback');if(API_DESIGN.test(objective))requiredCapabilities.push('api-interface-design');if(WORKSPACE_ISOLATION.test(objective))requiredCapabilities.push('workspace-isolation');if(SKILL_AUTHORING.test(objective))requiredCapabilities.push('skill-authoring');if(security){requiredCapabilities.push('security-review','critical-validation')}else if(risk==='high')requiredCapabilities.push('critical-validation');if(VISUAL.test(objective))requiredCapabilities.push('visual-qa');if(scope==='multi-stream')requiredCapabilities.push('multi-stream-delegation')
  const repoVerify=repo?.likelyVerification??[]
  const hasTest=repoVerify.some(x=>/test|pytest|cargo test|go test/i.test(x)),staticKind=repoVerify.find(x=>/typecheck|check|lint/i.test(x)),buildKind=repoVerify.find(x=>/build/i.test(x))
  let likelyVerification:string[]
  if(taskKind==='review')likelyVerification=['review-evidence']
  else if(taskKind==='release-readiness'){likelyVerification=[...(hasTest?['targeted-tests']:['changed-surface-sanity']),...(staticKind?[staticKind]:[]),...(buildKind?[buildKind]:[])]}
  else if(VISUAL.test(objective)){likelyVerification=['changed-surface-sanity','visual-check']}
  else if(TEST.test(objective)||taskKind==='bug-fix'){
    // Verification economy: a local low-risk change should not inherit every repo-wide script as a hard gate.
    // High-risk or broad work strengthens the contract with one static check and, when available, a build.
    likelyVerification=['targeted-tests']
    if(risk==='high'||scope==='repo-wide'||scope==='multi-stream'){if(staticKind)likelyVerification.push(staticKind);if(buildKind)likelyVerification.push(buildKind)}
    else if(scope==='multi-file'&&staticKind)likelyVerification.push(staticKind)
  }else{
    likelyVerification=['changed-surface-sanity']
    if(risk==='high'){if(staticKind)likelyVerification.push(staticKind);if(buildKind)likelyVerification.push(buildKind)}
  }
  const ambiguity=CONTRACT.test(objective)&&!EXPLICIT_TARGET.test(objective)&&!likelyTargets.length?'contract-critical':'none'
  const dependencyClass=EXTERNAL_GATE.test(objective)?'external-gated':SEQUENTIAL.test(objective)?'sequential':scope==='multi-stream'?'independent-multi':scope==='local'?'independent':'unknown'
  const avoid=['unnecessary-agents','unnecessary-skills','full-chat-child-context','unrequested-external-effects'];if(repo?.ecosystems.length)avoid.push(`ignore-repo-ecosystem:${repo.ecosystems.join('+')}`)
  return{objective,likelyTargets:likelyTargets.length?likelyTargets:undefined,taskKind,scope,risk,ambiguity,dependencyClass,requiredCapabilities:[...new Set(requiredCapabilities)],likelyVerification:[...new Set(likelyVerification)],avoid}
}
