import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const TEST_OWNER = 'playwright-sociobot-entra-user';

async function useTestOwner(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(owner => sessionStorage.setItem('gbc_test_owner_oid', owner), TEST_OWNER);
}

test('@desktop-only desktop landing, demo, and owner entry stay accessible', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  expect(page.viewportSize()).toEqual({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page).toHaveTitle('Guest Booking Confirm — confirm guest appointments');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('.topbar nav a')).toHaveText(['Try the demo', 'Owner panel', 'Privacy']);
  expect(await page.locator('.topbar nav a').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(['/?demo=1', '/manage', '/privacy']);
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  const desktopThirdFactBottom = await page.getByText('Free for 30 active bookings', { exact: true }).evaluate(node => node.getBoundingClientRect().bottom);
  expect(desktopThirdFactBottom).toBeLessThanOrEqual(900);
  const landingAxe = await new AxeBuilder({ page }).analyze();
  expect(landingAxe.violations.filter(violation => ['serious', 'critical'].includes(violation.impact || ''))).toEqual([]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.getByRole('link', { name: 'Try it with sample data' }).first().click();
  await expect(page).toHaveURL(/\?demo=1$/);
  const demoAxe = await new AxeBuilder({ page }).analyze();
  expect(demoAxe.violations.filter(violation => ['serious', 'critical'].includes(violation.impact || ''))).toEqual([]);
  await page.goto('/manage');
  await expect(page.getByRole('button', { name: 'Sign in with Sociobot' })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('@claim:owner-entra-identity owner access uses Sociobot Entra and mobile hours remain usable', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/manage');
  await expect(page.getByRole('heading', { name: 'Sign in to manage appointments' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Sociobot' })).toBeVisible();
  await expect(page.getByText('Sociobot Microsoft Entra External ID')).toBeVisible();
  await expect(page.getByLabel('Owner password')).toHaveCount(0);
  await page.route('https://sociobotcustomers.ciamlogin.com/**', route => route.abort());
  const providerRequest = page.waitForRequest(request => request.url().startsWith('https://sociobotcustomers.ciamlogin.com/'));
  await page.getByRole('button', { name: 'Sign in with Sociobot' }).click();
  expect((await providerRequest).url()).toContain('35c6fe40-0ec0-46b6-98c6-213ad4de6650');

  const unauthenticated = await request.get('/api/owner/status', {
    headers: { 'x-forwarded-for': 'identity-regression-unauthenticated' }
  });
  expect(unauthenticated.status()).toBe(401);

  await page.evaluate(owner => sessionStorage.setItem('gbc_test_owner_oid', owner), TEST_OWNER);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Set up your booking desk' })).toBeVisible();
  const timeInputs = await page.locator('.hours input[type=time]').evaluateAll(nodes => nodes.map(node => {
    const bounds = node.getBoundingClientRect();
    return { label: node.getAttribute('aria-label'), value: (node as HTMLInputElement).value, width: bounds.width, height: bounds.height };
  }));
  expect(timeInputs).toHaveLength(14);
  for (const input of timeInputs) {
    expect(input.value, `${input.label} value`).toMatch(/^\d{2}:\d{2}$/);
    expect(input.width, `${input.label} width`).toBeGreaterThanOrEqual(44);
    expect(input.height, `${input.label} height`).toBeGreaterThanOrEqual(44);
  }
});

test('@claim:appointment-status-preview cold landing uses future appointment states and keeps all facts above the fold', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Request and confirm guest appointments.' })).toBeVisible();
  await expect(page.getByText('For microbusinesses that approve time requests before each guest gets a clear booking status.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Try it with sample data' }).first()).toBeVisible();
  await expect(page.getByText('Opens Maya’s approved request at the guest confirmation step.')).toBeVisible();
  await expect(page.getByText('No tracking cookies', { exact: true })).toBeVisible();
  await expect(page.getByText('The demo works offline after the first visit', { exact: true })).toBeVisible();
  await expect(page.getByText('Free for 30 active bookings', { exact: true })).toBeVisible();
  const thirdFactBottom = await page.getByText('Free for 30 active bookings', { exact: true }).evaluate(node => node.getBoundingClientRect().bottom);
  expect(thirdFactBottom).toBeLessThanOrEqual(844);
  await expect(page.locator('.release-facts-bar')).toContainText('Guest requests');
  await expect(page.locator('.release-facts-bar')).toContainText('Owner approves');
  await expect(page.locator('.release-facts-bar')).toContainText('Guest confirms');
  const navTargets = await page.locator('.topbar nav a').evaluateAll(nodes => nodes.map(node => {
    const bounds = node.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  }));
  for (const target of navTargets) {
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
  }
  const spacing = await page.evaluate(() => {
    const copy = document.querySelector('.release-lede')!.getBoundingClientRect();
    const action = document.querySelector('.release-actions .button')!.getBoundingClientRect();
    return action.top - copy.bottom;
  });
  expect(spacing).toBeGreaterThanOrEqual(20);
  await page.evaluate(() => document.querySelector('#schedule')?.scrollIntoView());
  await expect(page.getByRole('heading', { name: 'Review sample appointment statuses' })).toBeVisible();
  const previews = await page.locator('[data-appointment-date]').evaluateAll(nodes => nodes.map(node => ({
    date: node.getAttribute('data-appointment-date'),
    state: node.getAttribute('data-appointment-state'),
  })));
  expect(previews).toHaveLength(12);
  for (const preview of previews) expect(new Date(preview.date!).getTime()).toBeGreaterThan(Date.now());
  for (const state of ['waiting for owner approval', 'ready for guest confirmation', 'confirmed by the guest']) {
    const button = page.locator(`[data-appointment-state="${state}"]`).first();
    await button.click();
    await expect(page.getByRole('status')).toContainText(state);
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await expect.poll(() => page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth })))
    .toEqual({ scroll: 390, client: 390 });
});

test('owner setup explains an inverted opening-hours range before saving', async ({ page }) => {
  await useTestOwner(page);
  await page.goto('/manage');
  await page.getByLabel('Business name').fill('Signal Studio');
  await page.getByLabel('Service name').fill('Consultation');
  await page.getByLabel('Business timezone').fill('UTC');
  await page.getByLabel('Monday opens').fill('17:00');
  await page.getByLabel('Monday closes').fill('09:00');
  await page.getByRole('button', { name: 'Open my booking desk' }).click();
  await expect(page.getByRole('alert')).toHaveText('Monday closing time must be later than opening time.');
  await expect(page.getByRole('heading', { name: 'Set up your booking desk' })).toBeVisible();
});

test('guest request identifies an invalid email without blaming a chosen time', async ({ page }) => {
  let bookingPosts = 0;
  const start = new Date(Date.now() + 86_400_000).toISOString();
  await page.route('**/api/public/settings', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ configured: true, business_name: 'Signal Studio', service_name: 'Consultation', timezone: 'UTC', duration_minutes: 30, welcome_note: '' }),
  }));
  await page.route('**/api/public/slots?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ slots: [{ start, local: '10:00', date: start.slice(0, 10) }] }),
  }));
  await page.route('**/api/bookings', route => {
    bookingPosts += 1;
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'The invalid form must not be submitted.' }) });
  });

  await page.goto('/');
  await page.locator('input[name="starts_at"]').check();
  await page.getByLabel('Full name').fill('Ada Guest');
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByRole('checkbox', { name: /I agree/ }).check();
  await page.getByRole('button', { name: /Send time request/ }).click();

  await expect(page.getByRole('alert')).toHaveText('Enter a valid email address.');
  await expect(page.locator('input[name="starts_at"]')).toBeChecked();
  expect(bookingPosts).toBe(0);
});

