import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const claims = JSON.parse(readFileSync(new URL('../.factory/claims.json', import.meta.url), 'utf8'));
const browserTests = readFileSync(new URL('../tests/booking-flow.spec.ts', import.meta.url), 'utf8');
const rustTests = readFileSync(new URL('../src/main.rs', import.meta.url), 'utf8');
const publicCopy = readFileSync(new URL('../frontend/src/app.ts', import.meta.url), 'utf8');

test('the claims registry has one executable regression for every public promise', () => {
  const ids = claims.map(claim => claim.id);
  assert.equal(new Set(ids).size, ids.length, 'claim IDs must be unique');
  for (const required of [
    'anonymous-page-view-count',
    'browser-license-storage',
    'revoked-license-fallback',
    'generated-artwork-provenance',
  ]) {
    assert.ok(ids.includes(required), `missing verifier-required claim: ${required}`);
  }

  for (const claim of claims) {
    assert.equal(typeof claim.claim, 'string');
    assert.equal(typeof claim.where, 'string');
    assert.equal(typeof claim.sandbox, 'string');
    if (claim.test.includes('test:e2e')) {
      assert.equal(
        browserTests.split(`@claim:${claim.id}`).length - 1,
        1,
        `${claim.id} must tag exactly one browser test`,
      );
    } else if (claim.test.startsWith('cargo test --locked ')) {
      const testName = claim.test.slice('cargo test --locked '.length);
      assert.equal(
        rustTests.split(`fn ${testName}(`).length - 1,
        1,
        `${claim.id} must name exactly one Rust test`,
      );
    } else {
      assert.equal(claim.test, 'npm run test:billing', `${claim.id} uses an unknown claim command`);
    }
  }

  const registeredBrowserTags = [...browserTests.matchAll(/@claim:([a-z0-9-]+)/g)].map(match => match[1]);
  for (const id of registeredBrowserTags) assert.ok(ids.includes(id), `browser claim ${id} is not registered`);
  assert.ok(!publicCopy.includes('We do not sell data or use it for advertising.'));
});
