import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('owner setup explains an inverted opening-hours range before saving', async ({ page }) => {
  await page.goto('/manage');
  await page.getByLabel('Business name').fill('Signal Studio');
  await page.getByLabel('Service name').fill('Consultation');
  await page.getByLabel('Business timezone').fill('UTC');
  await page.getByLabel('Owner password').fill('correct-horse-battery');
  await page.getByLabel('Monday opens').fill('17:00');
  await page.getByLabel('Monday closes').fill('09:00');
  await page.getByRole('button', { name: 'Open my booking desk' }).click();
  await expect(page.getByRole('alert')).toHaveText('Monday closing time must be later than opening time.');
  await expect(page.getByRole('heading', { name: 'Set up your booking desk' })).toBeVisible();
});

test('@claim:guest-no-account @claim:owner-approval-before-booking guest request reaches owner approval and guest confirmation', async ({ page, request }) => {
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });

  await page.goto('/manage');
  await expect(page.getByRole('heading', { name: 'Set up your booking desk' })).toBeVisible();
  await page.getByLabel('Business name').fill('Signal Studio');
  await page.getByLabel('Service name').fill('Consultation');
  await page.getByLabel('Business timezone').fill('UTC');
  await page.getByLabel('Owner password').fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Open my booking desk' }).click();
  await expect(page.getByRole('heading', { name: 'Booking signals', exact: true })).toBeVisible();

  const ownerToken = await page.evaluate(() => sessionStorage.getItem('gbc_owner_session'));
  expect(ownerToken).toBeTruthy();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Ask for a time/ })).toBeVisible();
  const firstSlot = page.locator('input[name="starts_at"]').first();
  await firstSlot.check();
  await page.getByLabel('Full name').fill('Ada Guest');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByRole('checkbox', { name: /I agree/ }).check();
  await page.getByRole('button', { name: /Send time request/ }).click();
  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible();
  const guestUrl = page.url();

  const list = await request.get('/api/owner/bookings', { headers: { authorization: `Bearer ${ownerToken}` } });
  const booking = (await list.json()).bookings[0];
  const approved = await request.patch(`/api/owner/bookings/${booking.id}/approve`, { headers: { authorization: `Bearer ${ownerToken}` } });
  expect(approved.ok()).toBeTruthy();

  await page.goto(guestUrl);
  await expect(page.getByRole('heading', { name: 'Ready to confirm' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm this time' }).click();
  await expect(page.getByRole('heading', { name: 'Confirmed', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Add to calendar/ })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact || ''))).toEqual([]);
  expect({ consoleErrors, failedResponses }).toEqual({ consoleErrors: [], failedResponses: [] });
});

test('legal pages expose one h1 and a main landmark', async ({ page }) => {
  for (const path of ['/privacy', '/terms']) {
    await page.goto(path);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact || ''))).toEqual([]);
  }
});

test('@claim:demo-confirmation-trail demo starts approved and reaches guest confirmation', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByRole('complementary', { name: 'Demo controls' })).toContainText('Demo — sample data, nothing is saved');
  await expect(page.getByRole('heading', { name: 'Ready to confirm' })).toBeVisible();
  await expect(page.getByText('Maya Chen')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm this time' }).click();
  await expect(page.getByRole('heading', { name: 'Confirmed', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Download sample calendar/ })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact || ''))).toEqual([]);
});

test('@claim:guest-rescheduling demo lets a guest request another sample time', async ({ page }) => {
  await page.goto('/demo');
  const originalTime = await page.locator('.booking-ticket dd').nth(1).textContent();
  await page.getByRole('button', { name: 'Request another time' }).click();
  await page.getByRole('button', { name: 'Request new sample time' }).click();
  await expect(page.getByRole('heading', { name: 'New time requested' })).toBeVisible();
  await expect(page.locator('.booking-ticket dd').nth(1)).not.toHaveText(originalTime || '');
  await expect(page.getByText('The new sample time is waiting for owner approval.')).toBeVisible();
});

test('@claim:guest-cancellation demo lets a guest cancel the sample booking', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Cancel request' }).click();
  await page.getByRole('button', { name: 'Yes, cancel sample booking' }).click();
  await expect(page.getByRole('heading', { name: 'Cancelled' })).toBeVisible();
  await expect(page.getByText('This booking is closed and the time is available again.')).toBeVisible();
});

