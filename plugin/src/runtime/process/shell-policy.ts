export type ShellDecision='ALLOW'|'REWRITE'|'USER_ACTION_REQUIRED'|'DENY'
export type ShellHumanDecisionType='credential_action'|'operational_action'
export interface ShellPolicyResult{decision:ShellDecision;command:string;reason:string;human_decision_type?:ShellHumanDecisionType;reason_code?:string}
const INTERACTIVE=[/\bssh\b(?!.*\s-[^\n]*T)/i,/\bpasswd\b/i,/\b(?:npm|pnpm|yarn)\s+login\b/i,/\bgh\s+auth\s+login\b/i,/\baz\s+login\b/i,/\bgcloud\s+(?:auth\s+)?login\b/i,/\baws\s+(?:sso\s+login|configure\s+sso|login)\b/i,/\bselect\s+/i]
const CATASTROPHIC_FILESYSTEM=[
  /(?:^|[;&|]\s*)rm\s+(?:-[^\s]*[rR][^\s]*\s+|--recursive\s+)(?:-[^\s]*f[^\s]*\s+|--force\s+)?(?:\/$|\/(?:etc|usr|var|boot|root|home)(?:\/|$)|~(?:\/|$)|\$HOME(?:\/|$)|\$\{HOME\}(?:\/|$)|\.\.(?:\/|$)|\*(?:\/|$))/i,
  /(?:^|[;&|]\s*)shred\s+[^;|&]*(?:\/dev\/|\/etc\/|\/home\/|~\/|\$HOME)/i,
  /(?:^|[;&|]\s*)mkfs(?:\.[A-Za-z0-9_-]+)?\s/i,
  /(?:^|[;&|]\s*)dd\s+[^;|&]*\bof=\/dev\//i,
]
const IRREVERSIBLE_EXTERNAL=[
  /\bgh\s+repo\s+delete\b/i,
  /\b(?:npm|pnpm|yarn)\s+unpublish\b/i,
  /\bterraform\s+destroy\b/i,
  /\b(?:aws|gcloud|az)\b[^;|&]*\b(?:delete|destroy|terminate)\b/i,
]
const SECRET_SENSITIVE=[
  /\b(?:password|passwd|secret|token|api[_-]?key)\s*=\s*[^\s$][^\s]*/i,
  /(?:--(?:password|secret|token|api[_-]?key)|-p)\s+[A-Za-z0-9._~+\/-]{8,}/i,
  /\bAuthorization:\s*Bearer\s+[A-Za-z0-9._~+\/-]{12,}/i,
]
export function evaluateShellCommand(command:string):ShellPolicyResult{
  const c=command.trim();if(!c)return{decision:'DENY',command:c,reason:'empty command'}
  if(/^\s*yes\s*\|/i.test(c)||/\|\s*yes\s*$/i.test(c))return{decision:'DENY',command:c,reason:'blanket approval bypass is forbidden'}
  if(/\bnpm\s+init\b(?!.*\s-y\b)/i.test(c))return{decision:'REWRITE',command:c.replace(/\bnpm\s+init\b/i,'npm init -y'),reason:'known safe non-interactive form'}
  if(INTERACTIVE.some(r=>r.test(c)))return{decision:'USER_ACTION_REQUIRED',command:c,reason:'interactive credential or terminal flow requires real user interaction',human_decision_type:'credential_action',reason_code:'interactive-shell'}
  if(SECRET_SENSITIVE.some(r=>r.test(c)))return{decision:'USER_ACTION_REQUIRED',command:c,reason:'plaintext secret-sensitive command requires explicit user action and safer credential handling',human_decision_type:'credential_action',reason_code:'secret-sensitive-shell'}
  if(CATASTROPHIC_FILESYSTEM.some(r=>r.test(c)))return{decision:'USER_ACTION_REQUIRED',command:c,reason:'catastrophic filesystem mutation requires explicit user action',human_decision_type:'operational_action',reason_code:'destructive-filesystem-action'}
  if(IRREVERSIBLE_EXTERNAL.some(r=>r.test(c)))return{decision:'USER_ACTION_REQUIRED',command:c,reason:'irreversible external deletion/destruction requires explicit user action',human_decision_type:'operational_action',reason_code:'irreversible-external-action'}
  return{decision:'ALLOW',command:c,reason:'non-interactive command'}
}
