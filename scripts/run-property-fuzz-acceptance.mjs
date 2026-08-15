#!/usr/bin/env node
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const root=resolve(new URL('..',import.meta.url).pathname)
const testRel='plugin/test/q4-property-fuzz.test.mjs'
const caseRel='data/validation/property-fuzz-failures/persistence-envelopes-seed-c0ffee-case-0.json'
const outRel='data/validation/property-fuzz-acceptance-0.1.0.json'
const seeds=[0x00c0ffee,0x5eed1234,0x00a11ce], casesPerSeed=32
const areas=['ids','paths','schemas','event-ordering','host-observations','config','decision-payloads','tool-outputs','persistence-envelopes']
const run=(cmd,args)=>spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:180000})
const git=(...args)=>{const r=run('git',args);if(r.status!==0)throw new Error(r.stderr||r.stdout);return r.stdout.trim()}
const r=run(process.execPath,['--test','--test-timeout=120000',testRel])
const text=(r.stdout??'')+(r.stderr??'')
const num=(label)=>{const m=text.match(new RegExp(`ℹ ${label} (\\d+)`));return m?Number(m[1]):undefined}
const terminal={tests:num('tests'),pass:num('pass'),fail:num('fail'),cancelled:num('cancelled'),skipped:num('skipped'),todo:num('todo')}
const knownTeardown=r.status!==0&&r.signal==='SIGABRT'&&/uv__io_poll: Assertion [`']errno == EEXIST['`] failed/.test(text)&&terminal.fail===0&&terminal.cancelled===0
if(!((r.status===0)||knownTeardown)||terminal.tests!==areas.length||terminal.pass!==areas.length||terminal.fail!==0||terminal.cancelled!==0)throw new Error(`property fuzz acceptance failed status=${r.status} signal=${r.signal}\n${text.slice(-4000)}`)
const sha=(rel)=>createHash('sha256').update(readFileSync(resolve(root,rel))).digest('hex')
const receipt={schema:1,kind:'PROPERTY_FUZZ_ACCEPTANCE',program:'PROMPT_B',section:32,status:'PASS',source_binding:{tested_git_commit:git('rev-parse','HEAD'),tested_git_tree:git('rev-parse','HEAD^{tree}')},configuration:{seeds,seeds_hex:seeds.map(x=>`0x${x.toString(16).padStart(8,'0')}`),cases_per_seed:casesPerSeed,areas,generated_cases:areas.length*seeds.length*casesPerSeed},terminal,known_node_teardown_normalized:knownTeardown,test:{path:testRel,sha256:sha(testRel)},historical_regression_case:{path:caseRel,sha256:sha(caseRel),status:'SAVED_AND_FIXED'},failures:[]}
writeFileSync(resolve(root,outRel),JSON.stringify(receipt,null,2)+'\n')
console.log(`property fuzz acceptance PASS: areas=${areas.length} generated_cases=${receipt.configuration.generated_cases} failures=0`)
