import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';

const base = 'https://guest-booking-confirm.sociobot.in';
const browser = await chromium.launch({ headless: true });
const report = { checkedAt: new Date().toISOString(), base, cold: {}, routes: [], demo: {}, offline: {} };

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile390', width: 390, height: 844 },
]) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const requests = [];
  const consoleErrors = [];
  const pageErrors = [];
  page.on('request', request => requests.push({ method: request.method(), url: request.url() }));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error)));
  const response = await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  const axe = await new AxeBuilder({ page }).analyze();
  const details = await page.evaluate(() => {
    const primary = document.querySelector('.release-actions .primary');
    const facts = [...document.querySelectorAll('.release-facts li')].map(node => node.textContent?.trim());
    const allTargets = [...document.querySelectorAll('a,button,input,select,textarea')]
      .filter(node => {
        const style = getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map(node => {
        const rect = node.getBoundingClientRect();
        return { text: node.textContent?.trim() || node.getAttribute('aria-label') || node.getAttribute('name'), width: rect.width, height: rect.height };
      });
    return {
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim(),
      lead: document.querySelector('.release-lede')?.textContent?.replace(/\s+/g, ' ').trim(),
      primary: primary?.textContent?.trim(),
      primaryHref: primary?.getAttribute('href'),
      primaryNote: document.querySelector('.action-note')?.textContent?.trim(),
      facts,
      h1Count: document.querySelectorAll('h1').length,
      mainCount: document.querySelectorAll('main').length,
      lang: document.documentElement.lang,
      overflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      factsBottom: document.querySelector('.release-facts')?.getBoundingClientRect().bottom,
      viewportHeight: innerHeight,
      reducedScrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      shortTargets: allTargets.filter(target => target.width < 44 || target.height < 44),
    };
  });
  await page.keyboard.press('Tab');
  const skip = await page.evaluate(() => {
    const active = document.activeElement;
    const style = active ? getComputedStyle(active) : null;
    return { text: active?.textContent?.trim(), outlineWidth: style?.outlineWidth, outlineColor: style?.outlineColor };
  });
  report.cold[viewport.name] = {
    status: response?.status(),
    ...details,
    skip,
    requests,
    cookies: await context.cookies(),
    consoleErrors,
    pageErrors,
    axeSeriousCritical: axe.violations.filter(item => ['serious', 'critical'].includes(item.impact || '')).map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })),
  };
  await page.screenshot({ path: `.factory/verification-artifacts/verify15-live-${viewport.name}.png`, fullPage: false });
  await context.close();
}

for (const path of ['/?demo=1', '/privacy', '/terms', '/manage', '/verify15-missing-page']) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error)));
  const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  const axe = await new AxeBuilder({ page }).analyze();
  report.routes.push(await page.evaluate(({ path, status, consoleErrors, pageErrors, axeIssues }) => ({
    path,
    status,
    title: document.title,
    description: document.querySelector('meta[name=description]')?.content,
    canonical: document.querySelector('link[rel=canonical]')?.href,
    robots: document.querySelector('meta[name=robots]')?.content,
    h1: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim(),
    h1Count: document.querySelectorAll('h1').length,
    mainCount: document.querySelectorAll('main').length,
    overflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    consoleErrors,
    pageErrors,
    axeSeriousCritical: axeIssues,
  }), { path, status: response?.status(), consoleErrors, pageErrors, axeIssues: axe.violations.filter(item => ['serious', 'critical'].includes(item.impact || '')).map(item => item.id) }));
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const requests = [];
  const consoleErrors = [];
  const pageErrors = [];
  page.on('request', request => requests.push({ method: request.method(), url: request.url() }));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Try it with sample data' }).first().click();
  await page.waitForURL(`${base}/?demo=1`);
  const initial = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim(),
    banner: document.querySelector('[aria-label="Demo controls"]')?.textContent?.replace(/\s+/g, ' ').trim(),
    storage: Object.keys(localStorage),
  }));
  await page.getByRole('button', { name: 'Confirm this time' }).click();
  const confirmed = await page.getByRole('heading', { level: 1 }).textContent();
  const calendar = page.getByRole('link', { name: 'Download sample calendar (.ics)' });
  const [download] = await Promise.all([page.waitForEvent('download'), calendar.click()]);
  const calendarHref = await calendar.getAttribute('href');
  const downloadText = decodeURIComponent((calendarHref || '').split(',').slice(1).join(','));
  await page.getByRole('button', { name: 'Reset demo' }).click();
  const reset = await page.getByRole('heading', { level: 1 }).textContent();
  const axe = await new AxeBuilder({ page }).analyze();
  report.demo = {
    initial,
    confirmed,
    reset,
    download: { filename: download.suggestedFilename(), hasCalendar: downloadText.includes('BEGIN:VCALENDAR'), hasConfirmed: downloadText.includes('STATUS:CONFIRMED') },
    storage: await page.evaluate(() => Object.entries(localStorage)),
    cookies: await context.cookies(),
    origins: [...new Set(requests.map(request => new URL(request.url).origin))],
    apiRequests: requests.filter(request => new URL(request.url).pathname.startsWith('/api/')),
    consoleErrors,
    pageErrors,
    axeSeriousCritical: axe.violations.filter(item => ['serious', 'critical'].includes(item.impact || '')).map(item => item.id),
  };
  await page.screenshot({ path: '.factory/verification-artifacts/verify15-live-demo-mobile390.png', fullPage: false });
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${base}/?demo=1`, { waitUntil: 'networkidle' });
  const registration = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    await reg.update();
    return { controlled: Boolean(navigator.serviceWorker.controller), scope: reg.scope, caches: await caches.keys() };
  });
  await page.reload({ waitUntil: 'networkidle' });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  report.offline = { registration, h1: await page.getByRole('heading', { level: 1 }).textContent(), url: page.url() };
  await context.setOffline(false);
  await context.close();
}

await browser.close();
await writeFile('.factory/verification-artifacts/verify15-live-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
