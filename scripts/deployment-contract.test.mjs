import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repo = fileURLToPath(new URL('../', import.meta.url));

test('the repository deploy command cannot bypass the single-replica release gate', async () => {
  const packageJson = JSON.parse(await readFile(join(repo, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts.deploy, './deploy/release.sh');
});

async function fixture({ stuck = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'gbc-deploy-contract-'));
  const statePath = join(directory, 'state.json');
  const logPath = join(directory, 'calls.log');
  const azPath = join(directory, 'az');
  const deployPath = join(directory, 'factory-deploy');
  const verifyPath = join(directory, 'verify-release');

  await writeFile(statePath, JSON.stringify({
    min: 1, max: 1, mode: 'single', active: 1, running: 1,
    share: false, environmentStorage: false, persistent: true,
  }));
  await writeFile(azPath, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const statePath = process.env.MOCK_AZ_STATE;
const logPath = process.env.MOCK_AZ_LOG;
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
fs.appendFileSync(logPath, 'az ' + args.join(' ') + '\\n');
const query = args[args.indexOf('--query') + 1];
if (args[0] === 'storage' && args[1] === 'share-rm' && args[2] === 'show') {
  process.exit(state.share ? 0 : 1);
} else if (args[0] === 'storage' && args[1] === 'share-rm' && args[2] === 'create') {
  state.share = true;
  fs.writeFileSync(statePath, JSON.stringify(state));
} else if (args[0] === 'storage' && args[1] === 'account' && args[2] === 'keys') {
  process.stdout.write('mock-storage-key');
} else if (args[0] === 'containerapp' && args[1] === 'env' && args[2] === 'storage' && args[3] === 'show') {
  process.exit(state.environmentStorage ? 0 : 1);
} else if (args[0] === 'containerapp' && args[1] === 'env' && args[2] === 'storage' && args[3] === 'set') {
  state.environmentStorage = true;
  fs.writeFileSync(statePath, JSON.stringify(state));
} else if (args[0] === 'rest') {
  const body = JSON.parse(args[args.indexOf('--body') + 1]);
  if ('cooldownPeriod' in body.properties.template.scale || 'pollingInterval' in body.properties.template.scale || 'ephemeralStorage' in body.properties.template.containers[0].resources) {
    process.stderr.write('read-only fields leaked into the Azure template patch\\n');
    process.exit(3);
  }
  const volumes = body.properties?.template?.volumes || [];
  const mounts = body.properties?.template?.containers?.[0]?.volumeMounts || [];
  state.persistent = volumes.some(item => item.name === 'gbc-data' && item.storageName === 'guest-booking-confirm-data') && mounts.some(item => item.volumeName === 'gbc-data' && item.mountPath === '/data');
  fs.writeFileSync(statePath, JSON.stringify(state));
} else if (args[0] === 'containerapp' && args[1] === 'update') {
  state.min = Number(args[args.indexOf('--min-replicas') + 1]);
  state.max = Number(args[args.indexOf('--max-replicas') + 1]);
  if (process.env.MOCK_AZ_STUCK !== '1') state.running = state.max;
  fs.writeFileSync(statePath, JSON.stringify(state));
} else if (args[0] === 'containerapp' && args[1] === 'revision' && args[2] === 'set-mode') {
  state.mode = args[args.indexOf('--mode') + 1];
  state.active = state.mode === 'single' ? 1 : 2;
  fs.writeFileSync(statePath, JSON.stringify(state));
} else if (args[0] === 'containerapp' && args[1] === 'show' && !args.includes('--query')) {
  process.stdout.write(JSON.stringify({
    id: '/subscriptions/mock/resourceGroups/sociobot/providers/Microsoft.App/containerApps/sf-guest-booking-confirm',
    properties: { template: {
      containers: [{ name: 'app', image: 'registry.test/app:sha', resources: { cpu: 0.5, memory: '1Gi', ephemeralStorage: '2Gi' }, env: [{ name: 'PORT', value: '8080' }], volumeMounts: state.persistent ? [{ volumeName: 'gbc-data', mountPath: '/data' }] : null }],
      volumes: state.persistent ? [{ name: 'gbc-data', storageType: 'AzureFile', storageName: 'guest-booking-confirm-data' }] : null,
      scale: { minReplicas: state.min, maxReplicas: state.max, cooldownPeriod: 300, pollingInterval: 30 }
    } }
  }));
} else if (args[0] === 'containerapp' && args[1] === 'show') {
  const values = {
    'properties.template.scale.minReplicas': state.min,
    'properties.template.scale.maxReplicas': state.max,
    'properties.latestReadyRevisionName': 'mock-revision',
    "properties.template.volumes[?name == 'gbc-data' && storageName == 'guest-booking-confirm-data' && storageType == 'AzureFile'] | length(@)": state.persistent ? 1 : 0,
    "properties.template.containers[0].volumeMounts[?volumeName == 'gbc-data' && mountPath == '/data'] | length(@)": state.persistent ? 1 : 0
  };
  process.stdout.write(String(values[query]));
} else if (args[0] === 'containerapp' && args[1] === 'revision' && args[2] === 'list') {
  process.stdout.write(String(state.active));
} else if (args[0] === 'containerapp' && args[1] === 'replica' && args[2] === 'list') {
  process.stdout.write(String(state.running));
} else {
  process.stderr.write('Unexpected az command: ' + args.join(' ') + '\\n');
  process.exit(3);
}
`);
  await writeFile(deployPath, `#!/usr/bin/env node
const fs = require('node:fs');
const statePath = process.env.MOCK_AZ_STATE;
const logPath = process.env.MOCK_AZ_LOG;
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
state.min = 1;
state.max = 3;
state.running = 2;
state.persistent = false;
fs.writeFileSync(statePath, JSON.stringify(state));
fs.appendFileSync(logPath, 'factory-deploy ' + process.argv.slice(2).join(' ') + '\\n');
`);
  await writeFile(verifyPath, `#!/usr/bin/env node
const fs = require('node:fs');
const state = JSON.parse(fs.readFileSync(process.env.MOCK_AZ_STATE, 'utf8'));
if (state.min !== 1 || state.max !== 1 || state.mode !== 'single' || state.active !== 1 || state.running !== 1 || !state.persistent) {
  process.stderr.write('live verification started before safe topology: ' + JSON.stringify(state) + '\\n');
  process.exit(4);
}
fs.appendFileSync(process.env.MOCK_AZ_LOG, 'verify-release ' + process.argv.slice(2).join(' ') + '\\n');
`);
  await Promise.all([chmod(azPath, 0o755), chmod(deployPath, 0o755), chmod(verifyPath, 0o755)]);

  return {
    directory,
    statePath,
    logPath,
    deployPath,
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      FACTORY_DEPLOY_SCRIPT: deployPath,
      RELEASE_VERIFY_SCRIPT: verifyPath,
      PUBLIC_URL: 'https://release.test',
      MOCK_AZ_STATE: statePath,
      MOCK_AZ_LOG: logPath,
      MOCK_AZ_STUCK: stuck ? '1' : '0',
      REPLICA_WAIT_ATTEMPTS: '1',
      REPLICA_WAIT_SECONDS: '0'
    }
  };
}

test('release repairs the factory max=3 default and verifies one serving replica', async t => {
  const mock = await fixture();
  t.after(() => rm(mock.directory, { recursive: true, force: true }));

  const result = spawnSync(join(repo, 'deploy/release.sh'), { cwd: repo, env: mock.env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const state = JSON.parse(await readFile(mock.statePath, 'utf8'));
  assert.deepEqual(state, {
    min: 1, max: 1, mode: 'single', active: 1, running: 1,
    share: true, environmentStorage: true, persistent: true,
  });

  const calls = (await readFile(mock.logPath, 'utf8')).trim().split('\n');
  assert.match(calls[0], /^factory-deploy guest-booking-confirm .* Dockerfile 8080$/);
  assert.ok(calls.some(call => /^az storage share-rm create /.test(call)));
  assert.ok(calls.some(call => /^az containerapp env storage set /.test(call)));
  assert.ok(calls.some(call => /^az rest --method patch /.test(call)));
  assert.ok(calls.some(call => /^verify-release https:\/\/release\.test [0-9a-f]{40}$/.test(call)));
  assert.equal(calls.filter(call => /^az containerapp update /.test(call)).length, 2);
  assert.equal(calls.filter(call => /^az containerapp revision set-mode /.test(call)).length, 2);
  assert.match(result.stdout, /one active revision and one running replica/);
});

test('release fails instead of claiming success while two replicas still serve', async t => {
  const mock = await fixture({ stuck: true });
  t.after(() => rm(mock.directory, { recursive: true, force: true }));

  const result = spawnSync(join(repo, 'deploy/release.sh'), { cwd: repo, env: mock.env, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /running_replicas=2/);

  const state = JSON.parse(await readFile(mock.statePath, 'utf8'));
  assert.equal(state.max, 1, 'the desired scale is corrected even if convergence stalls');
  assert.equal(state.running, 2, 'the test preserves the unsafe serving state that must block release');
  assert.equal(state.persistent, true, 'persistent data is repaired before topology convergence is checked');
});
