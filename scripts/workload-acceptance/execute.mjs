#!/usr/bin/env node
import {executeWorkload} from './execution-driver.mjs'
const workload=process.argv[2]
if(!/^W(?:0[1-9]|1[0-8])$/.test(workload??'')){console.error('Usage: node scripts/workload-acceptance/execute.mjs W01');process.exit(2)}
try{const result=await executeWorkload(workload);process.stdout.write(JSON.stringify(result,null,2)+'\n');process.exitCode=result.disposition==='TERMINAL_PASS'?0:result.disposition==='READY_TO_EXECUTE'?0:3}catch(error){console.error(error?.stack??String(error));process.exitCode=1}
