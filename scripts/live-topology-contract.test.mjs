import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repo = fileURLToPath(new URL('../', import.meta.url));
const script = join(repo, 'deploy/verify-live-topology.sh');
const image = 'sociobotregistry.azurecr.io/sf-guest-booking-confirm:0123456789ab';

async function fixture({ unsafeServingRevision = false, extraStorage = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'gbc-topology-contract-'));
  const azPath = join(directory, 'az');
  await writeFile(azPath, `#!/usr/bin/env node
const args = process.argv.slice(2);
const image = ${JSON.stringify(image)};
const unsafe = ${JSON.stringify(unsafeServingRevision)};
const extraStorage = ${JSON.stringify(extraStorage)};
const mounted = value => ({
  containers: [{ image, volumeMounts: value ? [{ volumeName: 'data', mountPath: '/data' }, ...(extraStorage ? [{ volumeName: 'product-storage', mountPath: '/product-storage' }] : [])] : null }],
  volumes: value ? [{ name: 'data', storageName: 'sf-guest-booking-confirm-data', storageType: 'AzureFile' }, ...(extraStorage ? [{ name: 'product-storage', storageName: 'product-created', storageType: 'AzureFile' }] : [])] : null,
  scale: { minReplicas: value ? 1 : 1, maxReplicas: value ? 1 : 3 }
});
if (args[0] === 'containerapp' && args[1] === 'show') {
  process.stdout.write(JSON.stringify({ properties: {
    provisioningState: 'Succeeded', latestReadyRevisionName: 'safe-revision', template: mounted(true)
  }}));
} else if (args[0] === 'containerapp' && args[1] === 'revision' && args[2] === 'list') {
  process.stdout.write('1');
} else if (args[0] === 'containerapp' && args[1] === 'replica' && args[2] === 'list') {
  process.stdout.write('1');
} else if (args[0] === 'containerapp' && args[1] === 'revision' && args[2] === 'show') {
  process.stdout.write(JSON.stringify({ properties: { active: true, template: mounted(!unsafe) } }));
} else {
  process.stderr.write('Unexpected az command: ' + args.join(' '));
  process.exit(3);
}
`);
  await chmod(azPath, 0o755);
  return { directory, env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, TOPOLOGY_WAIT_ATTEMPTS: '1', TOPOLOGY_WAIT_SECONDS: '0' } };
}

function verify(env) {
  return spawnSync(script, ['sociobot', 'sf-guest-booking-confirm', image], { cwd: repo, env, encoding: 'utf8' });
}

test('serving topology gate accepts the mounted one-replica revision', async t => {
  const mock = await fixture();
  t.after(() => rm(mock.directory, { recursive: true, force: true }));

  const result = verify(mock.env);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Azure Files \/data, one active revision, one running replica/);
});

test('serving topology gate reproduces and rejects the verifier’s max=3 revision without /data', async t => {
  const mock = await fixture({ unsafeServingRevision: true });
  t.after(() => rm(mock.directory, { recursive: true, force: true }));

  const result = verify(mock.env);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /revision\(name=safe-revision active=true image=.* min=1 max=3 matching_volumes=0 matching_mounts=0 total_volumes=0 total_mounts=0\)/);
});

test('serving topology gate rejects product-created additional storage', async t => {
  const mock = await fixture({ extraStorage: true });
  t.after(() => rm(mock.directory, { recursive: true, force: true }));

  const result = verify(mock.env);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /matching_volumes=1 matching_mounts=1 total_volumes=2 total_mounts=2/);
});
