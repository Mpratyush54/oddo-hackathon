const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PLAYWRIGHT_MODULE = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = require(PLAYWRIGHT_MODULE);
const BASE_URL = (process.env.TEST_URL || 'http://127.0.0.1:5174').replace(/\/+$/, '');
const OUTPUT_PATH = process.env.UI_COVERAGE_OUTPUT || path.join('artifacts', 'ui-coverage.json');

const PUBLIC_ROUTES = [
  '/',
  '/events',
  '/clubs',
  '/shop',
  '/shop?club=codecraft&product=PROD-001',
  '/login',
  '/signup',
  '/verify-email',
  '/clubs/skyline',
  '/clubs/codecraft',
  '/clubs/canvas',
  '/e/canvas/EVT-WELCOME-2026',
];

const WORKSPACE_ROUTES = {
  admin: [
    '/app',
    '/app/members',
    '/app/events/manage',
    '/app/events',
    '/app/events/EVT-001',
    '/app/announcements',
    '/app/merchandise',
    '/app/contributions',
    '/app/tasks',
    '/app/my-tasks',
    '/app/finance',
    '/app/expenses',
    '/app/audit',
    '/app/calendar',
    '/app/check-in',
    '/app/checkout?event=EVT-WELCOME-2026',
    '/app/profile',
    '/app/my-card',
    '/app/my-tickets',
    '/app/my-orders',
  ],
  organizer: [
    '/app',
    '/app/events/manage',
    '/app/events',
    '/app/events/EVT-001',
    '/app/announcements',
    '/app/merchandise',
    '/app/tasks',
    '/app/my-tasks',
    '/app/calendar',
    '/app/check-in',
    '/app/checkout?event=EVT-WELCOME-2026',
    '/app/profile',
    '/app/my-tickets',
    '/app/my-orders',
  ],
  treasurer: [
    '/app',
    '/app/finance',
    '/app/expenses',
    '/app/audit',
    '/app/profile',
    '/app/my-orders',
    '/app/my-tasks',
    '/app/calendar',
  ],
  member: [
    '/app',
    '/app/events',
    '/app/events/EVT-001',
    '/app/calendar',
    '/app/my-tasks',
    '/app/profile',
    '/app/my-card',
    '/app/my-tickets',
    '/app/my-orders',
    '/app/checkout?event=EVT-WELCOME-2026',
  ],
  college: [
    '/app',
    '/app/college',
    '/app/college-clubs',
    '/app/club-summary',
    '/app/profile',
  ],
};

// These actions can contact a provider or commit business data. Inventory them and
// validate their labels, but exercise their complete workflow in a dedicated test
// rather than blindly firing them during a control sweep.
const SIDE_EFFECT_ACTION =
  /\b(send whatsapp test|send renewal reminders|send reminder|send notification|publish announcement|publish|delete|remove|approve|reject|complete demo order|place order|buy now|pay now|book ticket|cancel ticket|create account|save changes|save task|save member|save product|save expense|sign up|log in|sign in|join club|grant role|revoke|upload receipt|mark as paid|check in|generate draft|send|payment)\b/i;

const UI_INTERACTION =
  /\b(filter|filters|sort|toggle|open|close|collapse|expand|view|preview|edit|details|gallery|reviews|next|previous|month|agenda|directory|table|board|list view|change view|search your workspace|switch organization|notifications|copy|share this event|clear selection|select all|select visible|rotate|rotation|show|hide|past events|upcoming events|student community|category|color|fit|page)\b/i;

function fail(message) {
  throw new Error(message);
}

