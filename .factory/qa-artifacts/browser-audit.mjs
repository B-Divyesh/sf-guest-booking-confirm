import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';

const base = 'https://guest-booking-confirm.sociobot.in';
const browser = await chromium.launch();
const results = {};

for (const profile of [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'mobile-390', viewport: { width: 390, height: 844 }, isMobile: true },
]) {
  const context = await browser.newContext({ viewport: profile.viewport, isMobile: profile.isMobile });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedResponses = [];
  const requests = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('response', res => { if (res.status() >= 400) failedResponses.push(`${res.status()} ${res.url()}`); });
  page.on('request', req => requests.push(req.url()));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `.factory/qa-artifacts/live-${profile.name}.png`, fullPage: true });
  const axe = await new AxeBuilder({ page }).analyze();
  const semantics = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.title,
    h1: [...document.querySelectorAll('h1')].map(x => x.textContent?.trim()),
    mainCount: document.querySelectorAll('main').length,
    headerCount: document.querySelectorAll('header').length,
    footerCount: document.querySelectorAll('footer').length,
    skipHref: document.querySelector('.skip-link')?.getAttribute('href'),
    horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    metadata: {
      canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href') ?? null,
      appleTouch: document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href') ?? null,
      ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? null,
      twitterCard: document.querySelector('meta[name="twitter:card"]')?.getAttribute('content') ?? null,
    },
    undersizedTargets: [...document.querySelectorAll('a,button,input,select,textarea')].map(el => {
      const r = el.getBoundingClientRect();
      return { text: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || '').trim(), width: r.width, height: r.height };
    }).filter(x => x.width < 44 || x.height < 44),
  }));
  const focusTrail = [];
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Tab');
    focusTrail.push(await page.evaluate(() => {
      const el = document.activeElement;
      const s = getComputedStyle(el);
      return { tag: el?.tagName, text: (el?.getAttribute('aria-label') || el?.textContent || '').trim(), outline: `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}` };
    }));
  }
  results[profile.name] = {
    semantics,
    axeSeriousCritical: axe.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })),
    consoleErrors,
    pageErrors,
    failedResponses,
    requestOrigins: [...new Set(requests.map(url => new URL(url).origin))],
    focusTrail,
  };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  results.reducedMotion = await page.evaluate(() => {
    const button = document.querySelector('.button,button');
    const style = button ? getComputedStyle(button) : null;
    return { mediaMatches: matchMedia('(prefers-reduced-motion: reduce)').matches, transitionDuration: style?.transitionDuration, scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior };
  });
  await context.close();
}

{
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const path of ['/demo', '/not-a-real-route', '/privacy', '/terms']) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    const axe = await new AxeBuilder({ page }).analyze();
    results[`route:${path}`] = {
      finalUrl: page.url(),
      title: await page.title(),
      h1: await page.locator('h1').allTextContents(),
      mainCount: await page.locator('main').count(),
      axeSeriousCritical: axe.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })),
    };
  }
  await context.close();
}

{
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => navigator.serviceWorker?.ready);
  await page.reload({ waitUntil: 'networkidle' });
  const before = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    await reg.update();
    return { controller: !!navigator.serviceWorker.controller, active: reg.active?.state, waiting: reg.waiting?.state ?? null };
  });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  results.offlineReload = { before, url: page.url(), h1: await page.locator('h1').allTextContents(), body: (await page.locator('body').innerText()).slice(0, 500) };
  await context.close();
}

await browser.close();
await writeFile('.factory/qa-artifacts/browser-audit.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
