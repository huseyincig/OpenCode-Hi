#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const args = process.argv.slice(2)
if (!args.length) {
  console.error('usage: node scripts/run-python.mjs <script-or-python-args...>')
  process.exit(2)
}
const candidates = process.platform === 'win32'
  ? [['py', ['-3']], ['python', []], ['python3', []]]
  : [['python3', []], ['python', []]]
let last
for (const [cmd, prefix] of candidates) {
  const probe = spawnSync(cmd, [...prefix, '--version'], { stdio: 'ignore' })
  if (probe.error?.code === 'ENOENT') { last = probe.error; continue }
  if (probe.status !== 0) { last = new Error(`${cmd} --version exited ${probe.status}`); continue }
  const out = spawnSync(cmd, [...prefix, ...args], { stdio: 'inherit' })
  if (out.error) { console.error(String(out.error)); process.exit(1) }
  process.exit(out.status ?? 1)
}
console.error(`No usable Python 3 interpreter found${last ? `: ${last}` : ''}`)
process.exit(127)
