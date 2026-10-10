const assert = require('node:assert/strict');
const {
  chromium,
} = require('C:/Users/Pratyush Mishra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const url = 'http://127.0.0.1:5174';
  await page.goto(url + '/shop');
  await page.getByRole('heading', { name: 'A little more you. A little more us.' }).waitFor();
  await page.screenshot({ path: 'artifacts/shop-v2.png', fullPage: true });
  await page.getByRole('button', { name: 'Explore The everyday hoodie' }).click();
  await page.getByRole('dialog').waitFor();
  await page.screenshot({ path: 'artifacts/garment-v2.png' });
  console.log('shop and preview rendered', await page.locator('.garment-model').count());
  await browser.close();
  assert.deepEqual(errors, []);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
