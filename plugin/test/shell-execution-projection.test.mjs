import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateShellCommand} from '../dist/runtime/process/shell-policy.js'
import {hasProjectedPosixBackgroundExecution,hasTopLevelPosixBackgroundOperator,projectExecutionSurface} from '../dist/runtime/safety/execution-projection.js'
import {externalEffectCommand,canonicalExternalCommand} from '../dist/runtime/safety/command-classifier.js'

function restricted(command){const shell=evaluateShellCommand(command);return shell.decision==='DENY'||shell.decision==='USER_ACTION_REQUIRED'||externalEffectCommand(command)}


test('top-level background detection distinguishes shell control from quoted comment and redirection data',()=>{
  assert.equal(hasTopLevelPosixBackgroundOperator('python3 app.py &'),true)
  assert.equal(hasTopLevelPosixBackgroundOperator('nohup python3 app.py > flask.log 2>&1 &'),true)
  assert.equal(hasTopLevelPosixBackgroundOperator('echo left & echo right'),true)
  assert.equal(hasTopLevelPosixBackgroundOperator('echo "a & b" && echo done'),false)
  assert.equal(hasTopLevelPosixBackgroundOperator("echo '&lt;script&gt;'"),false)
  assert.equal(hasTopLevelPosixBackgroundOperator("# Check if script tags are escaped in the HTML (should appear as &lt;script&gt;)\ncurl -s http://localhost:5000/ | grep -o '&lt;script&gt;' | head -3"),false)
  assert.equal(hasTopLevelPosixBackgroundOperator('echo ok &>flask.log'),false)
  assert.equal(hasTopLevelPosixBackgroundOperator('echo ok 2>&1'),false)
  assert.equal(hasTopLevelPosixBackgroundOperator('echo ok |& cat'),false)
  assert.equal(hasTopLevelPosixBackgroundOperator('echo foo\\&bar'),false)
})

test('projected background detection follows executable carriers without treating inert text as execution',()=>{
  assert.equal(hasProjectedPosixBackgroundExecution('python3 app.py &'),true)
  assert.equal(hasProjectedPosixBackgroundExecution(`node -e "const {execSync}=require('child_process'); execSync('PORT=3100 node src/server.js &')"`),true)
  assert.equal(hasProjectedPosixBackgroundExecution(`node -e "console.log('PORT=3100 node src/server.js &')"`),false)
  assert.equal(hasProjectedPosixBackgroundExecution('echo "node src/server.js &"'),false)
  assert.equal(hasProjectedPosixBackgroundExecution("# inert & text\necho '&lt;script&gt;'"),false)
  assert.equal(hasProjectedPosixBackgroundExecution("# Check if script tags are escaped in the HTML (should appear as &lt;script&gt;)\ncurl -s http://localhost:5000/ | grep -o '&lt;script&gt;' | head -3"),false)
})

const HOLDOUT=[
  ['safe-sub-output-git','echo $(printf "git reset --hard")',false],
  ['safe-sub-output-rm','echo $(printf "rm -rf /")',false],
  ['safe-shell-echo','bash -c \'echo "rm -rf /"\'',false],
  ['safe-awk-print','awk \'BEGIN { print "rm -rf /" }\'',false],
  ['safe-ps-text','powershell -Command "Write-Output \'Remove-Item . -Recurse -Force\'"',false],
  ['safe-rm-tmp','rm -rf /tmp/hi-holdout',false],
  ['safe-rm-local','rm -rf ./dist',false],
  ['safe-git-clean-local','git clean -fd -- ./dist',false],
  ['safe-git-restore-staged','git restore --staged src/a.ts',false],
  ['safe-ps-temp','powershell -Command "Remove-Item C:\\Temp\\hi-holdout -Recurse -Force"',false],
  ['safe-prefix-local-cleanup','MODE=ci rm -rf ./dist',false],
  ['safe-prefix-inert-text','MODE=ci echo "rm -rf /"',false],
  ['danger-prefix-root-delete','MODE=ci rm -rf /',true],
  ['danger-prefix-dynamic-target','TMPDIR=/non-temp rm -rf $TMPDIR/foo',true],
  ['danger-prefix-git-reset','MODE=ci git reset --hard',true],
  ['danger-prefix-mkfs','MODE=ci mkfs.ext4 /dev/sda',true],
  ['danger-prefix-external-effect','MODE=ci git push origin main',true],
  ['danger-command-wrapper','command rm -rf /',true],
  ['danger-nohup-wrapper','nohup rm -rf /',true],
  ['danger-time-wrapper','time rm -rf /',true],
  ['danger-eval','eval \'rm -rf /\'',true],
  ['danger-find-exec','find / -exec rm -rf {} +',true],
  ['danger-find-delete-home','find /home -delete',true],
  ['danger-python-system','python -c \'import os; os.system("rm -rf /")\'',true],
  ['danger-perl-system','perl -e \'system("rm -rf /")\'',true],
  ['danger-node-exec','node -e \'require("child_process").execSync("rm -rf /")\'',true],
  ['danger-xargs-replace','printf / | xargs -I{} sh -c \'rm -rf "$1"\' _ {}',true],
  ['danger-parallel','parallel rm -rf ::: /',true],
  ['danger-ps-windows','powershell -Command "Remove-Item C:\\Windows -Recurse -Force"',true],
  ['danger-nested-push-output','echo $(git push origin main)',true],
  ['safe-literal-push','echo "git push origin main"',false],
]

