import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = 'https://guest-booking-confirm.sociobot.in';
const browser = await chromium.launch();
const output = {};

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900, isMobile: false },
  { name: 'mobile-390', width: 390, height: 844, isMobile: true },
]) {
  const context = await browser.newContext({ viewport, isMobile: viewport.isMobile });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedResponses = [];
  const requests = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });
  page.on('request', request => requests.push(request.url()));

  const response = await page.goto(`${base}/demo`, { waitUntil: 'networkidle' });
  const initial = await page.evaluate(() => ({
    title: document.title,
    lang: document.documentElement.lang,
    h1: [...document.querySelectorAll('h1')].map(element => element.textContent?.trim()),
    mainCount: document.querySelectorAll('main').length,
    banner: document.querySelector('[aria-label="Demo controls"]')?.textContent?.replace(/\s+/g, ' ').trim(),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    cookies: document.cookie,
    storage: Object.keys(localStorage),
  }));
  const axeInitial = await new AxeBuilder({ page }).analyze();

  const focusTrail = [];
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const element = document.activeElement;
      const style = getComputedStyle(element);
      return {
        tag: element?.tagName,
        text: (element?.getAttribute('aria-label') || element?.textContent || '').replace(/\s+/g, ' ').trim(),
        outline: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
      };
    });
    focusTrail.push(focus);
    if (focus.text === 'Confirm this time') {
      await page.keyboard.press('Enter');
      break;
    }
  }
  await page.getByRole('heading', { name: 'Confirmed', exact: true }).waitFor();
  const afterConfirm = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim(),
    calendar: document.querySelector('[download="demo-booking.ics"]')?.textContent?.trim(),
    cookies: document.cookie,
    storage: Object.entries(localStorage),
  }));
  await page.getByRole('button', { name: 'Reset demo' }).click();
  const afterReset = await page.locator('h1').innerText();
  await page.getByRole('button', { name: 'Start for real' }).click();
  await page.waitForURL(base + '/');
  const afterExit = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent?.trim(), storage: Object.keys(localStorage) }));

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${base}/demo`, { waitUntil: 'networkidle' });
  const reducedMotion = await page.evaluate(() => ({
    matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
    transitionDuration: getComputedStyle(document.querySelector('button')).transitionDuration,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  }));
  const targetSizes = await page.evaluate(() => [...document.querySelectorAll('a,button')].map(element => {
    const rect = element.getBoundingClientRect();
    return { text: (element.getAttribute('aria-label') || element.textContent || '').replace(/\s+/g, ' ').trim(), width: rect.width, height: rect.height };
  }).filter(target => target.width < 44 || target.height < 44));

  output[viewport.name] = {
    status: response?.status(),
    responseHeaders: response?.headers(),
    initial,
    axeSeriousCritical: axeInitial.violations.filter(item => ['serious', 'critical'].includes(item.impact)).map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })),
    focusTrail,
    afterConfirm,
    afterReset,
    afterExit,
    reducedMotion,
    targetSizes,
    requestOrigins: [...new Set(requests.map(url => new URL(url).origin))],
    apiRequests: requests.filter(url => new URL(url).pathname.startsWith('/api/')),
    consoleErrors,
    pageErrors,
    failedResponses,
  };
  await page.screenshot({ path: `.factory/qa-artifacts/candidate-${viewport.name}.png`, fullPage: true });
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await context.newPage();
  await page.goto(`${base}/demo`, { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
  const before = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    return { controlled: Boolean(navigator.serviceWorker.controller), active: registration.active?.state, waiting: registration.waiting?.state || null };
  });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const offline = await page.evaluate(() => ({ url: location.href, h1: document.querySelector('h1')?.textContent?.trim(), banner: document.querySelector('[aria-label="Demo controls"]')?.textContent?.replace(/\s+/g, ' ').trim() }));
  await context.setOffline(false);
  output.serviceWorker = { before, offline };
  await context.close();
}

console.log(JSON.stringify(output, null, 2));
await browser.close();
