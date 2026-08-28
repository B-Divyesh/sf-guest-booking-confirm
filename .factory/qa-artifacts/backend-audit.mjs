import { writeFile } from 'node:fs/promises';

const base = 'http://127.0.0.1:4180/api';
let ip = 10;
async function call(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('x-forwarded-for', `203.0.113.${ip++}`);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const text = await response.text();
  let body = text;
  try { body = JSON.parse(text); } catch {}
  return { status: response.status, headers: Object.fromEntries(response.headers), body };
}

const hours = Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(day => [day, ['00:00','23:30']]));
const setupBase = { business_name: 'Boundary Books', service_name: 'Book consultation', timezone: 'UTC', duration_minutes: 30, weekly_hours: hours, welcome_note: 'Choose a time for a short book consultation.', password: 'correct-horse-battery' };
const out = {};

out.initialStatus = await call('/owner/status');
out.invalidSetup = {};
for (const [name, payload] of Object.entries({
  shortBusiness: { ...setupBase, business_name: 'A' },
  shortService: { ...setupBase, service_name: 'A' },
  badTimezone: { ...setupBase, timezone: 'Moon/Base' },
  durationLow: { ...setupBase, duration_minutes: 14 },
  durationHigh: { ...setupBase, duration_minutes: 481 },
  shortPassword: { ...setupBase, password: 'short' },
})) out.invalidSetup[name] = await call('/owner/setup', { method: 'POST', body: JSON.stringify(payload) });

out.setup = await call('/owner/setup', { method: 'POST', body: JSON.stringify(setupBase) });
const token = out.setup.body.token;
const auth = { authorization: `Bearer ${token}` };
out.secondSetup = await call('/owner/setup', { method: 'POST', body: JSON.stringify(setupBase) });
out.ownerUnauthorized = await call('/owner/bookings');
out.ownerWrongPassword = await call('/owner/login', { method: 'POST', body: JSON.stringify({ password: 'definitely-wrong' }) });
out.slots = await call('/public/slots?days=3');
const firstSlot = out.slots.body.slots[0].start;
const secondSlot = out.slots.body.slots[1].start;

out.invalidBookings = {};
const bookingBase = { guest_name: 'Ada Guest', email: 'ada@example.com', phone: null, starts_at: firstSlot, consent: true };
for (const [name, payload] of Object.entries({
  shortName: { ...bookingBase, guest_name: 'A' },
  longName: { ...bookingBase, guest_name: 'x'.repeat(81) },
  badEmail: { ...bookingBase, email: 'not-an-email' },
  noConsent: { ...bookingBase, consent: false },
  longPhone: { ...bookingBase, phone: '1'.repeat(31) },
  badTime: { ...bookingBase, starts_at: 'not-a-time' },
  offGridTime: { ...bookingBase, starts_at: new Date(Date.parse(firstSlot) + 5 * 60_000).toISOString() },
})) out.invalidBookings[name] = await call('/bookings', { method: 'POST', body: JSON.stringify(payload) });

out.boundaryBooking = await call('/bookings', { method: 'POST', body: JSON.stringify({ ...bookingBase, guest_name: 'AB', email: 'a@b', starts_at: secondSlot }) });
out.icsBeforeConfirm = await call(`/guest/${out.boundaryBooking.body.token}/calendar.ics`);

const collisionCreates = await Promise.all(Array.from({ length: 12 }, (_, n) => call('/bookings', {
  method: 'POST',
  body: JSON.stringify({ ...bookingBase, guest_name: `Guest ${n}`, email: `guest${n}@example.com` }),
})));
out.collisionCreateStatuses = Object.groupBy(collisionCreates, x => x.status);
out.ownerListBeforeApproval = await call('/owner/bookings', { headers: auth });
const collisionIds = out.ownerListBeforeApproval.body.bookings.filter(x => x.starts_at === firstSlot).map(x => x.id);
const approvals = await Promise.all(collisionIds.map(id => call(`/owner/bookings/${id}/approve`, { method: 'PATCH', headers: auth })));
out.concurrentApprovalStatuses = approvals.map(x => x.status);
out.ownerListAfterApproval = await call('/owner/bookings', { headers: auth });
out.acceptedAtSameTime = out.ownerListAfterApproval.body.bookings.filter(x => x.starts_at === firstSlot && ['awaiting_confirmation','confirmed'].includes(x.status)).length;

const approved = out.ownerListAfterApproval.body.bookings.find(x => x.starts_at === firstSlot && x.status === 'awaiting_confirmation');
const approvedCreate = collisionCreates.find(x => x.body.reference === approved?.reference);
if (approvedCreate) {
  const guestToken = approvedCreate.body.token;
  out.confirmFirst = await call(`/guest/${guestToken}/confirm`, { method: 'POST' });
  out.confirmSecond = await call(`/guest/${guestToken}/confirm`, { method: 'POST' });
  out.icsAfterConfirm = await call(`/guest/${guestToken}/calendar.ics`);
  out.cancelAfterConfirm = await call(`/guest/${guestToken}/cancel`, { method: 'POST' });
  out.cancelSecond = await call(`/guest/${guestToken}/cancel`, { method: 'POST' });
  out.rescheduleAfterCancel = await call(`/guest/${guestToken}/reschedule`, { method: 'POST', body: JSON.stringify({ starts_at: secondSlot }) });
}

await writeFile('.factory/qa-artifacts/backend-audit.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  invalidSetup: Object.fromEntries(Object.entries(out.invalidSetup).map(([k,v]) => [k, v.status])),
  setup: out.setup.status,
  secondSetup: out.secondSetup.status,
  ownerUnauthorized: out.ownerUnauthorized.status,
  ownerWrongPassword: out.ownerWrongPassword.status,
  slotCount: out.slots.body.slots.length,
  invalidBookings: Object.fromEntries(Object.entries(out.invalidBookings).map(([k,v]) => [k, v.status])),
  boundaryBooking: out.boundaryBooking.status,
  icsBeforeConfirm: out.icsBeforeConfirm.status,
  collisionCreates: collisionCreates.map(x => x.status),
  concurrentApprovals: out.concurrentApprovalStatuses,
  acceptedAtSameTime: out.acceptedAtSameTime,
  confirmFirst: out.confirmFirst?.status,
  confirmSecond: out.confirmSecond?.status,
  icsAfterConfirm: { status: out.icsAfterConfirm?.status, type: out.icsAfterConfirm?.headers['content-type'], disposition: out.icsAfterConfirm?.headers['content-disposition'], hasConfirmed: String(out.icsAfterConfirm?.body).includes('STATUS:CONFIRMED') },
  cancelAfterConfirm: out.cancelAfterConfirm?.status,
  cancelSecond: out.cancelSecond?.status,
  rescheduleAfterCancel: out.rescheduleAfterCancel?.status,
}, null, 2));
