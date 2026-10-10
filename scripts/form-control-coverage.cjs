/*
 * Input/select/checkbox/radio interaction coverage for Skyline.
 * Run only against npm run dev:demo (never production):
 *   npm install -D playwright
 *   node scripts/form-control-coverage.cjs
 *
 * Tests visible fields one at a time from fresh demo state. It does not submit
 * forms, upload real receipts, or call external providers.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE_URL = (process.env.TEST_URL || 'http://127.0.0.1:5174').replace(/\/+$/, '');
const OUT_DIR = process.env.INTERACTION_REPORT_DIR || '.artifacts';
const REPORT_PATH = path.join(OUT_DIR, 'form-control-coverage.json');
const TIMEOUT = Number(process.env.INTERACTION_TIMEOUT_MS || 2500);
const RESET_PARAM = '__qa_reset';
const FIELDS = 'input:visible:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select:visible, textarea:visible';

const ROUTES = [
  { path: '/signup', roles: ['member'] },
  { path: '/login', roles: ['member'] },
  { path: '/verify-email', roles: ['member'] },
  { path: '/events', roles: ['member'] },
  { path: '/shop', roles: ['member'] },
  { path: '/app/profile', roles: ['member', 'organizer', 'treasurer', 'admin', 'college'] },
  { path: '/app/finance', roles: ['treasurer', 'admin'] },
  { path: '/app/expenses', roles: ['member', 'organizer', 'treasurer', 'admin'] },
  { path: '/app/events/manage', roles: ['organizer', 'admin'] },
  { path: '/app/members', roles: ['admin'] },
  { path: '/app/tasks', roles: ['organizer', 'admin'] },
  { path: '/app/merchandise', roles: ['member', 'organizer', 'treasurer', 'admin'] },
  { path: '/app/announcements', roles: ['member', 'organizer', 'admin'] },
  { path: '/app/check-in', roles: ['organizer', 'admin'] },
  { path: '/app/checkout?event=EVT-001', roles: ['member'] },
  { path: '/app/college', roles: ['college'] },
];

function testUrl(route, role) {
  const url = new URL(route, BASE_URL);
  url.searchParams.set(RESET_PARAM, role + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));
  return url.toString();
}
async function openPage(browser, route, role, errors) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.addInitScript((activeRole) => {
    if (new URL(location.href).searchParams.has('__qa_reset')) {
      localStorage.clear();
      localStorage.setItem('skyline-session', JSON.stringify({ role: activeRole, signedIn: true }));
    }
  }, role);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(testUrl(route, role), { waitUntil: 'domcontentloaded' });
  await page.locator('body').waitFor({ state: 'visible' });
  await page.waitForTimeout(100);
  return { context, page };
}
async function fieldName(el) {
  return el.evaluate((node) => {
    const aria = node.getAttribute('aria-label')?.trim();
    if (aria) return aria;
    const ids = node.getAttribute('aria-labelledby');
    if (ids) {
      const label = ids.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ');
      if (label) return label;
    }
    const associated = node.labels ? [...node.labels].map((label) => label.innerText.trim()).filter(Boolean).join(' ') : '';
    if (associated) return associated;
    return node.getAttribute('placeholder') || node.name || node.id || node.type || node.tagName.toLowerCase();
  });
}
async function inventory(page) {
  const locator = page.locator(FIELDS);
  const result = [];
  for (let i = 0; i < await locator.count(); i++) {
    const el = locator.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const attrs = await el.evaluate((node) => ({
      tag: node.tagName.toLowerCase(),
      type: (node.getAttribute('type') || '').toLowerCase(),
      disabled: Boolean(node.disabled),
      readOnly: Boolean(node.readOnly),
      name: node.name || '',
      id: node.id || '',
      value: node.value || '',
      accept: node.getAttribute('accept') || '',
      optionCount: node.tagName === 'SELECT' ? node.options.length : 0,
      options: node.tagName === 'SELECT'
        ? [...node.options].filter((option) => !option.disabled).map((option) => ({ value: option.value, text: option.textContent.trim() }))
        : [],
    }));
    result.push({ index: i, label: await fieldName(el), ...attrs });
  }
  return result;
}
function valueFor(type) {
  switch (type) {
    case 'email': return 'qa-interaction@example.test';
    case 'url': return 'https://example.test/';
    case 'tel': return '2025550100';
    case 'password': return 'Qa-Test-Only-2026!';
    case 'number': return '1';
    case 'date': return '2026-10-15';
    case 'time': return '10:15';
    case 'datetime-local': return '2026-10-15T10:15';
    case 'month': return '2026-10';
    case 'week': return '2026-W42';
    case 'color': return null;
    case 'range': return null;
    default: return 'QA interaction probe';
  }
}
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = { baseUrl: BASE_URL, environment: 'LOCAL DEMO ONLY', startedAt: new Date().toISOString(), fields: [], failures: [], summary: {} };
  const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
  try {
    for (const routeCase of ROUTES) {
      for (const role of routeCase.roles) {
        const errors = [];
        const first = await openPage(browser, routeCase.path, role, errors);
        const fields = await inventory(first.page);
        await first.context.close();

        for (const field of fields) {
          const addRecord = (record) => report.fields.push({ route: routeCase.path, role, label: field.label, index: field.index, ...record });
          if (field.disabled || field.readOnly) {
            addRecord({ type: field.tag, status: 'state-covered', detail: field.disabled ? 'Disabled baseline state' : 'Read-only baseline state' });
            continue;
          }
          if (field.tag === 'input' && field.type === 'file') {
            addRecord({ type: 'file', status: 'metadata-covered', detail: 'Inspected accept/type metadata; no file is uploaded by this audit.', accept: field.accept });
            continue;
          }
          if (field.tag === 'input' && field.type === 'color') {
            addRecord({ type: 'color', status: 'metadata-covered', detail: 'Color field is visible and enabled; native picker is not automated by Chromium.' });
            continue;
          }

          const cases = [];
          if (field.tag === 'select') {
            const options = field.options.filter((option) => option.value !== field.value);
            if (!options.length) cases.push({ kind: 'select-no-alternative', option: null });
            else options.forEach((option) => cases.push({ kind: 'select-option', option }));
          } else if (field.tag === 'input' && field.type === 'checkbox') {
            cases.push({ kind: 'checkbox-toggle' });
          } else if (field.tag === 'input' && field.type === 'radio') {
            cases.push({ kind: 'radio-select' });
          } else if (field.tag === 'input' && field.type === 'range') {
            cases.push({ kind: 'range-keyboard' });
          } else {
            cases.push({ kind: 'fill-or-focus' });
          }

          for (const testCase of cases) {
            const localErrors = [];
            const opened = await openPage(browser, routeCase.path, role, localErrors);
            const record = {
              route: routeCase.path, role, label: field.label, index: field.index,
              type: field.type || field.tag, action: testCase.kind, status: 'pending',
            };
            try {
              const locator = opened.page.locator(FIELDS).nth(field.index);
              if (!(await locator.isVisible())) throw new Error('Field was not visible at the recorded index.');
              if (await locator.isDisabled()) {
                record.status = 'state-covered';
                record.detail = 'Field became disabled in clean state.';
              } else if (testCase.kind === 'select-no-alternative') {
                record.status = 'state-covered';
                record.detail = 'Select has no alternative enabled option.';
              } else if (testCase.kind === 'select-option') {
                await locator.selectOption(testCase.option.value, { timeout: TIMEOUT });
                const actual = await locator.inputValue();
                if (actual !== testCase.option.value) throw new Error('Select value did not change to the chosen option.');
                record.status = 'interacted';
                record.selectedOption = testCase.option.text;
              } else if (testCase.kind === 'checkbox-toggle') {
                const before = await locator.isChecked();
                await locator.click({ timeout: TIMEOUT });
                const after = await locator.isChecked();
                if (before === after) throw new Error('Checkbox state did not toggle.');
                record.status = 'interacted';
                record.value = after;
              } else if (testCase.kind === 'radio-select') {
                await locator.click({ timeout: TIMEOUT });
                if (!(await locator.isChecked())) throw new Error('Radio input was not selected after click.');
                record.status = 'interacted';
              } else if (testCase.kind === 'range-keyboard') {
                const before = await locator.inputValue();
                await locator.focus();
                await locator.press('ArrowRight');
                const after = await locator.inputValue();
                if (before === after) throw new Error('Range did not respond to ArrowRight.');
                record.status = 'interacted';
                record.before = before;
                record.after = after;
              } else {
                const value = valueFor(field.type);
                if (value === null) {
                  await locator.focus();
                  record.status = 'focus-covered';
                } else {
                  await locator.fill(value, { timeout: TIMEOUT });
                  const actual = await locator.inputValue();
                  if (actual !== value) throw new Error('Field value did not match the probe value.');
                  await locator.fill('');
                  record.status = 'interacted';
                  record.detail = 'Filled and cleared without submitting the form.';
                }
              }
              await opened.page.waitForTimeout(80);
              if (localErrors.length) throw new Error('Uncaught browser error: ' + localErrors.join(' | '));
            } catch (error) {
              record.status = 'failed';
              record.detail = error instanceof Error ? error.message : String(error);
              report.failures.push({ route: routeCase.path, role, field: field.label, action: testCase.kind, detail: record.detail });
            } finally {
              report.fields.push(record);
              await opened.context.close().catch(() => {});
            }
          }
        }
      }
    }
  } finally { await browser.close(); }
  const count = (status) => report.fields.filter((item) => item.status === status).length;
  report.finishedAt = new Date().toISOString();
  report.summary = {
    fieldScenarios: report.fields.length,
    interacted: count('interacted'),
    focusCovered: count('focus-covered'),
    stateCovered: count('state-covered'),
    metadataCovered: count('metadata-covered'),
    failures: report.failures.length,
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: REPORT_PATH, summary: report.summary }, null, 2));
  if (report.failures.length) {
    console.error('Form-control coverage found ' + report.failures.length + ' failure(s). Inspect ' + REPORT_PATH + '.');
    process.exitCode = 1;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
