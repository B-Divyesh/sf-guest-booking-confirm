#!/usr/bin/env node

const [, , rawBaseUrl, expectedBuildSha] = process.argv;
const baseUrl = (rawBaseUrl || 'https://guest-booking-confirm.sociobot.in').replace(/\/$/, '');
const repetitions = Number.parseInt(process.env.RELEASE_VERIFY_REPETITIONS || '3', 10);

if (!expectedBuildSha) {
  console.error('Usage: verify-release.mjs <base-url> <expected-build-sha>');
  process.exit(2);
}
if (!Number.isInteger(repetitions) || repetitions < 1) {
  console.error('RELEASE_VERIFY_REPETITIONS must be a positive integer.');
  process.exit(2);
}

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForIdentity() {
  let last = 'no response';
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`, { cache: 'no-store' });
      const health = await response.json();
      last = `${response.status} ${JSON.stringify(health)}`;
      if (response.ok && health.build_sha === expectedBuildSha) return;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 30) await wait(2_000);
  }
  throw new Error(`live build identity did not become ${expectedBuildSha}; last result: ${last}`);
}

function clientIdentity(run, className) {
  const seed = `${Date.now()}-${process.pid}-${run}-${className}`;
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `198.51.${100 + (hash % 50)}.${10 + (Math.floor(hash / 50) % 200)}`;
}

async function assertBoundary({ path, method, allowance, acceptedStatus, body, headers = {}, run, className }) {
  const client = clientIdentity(run, className);
  const requests = Array.from({ length: allowance + 1 }, () =>
    fetch(`${baseUrl}${path}`, {
      method,
      cache: 'no-store',
      headers: { 'x-forwarded-for': client, ...headers },
      body
    })
  );
  const responses = await Promise.all(requests);
  const statuses = responses.map(response => response.status);
  const expectedStatus = acceptedStatus ?? (method === 'GET' ? 200 : 204);
  const accepted = statuses.filter(status => status === expectedStatus).length;
  const limited = statuses.filter(status => status === 429).length;
  const unexpected = statuses.filter(status => status !== expectedStatus && status !== 429);
  const limitedResponses = responses.filter(response => response.status === 429);
  await Promise.all(responses.map(response => response.arrayBuffer()));

  if (accepted !== allowance || limited !== 1 || unexpected.length > 0) {
    throw new Error(
      `${className} burst ${run} violated the global allowance: ` +
      `expected ${allowance} x ${expectedStatus} and 1 x 429; received ${JSON.stringify(statuses)}`
    );
  }
  if (limitedResponses.some(response => response.headers.get('retry-after') !== '1')) {
    throw new Error(`${className} burst ${run} returned 429 without Retry-After: 1`);
  }
  console.log(`Verified ${className} burst ${run}: ${allowance} accepted, then 429 with Retry-After: 1.`);
}

try {
  await waitForIdentity();
  console.log(`Verified live build identity ${expectedBuildSha}.`);
  for (let run = 1; run <= repetitions; run += 1) {
    await assertBoundary({
      path: '/api/public/settings', method: 'GET', allowance: 40, run, className: 'read'
    });
    await assertBoundary({
      path: '/api/page-view', method: 'POST', allowance: 12, run, className: 'write'
    });
    await assertBoundary({
      path: '/api/license/verify', method: 'POST', allowance: 12, acceptedStatus: 422,
      headers: { 'content-type': 'application/json' }, body: '{}', run,
      className: 'license verification'
    });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
