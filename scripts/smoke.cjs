const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.TEST_URL || 'http://127.0.0.1:5174';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('skyline-v2')));
  const persona = async (role) => {
    await page.evaluate(
      (role) => localStorage.setItem('skyline-session', JSON.stringify({ role, signedIn: true })),
      role,
    );
  };

  await page.goto(url);
  await page.getByRole('heading', { name: /Less chasing.*More belonging/ }).waitFor();
  await page.goto(url + '/shop?club=codecraft&product=PROD-001');
  await page.getByRole('dialog').waitFor();
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem('skyline-v2')).selectedClub === 'codecraft',
  );
  assert.equal(
    await page.getByRole('button', { name: 'Sign in to order', exact: true }).count(),
    1,
  );
  const slider = page.getByRole('slider', { name: 'Garment rotation' });
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  assert.match(await slider.getAttribute('aria-valuetext'), /back/);
  await slider.focus();
  await page.keyboard.press('Home');
  assert.match(await slider.getAttribute('aria-valuetext'), /front/);
  await page.getByRole('button', { name: 'Preview Warm cream' }).click();
  await page.getByRole('button', { name: 'Find my fit' }).click();
  assert.equal(await page.getByRole('dialog').count(), 1);
  await page.getByLabel('Height (cm)').fill('170');
  await page.getByLabel('Chest circumference (cm)').fill('96');
  await page.getByRole('button', { name: 'Suggest a starting size' }).click();
  await page.getByText('Start with M', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Sign in to order', exact: true }).click();
  await page.getByLabel('Choose a demo view').selectOption('member');
  await page.getByRole('button', {name:'Continue to workspace'}).click();
  await page.getByRole('dialog').waitFor();
  const initial = (await state()).clubs.codecraft;
  const skylineStock = (await state()).clubs.skyline.products[0].stock;
  await page.getByRole('button', { name: 'M,', exact: false }).click();
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Complete demo order', exact: false }).click();
  await page.waitForFunction(
    (count) =>
      JSON.parse(localStorage.getItem('skyline-v2')).clubs.codecraft.orders.length === count + 2,
    initial.orders.length,
  );
  const current = (await state()).clubs.codecraft;
  assert.equal(current.products[0].stock.M, initial.products[0].stock.M - 2);
  assert.equal(current.transactions[0].amount, current.products[0].memberPrice * 2);
  assert.ok(current.audit.length > initial.audit.length);
  assert.deepEqual((await state()).clubs.skyline.products[0].stock, skylineStock);

  await page.goto(url + '/app/finance');
  await page
    .getByRole('heading', { name: 'This view belongs to another responsibility.' })
    .waitFor();
  await page.goto(url + '/app/my-card');
  assert.equal(await page.locator('.portal-card-qr img').count(), 1);
  await persona('admin');
  await page.goto(url + '/app');
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.getByRole('button', {name:'Open navigation'}).click();
  const scroll = await page.locator('.sidebar-scroll').evaluate((el) => ({
    client: el.clientHeight,
    full: el.scrollHeight,
    overflow: getComputedStyle(el).overflowY,
  }));
  assert.ok(scroll.full > scroll.client);
  assert.equal(scroll.overflow, 'auto');
  const health = await page.request.get(url + '/api/health');
  assert.equal(health.status(), 200);
  assert.equal((await health.json()).ai.provider, 'OpenRouter');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/shop', '/app/merchandise', '/app/profile', '/app/announcements']) {
    await page.goto(url + path);
    await page.locator('h1').first().waitFor();
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      path + ' overflow',
    );
  }
  await page.goto(url + '/shop?product=PROD-001');
  await page.getByRole('dialog').waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: 'artifacts/shop-mobile.png' });
  await persona('college');
  await page.goto(url + '/app/college');
  await page.getByRole('heading', { name: 'A campus full of possibility.' }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: public browsing, club deep links, rotation/color/fit controls, login return, quantity/order/stock/ledger/audit, roles, QR, short sidebar, API, mobile.',
  );
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
