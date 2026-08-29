import assert from 'node:assert/strict';
import test from 'node:test';

const billingBase = process.env.SOCIOBOT_BILLING_BASE || 'https://api.sociobot.in';
const productSlug = 'guest-booking-confirm';

test('@claim:panel-pro-checkout Panel Pro has a live $29 hosted checkout', async () => {
  const catalogResponse = await fetch(`${billingBase}/api/v1/products`, {
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(catalogResponse.status, 200, 'Sociobot product catalog must be available');

  const catalog = await catalogResponse.json();
  assert.equal(catalog.mode, 'live');
  const product = catalog.data.find((entry) => entry.slug === productSlug);
  assert.deepEqual(product, {
    checkout_url: `${billingBase}/api/v1/products/${productSlug}/checkout`,
    currency: 'USD',
    name: 'Guest Booking Confirm Panel Pro',
    price_minor: 2900,
    product_url: 'https://guest-booking-confirm.sociobot.in/manage',
    slug: productSlug,
  });

  const checkoutResponse = await fetch(product.checkout_url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(checkoutResponse.status, 303, 'checkout must redirect to the hosted payment page');
  const checkoutUrl = new URL(checkoutResponse.headers.get('location'));
  assert.equal(checkoutUrl.protocol, 'https:');
  assert.equal(checkoutUrl.hostname, 'checkout.dodopayments.com');
  assert.match(checkoutUrl.pathname, /^\/session\/cks_[A-Za-z0-9]+$/);

  const hostedResponse = await fetch(checkoutUrl, { signal: AbortSignal.timeout(30_000) });
  assert.equal(hostedResponse.status, 200, 'hosted checkout must load');
  const hostedPage = await hostedResponse.text();
  assert.match(hostedPage, /Guest Booking Confirm/);
  assert.match(hostedPage, /Panel Pro/);
  assert.match(hostedPage, /\$29/);
});
