import {createHash} from 'node:crypto'
import {readFileSync,statSync,readdirSync} from 'node:fs'
import {join,relative} from 'node:path'

function hashTree(root){const h=createHash('sha256');function walk(dir){for(const name of readdirSync(dir).sort()){const p=join(dir,name),s=statSync(p);if(s.isDirectory())walk(p);else if(s.isFile()){h.update(relative(root,p));h.update('\0');h.update(readFileSync(p));h.update('\0')}}}walk(root);return h.digest('hex')}
export function fixtureIdentity(root){return hashTree(root)}
export class FixtureManager{
  constructor(spec){this.spec=spec}
  async reset(lock){if(!lock?.owned||lock.workloadId!==this.spec.workloadId)throw new Error('AUTHORITATIVE_LOCK_REQUIRED');await this.spec.reset();const observed=fixtureIdentity(this.spec.fixtureRoot);if(this.spec.baseline?.kind==='sha256'&&this.spec.baseline.value!==observed)throw new Error(`FIXTURE_BASELINE_MISMATCH:${observed}`);return{baseline:this.spec.baseline,observed_identity:observed}}
}
