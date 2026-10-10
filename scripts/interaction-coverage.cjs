/*
 * Skyline Student Association: route, button, link, form and table interaction census.
 *
 * LOCAL DEMO ONLY. Start `npm run dev:demo` first.
 *   npm install -D playwright
 *   npx playwright install chromium
 *   node scripts/interaction-coverage.cjs
 *
 * This reports general interaction evidence. Business-critical controls still need
 * focused assertions for correct data changes, permissions and API behavior.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE_URL = (process.env.TEST_URL || 'http://127.0.0.1:5174').replace(/\/+$/, '');
const OUT_DIR = process.env.INTERACTION_REPORT_DIR || '.artifacts';
const REPORT_PATH = path.join(OUT_DIR, 'interaction-coverage.json');
const TIMEOUT = Number(process.env.INTERACTION_TIMEOUT_MS || 2500);
const RESET_PARAM = '__qa_reset';
const TAKE_SCREENSHOTS = process.env.INTERACTION_SCREENSHOTS !== '0';
const CLICK_LINKS = process.env.CHECK_LINK_CLICKS !== '0';
const BUTTONS = [
  'button:visible', '[role="button"]:visible', '[role="tab"]:visible',
  '[role="menuitem"]:visible', 'summary:visible',
  'input[type="button"]:visible', 'input[type="submit"]:visible', 'input[type="reset"]:visible',
].join(', ');
const LINKS = 'a:visible';
const FIELD_SELECTOR = [
  'input:visible:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"])',
  'select:visible', 'textarea:visible', '[role="combobox"]:visible', '[role="slider"]:visible',
].join(', ');

const PUBLIC_ROUTES = [
  '/', '/events', '/clubs', '/shop', '/clubs/skyline', '/clubs/codecraft',
  '/clubs/canvas', '/e/skyline/EVT-001', '/login', '/signup', '/verify-email',
  '/this-route-should-not-exist',
];
const ROUTES_BY_ROLE = [
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
const FORBIDDEN_ROUTE_PROBES = [
  { path: '/app/finance', role: 'member' },
  { path: '/app/members', role: 'member' },
  { path: '/app/check-in', role: 'member' },
  { path: '/app/audit', role: 'organizer' },
  { path: '/app/college', role: 'member' },
];
const DO_NOT_CLICK = [
  /whatsapp/i, /send.{0,24}(message|email|notification)/i,
  /(?:email|notification).{0,24}send/i, /trigger.{0,24}webhook/i,
  /generate.{0,24}(ai|draft)/i, /draft.{0,24}with ai/i,
  /scan.{0,16}(qr|ticket)/i, /start.{0,16}(camera|scanner)/i,
  /use camera/i, /send test/i,
];

function skipReason(name) {
  if (DO_NOT_CLICK.some((pattern) => pattern.test(name || ''))) {
    return 'Potential external-provider or hardware action; inventoried but not activated by the generic audit.';
  }
  return '';
}
function testUrl(route, role) {
  const url = new URL(route, BASE_URL);
  url.searchParams.set(RESET_PARAM, role + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  return url.toString();
}
async function newPage(browser, role, errors, dialogs) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.addInitScript((activeRole) => {
    if (new URL(window.location.href).searchParams.has('__qa_reset')) {
      localStorage.clear();
      localStorage.setItem('skyline-session', JSON.stringify({ role: activeRole, signedIn: true }));
    }
  }, role);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    // A generic audit must never confirm a destructive native confirmation.
    await dialog.dismiss().catch(() => {});
  });
  return { context, page };
}
async function waitReady(page) {
  await page.locator('body').waitFor({ state: 'visible' });
  await page.waitForTimeout(100);
}
async function accessibleName(locator) {
  return locator.evaluate((el) => {
    const aria = el.getAttribute('aria-label') && el.getAttribute('aria-label').trim();
    if (aria) return aria;
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const value = labelledBy.split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean).join(' ');
      if (value) return value;
    }
    const nativeLabels = el.labels
      ? [...el.labels].map((label) => label.textContent.trim()).filter(Boolean).join(' ')
      : '';
    if (nativeLabels) return nativeLabels;
    const wrappingLabel = el.closest('label')?.textContent?.trim();
    if (wrappingLabel) return wrappingLabel.replace(/\s+/g, ' ');
    return (el.getAttribute('title') || '').trim() ||
      (el.value || '').trim() ||
      (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  });
}
async function listControls(page) {
  const locator = page.locator(BUTTONS);
  const out = [];
  for (let index = 0; index < await locator.count(); index++) {
    const el = locator.nth(index);
    if (!(await el.isVisible().catch(() => false))) continue;
    const meta = await el.evaluate((node) => ({
      tag: node.tagName.toLowerCase(),
      role: node.getAttribute('role') || '',
      disabled: Boolean(node.disabled) || node.getAttribute('aria-disabled') === 'true',
      type: node.getAttribute('type') || '',
      testId: node.getAttribute('data-testid') || '',
      title: node.getAttribute('title') || '',
    }));
    out.push({ index, name: await accessibleName(el), ...meta });
  }
  return out;
}
async function listLinks(page) {
  const locator = page.locator(LINKS);
  const out = [];
  for (let index = 0; index < await locator.count(); index++) {
    const el = locator.nth(index);
    if (!(await el.isVisible().catch(() => false))) continue;
    out.push({
      index,
      name: await accessibleName(el),
      href: await el.evaluate((node) => node.href || ''),
      rawHref: await el.getAttribute('href'),
      target: await el.getAttribute('target'),
      download: await el.getAttribute('download'),
    });
  }
  return out;
}
async function auditPageStructure(page, route, role) {
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
        table.closest('.card')?.querySelector('h1,h2,h3')?.textContent?.trim() ||
        'table-' + (index + 1);
      if (!headers.length) failures.push('Table "' + name + '" has no discoverable column headers.');
      const rowReports = rows.map((row, rowIndex) => {
        const cells = [...row.querySelectorAll('td, th, [role="cell"], [role="gridcell"]')];
        if (headers.length && cells.length && cells.length !== headers.length &&
            !cells.some((cell) => Number(cell.getAttribute('colspan') || 1) > 1)) {
          warnings.push('Table "' + name + '" row ' + (rowIndex + 1) +
            ' has ' + cells.length + ' cells versus ' + headers.length + ' headers; inspect manually.');
        }
        const actions = [...row.querySelectorAll('button, [role="button"], a[href], input[type="button"], input[type="submit"]')]
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
          })
          .map((el) => ({
            tag: el.tagName.toLowerCase(),
            name: el.getAttribute('aria-label') || el.getAttribute('title') ||
              (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(),
            disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
          }));
        actions.filter((action) => !action.name).forEach(() => {
          failures.push('Table "' + name + '" row ' + (rowIndex + 1) + ' has an action with no accessible name.');
        });
        return { index: rowIndex, cellCount: cells.length, text: (row.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 140), actions };
      });
      return { name, headerCount: headers.length, rowCount: rows.length, rows: rowReports };
    });
    const fields = [...document.querySelectorAll(
      'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea, [role="combobox"], [role="slider"]'
    )].filter((field) => {
      const rect = field.getBoundingClientRect();
      const style = getComputedStyle(field);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    for (const field of fields) {
      const hasLabel = Boolean(field.getAttribute('aria-label')) ||
        Boolean(field.getAttribute('aria-labelledby')) ||
        Boolean(field.labels && field.labels.length) ||
        Boolean(field.closest('label'));
      if (!hasLabel) failures.push('Field "' + (field.name || field.id || field.tagName) + '" has no programmatic label.');
    }
    for (const image of document.querySelectorAll('img')) {
      if (!image.hasAttribute('alt')) failures.push('Image "' + (image.currentSrc || image.src) + '" has no alt attribute.');
    }
    return {
      route, role, title: document.title,
      heading: document.querySelector('h1')?.innerText?.trim() || '',
      tables, fieldCount: fields.length, imageCount: document.querySelectorAll('img').length,
      failures, warnings,
    };
  }, { route, role });
}
function signature(control) {
  return control.tag + '|' + control.name.trim().toLowerCase();
}
function tally(controls) {
  const out = new Map();
  for (const control of controls) out.set(signature(control), (out.get(signature(control)) || 0) + 1);
  return out;
}
function isLocalInternalLink(href) {
  try { return new URL(href, BASE_URL).origin === new URL(BASE_URL).origin; }
  catch { return false; }
}
async function inspectRoute(browser, route, role, report) {
  const errors = [], dialogs = [];
  const { context, page } = await newPage(browser, role, errors, dialogs);
  try {
    await page.goto(testUrl(route, role), { waitUntil: 'domcontentloaded' });
    await waitReady(page);
    const actual = new URL(page.url());
    actual.searchParams.delete(RESET_PARAM);
    const actualRoute = actual.pathname + actual.search;
    const controls = await listControls(page);
    const links = await listLinks(page);
    const structure = await auditPageStructure(page, actualRoute, role);
    report.routes.push({
      requestedRoute: route,
      actualRoute,
      role,
      title: structure.title,
      heading: structure.heading,
      buttons: controls,
      links,
      tables: structure.tables,
      buttonCount: controls.length,
      linkCount: links.length,
      tableCount: structure.tables.length,
      fieldCount: structure.fieldCount,
      imageCount: structure.imageCount,
    });
    structure.failures.forEach((detail) => report.failures.push({ type: 'structure', route: actualRoute, role, detail }));
    structure.warnings.forEach((detail) => report.warnings.push({ type: 'table-structure', route: actualRoute, role, detail }));
    errors.forEach((detail) => report.failures.push({ type: 'page-error', route: actualRoute, role, detail }));
    controls.filter((control) => !control.name).forEach((control) => {
      report.failures.push({
        type: 'button-name', route: actualRoute, role,
        detail: 'Visible ' + control.tag + ' at index ' + control.index + ' has no accessible name.',
      });
    });
    links.forEach((link) => {
      if (!link.name) report.failures.push({ type: 'link-name', route: actualRoute, role, detail: 'Link ' + link.href + ' has no accessible name.' });
      if (!link.href || link.href.startsWith('javascript:')) {
        report.failures.push({ type: 'link-destination', route: actualRoute, role, detail: 'Link "' + link.name + '" has invalid href "' + link.rawHref + '".' });
      }
    });
    return { controls, links };
  } finally {
    await context.close().catch(() => {});
  }
}
async function getInitialControls(browser, route, role) {
  const errors = [], dialogs = [];
  const { context, page } = await newPage(browser, role, errors, dialogs);
  try {
    await page.goto(testUrl(route, role), { waitUntil: 'domcontentloaded' });
    await waitReady(page);
    return await listControls(page);
  } finally {
    await context.close().catch(() => {});
  }
}
async function clickButtonPath(browser, route, role, steps, report) {
  const record = {
    route, role,
    path: steps.map((step) => step.name),
    controlName: steps[steps.length - 1].name,
    controlIndex: steps[steps.length - 1].index,
    status: 'pending',
  };
  const errors = [], dialogs = [];
  const { context, page } = await newPage(browser, role, errors, dialogs);
  try {
    await page.goto(testUrl(route, role), { waitUntil: 'domcontentloaded' });
    await waitReady(page);
    let previousUrl = page.url();
    let previousText = await page.locator('body').innerText();
    let finalControls = [];
    let downloadObserved = false;
    for (const step of steps) {
      const items = page.locator(BUTTONS);
      if (step.index >= await items.count()) throw new Error('Control index ' + step.index + ' no longer exists.');
      const item = items.nth(step.index);
      const actualName = await accessibleName(item);
      if (actualName !== step.name) throw new Error('Expected "' + step.name + '", found "' + actualName + '".');
      if (!(await item.isVisible())) throw new Error('Control "' + step.name + '" is not visible.');
      if (await item.isDisabled().catch(() => false)) {
        record.status = 'disabled-state-covered';
        record.detail = 'Disabled state asserted; action was not activated.';
        return record;
      }
      const safety = skipReason(step.name);
      if (safety) {
        record.status = 'safety-skipped';
        record.detail = safety;
        return record;
      }
      const downloadPromise = page.waitForEvent('download', { timeout: 250 }).then(() => { downloadObserved = true; }).catch(() => {});
      await item.click({ timeout: TIMEOUT });
      await page.waitForTimeout(100);
      await downloadPromise;
      if (errors.length) throw new Error('Browser error: ' + errors.join(' | '));
      const text = await page.locator('body').innerText().catch(() => '');
      if (!text.trim()) throw new Error('Click left the page blank.');
      finalControls = await listControls(page);
      previousUrl = page.url();
      previousText = text;
    }
    const nowUrl = page.url();
    const modalCount = await page.locator('[role="dialog"], dialog, [aria-modal="true"]').count();
    record.status = 'clicked';
    record.resultUrl = nowUrl;
    record.downloadObserved = downloadObserved;
    record.nativeDialogsDismissed = dialogs;
    if (new URL(nowUrl).pathname !== new URL(testUrl(route, role)).pathname) {
      record.effect = 'route-change';
    } else if (modalCount > 0) {
      record.effect = 'dialog-present';
    } else if (downloadObserved) {
      record.effect = 'download';
    } else if (previousText !== '') {
      record.effect = 'click-completed';
      record.reviewRequired = true;
      record.detail = 'Click executed; verify the specific business outcome with a focused test.';
      report.warnings.push({ type: 'specific-outcome-required', route, role, control: record.path.join(' -> '), detail: record.detail });
    }
    record.revealedControls = [];
    const baseline = tally(await getInitialControls(browser, route, role));
    const seen = new Map();
    const samePath = new URL(nowUrl).pathname === new URL(testUrl(route, role)).pathname;
    if (samePath) for (const control of finalControls) {
      const key = signature(control);
      const occurrence = (seen.get(key) || 0) + 1;
      seen.set(key, occurrence);
      if (occurrence > (baseline.get(key) || 0) && control.name) record.revealedControls.push(control);
    }
  } catch (error) {
    record.status = 'failed';
    record.detail = error instanceof Error ? error.message : String(error);
    report.failures.push({ type: 'button-click', route, role, control: record.path.join(' -> '), detail: record.detail });
    if (TAKE_SCREENSHOTS) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      const filename = (role + '-' + record.path.join('-')).replace(/[^a-z0-9-]+/gi, '-').slice(0, 90);
      await page.screenshot({ path: path.join(OUT_DIR, filename + '-failure.png'), fullPage: true }).catch(() => {});
    }
  } finally {
    await context.close().catch(() => {});
  }
  return record;
}
async function auditFormFields(browser, route, role, report) {
  const errors = [], dialogs = [];
  const { context, page } = await newPage(browser, role, errors, dialogs);
  try {
    await page.goto(testUrl(route, role), { waitUntil: 'domcontentloaded' });
    await waitReady(page);
    const fields = page.locator(FIELD_SELECTOR);
    const inventory = [];
    for (let index = 0; index < await fields.count(); index++) {
      const el = fields.nth(index);
      if (!(await el.isVisible().catch(() => false))) continue;
      const meta = await el.evaluate((node) => ({
        tag: node.tagName.toLowerCase(),
        type: (node.getAttribute('type') || '').toLowerCase(),
        name: node.getAttribute('name') || '',
        id: node.id || '',
        disabled: Boolean(node.disabled) || node.getAttribute('aria-disabled') === 'true',
        readOnly: Boolean(node.readOnly),
        value: node.value || '',
        accept: node.getAttribute('accept') || '',
        options: node.tagName === 'SELECT'
          ? [...node.options].filter((option) => !option.disabled).map((option) => ({ value: option.value, text: option.textContent.trim() }))
          : [],
      }));
      inventory.push({ index, name: await accessibleName(el), ...meta });
    }
    for (const field of inventory) {
      const result = { route, role, name: field.name, index: field.index, type: field.type || field.tag, status: 'pending' };
      if (!field.name) {
        result.status = 'failed';
        result.detail = 'Visible form field has no accessible name.';
      } else if (field.disabled || field.readOnly) {
        result.status = 'state-covered';
        result.detail = field.disabled ? 'Disabled field baseline covered.' : 'Read-only field baseline covered.';
      } else if (field.type === 'file' || field.type === 'color') {
        result.status = 'metadata-covered';
        result.detail = 'Metadata inspected without opening a native picker or uploading a file.';
        result.accept = field.accept;
      } else {
        const errorsLocal = [];
        const isolated = await newPage(browser, role, errorsLocal, []);
        try {
          await isolated.page.goto(testUrl(route, role), { waitUntil: 'domcontentloaded' });
          await waitReady(isolated.page);
          const locator = isolated.page.locator(FIELD_SELECTOR).nth(field.index);
          if (!(await locator.isVisible())) throw new Error('Field is not visible in reset state.');
          if (field.tag === 'select') {
            const option = field.options.find((item) => item.value !== field.value && item.value !== '');
            if (!option) {
              result.status = 'state-covered';
              result.detail = 'No alternative non-empty option is available.';
            } else {
              await locator.selectOption(option.value);
              if (await locator.inputValue() !== option.value) throw new Error('Selected option did not stick.');
              result.status = 'interacted';
              result.selectedOption = option.text;
            }
          } else if (field.type === 'checkbox') {
            const before = await locator.isChecked();
            await locator.setChecked(!before);
            if (await locator.isChecked() === before) throw new Error('Checkbox did not toggle.');
            result.status = 'interacted';
          } else if (field.type === 'radio') {
            if (await locator.isChecked()) {
              result.status = 'state-covered';
              result.detail = 'Radio already selected in baseline state.';
            } else {
              await locator.check();
              if (!(await locator.isChecked())) throw new Error('Radio did not become selected.');
              result.status = 'interacted';
            }
          } else if (field.type === 'range' || field.tag === 'div' && field.name) {
            await locator.focus();
            await locator.press('ArrowRight');
            result.status = 'focus-covered';
          } else {
            let value = 'QA input probe';
            if (field.type === 'email') value = 'qa-interaction@example.test';
            else if (field.type === 'password') value = 'Qa-Test-Only-2026!';
            else if (field.type === 'number') value = '1';
            else if (field.type === 'date') value = '2026-10-15';
            else if (field.type === 'time') value = '10:15';
            else if (field.type === 'datetime-local') value = '2026-10-15T10:15';
            else if (field.type === 'tel') value = '2025550100';
            else if (field.type === 'url') value = 'https://example.test/';
            await locator.fill(value, { timeout: TIMEOUT });
            if (await locator.inputValue() !== value) throw new Error('Filled value did not stick.');
            await locator.fill('');
            result.status = 'interacted';
            result.detail = 'Field filled and cleared without submitting the form.';
          }
          if (errorsLocal.length) throw new Error('Browser error: ' + errorsLocal.join(' | '));
        } catch (error) {
          result.status = 'failed';
          result.detail = error instanceof Error ? error.message : String(error);
        } finally {
          await isolated.context.close().catch(() => {});
        }
      }
      if (result.status === 'failed') report.failures.push({ type: 'form-field', route, role, control: field.name, detail: result.detail });
      report.fields.push(result);
    }
  } catch (error) {
    report.failures.push({ type: 'field-audit', route, role, detail: error instanceof Error ? error.message : String(error) });
  } finally {
    await context.close().catch(() => {});
  }
}
async function auditTableRowActions(browser, route, role, report) {
  const errors = [], dialogs = [];
  const { context, page } = await newPage(browser, role, errors, dialogs);
  try {
    await page.goto(testUrl(route, role), { waitUntil: 'domcontentloaded' });
    await waitReady(page);
    const tables = await page.locator('table, [role="table"], [role="grid"]').count();
    const rowActions = await page.locator('table tbody tr, [role="table"] [role="row"], [role="grid"] [role="row"]').evaluateAll((rows) =>
      rows.map((row, rowIndex) => ({
        rowIndex,
        text: (row.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160),
        actions: [...row.querySelectorAll('button, [role="button"], a[href], input[type="button"], input[type="submit"]')]
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
      }))
    );
    report.tableActions.push({ route, role, tableCount: tables, rows: rowActions });
  } catch (error) {
    report.failures.push({ type: 'table-row-audit', route, role, detail: error instanceof Error ? error.message : String(error) });
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
    result.detail = 'Missing or invalid link target.';
    report.failures.push({ type: 'link-target', route, role, name: link.name, detail: result.detail });
    return result;
  }
  if (!link.name) {
    result.status = 'failed';
    result.detail = 'Link has no accessible name.';
    report.failures.push({ type: 'link-name', route, role, detail: link.href + ' has no accessible name.' });
    return result;
  }
  if (!isLocalInternalLink(link.href) || ['mailto:', 'tel:'].includes(url.protocol) || link.target === '_blank' || link.download !== null) {
    result.status = 'safety-skipped';
    result.detail = 'External, download, new-tab, email or telephone link was inventoried but not activated.';
    return result;
  }
  if (!CLICK_LINKS) {
    result.status = 'destination-validated';
    return result;
  }
  const errors = [], dialogs = [];
  const { context, page } = await newPage(browser, role, errors, dialogs);
  try {
    await page.goto(testUrl(route, role), { waitUntil: 'domcontentloaded' });
    await waitReady(page);
    const links = page.locator(LINKS);
    if (link.index >= await links.count()) throw new Error('Link index not found on a clean route load.');
    const el = links.nth(link.index);
    if (await el.evaluate((node) => node.href || '') !== link.href || await accessibleName(el) !== link.name) {
      throw new Error('Link identity changed between inventory and execution.');
    }
    await el.click({ timeout: TIMEOUT });
    await page.waitForTimeout(100);
    if (errors.length) throw new Error('Browser error: ' + errors.join(' | '));
    if (!(await page.locator('body').innerText()).trim()) throw new Error('Link click left a blank page.');
    result.status = 'clicked';
    result.resultUrl = page.url();
  } catch (error) {
    result.status = 'failed';
    result.detail = error instanceof Error ? error.message : String(error);
    report.failures.push({ type: 'link-click', route, role, name: link.name, detail: result.detail });
  } finally {
    await context.close().catch(() => {});
  }
  return result;
}
async function main() {
  const hostname = new URL(BASE_URL).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    throw new Error('Safety stop: this audit only runs against localhost. Do not point it at production or shared staging.');
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    repository: 'Mpratyush54/oddo-hackathon',
    baseUrl: BASE_URL,
    environment: 'LOCAL DEMO ONLY',
    startedAt: new Date().toISOString(),
    routes: [], buttons: [], links: [], fields: [], tableActions: [], failures: [], warnings: [], summary: {},
  };
  const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
  try {
    const cases = PUBLIC_ROUTES.map((route) => ({ path: route, roles: ['member'] })).concat(ROUTES_BY_ROLE);
    for (const routeCase of cases) {
      for (const role of routeCase.roles) {
        const inventory = await inspectRoute(browser, routeCase.path, role, report);
        await auditFormFields(browser, routeCase.path, role, report);
        await auditTableRowActions(browser, routeCase.path, role, report);
        const queue = inventory.controls.map((control) => ({
          steps: [{ index: control.index, name: control.name, tag: control.tag }],
          keyParts: [control.index + ':' + control.name],
        }));
        const attempted = new Set();
        for (let cursor = 0; cursor < queue.length; cursor++) {
          const item = queue[cursor];
          const key = role + '|' + routeCase.path + '|' + item.keyParts.join(' -> ');
          if (attempted.has(key)) continue;
          attempted.add(key);
          const outcome = await clickButtonPath(browser, routeCase.path, role, item.steps, report);
          report.buttons.push(outcome);
          for (const child of outcome.revealedControls || []) {
            const childParts = item.keyParts.concat(child.index + ':' + child.name);
            const childKey = role + '|' + routeCase.path + '|' + childParts.join(' -> ');
            if (attempted.has(childKey) || queue.some((entry) => entry.keyParts.join(' -> ') === childParts.join(' -> '))) continue;
            queue.push({
              steps: item.steps.concat({ index: child.index, name: child.name, tag: child.tag }),
              keyParts: childParts,
            });
          }
        }
        for (const link of inventory.links) report.links.push(await clickLink(browser, routeCase.path, role, link, report));
      }
    }
    for (const probe of FORBIDDEN_ROUTE_PROBES) {
      const errors = [], dialogs = [];
      const { context, page } = await newPage(browser, probe.role, errors, dialogs);
      try {
        await page.goto(testUrl(probe.path, probe.role), { waitUntil: 'domcontentloaded' });
        await waitReady(page);
        const current = new URL(page.url());
        const isBlocked = current.pathname.indexOf('/login') >= 0 ||
          await page.getByRole('heading', { name: /responsibility|not authorized|access denied|administrator/i }).count() > 0;
        if (!isBlocked) report.failures.push({
          type: 'role-route-guard',
          route: probe.path, role: probe.role,
          detail: 'Role "' + probe.role + '" was not clearly blocked from ' + probe.path + '. Final URL: ' + current.pathname,
        });
      } catch (error) {
        report.failures.push({ type: 'role-route-guard', route: probe.path, role: probe.role, detail: error instanceof Error ? error.message : String(error) });
      } finally {
        await context.close().catch(() => {});
      }
    }
  } finally {
    await browser.close();
  }
  const count = (items, status) => items.filter((item) => item.status === status).length;
  report.finishedAt = new Date().toISOString();
  report.summary = {
    routeRoleVisits: report.routes.length,
    visibleButtonsInventoried: report.routes.reduce((sum, route) => sum + route.buttonCount, 0),
    buttonScenarios: report.buttons.length,
    buttonsClicked: count(report.buttons, 'clicked'),
    disabledButtonsCovered: count(report.buttons, 'disabled-state-covered'),
    buttonsSafetySkipped: count(report.buttons, 'safety-skipped'),
    buttonFailures: count(report.buttons, 'failed'),
    fieldsInventoried: report.fields.length,
    fieldsInteracted: count(report.fields, 'interacted'),
    fieldStateCovered: count(report.fields, 'state-covered') + count(report.fields, 'metadata-covered') + count(report.fields, 'focus-covered'),
    fieldFailures: count(report.fields, 'failed'),
    tablesAudited: report.routes.reduce((sum, route) => sum + route.tableCount, 0),
    tableRoutesInspected: report.tableActions.length,
    tableRowsInspected: report.tableActions.reduce((sum, table) => sum + table.rows.length, 0),
    linksInventoried: report.links.length,
    linksClicked: count(report.links, 'clicked'),
    linksSafetySkipped: count(report.links, 'safety-skipped'),
    linkFailures: count(report.links, 'failed'),
    failures: report.failures.length,
    warnings: report.warnings.length,
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: REPORT_PATH, summary: report.summary }, null, 2));
  if (report.failures.length) {
    console.error('Interaction coverage found ' + report.failures.length + ' failure(s). Inspect ' + REPORT_PATH + '.');
    process.exitCode = 1;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
