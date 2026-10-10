const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const b = await chromium.launch();
  const context = await b.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const p = await context.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const base = 'http://127.0.0.1:5174';
  await p.goto(base + '/events');
  await p.locator('.event-discovery-card').first().waitFor();
  assert.equal(
    (await p.locator('.event-discovery-card').count()) +
      (await p.locator('.event-spotlight').count()),
    12,
  );
  await p.getByRole('button', { name: 'Filters', exact: true }).click();
  await p.getByLabel('Student community').selectOption('canvas');
  assert.equal(
    (await p.locator('.event-discovery-card').count()) +
      (await p.locator('.event-spotlight').count()),
    4,
  );
  await p.getByRole('button', { name: 'Past events', exact: true }).click();
  assert.equal(await p.locator('.event-discovery-card').count(), 1);
  await p.getByRole('link', { name: 'View memories', exact: false }).click();
  await p.getByRole('button', { name: 'Event ended', exact: false }).waitFor();
  assert.equal(
    await p.getByRole('button', { name: 'Event ended', exact: false }).isDisabled(),
    true,
  );
  await p.getByRole('tab', { name: 'Gallery', exact: false }).click();
  assert.equal(await p.locator('.experience-gallery-grid button').count(), 3);
  await p.getByRole('button', { name: 'Open event cover image' }).click();
  await p.getByRole('dialog').waitFor();
  await p.getByRole('button', { name: 'Next', exact: true }).click();
  await p.getByText('2 / 3', { exact: true }).waitFor();
  await p.keyboard.press('Escape');
  await p.getByRole('tab', { name: 'Reviews', exact: false }).click();
  await p.getByRole('heading', { name: 'No reviews yet.' }).waitFor();
  await p.getByRole('button', { name: 'Share this event' }).click();
  await p.getByRole('button', { name: 'Link copied' }).waitFor();
  assert.match(
    await p.evaluate(() => navigator.clipboard.readText()),
    /\/e\/canvas\/EVT-WELCOME-2026$/,
  );
  await p.goto(base + '/e/skyline/EVT-001');
  await p.getByRole('button', { name: 'Get your ticket' }).click();
  await p.getByLabel('Choose a demo view').selectOption('member');
  await p.getByRole('button', { name: 'Continue to workspace' }).click();
  await p.waitForURL('**/app/events/EVT-001');
  await p.locator('.experience-heading h1').waitFor();
  assert.equal(await p.locator('.experience-heading h1').count(), 1);
  await p.goto(base + '/app/checkout?event=EVT-WELCOME-2026');
  await p.getByRole('heading', { name: /This event has.*ended/ }).waitFor();
  await p.evaluate(() => {
    window.__spaNavigation = true;
    const store = JSON.parse(localStorage.getItem('skyline-v2'));
    store.clubs.skyline.events.push({
      id: 'OVERNIGHT',
      title: 'Overnight test',
      date: '2026-10-30',
      time: '23:00',
      endTime: '02:00',
      venue: 'Test lab',
      category: 'Workshop',
      price: 0,
      memberPrice: 0,
      capacity: 5,
      sold: 0,
      image: '',
      description: 'QA only',
    });
    localStorage.setItem('skyline-v2', JSON.stringify(store));
  });
  await p.goto(base + '/app/calendar');
  await p.getByRole('link', { name: 'Overnight test', exact: false }).first().waitFor();
  assert.equal(await p.getByRole('link', { name: 'Overnight test', exact: false }).count(), 2);
  await p.evaluate(() => (window.__spaNavigation = true));
  await p.getByRole('button', { name: 'Open navigation' }).click();
  await p.getByRole('link', { name: 'Events', exact: true }).first().click();
  await p.locator('.event-discovery').waitFor();
  assert.equal(await p.evaluate(() => window.__spaNavigation), true);
  assert.equal(await p.locator('#workspace-navigation').isVisible(), true);
  await p.getByRole('button', { name: 'Close navigation' }).click();
  assert.equal(
    await p.getByRole('button', { name: 'Open navigation' }).getAttribute('aria-expanded'),
    'false',
  );
  for (const width of [390, 320]) {
    await p.setViewportSize({ width, height: 844 });
    for (const path of [
      '/',
      '/events',
      '/clubs',
      '/login',
      '/app/calendar',
      '/app/events/EVT-001',
      '/e/skyline/EVT-WELCOME-2026',
    ]) {
      await p.goto(base + path);
      await p.locator('h1').first().waitFor();
      assert.ok(
        await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${width} ${path} overflow`,
      );
    }
    await p.goto(base + '/');
    await p.getByRole('button', { name: 'Open site menu' }).click();
    await p
      .getByRole('navigation', { name: 'Public navigation' })
      .getByRole('link', { name: 'Events', exact: true })
      .click();
    await p.waitForURL('**/events');
  }
  assert.deepEqual(errors, []);
  console.log(
    'PASS: public discovery/filter/archive/gallery/share/login return/past checkout guard/overnight calendar/SPA navigation/mobile320+390/site menu',
  );
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
