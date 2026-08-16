import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const workflow=readFileSync(resolve(root,'.github/workflows/npm-publish.yml'),'utf8')
const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'))
const verifier=readFileSync(resolve(root,'scripts/verify-npm-oidc-release.mjs'),'utf8')

test('R1 npm publish workflow is release-bound OIDC with no long-lived npm token surface',()=>{
  assert.match(workflow,/release:\s*\n\s*types: \[published\]/)
  assert.match(workflow,/id-token: write/)
  assert.match(workflow,/contents: read/)
  assert.match(workflow,/runs-on: ubuntu-latest/)
  assert.match(workflow,/github\.event\.release\.prerelease == false/)
  assert.match(workflow,/node-version: '24'/)
  assert.match(workflow,/package-manager-cache: false/)
  assert.match(workflow,/Install locked distribution dependencies/)
  assert.match(workflow,/npm ci --ignore-scripts --no-audit --no-fund/)
  assert.match(workflow,/npm ci --prefix plugin --ignore-scripts --no-audit --no-fund/)
  assert.match(workflow,/npm publish --ignore-scripts --access public/)
  assert.doesNotMatch(workflow,/NODE_AUTH_TOKEN|NPM_TOKEN|secrets\.[A-Za-z0-9_]*NPM/i)
  assert.doesNotMatch(workflow,/workflow_dispatch|repository_dispatch/)
})

test('R1 workflow fails closed on exact annotated tag/source/package identity before publish',()=>{
  assert.match(workflow,/verify-npm-oidc-release\.mjs preflight/)
  assert.match(verifier,/must be annotated/)
  assert.match(verifier,/tagCommit!==head/)
  assert.match(verifier,/pkg\.repository\?\.url!==expectedRepository/)
  assert.equal(pkg.repository.url,'git+https://github.com/huseyincig/OpenCode-Hi.git')
  assert.equal(pkg.publishConfig.access,'public')
  assert.match(verifier,/rootLockVersion/)
  assert.match(verifier,/root @opencode-ai\/sdk dependency must equal accepted 1\.18\.18/)
})

test('R1 registry proof requires fresh pack integrity and shasum equality before fresh-consumer acceptance',()=>{
  assert.match(workflow,/npm pack --dry-run --json --ignore-scripts > npm-pack-proof\.json/)
  assert.match(workflow,/npm view .*dist\.integrity dist\.shasum --json/)
  assert.match(workflow,/verify-npm-oidc-release\.mjs registry/)
  assert.match(workflow,/npm install --ignore-scripts "opencode-hi@\$\{VERSION\}"/)
  assert.match(workflow,/await import\('opencode-hi'\)/)
  assert.match(verifier,/registry integrity does not match fresh pack proof/)
  assert.match(verifier,/registry shasum does not match fresh pack proof/)
})

test('R1 preflight rejects the historical release tag when current source has advanced beyond it',()=>{
  const run=spawnSync(process.execPath,['scripts/verify-npm-oidc-release.mjs','preflight','v0.1.0'],{cwd:root,encoding:'utf8'})
  assert.notEqual(run.status,0)
  assert.match(run.stderr,/(release tag v0\.1\.0 != v0\.1\.1|not checked-out HEAD)/)
})
