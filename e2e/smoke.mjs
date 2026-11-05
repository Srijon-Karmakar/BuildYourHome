// Browser smoke test: drives the real app (Playwright + Edge/Chrome, software WebGL) through the key flows.
//   pnpm dev            (in one terminal)
//   pnpm e2e            (in another)   — env: E2E_URL (default http://localhost:5173/), E2E_CHANNEL (msedge|chrome)
// Screenshots land in e2e/out/ (gitignored).
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const SP = new URL('./out', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(SP, { recursive: true });
const BASE = process.env.E2E_URL ?? 'http://localhost:5173/';
const ARGS = ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];

const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? 'msedge', headless: true, args: ARGS });
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
};

try {
  // ---------------------------------------------------------------- 1. draw a room with the mouse
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(BASE + '?view=2d');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForTimeout(500);

    const box = await page.locator('canvas.plan-canvas').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    // At 60 px/m, grid step 0.5 m = 30 px. Draw a 4 m x 3 m room around the origin.
    const pts = [[-120, -90], [120, -90], [120, 90], [-120, 90], [-120, -90]];
    for (const [dx, dy] of pts) {
      await page.mouse.move(cx + dx, cy + dy);
      await page.mouse.click(cx + dx, cy + dy);
      await page.waitForTimeout(60);
    }
    const counts = await page.evaluate(() => {
      const s = window.__hd.editor.getState().scene;
      return { walls: Object.keys(s.walls).length, nodes: Object.keys(s.nodes).length, rooms: Object.values(s.rooms).map((r) => r.name) };
    });
    check('draw 4 walls with the mouse closes a loop', counts.walls === 4 && counts.nodes === 4, JSON.stringify(counts));
    check('a room is created automatically', counts.rooms.length === 1, counts.rooms.join(','));
    await page.screenshot({ path: `${SP}/e2e-room.png` });

    // undo / redo via keyboard
    await page.keyboard.press('Control+z');
    const afterUndo = await page.evaluate(() => Object.keys(window.__hd.editor.getState().scene.walls).length);
    check('Ctrl+Z removes the last wall', afterUndo === 3, `walls=${afterUndo}`);
    await page.keyboard.press('Control+y');
    const afterRedo = await page.evaluate(() => Object.keys(window.__hd.editor.getState().scene.walls).length);
    check('Ctrl+Y restores it', afterRedo === 4, `walls=${afterRedo}`);

    // divider from wall body to wall body splits the room
    await page.mouse.move(cx, cy - 90);
    await page.mouse.click(cx, cy - 90);
    await page.mouse.move(cx, cy + 90);
    await page.mouse.click(cx, cy + 90);
    const split = await page.evaluate(() => {
      const s = window.__hd.editor.getState().scene;
      return { walls: Object.keys(s.walls).length, rooms: Object.keys(s.rooms).length };
    });
    check('divider across the room splits it into two rooms', split.rooms === 2, JSON.stringify(split));

    // snap popover opens
    await page.getByRole('button', { name: 'Snap' }).click();
    check('Snap popover opens', await page.getByText('Join onto walls').isVisible());
    await page.keyboard.press('Escape');
    check('no console errors while drawing', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2. walkthrough
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low')); // software GL: keep frames cheap
    await page.goto(BASE + '?demo=1&view=3d');
    await page.waitForSelector('canvas');
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Walk', exact: true }).click();
    await page.waitForTimeout(800);
    const p0 = await page.evaluate(() => window.__hd.walkPose.getState());
    check('walk starts inside the largest room', p0.active && p0.x > 0.2 && p0.x < 5.8 && p0.z > 0.2 && p0.z < 5.8, JSON.stringify(p0));

    await page.keyboard.down('w');
    await page.waitForTimeout(1500);
    await page.keyboard.up('w');
    const p1 = await page.evaluate(() => window.__hd.walkPose.getState());
    const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
    check('holding W moves forward', moved > 0.3, `moved ${moved.toFixed(2)} m`);

    // run into the north wall (z ~ 0) for a while: must stay inside the room
    await page.keyboard.down('Shift');
    await page.keyboard.down('w');
    await page.waitForFunction(() => window.__hd.walkPose.getState().z < 0.6, null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500); // keep pushing into the wall
    await page.keyboard.up('w');
    await page.keyboard.up('Shift');
    const p2 = await page.evaluate(() => window.__hd.walkPose.getState());
    // north wall centre line is z = 0 (half thickness 0.115) + player radius 0.25 => z >= 0.365
    check('walls stop the walker (cannot leave the room)', p2.z > 0.3 && p2.z < 0.6, `z=${p2.z.toFixed(2)}`);
    await page.screenshot({ path: `${SP}/e2e-walk.png` });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => window.__hd.useUi.getState().walk);
    check('Esc exits walk mode', after === false);
    check('no page errors while walking', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2b. doors and windows
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));

    // Place a door with the Door tool on an empty plan: draw a wall, pick Door, click the wall.
    await page.goto(BASE + '?view=2d');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForTimeout(400);
    const box = await page.locator('canvas.plan-canvas').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.click(cx - 180, cy); // start (−3 m, 0)
    await page.mouse.click(cx + 180, cy); // end   ( 3 m, 0)
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Door' }).click();
    await page.mouse.move(cx + 30, cy - 12);
    await page.mouse.click(cx + 30, cy - 12);
    let ops = await page.evaluate(() => Object.values(window.__hd.editor.getState().scene.openings));
    check('Door tool places a door on the wall', ops.length === 1 && ops[0].type === 'door', JSON.stringify(ops.map((o) => [o.type, +o.offset.toFixed(2)])));
    check('door opens toward the pointer side', ops[0]?.flip.swing === true || ops[0]?.flip.swing === false);

    // A second click on the same spot lands in the nearest free place, never overlapping.
    await page.mouse.click(cx + 30, cy - 12);
    ops = await page.evaluate(() => Object.values(window.__hd.editor.getState().scene.openings));
    const sorted = ops.map((o) => o.offset).sort((a, b) => a - b);
    check('a second door never overlaps the first', ops.length === 2 && sorted[1] - sorted[0] >= 0.9 + 0.05 - 1e-6, JSON.stringify(sorted));

    // Select tool: tap selects it, contextual pills appear, Swing flips, Delete removes.
    await page.getByRole('button', { name: 'Select' }).click();
    const first = ops.sort((a, b) => a.offset - b.offset)[0];
    const sx = cx + (first.offset - 3) * 60;
    await page.mouse.click(sx, cy);
    check('tapping a door selects it', (await page.evaluate(() => window.__hd.editor.getState().selection)).length === 1);
    check('Swing / Wider pills appear', (await page.getByRole('button', { name: 'Swing' }).isVisible()) && (await page.getByRole('button', { name: 'Wider' }).isVisible()));
    const before = await page.evaluate((id) => window.__hd.editor.getState().scene.openings[id].flip.swing, first.id);
    await page.getByRole('button', { name: 'Swing' }).click();
    const after = await page.evaluate((id) => window.__hd.editor.getState().scene.openings[id].flip.swing, first.id);
    check('Swing flips the door', before !== after);
    await page.keyboard.press('Delete');
    check('Delete removes the selected door', (await page.evaluate(() => Object.keys(window.__hd.editor.getState().scene.openings).length)) === 1);
    await page.close();

    // Walk through a doorway of the sample home (living -> bedroom door on the divider at z = 1.75) ...
    const walk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    walk.on('pageerror', (e) => errors.push(String(e)));
    await walk.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await walk.goto(BASE + '?demo=1&view=3d');
    await walk.waitForSelector('canvas');
    await walk.waitForTimeout(1200);
    const startWalk = async (x, z) => {
      await walk.evaluate(([x, z]) => {
        window.__hd.rememberPose({ x, z, yaw: -Math.PI / 2 }); // facing east (+x)
        window.__hd.useUi.getState().setWalk(true);
      }, [x, z]);
      await walk.waitForTimeout(500);
    };
    const stop = async () => {
      await walk.keyboard.up('w');
      await walk.evaluate(() => window.__hd.useUi.getState().setWalk(false));
      await walk.waitForTimeout(300);
    };
    await startWalk(4.5, 1.75);
    await walk.keyboard.down('w');
    await walk.waitForFunction(() => window.__hd.walkPose.getState().x > 6.8, null, { timeout: 30000 }).catch(() => {});
    const through = await walk.evaluate(() => window.__hd.walkPose.getState());
    await stop();
    check('walker passes through the doorway', through.x > 6.8, `x=${through.x.toFixed(2)}, z=${through.z.toFixed(2)}`);

    // ... but is stopped by the solid wall beside it.
    await startWalk(4.5, 0.7);
    await walk.keyboard.down('w');
    await walk.waitForTimeout(6000);
    const blocked = await walk.evaluate(() => window.__hd.walkPose.getState());
    await stop();
    check('walker is blocked by the wall next to the door', blocked.x < 5.7, `x=${blocked.x.toFixed(2)}`);
    check('no page errors with doors and windows', errors.length === 0, errors.slice(0, 2).join(' | '));
    await walk.close();
  }

  // ---------------------------------------------------------------- 3. benchmark
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(BASE + '?demo=1&bench=1');
    await page.waitForSelector('.perf');
    const t0 = Date.now();
    await page.waitForSelector('.perf table', { timeout: 120000 });
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    const rows = await page.$$eval('.perf tbody tr', (trs) => trs.map((tr) => [...tr.children].map((td) => td.textContent)));
    check('benchmark finishes with a row per tier', rows.length === 3, `${secs}s, rows=${JSON.stringify(rows)}`);
    check('benchmark recorded frames', rows.every((r) => Number(r[1]) > 0));
    await page.screenshot({ path: `${SP}/e2e-bench.png` });
    check('no page errors during benchmark', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
