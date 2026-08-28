import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const page = await context.newPage();
await page.goto('http://127.0.0.1:4180', { waitUntil: 'networkidle' });
const trail = [];
for (let i = 0; i < 12; i++) {
  await page.keyboard.press('Tab');
  trail.push(await page.evaluate(() => {
    const el = document.activeElement;
    const s = getComputedStyle(el);
    return { tag: el?.tagName, name: el?.getAttribute('name'), text: (el?.getAttribute('aria-label') || el?.textContent || '').trim(), outline: `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}` };
  }));
}
await page.goto('http://127.0.0.1:4180', { waitUntil: 'networkidle' });
await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
await page.screenshot({ path: '.factory/qa-artifacts/local-mobile-text-200.png', fullPage: true });
const resize = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, h1Rect: (() => { const r = document.querySelector('h1').getBoundingClientRect(); return { x:r.x, width:r.width, height:r.height }; })() }));
const out = { trail, resize };
await writeFile('.factory/qa-artifacts/keyboard-resize-audit.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await browser.close();
