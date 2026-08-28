import { readFile, writeFile } from 'node:fs/promises';
const prior = JSON.parse(await readFile('.factory/qa-artifacts/backend-audit.json', 'utf8'));
const base = 'http://127.0.0.1:4180/api';
let ip = 150;
async function call(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('x-forwarded-for', `198.51.100.${ip++}`);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const text = await response.text();
  let body = text; try { body = JSON.parse(text); } catch {}
  return { status: response.status, headers: Object.fromEntries(response.headers), body };
}
const token = prior.setup.body.token;
const auth = { authorization: `Bearer ${token}` };
const firstSlot = prior.slots.body.slots[0].start;
const before = await call('/owner/bookings', { headers: auth });
const ids = before.body.bookings.filter(x => Date.parse(x.starts_at) === Date.parse(firstSlot)).map(x => x.id);
const approvals = await Promise.all(ids.map(id => call(`/owner/bookings/${id}/approve`, { method: 'PATCH', headers: auth })));
const after = await call('/owner/bookings', { headers: auth });
const accepted = after.body.bookings.filter(x => Date.parse(x.starts_at) === Date.parse(firstSlot) && ['awaiting_confirmation','confirmed'].includes(x.status));
const match = prior.collisionCreateStatuses;
const created = Object.values(match).flat();
const chosen = accepted[0];
const chosenCreate = created.find(x => x.body.reference === chosen?.reference);
const action = {};
if (chosenCreate) {
  const guestToken = chosenCreate.body.token;
  action.confirmFirst = await call(`/guest/${guestToken}/confirm`, { method: 'POST' });
  action.confirmSecond = await call(`/guest/${guestToken}/confirm`, { method: 'POST' });
  action.ics = await call(`/guest/${guestToken}/calendar.ics`);
  action.cancelFirst = await call(`/guest/${guestToken}/cancel`, { method: 'POST' });
  action.cancelSecond = await call(`/guest/${guestToken}/cancel`, { method: 'POST' });
}
const out = { ids, approvalStatuses: approvals.map(x => x.status), accepted, action };
await writeFile('.factory/qa-artifacts/backend-concurrency.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  candidates: ids.length,
  approvalStatuses: out.approvalStatuses,
  acceptedAtSameTime: accepted.length,
  acceptedStates: accepted.map(x => x.status),
  confirmFirst: action.confirmFirst?.status,
  confirmSecond: action.confirmSecond?.status,
  ics: { status: action.ics?.status, contentType: action.ics?.headers['content-type'], disposition: action.ics?.headers['content-disposition'], confirmed: String(action.ics?.body).includes('STATUS:CONFIRMED') },
  cancelFirst: action.cancelFirst?.status,
  cancelSecond: action.cancelSecond?.status,
}, null, 2));