test('@claim:guest-no-account @claim:owner-approval-before-booking @claim:copy-private-booking-link @claim:private-booking-link-security guest request reaches owner approval and guest confirmation', async ({ page, request, context }) => {
  await useTestOwner(page);
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });

  await page.goto('/manage');
  await expect(page.getByRole('heading', { name: 'Set up your booking desk' })).toBeVisible();
  await page.getByLabel('Business name').fill('Signal Studio');
  await page.getByLabel('Service name').fill('Consultation');
  await page.getByLabel('Business timezone').fill('UTC');
  await page.getByRole('button', { name: 'Open my booking desk' }).click();
  await expect(page.getByRole('heading', { name: 'Booking signals', exact: true })).toBeVisible();

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

  const ownerHeaders = { 'x-test-oid': TEST_OWNER, 'x-forwarded-for': 'owner-flow-regression' };
  const list = await request.get('/api/owner/bookings', { headers: ownerHeaders });
  const booking = (await list.json()).bookings[0];
  const approved = await request.patch(`/api/owner/bookings/${booking.id}/approve`, { headers: ownerHeaders });
  expect(approved.ok()).toBeTruthy();

  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/manage');
  await page.getByRole('button', { name: 'Copy guest link' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(guestUrl);

  await page.evaluate(() => sessionStorage.clear());
  await page.goto(guestUrl);
  await expect(page.getByRole('heading', { name: 'Ready to confirm' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm this time' }).click();
  await expect(page.getByRole('heading', { name: 'Confirmed', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Add to calendar/ })).toBeVisible();

  expect({ consoleErrors, failedResponses }).toEqual({ consoleErrors: [], failedResponses: [] });
  page.removeAllListeners('console');
  page.removeAllListeners('response');

  await page.goto(`${guestUrl}changed`);
  await expect(page.getByRole('heading', { name: 'We couldn’t open the booking desk' })).toBeVisible();
  await expect(page.getByText('Ada Guest')).toHaveCount(0);
  await page.goto('/b/');
  await expect(page.getByRole('heading', { name: 'That page is not on this desk' })).toBeVisible();
  await expect(page.getByText('Ada Guest')).toHaveCount(0);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact || ''))).toEqual([]);
});

