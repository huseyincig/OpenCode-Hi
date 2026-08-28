import { BROWSER_OBSERVATION_ACTIONS,type BrowserObservationAction } from './browser-observation.js'

export interface VerificationCase { id:string; subject:string; required_browser_actions:BrowserObservationAction[] }
const ACTIONS=new Set<string>(BROWSER_OBSERVATION_ACTIONS)
export function isVerificationCase(v:unknown):v is VerificationCase{
  if(!v||typeof v!=='object'||Array.isArray(v))return false
  const x=v as Record<string,unknown>,keys=Object.keys(x);if(keys.some(k=>!['id','subject','required_browser_actions'].includes(k)))return false
  if(typeof x.id!=='string'||!/^vc_[a-z0-9][a-z0-9-]{0,47}$/.test(x.id))return false
  if(typeof x.subject!=='string'||!x.subject.trim()||x.subject.length>240)return false
  return Array.isArray(x.required_browser_actions)&&x.required_browser_actions.length>0&&x.required_browser_actions.length<=10&&new Set(x.required_browser_actions).size===x.required_browser_actions.length&&x.required_browser_actions.every(a=>typeof a==='string'&&ACTIONS.has(a))
}
