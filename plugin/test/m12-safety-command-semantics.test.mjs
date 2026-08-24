import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateShellCommand} from '../dist/runtime/process/shell-policy.js'
import {projectExecutionSurface} from '../dist/runtime/safety/execution-projection.js'

const cwdDanger=[
  'cd / && rm -rf ./etc',
  'cd /etc && rm -rf ./ssh',
  'pushd /usr && rm -rf ./lib',
  'powershell -Command "Set-Location C:\\\\; Remove-Item .\\\\Windows -Recurse -Force"',
]
const gitDanger=[
  'git branch -D old-branch',
  'git stash clear',
  'git stash drop stash@{0}',
  'git tag -d v1',
  'git reflog delete HEAD@{1}',
  'git worktree remove --force ../feature',
  'git rm -rf src/legacy',
]

test('M12 recursive delete resolves relative safety against effective destructive cwd',()=>{
  for(const command of cwdDanger)assert.equal(evaluateShellCommand(command).decision,'USER_ACTION_REQUIRED',command)
  assert.equal(projectExecutionSurface('cd /etc && rm -rf ./ssh').fragments.at(-1)?.cwdRisk,'system')
  assert.equal(projectExecutionSurface('powershell -Command "Set-Location C:\\\\; Remove-Item .\\\\Windows -Recurse -Force"').fragments.at(-1)?.cwdRisk,'root')
  assert.equal(evaluateShellCommand('cd /tmp && rm -rf ./hi-safe').decision,'ALLOW')
  assert.equal(evaluateShellCommand('powershell -Command "Set-Location C:\\\\Temp; Remove-Item .\\\\hi-safe -Recurse -Force"').decision,'ALLOW')
})

test('M12 local Git data-loss commands share the existing destructive Git admission boundary',()=>{
  for(const command of gitDanger){const result=evaluateShellCommand(command);assert.equal(result.decision,'USER_ACTION_REQUIRED',command);assert.equal(result.reason_code,'destructive-git-action',command)}
  assert.equal(evaluateShellCommand('git branch feature').decision,'ALLOW')
  assert.equal(evaluateShellCommand('git tag v1').decision,'ALLOW')
  assert.equal(evaluateShellCommand('git worktree remove ../feature').decision,'ALLOW')
})


test('M12 Windows command carriers cannot hide destructive execution from the bounded projection',()=>{
  const encoded=Buffer.from('Remove-Item C:\\Windows -Recurse -Force','utf16le').toString('base64')
  for(const command of [`powershell -EncodedCommand ${encoded}`,`pwsh -enc ${encoded}`])assert.equal(evaluateShellCommand(command).decision,'USER_ACTION_REQUIRED',command)
  for(const command of ['cmd /c "rmdir /s /q C:\\Windows"','cmd.exe /c "del /s /q C:\\Users\\Public"'])assert.equal(evaluateShellCommand(command).decision,'USER_ACTION_REQUIRED',command)
  const safeEncoded=Buffer.from("Write-Output 'hello'",'utf16le').toString('base64')
  assert.equal(evaluateShellCommand(`powershell -EncodedCommand ${safeEncoded}`).decision,'ALLOW')
  assert.equal(evaluateShellCommand('cmd /c "echo rmdir /s /q C:\\Windows"').decision,'ALLOW')
})