function accessibleName(element) {
  const aria = element.getAttribute('aria-label');
  if (aria && aria.trim()) return aria.trim();

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelText = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .map((node) => node.innerText || node.textContent || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (labelText) return labelText;
  }

  if (element.labels && element.labels.length) {
    const labelText = Array.from(element.labels)
      .map((node) => node.innerText || node.textContent || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (labelText) return labelText;
  }

  const wrappingLabel = element.closest('label');
  if (wrappingLabel) {
    const labelText = (wrappingLabel.innerText || wrappingLabel.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (labelText) return labelText;
  }

  if (element.tagName === 'INPUT' && /^(button|submit|reset|image)$/i.test(element.type)) {
    if (element.value) return element.value.trim();
    if (element.alt) return element.alt.trim();
  }

  const title = element.getAttribute('title');
  const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
  if (text) return text;
  if (title && title.trim()) return title.trim();

  const alt = element.getAttribute('alt');
  if (alt && alt.trim()) return alt.trim();

  const placeholder = element.getAttribute('placeholder');
  if (placeholder && placeholder.trim()) return placeholder.trim();

  const svgTitle = element.querySelector('svg title');
  return svgTitle ? (svgTitle.textContent || '').trim() : '';
}

async function collectUiSnapshot(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      if (!element || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
      const style = window.getComputedStyle(element);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity || 1) !== 0 &&
        element.getClientRects().length > 0
      );
    };

    const nameOf = (element) => {
      const aria = element.getAttribute('aria-label');
      if (aria && aria.trim()) return aria.trim();
      const labelledBy = element.getAttribute('aria-labelledby');
      if (labelledBy) {
        const labels = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id))
          .filter(Boolean)
          .map((node) => node.innerText || node.textContent || '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (labels) return labels;
      }
      if (element.labels && element.labels.length) {
        const labels = Array.from(element.labels)
          .map((node) => node.innerText || node.textContent || '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (labels) return labels;
      }
      const wrappingLabel = element.closest('label');
      if (wrappingLabel) {
        const labels = (wrappingLabel.innerText || wrappingLabel.textContent || '')
          .replace(/\s+/g, ' ')
          .trim();
        if (labels) return labels;
      }
      if (element.tagName === 'INPUT' && /^(button|submit|reset|image)$/i.test(element.type)) {
        if (element.value) return element.value.trim();
        if (element.alt) return element.alt.trim();
      }
      const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) return text;
      const title = element.getAttribute('title');
      if (title && title.trim()) return title.trim();
      const alt = element.getAttribute('alt');
      if (alt && alt.trim()) return alt.trim();
      const placeholder = element.getAttribute('placeholder');
      if (placeholder && placeholder.trim()) return placeholder.trim();
      const svgTitle = element.querySelector('svg title');
      return svgTitle ? (svgTitle.textContent || '').trim() : '';
    };

    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'))
      .filter(visible)
      .map((element, index) => ({
        index,
        name: nameOf(element),
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute('role') || (element.tagName === 'BUTTON' ? 'button' : ''),
        type: element.getAttribute('type') || '',
        disabled: Boolean(element.disabled || element.getAttribute('aria-disabled') === 'true'),
        expanded: element.getAttribute('aria-expanded'),
        hasPopup: element.getAttribute('aria-haspopup'),
        className: typeof element.className === 'string' ? element.className : '',
        inForm: Boolean(element.closest('form')),
        href: element.getAttribute('href'),
        testId: element.getAttribute('data-testid') || '',
      }));

    const links = Array.from(document.querySelectorAll('a[href]'))
      .filter(visible)
      .map((element) => ({
        name: nameOf(element),
        href: element.getAttribute('href') || '',
        target: element.getAttribute('target') || '',
        rel: element.getAttribute('rel') || '',
      }));

    const fields = Array.from(
      document.querySelectorAll('input:not([type="hidden"]), select, textarea, [role="combobox"], [role="checkbox"], [role="switch"]'),
    )
      .filter(visible)
      .map((element) => ({
        name: nameOf(element),
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute('type') || '',
        required: Boolean(element.required || element.getAttribute('aria-required') === 'true'),
        disabled: Boolean(element.disabled || element.getAttribute('aria-disabled') === 'true'),
        placeholder: element.getAttribute('placeholder') || '',
        testId: element.getAttribute('data-testid') || '',
      }));

    const tables = Array.from(document.querySelectorAll('table'))
      .filter(visible)
      .map((table, tableIndex) => {
        const rows = Array.from(table.querySelectorAll('tr'));
        const headerRow = rows.find((row) => row.querySelector('th'));
        const headers = headerRow
          ? Array.from(headerRow.querySelectorAll('th, td')).map((cell) =>
              (cell.innerText || cell.textContent || '').replace(/\s+/g, ' ').trim(),
            )
          : [];
        const columnCount = headerRow
          ? Array.from(headerRow.querySelectorAll('th, td')).reduce(
              (count, cell) => count + Math.max(1, Number(cell.colSpan || 1)),
              0,
            )
          : 0;
        const bodyRows = rows
          .filter((row) => !row.querySelector('th') && row.querySelector('td'))
          .map((row, rowIndex) => {
            const cells = Array.from(row.querySelectorAll('td'));
            return {
              rowIndex,
              cellCount: cells.reduce(
                (count, cell) => count + Math.max(1, Number(cell.colSpan || 1)),
                0,
              ),
              hasColSpan: cells.some((cell) => Number(cell.colSpan || 1) > 1),
              text: (row.innerText || row.textContent || '').replace(/\s+/g, ' ').trim(),
            };
          });
        return {
          index: tableIndex,
          name: table.getAttribute('aria-label') || table.caption?.innerText?.trim() || 'Table ' + (tableIndex + 1),
          headers,
          columnCount,
          rowCount: bodyRows.length,
          rows: bodyRows,
        };
      });

    const forms = Array.from(document.querySelectorAll('form'))
      .filter(visible)
      .map((form, index) => ({
        index,
        name: form.getAttribute('aria-label') || form.getAttribute('name') || form.querySelector('legend')?.innerText?.trim() || 'Form ' + (index + 1),
        controlCount: Array.from(form.querySelectorAll('input:not([type="hidden"]), select, textarea')).filter(visible).length,
        submitCount: Array.from(form.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type])')).filter(visible).length,
      }));

    const tabs = Array.from(document.querySelectorAll('[role="tab"]'))
      .filter(visible)
      .map((element) => ({ name: nameOf(element), selected: element.getAttribute('aria-selected') }));

    return {
      title: document.title,
      pathname: window.location.pathname + window.location.search,
      bodyTextLength: (document.body.innerText || '').trim().length,
      buttons,
      links,
      fields,
      tables,
      forms,
      tabs,
    };
  });
}