test('holdout separates inert dangerous-looking data from executable destructive carriers',()=>{
  const misses=[]
  for(const [id,command,expected] of HOLDOUT){const actual=restricted(command);if(actual!==expected)misses.push({id,command,expected,actual,decision:evaluateShellCommand(command)})}
  assert.deepEqual(misses,[])
})

test('bounded execution projection derives executable children instead of scanning inert output text',()=>{
  const inert=projectExecutionSurface('echo $(printf "rm -rf /")')
  assert.equal(inert.fragments.some(x=>x.text==='rm -rf /'),false)
  assert.ok(inert.fragments.some(x=>x.text.startsWith('printf ')))

  const evalProjection=projectExecutionSurface("eval 'rm -rf /'")
  assert.ok(evalProjection.fragments.some(x=>x.origin==='embedded-execution'&&x.text==='rm -rf /'))

  const findProjection=projectExecutionSurface('find / -exec rm -rf {} +')
  assert.ok(findProjection.fragments.some(x=>x.origin==='embedded-execution'&&x.text==='rm -rf /'))

  const interpreterProjection=projectExecutionSurface("python -c 'import os; os.system(\"rm -rf /\")'")
  assert.ok(interpreterProjection.fragments.some(x=>x.origin==='embedded-execution'&&x.text==='rm -rf /'))

  const parallelProjection=projectExecutionSurface('parallel rm -rf ::: /')
  assert.ok(parallelProjection.fragments.some(x=>x.origin==='embedded-execution'&&x.text==='rm -rf /'))

  const xargsProjection=projectExecutionSurface("printf / | xargs -I{} sh -c 'rm -rf \"$1\"' _ {}")
  assert.ok(xargsProjection.fragments.some(x=>x.origin==='shell-wrapper'&&x.text.includes('rm -rf')&&x.text.includes('$1')))
})

test('projection preserves CWD and Windows-path risk while bounded temporary cleanup remains admissible',()=>{
  const cwd=projectExecutionSurface('cd / && rm -rf .')
  assert.ok(cwd.fragments.some(x=>x.text==='rm -rf .'&&x.cwdRisk==='root'))

  const windows=projectExecutionSurface('powershell -Command "Remove-Item C:\\Windows -Recurse -Force"')
  assert.ok(windows.fragments.some(x=>x.dialect==='powershell'&&x.text.includes('C:\\Windows')))
  assert.equal(evaluateShellCommand('powershell -Command "Remove-Item C:\\Temp\\hi-holdout -Recurse -Force"').decision,'ALLOW')
})

test('nested external effects reuse Hi authority classification and cannot become canonical by wrapping',()=>{
  const nested='echo $(git push origin main)'
  assert.equal(externalEffectCommand(nested),true)
  assert.equal(canonicalExternalCommand(nested),false)
  assert.equal(externalEffectCommand('echo "git push origin main"'),false)
})

test('malformed destructive execution fails closed without unbounded recursive analysis',()=>{
  const command='rm -rf $(printf unsafe'
  const projection=projectExecutionSurface(command)
  assert.equal(projection.uncertain,true)
  assert.ok(projection.uncertainty.includes('unterminated-command-substitution'))
  assert.equal(evaluateShellCommand(command).decision,'USER_ACTION_REQUIRED')
  assert.ok(projection.workUnits<=524288)
})


test('valid shell data and comment vocabulary cannot impersonate shell control semantics',()=>{
  const command=`echo safe
# The template itself doesn't render note data - JS does via textContent
curl -s -X DELETE http://127.0.0.1:5000/notes/5`
  assert.equal(evaluateShellCommand(command).decision,'ALLOW')
  assert.equal(evaluateShellCommand(`python -c "print('SELECT id FROM notes')"`).decision,'ALLOW')
})
