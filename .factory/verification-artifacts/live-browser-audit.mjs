import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const base = 'https://guest-booking-confirm.sociobot.in';
const browser = await chromium.launch({ headless: true });
const report = { routes: [], demo: {}, keyboard: {}, pwa: {}, identity: {}, navigation: {}, links: {}, metadata: {} };

function contrast(foreground, background) {
  const luminance = color => {
    const values = color.match(/[\d.]+/g).slice(0, 3).map(value => Number(value) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
  };
  const values = [luminance(foreground), luminance(background)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile390', width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error)));
  for (const path of ['/', '/demo', '/privacy', '/terms', '/manage']) {
    const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    const axe = await new AxeBuilder({ page }).analyze();
    const dom = await page.evaluate(() => {
      const visible = element => {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return bounds.width > 0 && bounds.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const undersized = [...document.querySelectorAll('a,button,input,select,textarea')].filter(visible).map(element => {
        const bounds = element.getBoundingClientRect();
        return { name: element.textContent?.trim() || element.getAttribute('aria-label') || element.getAttribute('name'), width: bounds.width, height: bounds.height };
      }).filter(item => item.width < 44 || item.height < 44);
      return {
        title: document.title,
        lang: document.documentElement.lang,
        h1Count: document.querySelectorAll('h1').length,
        h1: document.querySelector('h1')?.textContent?.trim(),
        mainCount: document.querySelectorAll('main').length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        undersized,
        imagesMissingAlt: [...document.images].filter(image => !image.hasAttribute('alt')).length,
      };
    });
    if (viewport.name === 'mobile390') {
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await page.waitForTimeout(50);
      dom.overflowAt200PercentText = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    }
    report.routes.push({ viewport: viewport.name, path, status: response.status(), ...dom,
      seriousCriticalAxe: axe.violations.filter(item => ['serious', 'critical'].includes(item.impact || '')).map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })),
    });
  }
  if (viewport.name === 'mobile390') {
    await page.goto(`${base}/demo`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: '.factory/verification-artifacts/live-mobile390-demo.png', fullPage: true });
  }
  report.routes.push({ viewport: viewport.name, consoleErrors, pageErrors });
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const requests = [];
  const consoleErrors = [];
  const pageErrors = [];
  page.on('request', request => requests.push({ method: request.method(), url: request.url(), type: request.resourceType() }));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error)));
  const response = await page.goto(`${base}/demo`, { waitUntil: 'networkidle' });
  const firstState = await page.getByRole('heading', { level: 1 }).textContent();
  await page.getByRole('button', { name: 'Mark sample reminder sent' }).click();
  await page.getByRole('button', { name: 'Confirm this time' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Download sample calendar/ }).click()]);
  const calendarHref = await page.getByRole('link', { name: /Download sample calendar/ }).getAttribute('href');
  const calendarText = decodeURIComponent(calendarHref.split(',').slice(1).join(','));
  await page.reload({ waitUntil: 'networkidle' });
  const persistedState = await page.getByRole('heading', { level: 1 }).textContent();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.getByRole('button', { name: 'Request another time' }).click();
  await page.getByRole('button', { name: 'Request new sample time' }).click();
  const rescheduledState = await page.getByRole('heading', { level: 1 }).textContent();
  await page.getByRole('button', { name: 'Approve sample change' }).click();
  await page.getByRole('button', { name: 'Cancel request' }).click();
  await page.getByRole('button', { name: 'Yes, cancel sample booking' }).click();
  const cancelledState = await page.getByRole('heading', { level: 1 }).textContent();
  await page.screenshot({ path: '.factory/verification-artifacts/live-demo-final-desktop.png', fullPage: true });
  report.demo = {
    status: response.status(), firstState, persistedState, rescheduledState, cancelledState,
    downloadName: download.suggestedFilename(),
    calendarChecks: ['BEGIN:VCALENDAR', 'SUMMARY:Precision cut — Northstar Barber', 'STATUS:CONFIRMED', 'DTSTART:', 'DTEND:'].map(value => ({ value, present: calendarText.includes(value) })),
    requests,
    crossOrigin: requests.filter(item => new URL(item.url).origin !== new URL(base).origin),
    apiRequests: requests.filter(item => new URL(item.url).pathname.startsWith('/api/')),
    cookies: await page.evaluate(() => document.cookie),
    localStorage: await page.evaluate(() => ({ ...localStorage })),
    sessionStorage: await page.evaluate(() => ({ ...sessionStorage })),
    consoleErrors, pageErrors,
  };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  const firstFocus = await page.evaluate(() => ({ text: document.activeElement?.textContent?.trim(), className: document.activeElement?.className }));
  await page.keyboard.press('Enter');
  const afterSkip = await page.evaluate(() => ({ tag: document.activeElement?.tagName, id: document.activeElement?.id }));
  const reducedMotion = await page.evaluate(() => ({
    matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    animated: [...document.querySelectorAll('*')].filter(element => {
      const style = getComputedStyle(element);
      return parseFloat(style.animationDuration) > 0.01 || parseFloat(style.transitionDuration) > 0.01;
    }).map(element => ({ tag: element.tagName, className: element.className, animation: getComputedStyle(element).animationDuration, transition: getComputedStyle(element).transitionDuration })),
  }));
  await page.goto(`${base}/demo`, { waitUntil: 'networkidle' });
  const focusSamples = [];
  for (const selector of ['#reset-demo', '#start-real']) {
    const sample = await page.evaluate(selector => {
      const element = document.querySelector(selector);
      element.focus();
      const surface = document.querySelector('.demo-banner');
      return { selector, focusVisible: element.matches(':focus-visible'), outline: getComputedStyle(element).outline, outlineColor: getComputedStyle(element).outlineColor, background: getComputedStyle(surface).backgroundColor };
    }, selector);
    sample.contrast = contrast(sample.outlineColor, sample.background);
    focusSamples.push(sample);
  }
  await page.getByRole('button', { name: 'Confirm this time' }).click();
  const tabOrder = [];
  for (let index = 0; index < 20; index += 1) {
    await page.keyboard.press('Tab');
    tabOrder.push(await page.evaluate(() => ({ id: document.activeElement?.id, text: document.activeElement?.textContent?.trim() })));
    if (tabOrder.at(-1).id === 'reset-demo') break;
  }
  await page.keyboard.press('Space');
  const resetByKeyboard = await page.getByRole('heading', { level: 1 }).textContent();
  report.keyboard = { firstFocus, afterSkip, reducedMotion, focusSamples, tabOrder, resetByKeyboard };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Try it with sample data' }).click();
  await page.waitForURL('**/demo');
  await page.goBack({ waitUntil: 'networkidle' });
  report.navigation = { pathAfterBack: new URL(page.url()).pathname, focusAfterBack: await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim() })) };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  let identityRequest = null;
  await page.route('https://sociobotcustomers.ciamlogin.com/**', route => { identityRequest = route.request().url(); return route.abort(); });
  await page.goto(`${base}/manage`, { waitUntil: 'networkidle' });
  const noPassword = await page.locator('input[type=password]').count() === 0;
  await page.getByRole('button', { name: 'Sign in with Sociobot' }).click();
  await page.waitForTimeout(500);
  report.identity = { noPassword, identityRequest, sessionStorageKeys: await page.evaluate(() => Object.keys(sessionStorage)), localStorageKeys: await page.evaluate(() => Object.keys(localStorage)) };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  const update = await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready; await registration.update(); return { waiting: Boolean(registration.waiting), active: Boolean(registration.active) }; });
  await page.goto(`${base}/demo`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Confirm this time' }).click();
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const offlineState = await page.getByRole('heading', { level: 1 }).textContent();
  await context.setOffline(false);
  const cachedUrls = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async name => (await (await caches.open(name)).keys()).map(request => request.url)))).flat());
  report.pwa = { controlled, update, offlineState, cachedIdentityCallback: cachedUrls.some(url => new URL(url).pathname === '/auth/callback'), cachedUrls };
  await context.close();
}