function classifyButton(button) {
  if (button.disabled) return { classification: 'disabled-state', click: false, reason: 'Disabled control' };
  if (button.type === 'submit' || SIDE_EFFECT_ACTION.test(button.name)) {
    return {
      classification: 'dedicated-workflow-required',
      click: false,
      reason: 'Submit, destructive, business-data, or provider action is exercised only in an isolated workflow test',
    };
  }

  const classLooksInteractive = /\b(tab|toggle|sort|filter|nav|menu|calendar|pagination|view|gallery|popover|member-cell|icon-button|table-sort)\b/i.test(button.className);
  if (
    button.role === 'tab' ||
    button.expanded !== null ||
    button.hasPopup !== null ||
    classLooksInteractive ||
    UI_INTERACTION.test(button.name)
  ) {
    return {
      classification: 'ui-interaction-clicked',
      click: true,
      reason: 'Safe view, navigation, filter, sort, modal, tab, or disclosure interaction',
    };
  }

  return {
    classification: 'visible-action-contract',
    click: false,
    reason: 'Inventoried and checked for an accessible name; add a dedicated behavior assertion before treating it as fully behavior-covered',
  };
}

async function visit(page, route) {
  const response = await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.locator('body').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(100);
  if (response && response.status() >= 500) {
    fail('HTTP ' + response.status() + ' while opening ' + route);
  }
  return response ? response.status() : null;
}

async function buildContext(browser, role) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    permissions: ['clipboard-read', 'clipboard-write'],
  });

  await context.addInitScript(({ currentRole }) => {
    window.localStorage.setItem(
      'skyline-session',
      JSON.stringify({ role: currentRole, signedIn: true }),
    );
  }, { currentRole: role });

  await context.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    const baseOrigin = new URL(BASE_URL).origin;
    if (requestUrl.origin !== baseOrigin) {
      await route.abort();
      return;
    }
    if (/\/api\/(notifications\/send|webhooks\/whatsapp|ai\/draft|.*\/receipts\/upload)(?:\/|$)/i.test(requestUrl.pathname)) {
      await route.abort();
      return;
    }
    await route.continue();
  });

  return context;
}

