import {spawnSync} from 'node:child_process'
import {existsSync,readFileSync} from 'node:fs'
import {resolve} from 'node:path'
const ROOT=resolve(import.meta.dirname,'../..')
function run(command,args,{stdio='inherit'}={}){const r=spawnSync(command,args,{cwd:ROOT,stdio,env:process.env});if(r.status!==0)throw new Error(`CERTIFICATION_COMMAND_FAILED:${command}:${r.status}`);return r}
if(existsSync(resolve(ROOT,'.agent-work/workload-acceptance')))throw new Error('ACTIVE_W_NAMESPACE_PRESENT')
run(process.execPath,['--test','tests/test_workload_acceptance_harness.mjs'])
const modelScan=spawnSync('grep',['-RNE','--exclude=certify.mjs','opencode-go/|muse-spark|mimo-v|deepseek-v|qwen3|longcat|minimax','scripts/workload-acceptance','tests/test_workload_acceptance_harness.mjs'],{cwd:ROOT,encoding:'utf8'})
if(modelScan.status===0)throw new Error(`W_HARNESS_VENDOR_MODEL_HARDCODE:${modelScan.stdout.trim()}`)
const adapter=readFileSync(resolve(ROOT,'scripts/workload-acceptance/liveness-adapter.mjs'),'utf8')
if(!adapter.includes("plugin/dist/runtime/liveness/assessment.js"))throw new Error('CANONICAL_PRODUCT_LIVENESS_ADAPTER_MISSING')
run('git',['-c',`safe.directory=${ROOT}`,'diff','--check'])
if(existsSync(resolve(ROOT,'.agent-work/workload-acceptance')))throw new Error('W_NAMESPACE_CREATED_DURING_CERTIFICATION')
console.log('W_HARNESS_CERTIFICATION_PASS')
