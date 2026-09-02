import assert from 'node:assert/strict';
import { access, chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repo = fileURLToPath(new URL('../', import.meta.url));
const release = join(repo, 'deploy/release.sh');

test('the repository deploy command uses the guarded fleet release wrapper', async () => {
  const packageJson = JSON.parse(await readFile(join(repo, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts.deploy, './deploy/release.sh');
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'gbc-deploy-contract-'));
  const callsPath = join(directory, 'calls.log');
  const fleetPath = join(directory, 'fleet-deploy');
  const topologyPath = join(directory, 'verify-topology');
  const ratePath = join(directory, 'verify-rate-limits');
  const sourceSha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
  const expectedImage = `sociobotregistry.azurecr.io/sf-guest-booking-confirm:${sourceSha.slice(0, 12)}`;

  await writeFile(fleetPath, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (process.env.WO_DATA_DIR !== '/data' || args.length !== 4 || args[0] !== 'guest-booking-confirm' || args[2] !== 'Dockerfile' || args[3] !== '8080') process.exit(3);
fs.appendFileSync(process.env.MOCK_CALLS, 'fleet ' + args.join(' ') + '\\n');
`);
  await writeFile(topologyPath, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args.join(' ') !== ${JSON.stringify(`sociobot sf-guest-booking-confirm ${expectedImage}`)}) process.exit(3);
fs.appendFileSync(process.env.MOCK_CALLS, 'topology ' + args.join(' ') + '\\n');
`);
  await writeFile(ratePath, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args.join(' ') !== ${JSON.stringify(`https://release.test ${sourceSha}`)}) process.exit(3);
fs.appendFileSync(process.env.MOCK_CALLS, 'rate ' + args.join(' ') + '\\n');
`);
  await Promise.all([chmod(fleetPath, 0o755), chmod(topologyPath, 0o755), chmod(ratePath, 0o755)]);

  return {
    directory,
    callsPath,
    sourceSha,
    env: {
      ...process.env,
      WO_DATA_DIR: '/data',
      FLEET_DEPLOY_CONTAINER: fleetPath,
      TOPOLOGY_VERIFY_SCRIPT: topologyPath,
      RELEASE_VERIFY_SCRIPT: ratePath,
      PUBLIC_URL: 'https://release.test',
      MOCK_CALLS: callsPath,
    },
  };
}

test('release delegates the managed /data topology to the fleet and verifies it before and after rate checks', async t => {
  const mock = await fixture();
  t.after(() => rm(mock.directory, { recursive: true, force: true }));

  const result = spawnSync(release, { cwd: repo, env: mock.env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const calls = (await readFile(mock.callsPath, 'utf8')).trim().split('\n');
  const expectedImage = `sociobotregistry.azurecr.io/sf-guest-booking-confirm:${mock.sourceSha.slice(0, 12)}`;
  assert.equal(calls.length, 4);
  assert.match(calls[0], /^fleet guest-booking-confirm .+ Dockerfile 8080$/);
  assert.equal(calls[1], `topology sociobot sf-guest-booking-confirm ${expectedImage}`);
  assert.equal(calls[2], `rate https://release.test ${mock.sourceSha}`);
  assert.equal(calls[3], `topology sociobot sf-guest-booking-confirm ${expectedImage}`);

  const script = await readFile(release, 'utf8');
  assert.doesNotMatch(script, /\baz (?:acr|storage|rest|containerapp)\b/);
  await assert.rejects(access(join(repo, 'deploy/ensure-persistent-data.sh'), constants.F_OK));
  await assert.rejects(access(join(repo, 'deploy/apply-safe-template.sh'), constants.F_OK));
  await assert.rejects(access(join(repo, 'deploy/enforce-single-replica.sh'), constants.F_OK));
});

test('release refuses to publish when the fleet work order does not declare /data', async t => {
  const mock = await fixture();
  t.after(() => rm(mock.directory, { recursive: true, force: true }));

  const result = spawnSync(release, { cwd: repo, env: { ...mock.env, WO_DATA_DIR: '' }, encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /deploy\.data_dir to \/data/);
  await assert.rejects(access(mock.callsPath, constants.F_OK));
});