test('@claim:browser-license-storage checkout return stores, strips, and verifies without blocking the free first paint', async ({ page }) => {
  await useTestOwner(page);
  const returnedLicense = 'license_return_regression_token';
  let submittedLicense = '';
  let releaseVerification!: () => void;
  const verificationPending = new Promise<void>(resolve => { releaseVerification = resolve; });
  await page.route('**/api/owner/status', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ configured: true, legacy_owner: false }),
  }));
  await page.route('**/api/owner/settings', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      business_name: 'Signal Studio',
      service_name: 'Consultation',
      timezone: 'UTC',
      duration_minutes: 30,
      weekly_hours: { mon: ['09:00', '17:00'] },
      welcome_note: '',
      paid: false,
    }),
  }));
  await page.route('**/api/owner/bookings', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ bookings: [] }),
  }));
  await page.route('**/api/license/verify', async route => {
    submittedLicense = route.request().postDataJSON().license;
    await verificationPending;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: false, reason: 'invalid' }) });
  });
  await page.goto(`/manage?license=${returnedLicense}`);

  await expect(page.getByRole('heading', { name: 'Free desk · 30 active bookings' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Buy Panel Pro · $29 at Sociobot' })).toHaveAttribute(
    'href',
    'https://api.sociobot.in/api/v1/products/guest-booking-confirm/checkout',
  );
  await expect(page).toHaveURL(/\/manage$/);
  await expect.poll(() => submittedLicense).toBe(returnedLicense);
  expect(await page.evaluate(() => ({
    license: localStorage.getItem('sb_license:guest-booking-confirm'),
    localIdentity: localStorage.getItem('gbc_test_owner_oid'),
    sessionIdentity: sessionStorage.getItem('gbc_test_owner_oid'),
  }))).toEqual({ license: returnedLicense, localIdentity: null, sessionIdentity: TEST_OWNER });
  releaseVerification();
  await expect(page.getByRole('alert')).toHaveText('This license is not active (invalid). Free features remain available.');
  expect(await page.evaluate(() => ({
    checked: Number(localStorage.getItem('sb_license:guest-booking-confirm:checked')),
    valid: localStorage.getItem('sb_license:guest-booking-confirm:valid'),
  }))).toEqual({ checked: expect.any(Number), valid: 'false' });
});

