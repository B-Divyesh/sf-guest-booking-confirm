import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';

const base = 'https://guest-booking-confirm.sociobot.in';
const browser = await chromium.launch({ headless: true });
const report = { firstScreens: {}, routes: [], demo: {}, offline: {}, links: {} };

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
  report.firstScreens[viewport.name] = await page.evaluate(() => ({
    status: 200,
    title: document.title,
    h1: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim(),
    thirdFactBottom: [...document.querySelectorAll('li')].find(node => node.textContent?.includes('Free for 30 active bookings'))?.getBoundingClientRect().bottom,
    viewportHeight: innerHeight,
    nav: [...document.querySelectorAll('.topbar nav a')].map(node => ({ text: node.textContent?.trim(), href: node.getAttribute('href') })),
    staleCopyCount: [...document.querySelectorAll('body *')].filter(node => /2025 release|8 weeks|two weeks|Spring preview|The cutoff|Join waitlist|Request booking/.test(node.textContent || '') && !node.children.length).length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  report.firstScreens[viewport.name].status = response?.status();
  report.firstScreens[viewport.name].axeSeriousCritical = axe.violations.filter(item => ['serious', 'critical'].includes(item.impact || '')).map(item => item.id);
  report.firstScreens[viewport.name].consoleErrors = consoleErrors;
  report.firstScreens[viewport.name].pageErrors = pageErrors;
  await page.screenshot({ path: `.factory/qa-artifacts/polish-1-live-${viewport.name}.png`, fullPage: false });
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const requests = [];
  const consoleErrors = [];
  const pageErrors = [];
  page.on('request', request => requests.push(request.url()));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error)));
  const response = await page.goto(`${base}/?demo=1`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: '.factory/qa-artifacts/polish-1-live-demo-390.png', fullPage: false });
  const initial = await page.evaluate(() => ({
    title: document.title,
    canonical: document.querySelector('link[rel=canonical]')?.href,
    h1: document.querySelector('h1')?.textContent?.trim(),
    banner: document.querySelector('[aria-label="Demo controls"]')?.textContent?.replace(/\s+/g, ' ').trim(),
    storage: Object.keys(localStorage),
    cookies: document.cookie,
  }));
  await page.getByRole('button', { name: 'Confirm this time' }).click();
  const confirmed = await page.getByRole('heading', { level: 1 }).textContent();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  const reset = await page.getByRole('heading', { level: 1 }).textContent();
  const demoApiRequestsBeforeExit = requests.filter(url => new URL(url).pathname.startsWith('/api/'));
  await page.getByRole('button', { name: 'Start for real' }).click();
  await page.waitForURL(`${base}/`);
  await page.locator('main h1').waitFor();
  const exit = await page.evaluate(() => ({ url: location.href, storage: Object.keys(localStorage), h1: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim() }));
  report.demo = {
    status: response?.status(), initial, confirmed, reset, exit,
    requestOrigins: [...new Set(requests.map(url => new URL(url).origin))],
    demoApiRequestsBeforeExit,
    apiRequestsAfterStartingRealDesk: requests.filter(url => new URL(url).pathname.startsWith('/api/')),
    consoleErrors, pageErrors,
  };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const links = new Set();
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error)));
  for (const path of ['/', '/?demo=1', '/privacy', '/terms', '/manage']) {
    const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    const axe = await new AxeBuilder({ page }).analyze();
    report.routes.push(await page.evaluate(({ path, status, issues }) => ({
      path, status, title: document.title,
      canonical: document.querySelector('link[rel=canonical]')?.href,
      description: document.querySelector('meta[name=description]')?.content,
      ogTitle: document.querySelector('meta[property="og:title"]')?.content,
      ogUrl: document.querySelector('meta[property="og:url"]')?.content,
      twitterTitle: document.querySelector('meta[name="twitter:title"]')?.content,
      h1Count: document.querySelectorAll('h1').length,
      mainCount: document.querySelectorAll('main').length,
      legalLinks: [...document.querySelectorAll('footer a')].filter(node => ['/privacy', '/terms'].includes(node.getAttribute('href') || '')).length,
      axeSeriousCritical: issues,
    }), { path, status: response?.status(), issues: axe.violations.filter(item => ['serious', 'critical'].includes(item.impact || '')).map(item => item.id) }));
    for (const href of await page.locator('a[href]').evaluateAll(nodes => nodes.map(node => node.href))) {
      if (href.startsWith(base)) links.add(href);
    }
  }
  const missing = await context.request.get(`${base}/polish-1-no-such-page`);
  const missingBody = await missing.text();
  report.routes.push({
    path: '/polish-1-no-such-page', status: missing.status(),
    hasDescription: missingBody.includes('meta name="description"'),
    hasCanonical: missingBody.includes('rel="canonical"'),
    hasOg: missingBody.includes('property="og:title"'),
    hasTwitter: missingBody.includes('name="twitter:title"'),
    hasIcons: missingBody.includes('rel="icon"') && missingBody.includes('rel="apple-touch-icon"'),
    noindex: missingBody.includes('content="noindex"'),
  });
  const sitemap = await context.request.get(`${base}/sitemap.xml`);
  report.links.sitemap = { status: sitemap.status(), body: await sitemap.text() };
  report.links.statuses = [];
  for (const href of links) {
    const response = await context.request.get(href);
    report.links.statuses.push({ href, status: response.status() });
  }
  report.links.consoleErrors = consoleErrors;
  report.links.pageErrors = pageErrors;
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
  report.offline = await page.evaluate(() => ({ controlled: Boolean(navigator.serviceWorker.controller), h1: document.querySelector('h1')?.textContent?.trim(), banner: document.querySelector('[aria-label="Demo controls"]')?.textContent?.replace(/\s+/g, ' ').trim() }));
  await context.setOffline(false);
  await context.close();
}

await browser.close();
await writeFile('.factory/qa-artifacts/polish-1-live-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
