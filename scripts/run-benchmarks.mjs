#!/usr/bin/env node
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runDeterministicBenchmarks } from '../plugin/dist/runtime/telemetry/benchmarks.js'
const rows=runDeterministicBenchmarks()
const summary={schema:1,release:'0.1.0',kind:'DETERMINISTIC_POLICY_SIMULATION',generatedBy:'scripts/run-benchmarks.mjs',claimBoundary:'These results measure deterministic Hi policy behavior in-process. They do not claim provider token billing, wall-clock model latency, or a real OpenCode host receipt.',scenarios:rows}
const out=resolve(process.argv[2]??'data/validation/benchmarks-0.1.0.json')
writeFileSync(out,JSON.stringify(summary,null,2)+'\n')
console.log(JSON.stringify({status:'PASS',scenarios:rows.length,out},null,2))
