import { readFile, writeFile } from 'node:fs/promises';
const prior = JSON.parse(await readFile('.factory/qa-artifacts/backend-audit.json', 'utf8'));
const base = 'http://127.0.0.1:4180/api';
const auth = { authorization: `Bearer ${prior.setup.body.token}`, 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.241' };
const hours = { mon:null,tue:null,wed:null,thu:null,fri:null,sat:null,sun:['00:00','04:00'] };
const update = await fetch(`${base}/owner/settings`, { method:'PATCH', headers:auth, body:JSON.stringify({ business_name:'Boundary Books', service_name:'Book consultation', timezone:'America/New_York', duration_minutes:30, weekly_hours:hours, welcome_note:'' }) });
async function slots(from) { const r=await fetch(`${base}/public/slots?from=${from}&days=1`, { headers:{'x-forwarded-for':`198.51.100.${from.endsWith('01')?'242':'243'}`} }); return {status:r.status, body:await r.json()}; }
const fall = await slots('2026-11-01');
const spring = await slots('2027-03-14');
const out = { update: update.status, fall, spring };
await writeFile('.factory/qa-artifacts/dst-audit.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