async function auditRoute(browser, testCase, report) {
  const context = await buildContext(browser, testCase.role);
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const entry = {
    role: testCase.role,
    route: testCase.route,
    status: null,
    counts: { buttons: 0, links: 0, fields: 0, tables: 0, forms: 0, tabs: 0 },
    buttons: [],
    tables: [],
    forms: [],
    issues: [],
  };

  try {
    entry.status = await visit(page, testCase.route);
    let snapshot = await collectUiSnapshot(page);

    if (snapshot.bodyTextLength === 0) {
      entry.issues.push('Page rendered an empty body');
    }

    snapshot.buttons.forEach((button) => {
      const classification = classifyButton(button);
      entry.buttons.push({
        index: button.index,
        name: button.name,
        type: button.type,
        disabled: button.disabled,
        testId: button.testId,
        classification: classification.classification,
        exercised: false,
        reason: classification.reason,
      });
      if (!button.name) entry.issues.push('Visible button #' + button.index + ' has no accessible name');
    });

    snapshot.links.forEach((link, index) => {
      if (!link.name) entry.issues.push('Visible link #' + index + ' has no accessible name');
      if (!link.href) entry.issues.push('Visible link #' + index + ' has no href');
      if (link.target === '_blank' && !/\bnoopener\b/i.test(link.rel)) {
        entry.issues.push('New-tab link "' + link.name + '" does not declare rel="noopener"');
      }
    });

    snapshot.fields.forEach((field, index) => {
      if (!field.name) entry.issues.push('Visible ' + field.tag + ' #' + index + ' has no accessible name');
    });

    snapshot.tables.forEach((table) => {
      entry.tables.push({
        name: table.name,
        headers: table.headers,
        rowCount: table.rowCount,
        columnCount: table.columnCount,
      });
      if (table.columnCount === 0 || table.headers.length === 0) {
        entry.issues.push(table.name + ' has no discoverable header row');
      }
      table.rows.forEach((row) => {
        if (!row.hasColSpan && table.columnCount > 0 && row.cellCount !== table.columnCount) {
          entry.issues.push(
            table.name + ' row ' + (row.rowIndex + 1) + ' has ' + row.cellCount +
            ' cells but the header defines ' + table.columnCount + ' columns',
          );
        }
      });
    });

    snapshot.forms.forEach((form) => {
      entry.forms.push(form);
      if (form.controlCount > 0 && form.submitCount === 0) {
        entry.issues.push(form.name + ' has controls but no visible submit control');
      }
    });

    entry.counts = {
      buttons: snapshot.buttons.length,
      links: snapshot.links.length,
      fields: snapshot.fields.length,
      tables: snapshot.tables.length,
      forms: snapshot.forms.length,
      tabs: snapshot.tabs.length,
    };

    // Exercise the non-destructive UI controls individually, resetting the route
    // before each click so one disclosure/filter cannot hide the next control.
    const safeIndexes = snapshot.buttons
      .map((button, index) => ({ button, index, classification: classifyButton(button) }))
      .filter((item) => item.classification.click)
      .map((item) => item.index);

    for (const index of safeIndexes) {
      await visit(page, testCase.route);
      const liveButtons = page.locator('button:visible, [role="button"]:visible');
      const count = await liveButtons.count();
      if (index >= count) {
        entry.issues.push('Button index ' + index + ' disappeared after route reset');
        continue;
      }

      const button = liveButtons.nth(index);
      const liveName = await button.evaluate((element) => {
        const aria = element.getAttribute('aria-label');
        if (aria && aria.trim()) return aria.trim();
        const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
        return text || element.getAttribute('title') || '';
      });
      const expectedName = snapshot.buttons[index].name;
      if (liveName !== expectedName) {
        entry.issues.push(
          'Control order changed on reset at button #' + index +
          ' (expected "' + expectedName + '", received "' + liveName + '")',
        );
        continue;
      }

      const errorsBeforeClick = pageErrors.length;
      await button.click({ timeout: 3000 });
      await page.waitForTimeout(80);
      entry.buttons[index].exercised = true;
      if (pageErrors.length > errorsBeforeClick) {
        entry.issues.push(
          'Clicking "' + expectedName + '" raised: ' + pageErrors.slice(errorsBeforeClick).join(' | '),
        );
      }
    }

    if (pageErrors.length > 0) {
      entry.issues.push('Uncaught page error(s): ' + pageErrors.join(' | '));
    }

    const issueList = Array.from(new Set(entry.issues));
    entry.issues = issueList;
    report.routes.push(entry);
    report.summary.routesVisited += 1;
    report.summary.buttonInstances += entry.counts.buttons;
    report.summary.links += entry.counts.links;
    report.summary.fields += entry.counts.fields;
    report.summary.tables += entry.counts.tables;
    report.summary.forms += entry.counts.forms;
    report.summary.tabs += entry.counts.tabs;
    report.summary.buttonsClicked += entry.buttons.filter((button) => button.exercised).length;
    report.summary.buttonsRequiringDedicatedWorkflow += entry.buttons.filter(
      (button) => button.classification === 'dedicated-workflow-required',
    ).length;
    report.summary.buttonsNeedingBehaviorAssertion += entry.buttons.filter(
      (button) => button.classification === 'visible-action-contract',
    ).length;

    if (entry.issues.length > 0) {
      report.summary.failedRoutes += 1;
      console.error('FAIL ' + testCase.role + ' ' + testCase.route + ': ' + entry.issues.join('; '));
    } else {
      console.log(
        'PASS ' + testCase.role + ' ' + testCase.route +
        ' — ' + entry.counts.buttons + ' buttons, ' + entry.counts.tables +
        ' tables, ' + entry.counts.forms + ' forms; ' +
        entry.buttons.filter((button) => button.exercised).length + ' safe clicks',
      );
    }
  } catch (error) {
    entry.issues.push(error && error.message ? error.message : String(error));
    report.routes.push(entry);
    report.summary.failedRoutes += 1;
    console.error('FAIL ' + testCase.role + ' ' + testCase.route + ': ' + entry.issues.join('; '));
  } finally {
    await context.close();
  }
}

