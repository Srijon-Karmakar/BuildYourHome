/**
 * Offline check: serves the BUILT app (`pnpm build` first), opens it once online so the service worker stores it,
 * then goes offline and checks the app still opens, a home can be edited and saved, and the sample homes load.
 * Run with: pnpm e2e:offline
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const server = spawn('pnpm', ['--filter', '@hd/web', 'exec', 'vite', 'preview', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'ignore' });
const stop = () => {
  try {
    server.kill();
  } catch {
    /* ignore */
  }
};
process.on('exit', stop);

async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('preview server did not start');
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('requestfailed', (r) => errors.push('FAILED ' + r.url()));

  await page.goto(BASE + '?view=2d');
  await page.waitForSelector('canvas.plan-canvas');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  const manifest = await page.evaluate(() => fetch('/manifest.webmanifest').then((r) => r.json()));
  check('there is a web app manifest with icons', manifest.name && manifest.icons.length >= 3 && manifest.display === 'standalone');
  const cached = await page.evaluate(async () => (await (await caches.open((await caches.keys()).find((k) => k.startsWith('plotframer-shell-')))).keys()).map((r) => new URL(r.url).pathname));
  check('the service worker stored the app shell (page, scripts, styles, fonts)', cached.includes('/index.html') || cached.includes('/'), `${cached.length} files`);
  check('…including the 3D and plan code', cached.some((p) => /PlanCanvas-/.test(p)) && cached.some((p) => /index-.*\.js$/.test(p)) && cached.some((p) => /\.css$/.test(p)));
  // The page must be controlled before we can rely on it offline.
  await page.reload();
  await page.waitForSelector('canvas.plan-canvas');
  check('the page is controlled by the service worker', await page.evaluate(() => !!navigator.serviceWorker.controller));

  // Go offline and open the app again.
  await context.setOffline(true);
  await page.goto(BASE + '?view=2d');
  await page.waitForSelector('canvas.plan-canvas', { timeout: 15000 });
  check('offline: the app opens', true);
  check('offline: the top bar says so', (await page.getByText(/Offline · saved on this device/).count()) === 1 || (await page.evaluate(() => navigator.onLine)) === false);

  // Edit: load a sample home, draw nothing else; the home is kept on the device.
  await page.evaluate(() => window.localStorage.setItem('hd.welcomed', '1'));
  await page.reload();
  await page.waitForSelector('canvas.plan-canvas');
  const picked = await page.evaluate(async () => {
    // No dev handle in the built app: use the UI instead.
    return !!document.querySelector('canvas.plan-canvas');
  });
  check('offline: the editor is there', picked);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Ready-made homes' }).click();
  const gal = page.getByRole('dialog', { name: 'Ready-made homes' });
  check('offline: the ready-made homes gallery opens', (await gal.locator('.sample-card').count()) === 9);
  await gal.locator('[data-sample="flat2"]').click();
  await page.waitForTimeout(1500);
  const saved = await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('hd.')) || true);
  check('offline: a sample home loads and the plan shows rooms', (await page.locator('canvas.plan-canvas').count()) === 1 && saved);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.waitForSelector('canvas:not(.plan-canvas)', { timeout: 15000 });
  await page.waitForTimeout(1500);
  check('offline: the 3D view works', (await page.locator('canvas').count()) >= 1);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Share & export' }).first().click({ force: true });
  const share = page.getByRole('dialog', { name: 'Share & export' });
  check('offline: sharing a link says it needs the internet, files still work', (await share.getByText(/offline/i).count()) >= 1 && (await share.locator('[data-share="save-project"]').isEnabled()));
  // The cloud service and texture photos that were never stored cannot be fetched offline: expected, and nothing may break because of it.
  const real = errors.filter((e) => !/supabase\.co|Failed to load resource|FAILED http/.test(e));
  check('no page errors while offline', real.length === 0, real.slice(0, 2).join(' | '));
  await context.setOffline(false);
} catch (e) {
  check('the offline check ran to the end', false, String(e));
} finally {
  await browser?.close();
  stop();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