{
  const context = await browser.newContext();
  const page = await context.newPage();
  const response = await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  report.metadata = await page.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name=description]')?.content,
    canonical: document.querySelector('link[rel=canonical]')?.href,
    ogImage: document.querySelector('meta[property="og:image"]')?.content,
    twitterCard: document.querySelector('meta[name="twitter:card"]')?.content,
  }));
  report.metadata.headers = await response.allHeaders();
  const seen = new Set();
  for (const path of ['/', '/demo', '/privacy', '/terms', '/manage']) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    for (const href of await page.locator('a[href]').evaluateAll(links => links.map(link => link.href))) {
      if (href.startsWith(base)) seen.add(href);
    }
  }
  const statuses = [];
  for (const href of seen) {
    const response = await context.request.get(href);
    statuses.push({ href, status: response.status() });
  }
  const missing = await context.request.get(`${base}/verification-10-no-such-page`);
  const robots = await context.request.get(`${base}/robots.txt`);
  const sitemap = await context.request.get(`${base}/sitemap.xml`);
  const mainAsset = await context.request.get(`${base}/assets/main-BELu721o.js`);
  const serviceWorker = await context.request.get(`${base}/sw.js`);
  report.links = { statuses, missing: { status: missing.status(), type: missing.headers()['content-type'] }, robots: robots.status(), sitemap: { status: sitemap.status(), body: await sitemap.text() }, cache: { document: response.headers()['cache-control'], mainAsset: mainAsset.headers()['cache-control'], serviceWorker: serviceWorker.headers()['cache-control'] } };
  await context.close();
}

console.log(JSON.stringify(report, null, 2));
await browser.close();
