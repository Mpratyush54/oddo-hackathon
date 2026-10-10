const {
  chromium,
} = require('C:/Users/Pratyush Mishra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.goto('http://127.0.0.1:5174/');
  await p.screenshot({ path: 'artifacts/landing-v2.png', fullPage: true });
  console.log(await p.locator('h1').allTextContents());
  console.log(await p.request.get('http://127.0.0.1:5174/api/health').then((r) => r.json()));
  await b.close();
})();
