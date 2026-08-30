import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const verifier = fileURLToPath(new URL('./verify-release.mjs', import.meta.url));
const buildSha = '0123456789abcdef0123456789abcdef01234567';

function startFixture({ splitReplicas = 1 } = {}) {
  const counters = new Map();
  let nextReplica = 0;
  const server = createServer((request, response) => {
    if (request.url === '/health') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ status: 'ok', build_sha: buildSha }));
      return;
    }
    const limit = request.method === 'GET' ? 40 : 12;
    const acceptedStatus = request.method === 'GET' ? 200 : request.url === '/api/license/verify' ? 422 : 204;
    const replica = nextReplica++ % splitReplicas;
    const key = `${request.headers['x-forwarded-for']}:${request.method}:${replica}`;
    const count = counters.get(key) || 0;
    counters.set(key, count + 1);
    if (count >= limit) {
      response.statusCode = 429;
      response.setHeader('retry-after', '1');
      response.end('limited');
    } else {
      response.statusCode = acceptedStatus;
      response.end();
    }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function runVerifier(url) {
  return new Promise(resolve => {
    const child = spawn(verifier, [url, buildSha], {
      env: { ...process.env, RELEASE_VERIFY_REPETITIONS: '3' }
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

test('release verification proves all read and write boundaries repeatedly', async t => {
  const server = await startFixture();
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const result = await runVerifier(`http://127.0.0.1:${address.port}`);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Verified live build identity/);
  assert.equal((result.stdout.match(/Verified read burst/g) || []).length, 3);
  assert.equal((result.stdout.match(/Verified write burst/g) || []).length, 3);
  assert.equal((result.stdout.match(/Verified license verification burst/g) || []).length, 3);
});

test('release verification rejects the verifier’s three-replica multiplied allowance signature', async t => {
  const server = await startFixture({ splitReplicas: 3 });
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const result = await runVerifier(`http://127.0.0.1:${address.port}`);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /violated the global allowance/);
  assert.match(result.stderr, /received \[200/);
});