async function main() {
  const host = new URL(BASE_URL).hostname;
  const allowedHosts = ['127.0.0.1', 'localhost', '::1'];
  if (!allowedHosts.includes(host) && process.env.ALLOW_REMOTE_TEST_TARGET !== '1') {
    fail(
      'UI coverage refuses to click controls on a remote host. Use a local demo server, ' +
      'or set ALLOW_REMOTE_TEST_TARGET=1 only after reviewing the risks.',
    );
  }

  const testCases = PUBLIC_ROUTES.map((route) => ({ role: 'member', route, group: 'public' }));
  for (const [role, routes] of Object.entries(WORKSPACE_ROUTES)) {
    for (const route of routes) testCases.push({ role, route, group: 'workspace' });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    mode: 'local/demo UI inventory plus safe interaction probes',
    summary: {
      routesPlanned: testCases.length,
      routesVisited: 0,
      failedRoutes: 0,
      buttonInstances: 0,
      buttonsClicked: 0,
      buttonsRequiringDedicatedWorkflow: 0,
      buttonsNeedingBehaviorAssertion: 0,
      links: 0,
      fields: 0,
      tables: 0,
      forms: 0,
      tabs: 0,
    },
    routes: [],
  };

  const browser = await chromium.launch({ headless: true });
  try {
    for (const testCase of testCases) {
      await auditRoute(browser, testCase, report);
    }
  } finally {
    await browser.close();
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log('\nUI COVERAGE SUMMARY');
  console.log(JSON.stringify(report.summary, null, 2));
  console.log('Detailed control inventory: ' + OUTPUT_PATH);

  if (report.summary.failedRoutes > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