test('@claim:confirmed-calendar-ics demo downloads a confirmed calendar file with appointment details', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Confirm this time' }).click();
  const calendar = page.getByRole('link', { name: 'Download sample calendar (.ics)' });
  const [download] = await Promise.all([page.waitForEvent('download'), calendar.click()]);
  expect(download.suggestedFilename()).toBe('demo-booking.ics');
  const href = await calendar.getAttribute('href');
  const contents = decodeURIComponent((href || '').split(',').slice(1).join(','));
  expect(contents).toContain('BEGIN:VCALENDAR');
  expect(contents).toContain('SUMMARY:Precision cut — Northstar Barber');
  expect(contents).toContain('STATUS:CONFIRMED');
  expect(contents).toContain('DTSTART:');
  expect(contents).toContain('DTEND:');
});

test('@claim:manual-reminder-checklist demo records an owner manual reminder without sending a message', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Mark sample reminder sent' }).click();
  await expect(page.locator('.demo-owner-checklist [role="status"]')).toHaveText('Sample reminder recorded.');
  await page.reload();
  await expect(page.locator('.demo-owner-checklist [role="status"]')).toHaveText('Sample reminder recorded.');
});

test('persistent demo controls meet the 44px target at a 390px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');
  const targets = await page.locator('#reset-demo, #start-real').evaluateAll(nodes => nodes.map(node => {
    const bounds = node.getBoundingClientRect();
    return { id: node.id, width: bounds.width, height: bounds.height };
  }));
  expect(targets).toHaveLength(2);
  for (const target of targets) {
    expect(target.width, `${target.id} width`).toBeGreaterThanOrEqual(44);
    expect(target.height, `${target.id} height`).toBeGreaterThanOrEqual(44);
  }
});

test('demo controls are reachable and operable by keyboard', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Confirm this time' }).click();
  const tabbedIds: string[] = [];
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    tabbedIds.push(await page.evaluate(() => document.activeElement?.id || ''));
    if (tabbedIds.at(-1) === 'reset-demo') break;
  }
  expect(tabbedIds).toContain('reset-demo');
  await page.keyboard.press('Space');
  await expect(page.getByRole('heading', { name: 'Ready to confirm' })).toBeVisible();

  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement?.id) === 'start-real') break;
  }
  await expect(page.locator('#start-real')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('main h1')).toBeVisible();
});

test('@claim:demo-local-only demo does not call booking APIs and uses only its demo storage namespace', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Confirm this time' }).click();
  await expect(page.getByRole('heading', { name: 'Confirmed', exact: true })).toBeVisible();
  expect(requests.some(url => new URL(url).pathname.startsWith('/api/'))).toBeFalsy();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['demo:guest-booking-confirm:state']);
});

test('@claim:no-tracking-cookies demo sends no cross-origin request and writes no cookie', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Confirm this time' }).click();
  expect(await page.evaluate(() => document.cookie)).toBe('');
  expect(requests.every(url => new URL(url).origin === 'http://127.0.0.1:4173')).toBeTruthy();
});

test('@claim:api-rate-limit API responses enforce a per-client limit with Retry-After', async ({ page }) => {
  await page.goto('/demo');
  const responses = await page.evaluate(async () => Promise.all(
    Array.from({ length: 41 }, () => fetch('/api/public/settings', { headers: { 'x-forwarded-for': 'claims-rate-limit' } })
      .then(response => ({ status: response.status, retryAfter: response.headers.get('retry-after') })))
  ));
  expect(responses.filter(response => response.status === 429)).toHaveLength(1);
  expect(responses.find(response => response.status === 429)?.retryAfter).toBe('1');
});

test('unknown routes return the designed 404 and hashed assets are immutable', async ({ page, request }) => {
  const missing = await request.get('/this-route-does-not-exist');
  expect(missing.status()).toBe(404);
  await expect(page.goto('/this-route-does-not-exist')).resolves.toBeTruthy();
  await expect(page.getByRole('heading', { name: 'That page is not on this desk' })).toBeVisible();
  await page.goto('/demo');
  const asset = await page.locator('script[type="module"]').getAttribute('src');
  const assetResponse = await request.get(asset!);
  expect(assetResponse.headers()['cache-control']).toContain('immutable');
});

test('demo shell reloads offline after its first controlled visit', async ({ page, context }) => {
  await page.goto('/demo');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ready to confirm' })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ready to confirm' })).toBeVisible();
  await context.setOffline(false);
});
