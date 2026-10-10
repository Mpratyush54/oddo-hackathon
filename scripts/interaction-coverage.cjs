/*
 * Skyline interaction coverage audit.
 * Run against LOCAL DEMO only:
 *   npm run dev:demo
 *   npm install -D playwright
 *   $env:PLAYWRIGHT_MODULE="playwright"   # PowerShell, if needed
 *   node scripts/interaction-coverage.cjs
 *
 * It inventories and clicks visible controls in isolated demo state, checks
 * internal links, tables, form labels and images, and writes a JSON report.
 * Provider-send actions are intentionally skipped to avoid real side effects.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE_URL = (process.env.TEST_URL || 'http://127.0.0.1:5174').replace(/\/+$/, '');
const OUT_DIR = process.env.INTERACTION_REPORT_DIR || '.artifacts';
const REPORT_PATH = path.join(OUT_DIR, 'interaction-coverage.json');
const SCREENSHOTS = process.env.INTERACTION_SCREENSHOTS !== '0';
const CHECK_LINK_CLICKS = process.env.CHECK_LINK_CLICKS !== '0';
const TIMEOUT = Number(process.env.INTERACTION_TIMEOUT_MS || 2500);
const RESET_PARAM = '__qa_reset';
const BUTTONS = 'button:visible, [role="button"]:visible, [role="tab"]:visible, [role="menuitem"]:visible, summary:visible, [onclick]:visible, input[type="button"]:visible, input[type="submit"]:visible, input[type="reset"]:visible';
const LINKS = 'a:visible';

const PUBLIC_ROUTES = [
  '/', '/events', '/clubs', '/shop', '/clubs/skyline', '/clubs/codecraft',
  '/clubs/canvas', '/e/skyline/EVT-001', '/login', '/signup', '/verify-email',
  '/this-route-should-not-exist',
];
const ROLE_ROUTES = [
  { path: '/app', roles: ['member', 'organizer', 'treasurer', 'admin'] },
  { path: '/app/events', roles: ['member', 'organizer', 'treasurer', 'admin'] },
  { path: '/app/events/manage', roles: ['organizer', 'admin'] },
  { path: '/app/events/EVT-001', roles: ['member', 'organizer', 'treasurer', 'admin'] },
  { path: '/app/announcements', roles: ['member', 'organizer', 'admin'] },
  { path: '/app/merchandise', roles: ['member', 'organizer', 'treasurer', 'admin'] },
  { path: '/app/contributions', roles: ['member', 'treasurer', 'admin'] },
  { path: '/app/tasks', roles: ['organizer', 'admin'] },
  { path: '/app/projects', roles: ['admin'] },
  { path: '/app/my-tasks', roles: ['member', 'organizer', 'treasurer', 'admin'] },
  { path: '/app/finance', roles: ['treasurer', 'admin'] },
  { path: '/app/expenses', roles: ['member', 'organizer', 'treasurer', 'admin'] },
  { path: '/app/audit', roles: ['treasurer', 'admin'] },
  { path: '/app/calendar', roles: ['member', 'organizer', 'treasurer', 'admin'] },
  { path: '/app/check-in', roles: ['organizer', 'admin'] },
  { path: '/app/checkout?event=EVT-001', roles: ['member', 'organizer', 'treasurer', 'admin'] },
  { path: '/app/profile', roles: ['member', 'organizer', 'treasurer', 'admin', 'college'] },
  { path: '/app/my-card', roles: ['member', 'organizer', 'treasurer', 'admin'] },
  { path: '/app/my-tickets', roles: ['member', 'organizer', 'treasurer', 'admin'] },
  { path: '/app/my-orders', roles: ['member', 'organizer', 'treasurer', 'admin'] },
  { path: '/app/members', roles: ['admin'] },
  { path: '/app/users', roles: ['admin'] },
  { path: '/app/settings', roles: ['admin'] },
  { path: '/app/college', roles: ['college'] },
  { path: '/app/college-clubs', roles: ['college'] },
  { path: '/app/club-summary', roles: ['college'] },
];
const ACCESS_PROBES = [
  { path: '/app/finance', role: 'member' },
  { path: '/app/members', role: 'member' },
  { path: '/app/check-in', role: 'member' },
  { path: '/app/audit', role: 'organizer' },
  { path: '/app/college', role: 'member' },
];
const EXTERNAL_ACTION = [
  /send.{0,24}(whatsapp|message|email|notification)/i,
  /(?:whatsapp|email|notification).{0,24}send/i,
  /generate.{0,24}(ai|draft)/i,
  /draft.{0,24}with ai/i,
  /trigger.{0,24}webhook/i,
  /test.{0,24}(whatsapp|email|provider|integration)/i,
  /publish.{0,24}(whatsapp|email|external)/i,
];

function skipReason(name) {
  return EXTERNAL_ACTION.some((pattern) => pattern.test(name))
    ? 'Not clicked: avoids sending real messages or invoking an external provider.'
    : '';
}
function scenarioUrl(route, role) {
  const url = new URL(route, BASE_URL);
  url.searchParams.set(RESET_PARAM, role + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  return url.toString();
}
async function newPage(browser, role, errors, dialogs) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.addInitScript((activeRole) => {
    if (new URL(location.href).searchParams.has('__qa_reset')) {
      localStorage.clear();
      localStorage.setItem('skyline-session', JSON.stringify({ role: activeRole, signedIn: true }));
    }
  }, role);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.dismiss().catch(() => {});
  });
  return { context, page };
}
async function ready(page) {
  await page.locator('body').waitFor({ state: 'visible' });
  await page.waitForTimeout(100);
}
async function nameOf(locator) {
  return locator.evaluate((el) => {
    const aria = el.getAttribute('aria-label') && el.getAttribute('aria-label').trim();
    if (aria) return aria;
    const ids = el.getAttribute('aria-labelledby');
    if (ids) {
      const value = ids.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ');
      if (value) return value;
    }
    const nativeLabel = el.labels && [...el.labels].map((label) => label.textContent.trim()).filter(Boolean).join(' ');
    if (nativeLabel) return nativeLabel;
    const wrappingLabel = el.closest('label')?.textContent?.trim();
    if (wrappingLabel) return wrappingLabel.replace(/\s+/g, ' ');
    return (el.getAttribute('title') || '').trim() || (el.value || '').trim() ||
      (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  });
}
async function controlsOn(page) {
  const locator = page.locator(BUTTONS);
  const items = [];
  for (let i = 0; i < await locator.count(); i++) {
    const el = locator.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const info = await el.evaluate((node) => ({
      tag: node.tagName.toLowerCase(),
      disabled: Boolean(node.disabled) || node.getAttribute('aria-disabled') === 'true',
      testId: node.getAttribute('data-testid') || '',
    }));
    items.push({ index: i, name: await nameOf(el), ...info });
  }
  return items;
}
async function linksOn(page) {
  const locator = page.locator(LINKS);
  const items = [];
  for (let i = 0; i < await locator.count(); i++) {
    const el = locator.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    items.push({
      index: i, name: await nameOf(el), href: await el.evaluate((node) => node.href || ''),
      rawHref: await el.getAttribute('href'), target: await el.getAttribute('target'),
      download: await el.getAttribute('download'),
    });
  }
  return items;
}
async function structureOn(page, route, role) {
  return page.evaluate(({ route, role }) => {
    const failures = [];
    const warnings = [];
    const tables = [...document.querySelectorAll('table, [role="table"], [role="grid"]')].map((table, index) => {
      const headers = [...table.querySelectorAll('thead th, [role="columnheader"]')];
      const rows = [...table.querySelectorAll('tbody tr, [role="row"]')].filter((row) => {
        const style = getComputedStyle(row);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      const name = table.getAttribute('aria-label') ||
        table.closest('section')?.querySelector('h1,h2,h3')?.textContent?.trim() ||
        table.closest('.card')?.querySelector('h1,h2,h3')?.textContent?.trim() || ('table-' + (index + 1));
      if (!headers.length) failures.push('Table "' + name + '" has no discoverable column headers.');
      rows.forEach((row, rowIndex) => {
        const cells = [...row.querySelectorAll('td, th, [role="cell"], [role="gridcell"]')];
        if (headers.length && cells.length && cells.length !== headers.length &&
            !cells.some((cell) => Number(cell.getAttribute('colspan') || 1) > 1)) {
          warnings.push('Table "' + name + '" row ' + (rowIndex + 1) + ' has ' + cells.length + ' cells for ' + headers.length + ' headers; review it.');
        }
      });
      return { name, headers: headers.length, rows: rows.length };
    });
    const fields = [...document.querySelectorAll(
      'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea, [role="combobox"]'
    )].filter((field) => {
      const style = getComputedStyle(field);
      const rect = field.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
    for (const field of fields) {
      const labelled = Boolean(field.getAttribute('aria-label')) ||
        Boolean(field.getAttribute('aria-labelledby')) ||
        Boolean(field.labels && field.labels.length) || Boolean(field.closest('label'));
      if (!labelled) failures.push('Field "' + (field.name || field.id || field.tagName) + '" has no associated accessible label.');
    }
    for (const image of document.querySelectorAll('img')) {
      if (!image.hasAttribute('alt')) failures.push('Image "' + (image.currentSrc || image.src) + '" has no alt attribute.');
    }
    return {
      route, role, title: document.title, heading: document.querySelector('h1')?.innerText?.trim() || '',
      tables, fields: fields.length, images: document.querySelectorAll('img').length, failures, warnings,
    };
  }, { route, role });
}
function keyOf(item) { return item.tag + '|' + item.name.trim().toLowerCase(); }
function countsOf(items) {
  const result = new Map();
  for (const item of items) result.set(keyOf(item), (result.get(keyOf(item)) || 0) + 1);
  return result;
}
function sameOrigin(href) {
  try { return new URL(href, BASE_URL).origin === new URL(BASE_URL).origin; }
  catch { return false; }
}
async function initialControlsFor(browser, route, role) {
  const errors = [], dialogs = [];
  const { context, page } = await newPage(browser, role, errors, dialogs);
  try {
    await page.goto(scenarioUrl(route, role), { waitUntil: 'domcontentloaded' });
    await ready(page);
    return await controlsOn(page);
  } finally { await context.close(); }
}
async function inspectRoute(browser, route, role, report) {
  const errors = [], dialogs = [];
  const { context, page } = await newPage(browser, role, errors, dialogs);
  try {
    await page.goto(scenarioUrl(route, role), { waitUntil: 'domcontentloaded' });
    await ready(page);
    const actual = new URL(page.url());
    actual.searchParams.delete(RESET_PARAM);
    const actualRoute = actual.pathname + actual.search;
    const controls = await controlsOn(page);
    const links = await linksOn(page);
    const structure = await structureOn(page, actualRoute, role);
    report.routes.push({
      requestedRoute: route, actualRoute, role, heading: structure.heading, title: structure.title,
      visibleButtonCount: controls.length, visibleLinkCount: links.length,
      tableCount: structure.tables.length, tables: structure.tables, fieldCount: structure.fields,
      imageCount: structure.images, structureFailures: structure.failures, structureWarnings: structure.warnings,
      pageErrors: errors.slice(),
    });
    for (const detail of structure.failures) report.failures.push({ type: 'structure', route: actualRoute, role, detail });
    for (const detail of structure.warnings) report.warnings.push({ type: 'table-layout', route: actualRoute, role, detail });
    for (const detail of errors) report.failures.push({ type: 'pageerror', route: actualRoute, role, detail });
    for (const button of controls) if (!button.name) {
      report.failures.push({ type: 'button-name', route: actualRoute, role, detail: 'Visible ' + button.tag + ' index ' + button.index + ' has no accessible name.' });
    }
    for (const link of links) {
      if (!link.name) report.failures.push({ type: 'link-name', route: actualRoute, role, detail: 'Visible link "' + link.href + '" has no accessible name.' });
      if (!link.href || link.href.startsWith('javascript:')) report.failures.push({
        type: 'link-target', route: actualRoute, role, detail: 'Link "' + link.name + '" has invalid href "' + link.rawHref + '".',
      });
    }
    return { controls, links };
  } finally { await context.close(); }
}
async function clickButton(browser, route, role, steps, report) {
  const result = { route, role, index: steps[steps.length - 1].index, elementTag: steps[steps.length - 1].tag, path: steps.map((step) => step.name), name: steps[steps.length - 1].name, status: 'pending' };
  const errors = [], dialogs = [];
  const { context, page } = await newPage(browser, role, errors, dialogs);
  try {
    await page.goto(scenarioUrl(route, role), { waitUntil: 'domcontentloaded' });
    await ready(page);
    let beforeUrl = page.url();
    let finalControls = [];
    for (const step of steps) {
      const locator = page.locator(BUTTONS);
      const count = await locator.count();
      if (step.index >= count) throw new Error('Expected control index ' + step.index + ' but found ' + count + '.');
      const element = locator.nth(step.index);
      const currentName = await nameOf(element);
      if (currentName !== step.name) throw new Error('Control changed: expected "' + step.name + '", found "' + currentName + '".');
      if (!(await element.isVisible())) throw new Error('Control "' + step.name + '" is not visible.');
      if (await element.isDisabled().catch(() => false)) {
        result.status = 'disabled-state-covered';
        result.detail = 'Disabled control was asserted and not clicked.';
        report.buttons.push(result);
        return result;
      }
      const safety = skipReason(step.name);
      if (safety) {
        result.status = 'safety-skipped';
        result.detail = safety;
        report.buttons.push(result);
        return result;
      }
      const previousText = await page.locator('body').innerText();
      await element.click({ timeout: TIMEOUT });
      await page.waitForTimeout(100);
      if (errors.length) throw new Error('Uncaught browser error: ' + errors.join(' | '));
      const text = await page.locator('body').innerText().catch(() => '');
      if (!text.trim()) throw new Error('Click left the page blank.');
      const nowUrl = page.url();
      result.effect = new URL(beforeUrl).pathname !== new URL(nowUrl).pathname
        ? 'route-change'
        : (await page.locator('[role="dialog"], dialog, [aria-modal="true"]').count()) > 0
          ? 'dialog-visible'
          : previousText !== text ? 'visible-content-changed' : 'no-visible-content-change; manually review if feedback is expected';
      beforeUrl = nowUrl;
      finalControls = await controlsOn(page);
    }
    result.status = 'clicked';
    result.resultUrl = page.url();
    result.nativeDialogsDismissed = dialogs;
    result.revealedControls = [];
    const baseControls = await initialControlsFor(browser, route, role);
    const counts = countsOf(baseControls);
    const occurrence = new Map();
    const samePath = new URL(result.resultUrl).pathname === new URL(scenarioUrl(route, role)).pathname;
    if (samePath) for (const item of finalControls) {
      const key = keyOf(item);
      const n = (occurrence.get(key) || 0) + 1;
      occurrence.set(key, n);
      if (n > (counts.get(key) || 0) && item.name) result.revealedControls.push(item);
    }
  } catch (error) {
    result.status = 'failed';
    result.detail = error instanceof Error ? error.message : String(error);
    report.failures.push({ type: 'button-click', route, role, control: result.path.join(' -> '), detail: result.detail });
    if (SCREENSHOTS) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      const safe = (role + '-' + result.path.join('-')).replace(/[^a-z0-9-]+/gi, '-').slice(0, 90);
      await page.screenshot({ path: path.join(OUT_DIR, safe + '-failure.png'), fullPage: true }).catch(() => {});
    }
  } finally { await context.close().catch(() => {}); }
  report.buttons.push(result);
  return result;
}

async function auditFields(browser, route, role, report) {
  const locators = [
    'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"])',
    'select', 'textarea', '[role="combobox"]', '[role="slider"]',
  ];
  const errors = [], dialogs = [];
  const { context, page } = await newPage(browser, role, errors, dialogs);
  try {
    await page.goto(scenarioUrl(route, role), { waitUntil: 'domcontentloaded' });
    await ready(page);
    const results = [];
    for (const selector of locators) {
      const collection = page.locator(selector);
      for (let index = 0; index < await collection.count(); index++) {
        const element = collection.nth(index);
        if (!(await element.isVisible().catch(() => false))) continue;
        const info = await element.evaluate((el) => ({
          tag: el.tagName.toLowerCase(),
          type: (el.getAttribute('type') || '').toLowerCase(),
          name: el.getAttribute('name') || '',
          id: el.id || '',
          disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
          readOnly: Boolean(el.readOnly),
          required: Boolean(el.required),
          value: el.value || '',
        }));
        const label = await nameOf(element);
        const result = { route, role, selector, index, label, ...info, status: 'pending' };
        if (!label) {
          result.status = 'failed';
          result.detail = 'Visible input/control has no accessible name.';
          report.failures.push({ type: 'field-name', route, role, detail: result.detail, control: JSON.stringify(info) });
          results.push(result);
          continue;
        }
        if (info.disabled || info.readOnly) {
          result.status = 'state-covered';
          result.detail = info.disabled ? 'Disabled control asserted.' : 'Read-only control asserted.';
          results.push(result);
          continue;
        }
        try {
          if (info.tag === 'select') {
            const options = await element.locator('option').evaluateAll((opts) =>
              opts.map((o) => ({ value: o.value, disabled: o.disabled }))
                .filter((o) => !o.disabled && o.value !== ''),
            );
            if (!options.length) {
              result.status = 'empty-select';
              result.detail = 'No enabled non-empty option to select.';
            } else {
              const previous = await element.inputValue().catch(() => '');
              const candidate = options.find((o) => o.value !== previous) || options[0];
              await element.selectOption(candidate.value);
              if ((await element.inputValue()) !== candidate.value) throw new Error('Select value did not update.');
              result.status = 'changed';
              result.detail = 'Selected option value ' + candidate.value + '.';
            }
          } else if (info.type === 'checkbox' || info.type === 'radio') {
            const before = await element.isChecked();
            if (info.type === 'radio' && before) {
              result.status = 'state-covered';
              result.detail = 'Radio option was already selected; left unchanged.';
            } else {
              await element.setChecked(info.type === 'radio' ? true : !before);
              const after = await element.isChecked();
              if (info.type === 'checkbox' && after !== !before) throw new Error('Checkbox state did not toggle.');
              if (info.type === 'radio' && !after) throw new Error('Radio option did not become selected.');
              result.status = 'changed';
              result.detail = info.type + ' state changed from ' + before + ' to ' + after + '.';
            }
          } else if (selector.includes('combobox') && info.tag !== 'input' && info.tag !== 'select') {
            await element.focus();
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
            result.status = 'changed';
            result.detail = 'Keyboard interaction exercised the custom combobox.';
          } else if (info.type === 'range' || info.tag === 'div' && selector.includes('slider')) {
            await element.focus();
            await page.keyboard.press('End');
            result.status = 'changed';
            result.detail = 'Keyboard interaction reached the slider end.';
          } else {
            let sample = 'QA test input';
            if (info.type === 'email') sample = 'qa-coverage@example.test';
            else if (info.type === 'password') sample = 'QA-Test-Password-123!';
            else if (info.type === 'number') sample = '2';
            else if (info.type === 'date') sample = '2026-10-15';
            else if (info.type === 'tel') sample = '+31612345678';
            else if (info.type === 'url') sample = 'https://example.test';
            else if (info.type === 'search') sample = 'QA';
            await element.fill(sample);
            if ((await element.inputValue()) !== sample) throw new Error('Entered value did not persist.');
            result.status = 'changed';
            result.detail = 'Filled test value without submitting the form.';
          }
        } catch (error) {
          result.status = 'failed';
          result.detail = error instanceof Error ? error.message : String(error);
          report.failures.push({ type: 'field-interaction', route, role, control: label, detail: result.detail });
        }
        results.push(result);
      }
    }
    report.fields.push(...results);
  } catch (error) {
    report.failures.push({ type: 'field-audit', route, role, detail: error instanceof Error ? error.message : String(error) });
  } finally {
    await context.close().catch(() => {});
  }
}
async function auditRowActions(browser, route, role, report) {
  const errors = [], dialogs = [];
  const { context, page } = await newPage(browser, role, errors, dialogs);
  try {
    await page.goto(scenarioUrl(route, role), { waitUntil: 'domcontentloaded' });
    await ready(page);
    const rows = await page.locator('table tbody tr, [role="table"] [role="row"], [role="grid"] [role="row"]').evaluateAll((items) =>
      items.map((row, rowIndex) => ({
        rowIndex,
        text: (row.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160),
        actions: [...row.querySelectorAll('button, [role="button"], a, input[type="button"], input[type="submit"]')]
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
          })
          .map((el) => ({
            tag: el.tagName.toLowerCase(),
            name: el.getAttribute('aria-label') || el.getAttribute('title') || (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(),
            disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
          })),
      })),
    );
    const tables = await page.locator('table, [role="table"], [role="grid"]').count();
    report.tableActions.push({ route, role, tables, rows });
    for (const row of rows) for (const action of row.actions) if (!action.name) {
      report.failures.push({ type: 'table-action-name', route, role, detail: 'Row ' + (row.rowIndex + 1) + ' contains an action without an accessible name.' });
    }
  } catch (error) {
    report.failures.push({ type: 'table-action-audit', route, role, detail: error instanceof Error ? error.message : String(error) });
  } finally {
    await context.close().catch(() => {});
  }
}

async function clickLink(browser, route, role, link, report) {
  const result = { route, role, name: link.name, href: link.href, status: 'pending' };
  let url;
  try { url = new URL(link.href, BASE_URL); } catch {}
  if (!url || !link.href || url.protocol === 'javascript:') {
    result.status = 'failed';
    result.detail = 'Missing or invalid destination.';
    report.failures.push({ type: 'link-target', route, role, name: link.name, detail: result.detail });
    return result;
  }
  if (!sameOrigin(link.href) || ['mailto:', 'tel:'].includes(url.protocol) || link.target === '_blank' || link.download !== null) {
    result.status = 'safety-skipped';
    result.detail = 'External, new-tab, email/telephone or download link; destination metadata was validated.';
    return result;
  }
  if (!CHECK_LINK_CLICKS) { result.status = 'destination-validated'; return result; }
  const errors = [], dialogs = [];
  const { context, page } = await newPage(browser, role, errors, dialogs);
  try {
    await page.goto(scenarioUrl(route, role), { waitUntil: 'domcontentloaded' });
    await ready(page);
    const locator = page.locator(LINKS);
    if (link.index >= await locator.count()) throw new Error('Expected link index ' + link.index + ' but it was not found.');
    const item = locator.nth(link.index);
    if (await item.evaluate((el) => el.href || '') !== link.href || await nameOf(item) !== link.name) {
      throw new Error('Link identity changed between inventory and execution.');
    }
    await item.click({ timeout: TIMEOUT });
    await page.waitForTimeout(100);
    if (errors.length) throw new Error('Uncaught browser error: ' + errors.join(' | '));
    if (!(await page.locator('body').innerText()).trim()) throw new Error('Link click left the page blank.');
    result.status = 'clicked';
    result.resultUrl = page.url();
  } catch (error) {
    result.status = 'failed';
    result.detail = error instanceof Error ? error.message : String(error);
    report.failures.push({ type: 'link-click', route, role, name: link.name, detail: result.detail });
  } finally { await context.close().catch(() => {}); }
  return result;
}
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    repository: 'Mpratyush54/oddo-hackathon',
    baseUrl: BASE_URL,
    environment: 'LOCAL DEMO ONLY — never run this mutating audit against production',
    startedAt: new Date().toISOString(),
    routes: [], buttons: [], links: [], fields: [], tableActions: [], failures: [], warnings: [], summary: {},
  };
  const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
  try {
    const routeCases = PUBLIC_ROUTES.map((route) => ({ path: route, roles: ['member'] }))
      .concat(ROLE_ROUTES);
    for (const routeCase of routeCases) {
      for (const role of routeCase.roles) {
        const inventory = await inspectRoute(browser, routeCase.path, role, report);
        await auditFields(browser, routeCase.path, role, report);
        await auditRowActions(browser, routeCase.path, role, report);
        const queue = inventory.controls.map((button) => ({
          steps: [{ index: button.index, name: button.name, tag: button.tag }],
          names: [button.name],
        }));
        const completed = new Set();
        for (let q = 0; q < queue.length; q++) {
          const item = queue[q];
          const key = role + '|' + routeCase.path + '|' + item.names.join(' -> ');
          if (completed.has(key)) continue;
          completed.add(key);
          const outcome = await clickButton(browser, routeCase.path, role, item.steps, report);
          if (outcome.revealedControls?.length) {
            for (const child of outcome.revealedControls) {
              const names = item.names.concat(child.name);
              const childKey = role + '|' + routeCase.path + '|' + names.join(' -> ');
              if (completed.has(childKey) || queue.some((qItem) => qItem.names.join(' -> ') === names.join(' -> '))) continue;
              queue.push({
                steps: item.steps.concat({ index: child.index, name: child.name, tag: child.tag }),
                names,
              });
            }
          }
        }
        for (const link of inventory.links) {
          const outcome = await clickLink(browser, routeCase.path, role, link, report);
          report.links.push(outcome);
        }
      }
    }
    for (const probe of ACCESS_PROBES) {
      const errors = [], dialogs = [];
      const { context, page } = await newPage(browser, probe.role, errors, dialogs);
      try {
        await page.goto(scenarioUrl(probe.path, probe.role), { waitUntil: 'domcontentloaded' });
        await ready(page);
        const url = new URL(page.url());
        const blocked = url.pathname.includes('/login') ||
          await page.getByRole('heading', { name: /responsibility|not authorized|access denied|administrator/i }).count() > 0;
        if (!blocked) report.failures.push({
          type: 'authorization-route', route: probe.path, role: probe.role,
          detail: 'Role "' + probe.role + '" was not clearly blocked; final URL was ' + url.pathname + '.',
        });
      } catch (error) {
        report.failures.push({
          type: 'authorization-route', route: probe.path, role: probe.role,
          detail: error instanceof Error ? error.message : String(error),
        });
      } finally { await context.close().catch(() => {}); }
    }
  } finally { await browser.close(); }
  const count = (items, status) => items.filter((item) => item.status === status).length;
  report.finishedAt = new Date().toISOString();
  report.summary = {
    routeRoleVisits: report.routes.length,
    initialVisibleButtons: report.routes.reduce((sum, item) => sum + item.visibleButtonCount, 0),
    buttonScenarios: report.buttons.length,
    initialButtonsCovered: report.routes.reduce((sum, route) => {
      const matched = report.buttons.filter((item) =>
        item.role === route.role &&
        item.route === route.requestedRoute &&
        Number.isInteger(item.index) &&
        item.path.length === 1
      );
      return sum + new Set(matched.map((item) => item.index)).size;
    }, 0),
    buttonsClicked: count(report.buttons, 'clicked'),
    disabledStateCovered: count(report.buttons, 'disabled-state-covered'),
    providerButtonsSafetySkipped: count(report.buttons, 'safety-skipped'),
    buttonFailures: count(report.buttons, 'failed'),
    fieldsInventoried: report.fields.length,
    fieldsChanged: report.fields.filter((item) => item.status === 'changed').length,
    fieldStateCovered: report.fields.filter((item) => item.status === 'state-covered').length,
    fieldFailures: report.fields.filter((item) => item.status === 'failed').length,
    tableInstancesInspected: report.tableActions.reduce((sum, item) => sum + item.tables, 0),
    rowsInspected: report.tableActions.reduce((sum, item) => sum + item.rows.length, 0),
    linksInventoried: report.links.length,
    linksClicked: count(report.links, 'clicked'),
    linksSafetySkipped: count(report.links, 'safety-skipped'),
    linkFailures: count(report.links, 'failed'),
    tablesAudited: report.routes.reduce((sum, item) => sum + item.tableCount, 0),
    fieldsAudited: report.routes.reduce((sum, item) => sum + item.fieldCount, 0),
    imagesAudited: report.routes.reduce((sum, item) => sum + item.imageCount, 0),
    failures: report.failures.length,
    warnings: report.warnings.length,
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: REPORT_PATH, summary: report.summary }, null, 2));
  if (report.failures.length) {
    console.error('Audit found ' + report.failures.length + ' failure(s). Inspect ' + REPORT_PATH + '.');
    process.exitCode = 1;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
