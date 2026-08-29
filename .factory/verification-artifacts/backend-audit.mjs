const base = process.env.QA_BASE;
if (!base) throw new Error('QA_BASE is required');

const ownerHeaders = {
  'content-type': 'application/json',
  'x-test-oid': 'verification-10-owner',
  'x-forwarded-for': 'verification-10-owner-client',
};

async function call(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const text = await response.text();
  let body = text;
  try { body = JSON.parse(text); } catch {}
  return { status: response.status, headers: Object.fromEntries(response.headers), body };
}

const settings = {
  business_name: 'Verification Workshop',
  service_name: 'Instrument check',
  timezone: 'UTC',
  duration_minutes: 30,
  weekly_hours: Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(day => [day, ['00:00','23:30']])),
  welcome_note: 'Independent verification desk.',
};

const result = {};
result.health = await call('/health');
result.unauthenticatedOwner = await call('/api/owner/status', { headers: { 'x-forwarded-for': 'verification-10-unauth' } });
result.setup = await call('/api/owner/setup', { method: 'POST', headers: ownerHeaders, body: JSON.stringify(settings) });
result.otherOwner = await call('/api/owner/status', { headers: { 'x-test-oid': 'another-owner', 'x-forwarded-for': 'verification-10-other' } });
const slotsResponse = await call('/api/public/slots?days=999', { headers: { 'x-forwarded-for': 'verification-10-slots' } });
const slots = slotsResponse.body.slots;
result.slotBoundary = { status: slotsResponse.status, count: slots.length, first: slots[0], last: slots.at(-1) };

const invalidBase = { starts_at: slots[0].start, phone: null, consent: true };
result.invalidName = await call('/api/bookings', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': 'verification-10-invalid-name' }, body: JSON.stringify({ ...invalidBase, guest_name: 'A', email: 'valid@example.test' }) });
result.invalidEmail = await call('/api/bookings', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': 'verification-10-invalid-email' }, body: JSON.stringify({ ...invalidBase, guest_name: 'Valid Guest', email: 'broken' }) });
result.missingConsent = await call('/api/bookings', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': 'verification-10-consent' }, body: JSON.stringify({ ...invalidBase, guest_name: 'Valid Guest', email: 'valid@example.test', consent: false }) });
result.closedSlot = await call('/api/bookings', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': 'verification-10-closed-slot' }, body: JSON.stringify({ ...invalidBase, guest_name: 'Valid Guest', email: 'valid@example.test', starts_at: '2000-01-01T00:00:00Z' }) });

const create = (slot, name, client) => call('/api/bookings', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': client }, body: JSON.stringify({ guest_name: name, email: `${name.toLowerCase().replaceAll(' ', '.')}@example.test`, phone: '+1 555 0100', starts_at: slot.start, consent: true }) });
result.normalCreate = await create(slots[0], 'Normal Guest', 'verification-10-create-normal');
const normalToken = result.normalCreate.body.token;
const ownerList = await call('/api/owner/bookings', { headers: ownerHeaders });
const normalBooking = ownerList.body.bookings.find(item => item.reference === result.normalCreate.body.reference);
result.pendingState = { status: normalBooking.status, tokenExposedToOwner: normalBooking.guest_token === normalToken };
result.normalApproval = await call(`/api/owner/bookings/${normalBooking.id}/approve`, { method: 'PATCH', headers: ownerHeaders });
result.afterApproval = await call(`/api/guest/${normalToken}`, { headers: { 'x-forwarded-for': 'verification-10-guest-view' } });
result.concurrentConfirm = await Promise.all([0, 1].map(index => call(`/api/guest/${normalToken}/confirm`, { method: 'POST', headers: { 'x-forwarded-for': `verification-10-confirm-${index}` } })));
result.calendar = await call(`/api/guest/${normalToken}/calendar.ics`, { headers: { 'x-forwarded-for': 'verification-10-calendar' } });
result.reminder = await call(`/api/owner/bookings/${normalBooking.id}/reminder`, { method: 'PATCH', headers: ownerHeaders });
result.afterReminder = (await call('/api/owner/bookings', { headers: ownerHeaders })).body.bookings.find(item => item.id === normalBooking.id);
result.invalidToken = await call('/api/guest/not-a-real-private-token', { headers: { 'x-forwarded-for': 'verification-10-bad-token' } });

const collidedCreates = await Promise.all([
  create(slots[1], 'Collision One', 'verification-10-collision-create-1'),
  create(slots[1], 'Collision Two', 'verification-10-collision-create-2'),
]);
const afterCollisionCreates = await call('/api/owner/bookings', { headers: ownerHeaders });
const collisionBookings = afterCollisionCreates.body.bookings.filter(item => collidedCreates.some(created => created.body.reference === item.reference));
result.concurrentApproval = await Promise.all(collisionBookings.map((item, index) => call(`/api/owner/bookings/${item.id}/approve`, { method: 'PATCH', headers: { ...ownerHeaders, 'x-forwarded-for': `verification-10-approve-${index}` } })));

const readClient = `verification-10-read-${Date.now()}`;
const readBurst = await Promise.all(Array.from({ length: 41 }, () => call('/api/public/settings', { headers: { 'x-forwarded-for': readClient } })));
result.readRateLimit = readBurst.map(item => ({ status: item.status, retryAfter: item.headers['retry-after'] ?? null })).reduce((summary, item) => { const key = `${item.status}:${item.retryAfter}`; summary[key] = (summary[key] || 0) + 1; return summary; }, {});

const writeClient = `verification-10-write-${Date.now()}`;
const writeBurst = await Promise.all(Array.from({ length: 13 }, () => call('/api/page-view', { method: 'POST', headers: { 'x-forwarded-for': writeClient } })));
result.writeRateLimit = writeBurst.map(item => ({ status: item.status, retryAfter: item.headers['retry-after'] ?? null })).reduce((summary, item) => { const key = `${item.status}:${item.retryAfter}`; summary[key] = (summary[key] || 0) + 1; return summary; }, {});

const licenseClient = `verification-10-license-${Date.now()}`;
const licenseBurst = await Promise.all(Array.from({ length: 13 }, () => call('/api/license/verify', { method: 'POST', headers: { ...ownerHeaders, 'x-forwarded-for': licenseClient }, body: JSON.stringify({ license: 'short' }) })));
result.licenseRateLimit = licenseBurst.map(item => ({ status: item.status, retryAfter: item.headers['retry-after'] ?? null })).reduce((summary, item) => { const key = `${item.status}:${item.retryAfter}`; summary[key] = (summary[key] || 0) + 1; return summary; }, {});

const started = performance.now();
const load = await Promise.all(Array.from({ length: 100 }, (_, index) => call('/api/public/settings', { headers: { 'x-forwarded-for': `verification-10-load-${index}` } }).then(item => ({ status: item.status, elapsed: performance.now() - started }))));
const sorted = load.map(item => item.elapsed).sort((a, b) => a - b);
result.load100 = { counts: load.reduce((summary, item) => { summary[item.status] = (summary[item.status] || 0) + 1; return summary; }, {}), totalMs: Math.round(performance.now() - started), p95Ms: Math.round(sorted[Math.floor(sorted.length * 0.95) - 1]) };
result.persistenceToken = normalToken;

console.log(JSON.stringify(result, null, 2));
