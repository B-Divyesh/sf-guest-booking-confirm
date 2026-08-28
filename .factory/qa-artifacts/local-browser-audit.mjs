import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';

const base = 'http://127.0.0.1:4180';
const browser = await chromium.launch();
const out = {};

async function snapshot(page, name) {
  const axe = await new AxeBuilder({ page }).analyze();
  const layout = await page.evaluate(() => ({
    h1: [...document.querySelectorAll('h1')].map(x => x.textContent?.trim()),
    mainCount: document.querySelectorAll('main').length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    undersized: [...document.querySelectorAll('a,button,input,select,textarea')].map(el => {
      const r = el.getBoundingClientRect();
      return { text: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || '').trim(), width: r.width, height: r.height };
    }).filter(x => x.width < 44 || x.height < 44),
  }));
  return { layout, seriousCritical: axe.violations.filter(v => ['serious','critical'].includes(v.impact)).map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })) };
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [], pageErrors = [], failedResponses = [], requests = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('response', res => { if (res.status() >= 400) failedResponses.push(`${res.status()} ${res.url()}`); });
  page.on('request', req => requests.push(req.url()));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.screenshot({ path: '.factory/qa-artifacts/local-product-desktop.png', fullPage: true });
  out.desktopLanding = await snapshot(page, 'desktop');

  const privacyLink = page.getByRole('link', { name: 'Privacy' });
  await privacyLink.focus();
  out.focusBeforeRoute = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim() }));
  await privacyLink.click();
  await page.waitForURL('**/privacy');
  out.focusAfterRoute = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim(), h1Focused: document.activeElement === document.querySelector('h1') }));
  await page.goBack();
  await page.waitForURL(base + '/');

  await page.getByRole('button', { name: /Send time request/ }).click();
  out.emptySubmit = { message: await page.locator('#booking-message').innerText(), focusedName: await page.evaluate(() => document.activeElement?.getAttribute('name')) };
  await page.getByLabel('Full name').fill('A');
  await page.getByLabel('Email').fill('bad');
  await page.getByRole('button', { name: /Send time request/ }).click();
  out.invalidSubmit = { message: await page.locator('#booking-message').innerText(), focusedName: await page.evaluate(() => document.activeElement?.getAttribute('name')) };
  await page.getByLabel('Full name').fill('Browser Guest');
  await page.getByLabel('Email').fill('browser@example.com');
  await page.getByRole('radio').first().check();
  await page.getByRole('checkbox', { name: /I agree/ }).check();
  await page.getByRole('button', { name: /Send time request/ }).click();
  await page.getByRole('heading', { name: 'Request received' }).waitFor();
  out.createdGuest = { url: page.url(), ...await snapshot(page, 'guest-created') };
  out.desktopErrors = { consoleErrors, pageErrors, failedResponses, requestOrigins: [...new Set(requests.map(x => new URL(x).origin))] };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.screenshot({ path: '.factory/qa-artifacts/local-product-mobile.png', fullPage: true });
  out.mobileLanding = await snapshot(page, 'mobile');
  await page.goto(base + '/manage', { waitUntil: 'networkidle' });
  await page.getByLabel('Owner password').fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: 'Booking signals', exact: true }).waitFor();
  await page.screenshot({ path: '.factory/qa-artifacts/local-owner-mobile.png', fullPage: true });
  out.mobileOwner = await snapshot(page, 'mobile-owner');
  await context.close();
}

await browser.close();
await writeFile('.factory/qa-artifacts/local-browser-audit.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
