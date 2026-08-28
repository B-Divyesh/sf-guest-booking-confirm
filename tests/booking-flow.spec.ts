import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('guest request reaches owner approval and guest confirmation', async ({ page, request }) => {
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
  }
});