test('a revoked cached license refreshes the owner panel to free limits', async ({ page }) => {
  await useTestOwner(page);
  await page.addInitScript(() => {
    localStorage.setItem('sb_license:guest-booking-confirm', 'formerly_valid_license_token');
    localStorage.setItem('sb_license:guest-booking-confirm:checked', '0');
    localStorage.setItem('sb_license:guest-booking-confirm:valid', 'true');
  });
  let paid = true;
  let releaseVerification!: () => void;
  const verificationPending = new Promise<void>(resolve => { releaseVerification = resolve; });
  await page.route('**/api/owner/status', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ configured: true, legacy_owner: false }),
  }));
  await page.route('**/api/owner/settings', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ business_name: 'Signal Studio', service_name: 'Consultation', timezone: 'UTC', duration_minutes: 30, weekly_hours: {}, welcome_note: '', paid }),
  }));
  await page.route('**/api/owner/bookings', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ bookings: [] }),
  }));
  await page.route('**/api/license/verify', async route => {
    await verificationPending;
    paid = false;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: false, reason: 'revoked' }) });
  });

  await page.goto('/manage');
  await expect(page.getByRole('heading', { name: 'Panel Pro is active' })).toBeVisible();
  releaseVerification();
  await expect(page.getByRole('heading', { name: 'Free desk · 30 active bookings' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText('This license is not active (revoked). Free features remain available.');
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

test('every route publishes its own title, canonical URL, and sharing metadata', async ({ page }) => {
  const routes = [
    ['/', 'Guest Booking Confirm — confirm guest appointments', '/'],
    ['/?demo=1', 'Demo — Guest Booking Confirm', '/?demo=1'],
    ['/privacy', 'Privacy — Guest Booking Confirm', '/privacy'],
    ['/terms', 'Terms — Guest Booking Confirm', '/terms'],
    ['/manage', 'Owner panel — Guest Booking Confirm', '/manage'],
  ];
  for (const [path, title, canonicalPath] of routes) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://guest-booking-confirm.sociobot.in${canonicalPath}`);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', title);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `https://guest-booking-confirm.sociobot.in${canonicalPath}`);
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', title);
    await expect(page.locator('footer a[href="/privacy"]')).toHaveCount(1);
    await expect(page.locator('footer a[href="/terms"]')).toHaveCount(1);
  }
});

test('@claim:demo-confirmation-trail demo starts approved and reaches guest confirmation', async ({ page }) => {
  await page.goto('/?demo=1');
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
  const actionRequests: Array<{ method: string; url: string }> = [];
  page.on('request', request => actionRequests.push({ method: request.method(), url: request.url() }));
  await page.getByRole('button', { name: 'Mark sample reminder sent' }).click();
  await expect(page.locator('.demo-owner-checklist [role="status"]')).toHaveText('Sample reminder recorded.');
  expect(actionRequests).toEqual([]);
  await page.reload();
  await expect(page.locator('.demo-owner-checklist [role="status"]')).toHaveText('Sample reminder recorded.');
  expect(actionRequests.every(request => request.method === 'GET' && new URL(request.url).origin === 'http://127.0.0.1:4173')).toBeTruthy();
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

test('keyboard focus indicators have at least 3:1 contrast on every dark product surface', async ({ page }) => {
  const contrast = ([foreground, background]: [string, string]): number => {
    const luminance = (color: string): number => {
      const values = color.match(/[\d.]+/g)!.slice(0, 3).map(value => Number(value) / 255)
        .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
    };
    const [first, second] = [luminance(foreground), luminance(background)];
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };
  const focusedColors = async (target: string, surface: string): Promise<[string, string]> => page.evaluate(([targetSelector, surfaceSelector]) => {
    const element = document.querySelector<HTMLElement>(targetSelector)!;
    element.focus();
    if (!element.matches(':focus-visible')) throw new Error(`${targetSelector} is not focus-visible`);
    return [getComputedStyle(element).outlineColor, getComputedStyle(document.querySelector(surfaceSelector)!).backgroundColor];
  }, [target, surface] as const);

  await page.goto('/demo');
  for (const target of ['#reset-demo', '#start-real']) {
    expect(contrast(await focusedColors(target, '.demo-banner')), `${target} focus contrast`).toBeGreaterThanOrEqual(3);
  }

  await page.route('**/api/public/settings', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ configured: true, business_name: 'Signal Studio', service_name: 'Consultation', timezone: 'UTC', duration_minutes: 30, welcome_note: '' }),
  }));
  await page.route('**/api/public/slots?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"slots":[]}' }));
  await page.goto('/');
  await expect(page.locator('.hero-demo')).toBeVisible();
  expect(contrast(await focusedColors('.hero-demo', '.booking-hero')), 'configured hero focus contrast').toBeGreaterThanOrEqual(3);
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
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: 'Confirm this time' }).click();
  await expect(page.getByRole('heading', { name: 'Confirmed', exact: true })).toBeVisible();
  expect(requests.some(url => new URL(url).pathname.startsWith('/api/'))).toBeFalsy();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['demo:guest-booking-confirm:state']);
});

test('@claim:no-tracking-cookies demo sends no cross-origin request and writes no cookie', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: 'Confirm this time' }).click();
  expect(await page.evaluate(() => document.cookie)).toBe('');
  expect(requests.every(url => new URL(url).origin === 'http://127.0.0.1:4173')).toBeTruthy();
});

