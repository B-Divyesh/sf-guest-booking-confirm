const base = process.env.QA_BASE;
const token = process.env.QA_TOKEN;
if (!base || !token) throw new Error('QA_BASE and QA_TOKEN are required');
const response = await fetch(`${base}/api/guest/${token}`, { headers: { 'x-forwarded-for': 'verification-10-persistence' } });
console.log(JSON.stringify({ status: response.status, body: await response.json() }, null, 2));
