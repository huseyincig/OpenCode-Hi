export interface Redaction{id:string;value:string;kind:'secret'|'token'|'credential'}
export interface PrivacyResult{providerText:string;redactions:Redaction[]}
const PATTERNS=[
  /\b(?:sk|pk)_[A-Za-z0-9_-]{16,}\b/g,
  /\b(?:ghp|github_pat)_[A-Za-z0-9_]{16,}\b/g,
  /\bAKIA[A-Z0-9]{16}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}\b/gi,
  /\b(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*["']?([^\s"']{8,})["']?/gi,
  /(?:--(?:password|secret|token|api[_-]?key)|-p)\s+[A-Za-z0-9._~+\/-]{8,}/gi,
]
function redact(text:string,placeholder:(index:number)=>string):PrivacyResult{const redactions:Redaction[]=[];let providerText=text,index=0;for(const pattern of PATTERNS){const re=new RegExp(pattern.source,pattern.flags);providerText=providerText.replace(re,(value:string)=>{if(value.includes('<HI_REDACTED'))return value;const id=placeholder(++index);redactions.push({id,value,kind:'secret'});return id})}return{providerText,redactions}}
export function redactProviderContext(text:string):PrivacyResult{return redact(text,index=>`<HI_REDACTED_${index}>`)}
export function redactDurableText(text:string):string{return redact(text,()=>'<HI_REDACTED_SECRET>').providerText}
export function restoreLocalText(text:string,redactions:Redaction[]):string{let out=text;for(const r of redactions)out=out.split(r.id).join(r.value);return out}
export function containsPlaintextSecret(text:string,redactions:Redaction[]):boolean{return redactions.some(r=>text.includes(r.value))}