test('@claim:api-rate-limit @claim:health-build-identity API limits traffic while health stays available', async ({ page, request }, testInfo) => {
  await page.goto('/demo');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const client = `claims-rate-limit-${testInfo.workerIndex}-${attempt}-${Date.now()}`;
    const responses = await Promise.all(Array.from({ length: 41 }, async () => {
      const response = await request.get('/api/public/settings', {
        headers: { 'x-forwarded-for': client }
      });
      return { status: response.status(), retryAfter: response.headers()['retry-after'] };
    }));
    expect(responses.filter(response => response.status === 200), `attempt ${attempt + 1} allowed responses`).toHaveLength(40);
    expect(responses.filter(response => response.status === 429), `attempt ${attempt + 1} limited responses`).toHaveLength(1);
    expect(responses.find(response => response.status === 429)?.retryAfter).toBe('1');
  }
  const pageViewClient = `write-rate-limit-${testInfo.workerIndex}-${Date.now()}`;
  const pageViews = await Promise.all(Array.from({ length: 14 }, async () => {
    const response = await request.post('/api/page-view', { headers: { 'x-forwarded-for': pageViewClient } });
    return { status: response.status(), retryAfter: response.headers()['retry-after'] };
  }));
  expect(pageViews.filter(response => response.status === 204)).toHaveLength(12);
  expect(pageViews.filter(response => response.status === 429)).toHaveLength(2);
  expect(pageViews.filter(response => response.status === 429).every(response => response.retryAfter === '1')).toBeTruthy();

  const licenseClient = `license-rate-limit-${testInfo.workerIndex}-${Date.now()}`;
  const licenses = await Promise.all(Array.from({ length: 14 }, async () => {
    const response = await request.post('/api/license/verify', {
      headers: { 'content-type': 'application/json', 'x-forwarded-for': licenseClient },
      data: {}
    });
    return { status: response.status(), retryAfter: response.headers()['retry-after'] };
  }));
  expect(licenses.filter(response => response.status === 422)).toHaveLength(12);
  expect(licenses.filter(response => response.status === 429)).toHaveLength(2);
  expect(licenses.filter(response => response.status === 429).every(response => response.retryAfter === '1')).toBeTruthy();
  const health = await request.get('/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: 'ok', build_sha: expect.stringMatching(/\S+/) });
});

test('unknown routes return the designed 404 and hashed assets are immutable', async ({ page, request }) => {
  const ownerShell = await request.get('/manage');
  expect(ownerShell.headers()['content-security-policy']).toContain('connect-src \'self\' https://api.sociobot.in https://sociobotcustomers.ciamlogin.com');
  expect(ownerShell.headers()['content-security-policy']).toContain('frame-src https://sociobotcustomers.ciamlogin.com');
  const callbackShell = await request.get('/auth/callback');
  expect(callbackShell.headers()['cache-control']).toBe('no-cache');
  const missing = await request.get('/this-route-does-not-exist');
  expect(missing.status()).toBe(404);
  const missingHtml = await missing.text();
  for (const required of ['meta name="description"', 'rel="canonical"', 'property="og:title"', 'name="twitter:title"', 'rel="icon"', 'rel="apple-touch-icon"']) {
    expect(missingHtml).toContain(required);
  }
  expect(missingHtml).toContain('meta name="robots" content="noindex"');
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const sitemapXml = await sitemap.text();
  for (const route of ['/', '/demo', '/privacy', '/terms', '/manage']) expect(sitemapXml).toContain(`https://guest-booking-confirm.sociobot.in${route}`);
  await expect(page.goto('/this-route-does-not-exist')).resolves.toBeTruthy();
  await expect(page.getByRole('heading', { name: 'That page is not on this desk' })).toBeVisible();
  await page.goto('/demo');
  const asset = await page.locator('script[type="module"]').getAttribute('src');
  const assetResponse = await request.get(asset!);
  expect(assetResponse.headers()['cache-control']).toContain('immutable');
});

test('@claim:offline-reload service worker leaves identity callbacks uncached and reloads the demo offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.goto('/auth/callback');
  const cachedUrls = await page.evaluate(async () => {
    const cacheNames = await caches.keys();
    const requests = (await Promise.all(cacheNames.map(async name => (await caches.open(name)).keys()))).flat();
    return requests.map(request => request.url);
  });
  expect(cachedUrls.some(url => new URL(url).pathname === '/auth/callback')).toBe(false);
  await page.goto('/?demo=1');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ready to confirm' })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ready to confirm' })).toBeVisible();
  await context.setOffline(false);
});
