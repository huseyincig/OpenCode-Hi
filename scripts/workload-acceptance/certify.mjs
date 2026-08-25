import {spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
const ROOT=resolve(import.meta.dirname,'../..')
function run(command,args,{stdio='inherit',env=process.env}={}){const r=spawnSync(command,args,{cwd:ROOT,stdio,env});if(r.status!==0)throw new Error(`CERTIFICATION_COMMAND_FAILED:${command}:${r.status}`);return r}
run(process.execPath,['scripts/workload-acceptance/catalog-certification.mjs'])
run(process.execPath,['--test','tests/test_workload_acceptance_harness.mjs'])
const modelScan=spawnSync('grep',['-RNE','--exclude=certify.mjs','opencode-go/|muse-spark|mimo-v|deepseek-v|qwen3|longcat|minimax','scripts/workload-acceptance'],{cwd:ROOT,encoding:'utf8'})
if(modelScan.status===0)throw new Error(`W_HARNESS_VENDOR_MODEL_HARDCODE:${modelScan.stdout.trim()}`)
const adapter=readFileSync(resolve(ROOT,'scripts/workload-acceptance/liveness-adapter.mjs'),'utf8')
if(!adapter.includes("plugin/dist/runtime/liveness/assessment.js"))throw new Error('CANONICAL_PRODUCT_LIVENESS_ADAPTER_MISSING')
run('git',['-c',`safe.directory=${ROOT}`,'diff','--check'])
console.log('W_HARNESS_CERTIFICATION_PASS')
