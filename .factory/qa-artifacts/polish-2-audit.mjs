import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';

const base = process.env.AUDIT_BASE || 'http://127.0.0.1:4173';
const label = process.env.AUDIT_LABEL || 'local';
const artifact = name => `.factory/qa-artifacts/polish-2-${label}-${name}`;
const browser = await chromium.launch({ headless: true });
const report = { base, firstScreens: {}, routes: [], privateBooking: {}, demo: {}, offline: {}, sitemap: {} };

const seriousCritical = result => result.violations
  .filter(item => ['serious', 'critical'].includes(item.impact || ''))
  .map(item => item.id);

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error)));
  const response = await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  const axe = await new AxeBuilder({ page }).analyze();
  report.firstScreens[viewport.name] = await page.evaluate(({ status, issues, consoleErrors, pageErrors }) => ({
    status,
    title: document.title,
    h1: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim(),
    thirdFactBottom: [...document.querySelectorAll('li')].find(node => node.textContent?.includes('Free for 30 active bookings'))?.getBoundingClientRect().bottom,
    viewportHeight: innerHeight,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    axeSeriousCritical: issues,
    consoleErrors,
    pageErrors,
  }), { status: response?.status(), issues: seriousCritical(axe), consoleErrors, pageErrors });
  await page.screenshot({ path: artifact(`${viewport.name}.png`), fullPage: false });
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  for (const path of ['/', '/?demo=1', '/privacy', '/terms', '/manage']) {
    const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    const axe = await new AxeBuilder({ page }).analyze();
    report.routes.push(await page.evaluate(({ path, status, issues }) => ({
      path,
      status,
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content,
      canonical: document.querySelector('link[rel="canonical"]')?.href,
      ogTitle: document.querySelector('meta[property="og:title"]')?.content,
      ogUrl: document.querySelector('meta[property="og:url"]')?.content,
      twitterTitle: document.querySelector('meta[name="twitter:title"]')?.content,
      robots: document.querySelector('meta[name="robots"]')?.content,
      h1Count: document.querySelectorAll('h1').length,
      mainCount: document.querySelectorAll('main').length,
      axeSeriousCritical: issues,
    }), { path, status: response?.status(), issues: seriousCritical(axe) }));
  }

  const token = 'polish-2-valid-token';
  await page.route(`**/api/guest/${token}`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      business_name: 'Northstar Barber',
      service_name: 'Precision cut',
      booking: {
        id: 'polish-2-booking', reference: 'POLISH-482', guest_name: 'Maya Chen',
        starts_at: '2026-09-04T14:00:00Z', timezone: 'UTC', duration_minutes: 45,
        status: 'awaiting_confirmation', updated_at: '2026-09-02T10:00:00Z',
      },
    }),
  }));
  await page.goto(`${base}/b/${token}`, { waitUntil: 'networkidle' });
  const privateAxe = await new AxeBuilder({ page }).analyze();
  report.privateBooking = await page.evaluate(issues => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content,
    canonical: document.querySelector('link[rel="canonical"]')?.href,
    ogTitle: document.querySelector('meta[property="og:title"]')?.content,
    ogDescription: document.querySelector('meta[property="og:description"]')?.content,
    ogUrl: document.querySelector('meta[property="og:url"]')?.content,
    twitterTitle: document.querySelector('meta[name="twitter:title"]')?.content,
    twitterDescription: document.querySelector('meta[name="twitter:description"]')?.content,
    robots: document.querySelector('meta[name="robots"]')?.content,
    h1: document.querySelector('h1')?.textContent?.trim(),
    axeSeriousCritical: issues,
  }), seriousCritical(privateAxe));
  await page.screenshot({ path: artifact('private-booking.png'), fullPage: false });

  const missing = await context.request.get(`${base}/polish-2-no-such-page`);
  const missingBody = await missing.text();
  report.routes.push({
    path: '/polish-2-no-such-page',
    status: missing.status(),
    completeMetadata: ['meta name="description"', 'rel="canonical"', 'property="og:title"', 'name="twitter:title"', 'rel="icon"', 'rel="apple-touch-icon"']
      .every(value => missingBody.includes(value)),
    noindex: missingBody.includes('content="noindex"'),
  });
  const sitemap = await context.request.get(`${base}/sitemap.xml`);
  const sitemapBody = await sitemap.text();
  report.sitemap = {
    status: sitemap.status(),
    canonicalDemoListed: sitemapBody.includes('https://guest-booking-confirm.sociobot.in/?demo=1'),
    aliasDemoAbsent: !sitemapBody.includes('https://guest-booking-confirm.sociobot.in/demo'),
  };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => localStorage.setItem('real:polish-2-sentinel', 'untouched'));
  const page = await context.newPage();
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto(`${base}/?demo=1`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: artifact('demo-390.png'), fullPage: false });
  const initial = await page.evaluate(() => ({
    title: document.title,
    canonical: document.querySelector('link[rel="canonical"]')?.href,
    h1: document.querySelector('h1')?.textContent?.trim(),
    banner: document.querySelector('[aria-label="Demo controls"]')?.textContent?.replace(/\s+/g, ' ').trim(),
    storage: { keys: Object.keys(localStorage), sentinel: localStorage.getItem('real:polish-2-sentinel'), demo: localStorage.getItem('demo:guest-booking-confirm:state') },
    cookies: document.cookie,
  }));
  await page.getByRole('button', { name: 'Confirm this time' }).click();
  const confirmed = await page.getByRole('heading', { level: 1 }).textContent();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  const reset = await page.getByRole('heading', { level: 1 }).textContent();
  const requestsBeforeExit = [...requests];
  await page.getByRole('button', { name: 'Start for real' }).click();
  await page.waitForURL(`${base}/`);
  report.demo = {
    initial,
    confirmed,
    reset,
    requestsBeforeExit,
    apiRequestsBeforeExit: requestsBeforeExit.filter(url => new URL(url).pathname.startsWith('/api/')),
    crossOriginRequestsBeforeExit: requestsBeforeExit.filter(url => new URL(url).origin !== new URL(base).origin),
    afterExit: await page.evaluate(() => ({
      url: location.href,
      storage: { keys: Object.keys(localStorage), sentinel: localStorage.getItem('real:polish-2-sentinel'), demo: localStorage.getItem('demo:guest-booking-confirm:state') },
    })),
  };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
  await page.goto(`${base}/?demo=1`, { waitUntil: 'networkidle' });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  report.offline = await page.evaluate(() => ({
    controlled: Boolean(navigator.serviceWorker.controller),
    h1: document.querySelector('h1')?.textContent?.trim(),
    banner: document.querySelector('[aria-label="Demo controls"]')?.textContent?.replace(/\s+/g, ' ').trim(),
  }));
  await context.setOffline(false);
  await context.close();
}

await browser.close();
await writeFile(artifact('audit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
