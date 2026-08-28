import { readFile, writeFile } from 'node:fs/promises';
const prior = JSON.parse(await readFile('.factory/qa-artifacts/backend-audit.json', 'utf8'));
const base = 'http://127.0.0.1:4180/api';
let ip = 210;
async function call(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('x-forwarded-for', `192.0.2.${ip++}`);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const text = await response.text(); let body = text; try { body = JSON.parse(text); } catch {}
  return { status: response.status, body };
}
const ownerToken = prior.setup.body.token;
const guestToken = prior.boundaryBooking.body.token;
const reference = prior.boundaryBooking.body.reference;
const thirdSlot = prior.slots.body.slots[2].start;
const auth = { authorization: `Bearer ${ownerToken}` };
const out = {};
out.rescheduleFirst = await call(`/guest/${guestToken}/reschedule`, { method: 'POST', body: JSON.stringify({ starts_at: thirdSlot }) });
out.rescheduleSecond = await call(`/guest/${guestToken}/reschedule`, { method: 'POST', body: JSON.stringify({ starts_at: prior.slots.body.slots[3].start }) });
out.listAfterReschedule = await call('/owner/bookings', { headers: auth });
const booking = out.listAfterReschedule.body.bookings.find(x => x.reference === reference);
out.ownerApprove = await call(`/owner/bookings/${booking.id}/approve`, { method: 'PATCH', headers: auth });
out.guestConfirm = await call(`/guest/${guestToken}/confirm`, { method: 'POST' });
out.markReminder = await call(`/owner/bookings/${booking.id}/reminder`, { method: 'PATCH', headers: auth });
out.listAfterReminder = await call('/owner/bookings', { headers: auth });
out.reminderDone = out.listAfterReminder.body.bookings.find(x => x.id === booking.id)?.reminder_done;
out.complete = await call(`/owner/bookings/${booking.id}/complete`, { method: 'PATCH', headers: auth });
out.guestAfterComplete = await call(`/guest/${guestToken}`);
await writeFile('.factory/qa-artifacts/backend-state-flow.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  rescheduleFirst: out.rescheduleFirst.status,
  rescheduleSecond: out.rescheduleSecond.status,
  stateAfterReschedule: booking.status,
  ownerApprove: out.ownerApprove.status,
  guestConfirm: out.guestConfirm.status,
  markReminder: out.markReminder.status,
  reminderDone: out.reminderDone,
  complete: out.complete.status,
  finalState: out.guestAfterComplete.body.booking.status,
}, null, 2));
