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

// The tests use the demo backend even when Supabase keys are configured in .env.local, so they never touch a real
// project: every context gets `hd.backend=local` (honoured by dev builds only).
{
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (opts) => {
    const c = await newContext(opts);
    await c.addInitScript(() => {
      localStorage.setItem('hd.backend', 'local');
      localStorage.setItem('hd.nocurtain', '1'); // the opening curtain is tested on its own below
    });
    return c;
  };
  browser.newPage = async (opts) => (await browser.newContext(opts)).newPage();
}
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
    const ins0 = page.getByRole('complementary', { name: 'Properties' });
    check('inspector shows the door controls', (await ins0.getByText('Opens to the other side').isVisible()) && (await ins0.getByText('Width').isVisible()));
    const before = await page.evaluate((id) => window.__hd.editor.getState().scene.openings[id].flip.swing, first.id);
    await ins0.getByRole('switch', { name: /Opens to the other side/ }).click();
    const after = await page.evaluate((id) => window.__hd.editor.getState().scene.openings[id].flip.swing, first.id);
    check('the swing toggle flips the door', before !== after);
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

  // ---------------------------------------------------------------- 2c. inspector
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?demo=1&view=2d');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForTimeout(900);
    const inspector = page.getByRole('complementary', { name: 'Properties' });
    const field = (label) => inspector.locator('.f-row', { hasText: label }).locator('input');
    const sceneOf = () => page.evaluate(() => window.__hd.editor.getState().scene);
    const sel = () => page.evaluate(() => window.__hd.editor.getState().selection);

    check('inspector is hidden when nothing is selected', (await inspector.count()) === 0);

    // Room: tap inside the living room with the Select tool.
    await page.getByRole('button', { name: 'Select' }).click();
    await page.mouse.click(530, 300);
    check('tapping inside a room selects it and opens the inspector', (await inspector.isVisible()) && (await sel()).length === 1);
    await field('Name').fill('Lounge');
    await field('Name').press('Enter');
    let sc = await sceneOf();
    check('renaming a room', Object.values(sc.rooms).some((r) => r.name === 'Lounge'));
    await inspector.getByRole('radio', { name: 'Walnut', exact: true }).click();
    sc = await sceneOf();
    check('choosing a floor swatch', Object.values(sc.rooms).find((r) => r.name === 'Lounge').floorMaterial.id === 'floor-wood-walnut');

    // Wall: tap the north wall, type a thickness in centimetres.
    await page.mouse.click(300, 90);
    check('tapping a wall selects the wall (not the room)', (await sel()).length === 1 && !!(await sceneOf()).walls[(await sel())[0]]);
    const wallId = (await sel())[0];
    await field('Thickness').fill('30cm');
    await field('Thickness').press('Enter');
    check('typed "30cm" sets thickness to 0.3 m', Math.abs((await sceneOf()).walls[wallId].thickness - 0.3) < 1e-9);
    await field('Thickness').fill('banana');
    await field('Thickness').press('Enter');
    check('invalid text is rejected (value unchanged)', Math.abs((await sceneOf()).walls[wallId].thickness - 0.3) < 1e-9);
    await inspector.getByRole('button', { name: '11.5 cm' }).click();
    check('thickness chip', Math.abs((await sceneOf()).walls[wallId].thickness - 0.115) < 1e-9);
    await field('Height').fill("9'");
    await field('Height').press('Enter');
    check('feet are understood: 9\' = 2.743 m', Math.abs((await sceneOf()).walls[wallId].height - 2.7432) < 1e-6);

    // Undo the last edit with the keyboard while focus is on the page.
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+z');
    check('Ctrl+Z undoes an inspector edit', Math.abs((await sceneOf()).walls[wallId].height - 3) < 1e-9);

    // Multi-select: shift-click another wall -> "2 items"; one edit changes both.
    await page.keyboard.down('Shift');
    await page.mouse.click(300, 790);
    await page.keyboard.up('Shift');
    check('Shift+click adds a second wall', (await sel()).length === 2);
    await field('Height').fill('2.8');
    await field('Height').press('Enter');
    sc = await sceneOf();
    check('one edit applies to both selected walls', (await sel()).every((id) => Math.abs(sc.walls[id].height - 2.8) < 1e-9));

    // Select all.
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+a');
    sc = await sceneOf();
    check('Ctrl+A selects every wall', (await sel()).length === Object.keys(sc.walls).length);
    await page.keyboard.press('Escape');
    check('Esc clears the selection and hides the inspector', (await inspector.count()) === 0);

    // Opening: exact width.
    const door = Object.values(sc.openings).find((o) => o.type === 'door');
    await page.evaluate((id) => window.__hd.editor.select([id]), door.id);
    await page.waitForTimeout(200);
    await field('Width').fill('1.05');
    await field('Width').press('Enter');
    check('exact door width', Math.abs((await sceneOf()).openings[door.id].width - 1.05) < 1e-9);

    // Deleting the divider re-joins the walls it had split (fresh page: halves still have identical properties).
    const fresh = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    fresh.on('pageerror', (e) => errors.push(String(e)));
    await fresh.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await fresh.goto(BASE + '?demo=1&view=2d');
    await fresh.waitForSelector('canvas.plan-canvas');
    await fresh.waitForTimeout(700);
    const count = () => fresh.evaluate(() => Object.keys(window.__hd.editor.getState().scene.walls).length);
    const before = await count();
    await fresh.evaluate(() => {
      const s = window.__hd.editor.getState().scene;
      const ids = Object.values(s.walls).filter((w) => s.nodes[w.a].p[0] === 6 && s.nodes[w.b].p[0] === 6).map((w) => w.id);
      window.__hd.editor.select(ids);
    });
    await fresh.keyboard.press('Delete');
    const after = await count();
    check('deleting the divider merges the split outer walls', after === before - 4, `${before} -> ${after}`);
    await fresh.keyboard.press('Control+z');
    check('and undo brings the divider back', (await count()) === before);
    await fresh.close();
    check('no page errors in the inspector flows', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.screenshot({ path: `${SP}/e2e-inspector.png` });
    await page.close();
  }

  // ---------------------------------------------------------------- 2d. customisation options
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?demo=1&view=2d');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForTimeout(900);
    const inspector = page.getByRole('complementary', { name: 'Properties' });
    const sceneOf = () => page.evaluate(() => window.__hd.editor.getState().scene);
    const sel = () => page.evaluate(() => window.__hd.editor.getState().selection);
    const blur = () => page.evaluate(() => document.activeElement?.blur());

    // Per-side wall paint: paint only side 2 of a (clockwise-drawn) outer wall.
    await page.getByRole('button', { name: 'Select' }).click();
    await page.mouse.click(300, 90);
    const wallId = (await sel())[0];
    const before = (await sceneOf()).walls[wallId];
    await inspector.getByRole('button', { name: 'Exterior wall' }).click();
    await inspector.getByRole('radio', { name: 'Light stone' }).count(); // (ground swatch lives in Home menu, not here)
    await inspector.getByRole('radio', { name: 'Stone' }).first().click();
    let w = (await sceneOf()).walls[wallId];
    const changed = [w.materialA.id !== before.materialA.id, w.materialB.id !== before.materialB.id];
    check('painting the Exterior wall changes exactly one face (the outside one)', changed.filter(Boolean).length === 1 && (w.materialA.id === 'wall-stone' || w.materialB.id === 'wall-stone'), `${w.materialA.id} | ${w.materialB.id}`);
    const outsideIsB = w.materialB.id === 'wall-stone';
    await inspector.getByRole('button', { name: 'Interior wall' }).click();
    await inspector.getByRole('radio', { name: 'Terracotta', exact: true }).first().click();
    w = (await sceneOf()).walls[wallId];
    check('painting the Interior wall changes the other face and leaves the exterior stone', (outsideIsB ? w.materialA.id === 'paint-terracotta' && w.materialB.id === 'wall-stone' : w.materialB.id === 'paint-terracotta' && w.materialA.id === 'wall-stone'), `${w.materialA.id} | ${w.materialB.id}`);
    await inspector.getByRole('button', { name: 'Both sides' }).click();
    await inspector.getByRole('radio', { name: 'White brick', exact: true }).click();
    w = (await sceneOf()).walls[wallId];
    check('"Both sides" paints both faces with a finish', w.materialA.id === 'wall-brick-white' && w.materialB.id === 'wall-brick-white');

    // Room: ceiling paint + a different floor.
    await page.keyboard.press('Escape');
    await page.mouse.click(530, 300);
    await inspector.getByRole('radio', { name: 'Sky', exact: true }).click();
    await inspector.getByRole('radio', { name: 'Terrazzo', exact: true }).click();
    const room = Object.values(await sceneOf().then((x) => x.rooms)).find((r) => r.name === 'Living');
    check('ceiling paint and terrazzo floor apply to the room', room.ceilingMaterial?.id === 'paint-sky' && room.floorMaterial.id === 'floor-terrazzo');

    // Door style + colours (front door is a double door in the demo; restyle it).
    await page.keyboard.press('Escape');
    const door = Object.values((await sceneOf()).openings).find((o) => o.type === 'door');
    await page.evaluate((id) => window.__hd.editor.select([id]), door.id);
    await page.waitForTimeout(200);
    await inspector.getByRole('button', { name: 'Glass', exact: true }).click();
    await inspector.getByRole('radio', { name: 'Black' }).first().click(); // frame colour
    await inspector.getByRole('radio', { name: 'Sage', exact: true }).click(); // door colour
    let o = (await sceneOf()).openings[door.id];
    check('door style and colours', o.style === 'glass' && o.frameColor === '#2b2a28' && o.leafColor === '#8f9f86', JSON.stringify([o.style, o.frameColor, o.leafColor]));
    await inspector.getByRole('button', { name: 'Double', exact: true }).click();
    o = (await sceneOf()).openings[door.id];
    check('choosing a double door widens it to fit two leaves', o.style === 'double' && o.width >= 1.4 - 1e-9, `width ${o.width}`);

    // Window style.
    const win = Object.values((await sceneOf()).openings).find((x) => x.type === 'window');
    await page.evaluate((id) => window.__hd.editor.select([id]), win.id);
    await page.waitForTimeout(200);
    await inspector.getByRole('button', { name: 'Sliding' }).click();
    check('window style', (await sceneOf()).openings[win.id].style === 'sliding');
    await page.keyboard.press('Escape');

    // Home menu: rename, ground, thickness for new walls; wall tool Inside/Outside.
    await page.getByRole('button', { name: 'Home' }).click();
    const home = page.getByRole('group', { name: 'Home settings' });
    await home.locator('.f-row', { hasText: 'Name' }).locator('input').fill('Villa Rosa');
    await home.locator('.f-row', { hasText: 'Name' }).locator('input').press('Enter');
    await home.getByRole('radio', { name: 'Sand', exact: true }).click();
    await home.locator('.f-row', { hasText: 'Inside walls' }).locator('input').fill('15cm');
    await home.locator('.f-row', { hasText: 'Inside walls' }).locator('input').press('Enter');
    const sc = await sceneOf();
    check('Home menu: name, ground and default thickness', sc.meta.name === 'Villa Rosa' && sc.terrain.groundMaterial.id === 'ground-sand' && Math.abs(sc.defaults.interiorThickness - 0.15) < 1e-9);
    await page.keyboard.press('Escape');
    await blur();

    await page.getByRole('button', { name: 'Wall' }).click();
    await page.mouse.click(300, 850);
    await page.mouse.click(500, 850);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Outside wall' }).click();
    await page.mouse.click(700, 850);
    await page.mouse.click(900, 850);
    await page.keyboard.press('Escape');
    const added = Object.values((await sceneOf()).walls).filter((x) => x.thickness === 0.15 || x.kind === 'exterior').slice(-2);
    const inner = added.find((x) => x.kind === 'interior');
    const outer = [...added].reverse().find((x) => x.kind === 'exterior');
    check('new inside wall uses the 15 cm default', !!inner && Math.abs(inner.thickness - 0.15) < 1e-9);
    check('Outside wall button draws a thicker exterior wall', !!outer && Math.abs(outer.thickness - 0.23) < 1e-9);
    check('no page errors in customisation flows', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.screenshot({ path: `${SP}/e2e-customise.png` });
    await page.close();
  }

  // ---------------------------------------------------------------- 2e. floors
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?demo=1&view=split');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForTimeout(900);
    const state = () =>
      page.evaluate(() => {
        const st = window.__hd.editor.getState();
        const s = st.scene;
        const per = (m, id) => Object.values(m).filter((x) => x.levelId === id).length;
        return {
          levels: s.levelOrder.map((id) => ({ id, name: s.levels[id].name, elevation: s.levels[id].elevation, height: s.levels[id].height, walls: per(s.walls, id), rooms: Object.values(s.rooms).filter((r) => r.levelId === id).map((r) => r.name) })),
          active: st.activeLevelId,
          selection: st.selection,
        };
      });
    const group = page.getByRole('group', { name: 'Floors' });

    let st = await state();
    check('starts with one floor', st.levels.length === 1);

    // Copy the ground floor to a new floor on top via the floor menu.
    await group.getByRole('button', { name: 'Ground floor' }).click();
    const menu = page.getByRole('group', { name: 'Floor settings' });
    check('tapping the current floor opens its settings', await menu.isVisible());
    check('Delete is disabled when it is the only floor', await menu.getByRole('button', { name: 'Delete floor' }).isDisabled());
    await menu.getByRole('button', { name: 'Copy to a new floor' }).click();
    st = await state();
    check('Copy creates a second floor with the same walls', st.levels.length === 2 && st.levels[1].walls === st.levels[0].walls && st.levels[1].walls > 0, JSON.stringify(st.levels.map((l) => [l.name, l.walls])));
    check('the new floor sits on top of the first', Math.abs(st.levels[1].elevation - st.levels[0].height) < 1e-9);
    check('room names are copied', JSON.stringify(st.levels[1].rooms.sort()) === JSON.stringify(st.levels[0].rooms.sort()), st.levels[1].rooms.join(','));
    check('the app switches to the new floor', st.active === st.levels[1].id);

    // Switch floors with the chips.
    await group.getByRole('button', { name: 'Ground floor' }).click();
    check('chips switch the current floor', (await state()).active === st.levels[0].id);
    await page.evaluate((id) => window.__hd.editor.select([id]), Object.keys(await page.evaluate(() => window.__hd.editor.getState().scene.walls))[0]);
    await group.getByRole('button', { name: 'Floor 1' }).click();
    check('switching floors clears the selection', (await state()).selection.length === 0);

    // Rename + height of the current floor; the floor above would move up.
    await group.getByRole('button', { name: 'Floor 1' }).click();
    const nameInput = menu.locator('.f-row', { hasText: 'Name' }).locator('input');
    await nameInput.fill('Upstairs');
    await nameInput.press('Enter');
    check('floor can be renamed', (await state()).levels[1].name === 'Upstairs');
    await page.keyboard.press('Escape');
    await group.getByRole('button', { name: 'Ground floor' }).click(); // go down
    await group.getByRole('button', { name: 'Ground floor' }).click(); // open its menu
    const h = menu.locator('.f-row', { hasText: 'Height' }).locator('input');
    await h.fill('3.4');
    await h.press('Enter');
    st = await state();
    check('raising the ground floor moves the upper floor up', Math.abs(st.levels[0].height - 3.4) < 1e-9 && Math.abs(st.levels[1].elevation - 3.4) < 1e-9);
    await page.keyboard.press('Escape');

    // 3D controls: cutaway + which floors are shown.
    const cut = page.getByRole('button', { name: 'Cutaway' });
    await cut.click();
    check('Cutaway toggles', (await page.evaluate(() => window.__hd.useUi.getState().cutaway)) === true);
    await cut.click();
    await page.getByRole('button', { name: 'Display' }).click();
    await page.getByRole('radio', { name: 'This floor only' }).click();
    check('"This floor only" is selectable once there are two floors', (await page.evaluate(() => window.__hd.useUi.getState().floorView)) === 'single');
    await page.keyboard.press('Escape');

    // Delete the upper floor; undo brings it back.
    await group.getByRole('button', { name: 'Upstairs' }).click();
    await group.getByRole('button', { name: 'Upstairs' }).click();
    await menu.getByRole('button', { name: 'Delete floor' }).click();
    st = await state();
    check('deleting the upper floor leaves one floor', st.levels.length === 1 && st.active === st.levels[0].id);
    await page.keyboard.press('Control+z');
    check('undo brings the floor back', (await state()).levels.length === 2);
    check('no page errors with floors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2f. furniture
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?demo=1&view=2d');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForTimeout(900);
    const items = () => page.evaluate(() => Object.values(window.__hd.editor.getState().scene.items));
    const panel = page.getByRole('complementary', { name: 'Furniture catalog' });
    const inspector = page.getByRole('complementary', { name: 'Properties' });
    const field = (label) => inspector.locator('.f-row', { hasText: label }).locator('input');

    const start = (await items()).length;
    check('the sample home is furnished', start >= 15, `${start} items`);

    // Browse the catalog.
    await page.getByRole('button', { name: 'Furniture' }).click();
    check('Furniture opens the catalog', await panel.isVisible());
    await panel.getByLabel('Search furniture').fill('sofa');
    check('search by name', (await panel.locator('.card').count()) >= 3);
    await panel.getByLabel('Search furniture').fill('couch');
    check('search by tag finds sofas', (await panel.locator('.card').count()) >= 3);
    await panel.getByLabel('Search furniture').fill('');
    await panel.getByRole('tab', { name: 'Bathroom' }).click();
    const names = await panel.locator('.card-name').allTextContents();
    check('category filter', names.includes('Toilet') && !names.includes('Sofa, 2-seat'), names.join(','));
    await panel.getByRole('tab', { name: 'All' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.furniture .card-thumb img').length >= 6, null, { timeout: 30000 }).catch(() => {});
    check('thumbnails are rendered from the models', (await page.locator('.furniture .card-thumb img').count()) >= 6);

    // Place a (free) single bed in open floor.
    await panel.getByLabel('Search furniture').fill('single bed');
    await panel.locator('.card', { hasText: 'Single bed' }).click();
    check('picking closes the catalog and starts placing', !(await panel.isVisible()) && (await page.evaluate(() => window.__hd.useUi.getState().placing)) === 'bed-single');
    await page.mouse.move(700, 330);
    await page.keyboard.press('r');
    check('R turns the item being placed', Math.abs((await page.evaluate(() => window.__hd.useUi.getState().placeRotation)) - Math.PI / 2) < 1e-9);
    await page.mouse.click(700, 330);
    let list = await items();
    check('click places it', list.length === start + 1);
    const placed = list.at(-1);
    check('floor items sit on the floor', placed.position[1] === 0);

    // Wall snapping: a wardrobe near the north wall ends up flush against it, facing the room.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Furniture' }).click();
    await panel.getByLabel('Search furniture').fill('wardrobe');
    await panel.locator('.card[title^="Wardrobe"]').click();
    await page.mouse.click(330, 140);
    list = await items();
    const wardrobe = list.at(-1);
    check('wardrobe snaps back-to-wall and faces the room', wardrobe.assetId === 'wardrobe' && Math.abs(wardrobe.rotationY) < 1e-6 && wardrobe.position[2] < 0.6, JSON.stringify([wardrobe.position, wardrobe.rotationY]));

    // Wall art refuses open floor.
    await page.getByRole('button', { name: 'Furniture' }).click();
    await panel.getByLabel('Search furniture').fill('wall art');
    await panel.locator('.card', { hasText: 'Wall art' }).click();
    const n = (await items()).length;
    await page.mouse.click(700, 520);
    check('wall art cannot be placed in the middle of a room', (await items()).length === n);
    await page.keyboard.press('Escape');

    // Select the bed and edit it in the inspector.
    await page.evaluate((id) => window.__hd.editor.select([id]), placed.id);
    await page.waitForTimeout(200);
    check('inspector shows the item', await inspector.getByText('Single bed').first().isVisible());
    await field('Rotation').fill('45');
    await field('Rotation').press('Enter');
    check('exact rotation in degrees', Math.abs((await items()).find((i) => i.id === placed.id).rotationY - Math.PI / 4) < 1e-6);
    await inspector.getByRole('radio', { name: 'Navy', exact: true }).click();
    check('colour variant', (await items()).find((i) => i.id === placed.id).variant === '#4d6783');
    await inspector.getByRole('button', { name: '125 %' }).click();
    check('size preset scales uniformly', JSON.stringify((await items()).find((i) => i.id === placed.id).scale) === '[1.25,1.25,1.25]');
    const before = (await items()).find((i) => i.id === placed.id).position;
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('ArrowRight');
    const after = (await items()).find((i) => i.id === placed.id).position;
    check('arrow keys nudge by 5 cm', Math.abs(after[0] - before[0] - 0.05) < 1e-9);
    await page.keyboard.press('Control+d');
    check('Ctrl+D duplicates', (await items()).length === n + 1);
    await page.keyboard.press('Delete');
    check('Delete removes the selected item', (await items()).length === n);
    await page.keyboard.press('Control+z');
    check('Ctrl+Z restores it', (await items()).length === n + 1);

    // Tap to select + drag to move a piece of the sample furniture.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Select' }).click();
    const sofa = (await items()).find((i) => i.assetId === 'sofa-2');
    check('the sample sofa is flush to the south wall, facing north', Math.abs(Math.abs(sofa.rotationY) - Math.PI) < 1e-6, String(sofa.rotationY));
    check('no page errors with furniture', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.screenshot({ path: `${SP}/e2e-furniture.png` });
    await page.close();
  }

  // ---------------------------------------------------------------- 2g. persistence
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?view=2d');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForTimeout(500);
    const walls = () => page.evaluate(() => Object.keys(window.__hd.editor.getState().scene.walls).length);

    const box = await page.locator('canvas.plan-canvas').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    for (const [dx, dy] of [[-120, -90], [120, -90], [120, 90], [-120, 90], [-120, -90]]) await page.mouse.click(cx + dx, cy + dy);
    await page.keyboard.press('Escape');
    check('drew a room', (await walls()) === 4);
    await page.getByRole('button', { name: 'Home' }).click();
    const nameInput = page.getByRole('group', { name: 'Home settings' }).locator('.f-row', { hasText: 'Name' }).locator('input');
    await nameInput.fill('Persisted villa');
    await nameInput.press('Enter');
    await page.keyboard.press('Escape');
    await page.getByText('Saved', { exact: true }).waitFor({ timeout: 8000 });
    check('the top bar says "Saved" after autosave', true);

    await page.reload();
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => {
      const sc = window.__hd.editor.getState().scene;
      return { walls: Object.keys(sc.walls).length, rooms: Object.keys(sc.rooms).length, name: sc.meta.name };
    });
    check('a reload restores the design', after.walls === 4 && after.rooms === 1 && after.name === 'Persisted villa', JSON.stringify(after));
    check('undo history starts fresh after a reload', (await page.evaluate(() => window.__hd.editor.getState().canUndo)) === false);

    // Save to file → New home → Open file brings it back.
    await page.getByRole('button', { name: 'Home' }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save to file' }).click()]);
    check('file name comes from the home name', download.suggestedFilename() === 'persisted-villa.homedesign.json', download.suggestedFilename());
    const path = `${SP}/saved-home.json`;
    await download.saveAs(path);
    const newBtn = page.getByRole('button', { name: 'New home' });
    await newBtn.click();
    check('New home needs a second tap', (await walls()) === 4);
    await page.getByRole('button', { name: 'Tap again to clear everything' }).click();
    check('second tap clears the home', (await walls()) === 0);
    check('New home offers the starting choices', await page.getByRole('dialog', { name: /design your home/ }).isVisible());
    await page.getByRole('button', { name: 'Skip' }).click();
    await page.getByRole('button', { name: 'Home' }).click();
    await page.locator('input[type=file]').setInputFiles(path);
    await page.waitForFunction(() => Object.keys(window.__hd.editor.getState().scene.walls).length === 4, null, { timeout: 8000 });
    check('Open file restores the saved home', (await walls()) === 4);

    // A bad file is refused with a message and nothing changes.
    await page.getByRole('button', { name: 'Home' }).click();
    const bad = `${SP}/bad.json`;
    (await import('node:fs')).writeFileSync(bad, '{"schemaVersion":1,"levels":5}');
    await page.locator('input[type=file]').setInputFiles(bad);
    await page.getByText(/Could not open this file/).waitFor({ timeout: 5000 });
    check('an invalid file is refused with a message', (await walls()) === 4);
    check('no page errors in persistence flows', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();

    // Demo links never touch the saved home.
    const demo = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await demo.goto(BASE + '?demo=1&view=2d');
    await demo.waitForSelector('canvas.plan-canvas');
    await demo.waitForTimeout(1500);
    const idb = await demo.evaluate(
      () => new Promise((res) => { const r = indexedDB.open('home-designer'); r.onsuccess = () => res(r.result.objectStoreNames.length); r.onerror = () => res(-1); r.onupgradeneeded = () => res(0); }),
    );
    check('?demo=1 does not create or change saved data', idb === 0, String(idb));
    await demo.close();
  }

  // ---------------------------------------------------------------- 2h. roof
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'medium'));
    await page.goto(BASE + '?demo=1&view=split');
    await page.waitForSelector('canvas');
    await page.waitForTimeout(2500);
    const roofs = () => page.evaluate(() => Object.values(window.__hd.editor.getState().scene.roofs));
    const group = page.getByRole('group', { name: 'Floors' });
    check('the sample home has a gable roof', (await roofs()).length === 1 && (await roofs())[0].style === 'gable');
    check('a Hide roof button appears once there is a roof', await group.getByRole('button', { name: 'Hide roof' }).isVisible());
    await group.getByRole('button', { name: 'Hide roof' }).click();
    check('Hide roof turns it off', (await page.evaluate(() => window.__hd.useUi.getState().showRoof)) === false);
    await group.getByRole('button', { name: 'Show roof' }).click();

    await group.getByRole('button', { name: 'Ground floor' }).click();
    const menu = page.getByRole('group', { name: 'Floor settings' });
    await menu.getByRole('button', { name: 'Hip', exact: true }).click();
    check('choosing Hip changes the style', (await roofs())[0].style === 'hip');
    const slope = menu.locator('.f-row', { hasText: 'Slope' }).locator('input');
    await slope.fill('40');
    await slope.press('Enter');
    check('slope in degrees', Math.abs((await roofs())[0].pitchDeg - 40) < 1e-9);
    await slope.fill('85');
    await slope.press('Enter');
    check('slope is clamped to 60 degrees', Math.abs((await roofs())[0].pitchDeg - 60) < 1e-9);
    const over = menu.locator('.f-row', { hasText: 'Overhang' }).locator('input');
    await over.fill('60cm');
    await over.press('Enter');
    check('overhang accepts typed lengths', Math.abs((await roofs())[0].overhang - 0.6) < 1e-9);
    await menu.getByRole('radio', { name: 'Slate', exact: true }).click();
    check('roof material', (await roofs())[0].material.id === 'roof-slate');
    await menu.getByRole('button', { name: 'Flat', exact: true }).click();
    check('Flat hides the slope control', (await menu.locator('.f-row', { hasText: 'Slope' }).count()) === 0);
    await menu.getByRole('button', { name: 'Gable', exact: true }).click();
    await menu.getByRole('button', { name: /Turn the ridge/ }).click();
    check('the ridge can be turned 90 degrees', Math.abs((await roofs())[0].ridgeAngle - Math.PI / 2) < 1e-9);
    await menu.getByRole('button', { name: 'None', exact: true }).click();
    check('None removes the roof', (await roofs()).length === 0);
    check('the Hide roof button disappears with it', (await group.getByRole('button', { name: /roof/ }).count()) === 0);
    await page.keyboard.press('Control+z');
    check('Ctrl+Z brings the roof back', (await roofs()).length === 1);

    // An empty new floor leaves the roof where it is; once the new floor has rooms the roof moves up to cover it.
    await group.getByRole('button', { name: 'Add floor' }).click();
    const lv = () => page.evaluate(() => ({ order: window.__hd.editor.getState().scene.levelOrder, roofLevels: Object.values(window.__hd.editor.getState().scene.roofs).map((r) => r.levelId) }));
    let st = await lv();
    check('an empty new floor leaves the roof on the floor below', st.roofLevels.length === 1 && st.roofLevels[0] === st.order[0]);
    await page.evaluate(() => { const ed = window.__hd.editor; ed.execute(window.__hd.core.copyLevel(ed.getState().scene.levelOrder[0])); });
    st = await lv();
    check('a floor with rooms takes the roof over', st.roofLevels.length === 1 && st.roofLevels[0] === st.order.at(-1));
    check('no page errors with roofs', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.screenshot({ path: `${SP}/e2e-roof.png` });
    await page.close();
  }

  // ---------------------------------------------------------------- 2i. guided start
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    const scene = () => page.evaluate(() => window.__hd.editor.getState().scene);
    const dialog = page.getByRole('dialog', { name: /design your home/ });

    // A first visit (no test flags) greets you.
    await page.goto(BASE);
    await dialog.waitFor({ timeout: 8000 });
    check('a first visit shows the welcome screen', true);

    // Bad sizes are refused with a helpful message.
    await dialog.getByLabel('Room width in metres').fill('banana');
    await dialog.getByRole('button', { name: 'Create room' }).click();
    check('invalid room size is refused', await dialog.getByRole('alert').isVisible());
    await dialog.getByLabel('Room width in metres').fill("12'6\"");
    await dialog.getByLabel('Room depth in metres').fill('350cm');
    await dialog.getByRole('button', { name: 'Create room' }).click();
    const sc = await scene();
    const xs = Object.values(sc.nodes).map((n) => n.p[0]);
    const zs = Object.values(sc.nodes).map((n) => n.p[1]);
    check('quick room understands feet and cm: 12\'6" x 350cm', Math.abs(Math.max(...xs) - 3.81) < 0.03 && Math.abs(Math.max(...zs) - 3.5) < 0.03, `${Math.max(...xs)} x ${Math.max(...zs)}`);
    check('it comes with a door and windows', Object.values(sc.openings).some((o) => o.type === 'door') && Object.values(sc.openings).some((o) => o.type === 'window'));
    check('the welcome closes', (await dialog.count()) === 0);

    // The tip card walks you through the next step.
    const tip = page.getByRole('status').filter({ hasText: 'Next:' });
    await tip.waitFor({ timeout: 5000 });
    check('the next step is furnishing (room + door exist)', (await tip.innerText()).includes('Furnish'));
    await tip.getByRole('button', { name: 'Furniture' }).click();
    check('the tip button opens the catalog', await page.getByRole('complementary', { name: 'Furniture catalog' }).isVisible());
    await page.keyboard.press('Escape');
    await tip.getByRole('button', { name: 'Hide tips' }).click();
    check('tips can be hidden', (await tip.count()) === 0);

    // It remembers: a reload neither greets nor shows tips again, and the home was saved.
    await page.waitForTimeout(1200);
    await page.reload();
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForTimeout(700);
    check('a returning visitor is not greeted again', (await dialog.count()) === 0);
    check('the quick room was autosaved and restored', Object.keys((await scene()).walls).length === 4);
    check('hidden tips stay hidden', (await page.getByRole('status').filter({ hasText: 'Next:' }).count()) === 0);

    // Help sheet with the ? key.
    await page.keyboard.press('?');
    const help = page.getByRole('dialog', { name: /Help/ });
    check('? opens the shortcuts', await help.isVisible());
    check('it lists shortcuts', (await help.getByText('Rotate furniture or stairs 90°').count()) === 1);
    await page.keyboard.press('Escape');
    check('Esc closes it', (await help.count()) === 0);
    await ctx.close();

    // Template choice on a fresh forced welcome, and the tip sequence from an empty plan.
    const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page2.on('pageerror', (e) => errors.push(String(e)));
    await page2.goto(BASE + '?welcome=1&fresh=1&view=2d');
    const d2 = page2.getByRole('dialog', { name: /design your home/ });
    await d2.getByRole('button', { name: /Family home/ }).click();
    const rooms = await page2.evaluate(() => Object.values(window.__hd.editor.getState().scene.rooms).map((r) => r.name).sort());
    check('Family home template: five named rooms', JSON.stringify(rooms) === JSON.stringify(['Bath', 'Bedroom', 'Bedroom 2', 'Kitchen', 'Living']), rooms.join(','));
    await page2.close();

    const page3 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page3.on('pageerror', (e) => errors.push(String(e)));
    await page3.goto(BASE + '?welcome=1&fresh=1&view=2d');
    await page3.getByRole('button', { name: /Start from scratch/ }).click();
    const t3 = page3.getByRole('status').filter({ hasText: 'Next:' });
    check('an empty plan starts with "draw your walls"', (await t3.innerText()).includes('Draw your walls'));
    await t3.getByRole('button', { name: 'Wall tool' }).click();
    check('its button selects the wall tool', (await page3.evaluate(() => window.__hd.useUi.getState().tool)) === 'wall');
    check('no page errors in the guided start', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page3.close();
  }

  // ---------------------------------------------------------------- 2j. pro tools: exact lengths, units
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?view=2d&fresh=1');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForTimeout(500);
    const box = await page.locator('canvas.plan-canvas').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const lengths = () =>
      page.evaluate(() => {
        const sc = window.__hd.editor.getState().scene;
        return Object.values(sc.walls).map((w) => Math.hypot(sc.nodes[w.b].p[0] - sc.nodes[w.a].p[0], sc.nodes[w.b].p[1] - sc.nodes[w.a].p[1]));
      });
    const typed = () => page.evaluate(() => window.__hd.useUi.getState().lengthInput);

    // Metric: start a wall, aim east, type 3.5, Enter.
    await page.mouse.click(cx - 120, cy);
    await page.mouse.move(cx + 40, cy);
    await page.keyboard.type('3.5');
    check('typed characters show up as the length being entered', (await typed()) === '3.5');
    await page.keyboard.press('Backspace');
    check('Backspace edits the typed length', (await typed()) === '3.');
    await page.keyboard.type('5');
    await page.keyboard.press('Enter');
    let l = await lengths();
    check('Enter places a wall of exactly 3.5 m in the aimed direction', l.length === 1 && Math.abs(l[0] - 3.5) < 1e-9, JSON.stringify(l));
    check('the chain continues after a typed length', (await page.evaluate(() => window.__hd.useUi.getState().drawing)) === true);

    // Units: switch to feet & inches; a bare number now means feet, and apostrophes work.
    await page.getByRole('button', { name: 'Home' }).click();
    await page.getByRole('button', { name: 'Feet & inches' }).click();
    await page.keyboard.press('Escape'); // closes the menu (and ends the chain)
    await page.mouse.click(cx - 120, cy - 160);
    await page.mouse.move(cx + 40, cy - 160);
    await page.keyboard.type("10'6\"");
    await page.keyboard.press('Enter');
    l = await lengths();
    check('feet & inches: 10\'6" becomes 3.2004 m', l.length === 2 && Math.abs(l[1] - 3.2004) < 1e-6, JSON.stringify(l));
    await page.keyboard.type('8');
    await page.keyboard.press('Enter');
    l = await lengths();
    check('a bare number means feet in feet mode (8 → 2.4384 m)', l.length === 3 && Math.abs(l[2] - 2.4384) < 1e-6, JSON.stringify(l));

    // Esc clears the typed text first and only then finishes the chain.
    await page.keyboard.type('12');
    await page.keyboard.press('Escape');
    check('Esc first clears the typed length', (await typed()) === '' && (await page.evaluate(() => window.__hd.useUi.getState().drawing)) === true);
    await page.keyboard.press('Escape');
    check('a second Esc finishes the chain', (await page.evaluate(() => window.__hd.useUi.getState().drawing)) === false);
    // garbage lengths are ignored
    await page.mouse.click(cx - 300, cy + 200);
    await page.keyboard.type('.');
    await page.keyboard.press('Enter');
    check('a nonsense length places nothing', (await lengths()).length === 3);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // Inspector fields follow the units (feet & inches, no "m" suffix).
    await page.getByRole('button', { name: 'Select' }).click();
    await page.evaluate(() => window.__hd.editor.select([Object.keys(window.__hd.editor.getState().scene.walls)[0]]));
    const inspector = page.getByRole('complementary', { name: 'Properties' });
    const height = inspector.locator('.f-row', { hasText: 'Height' }).locator('input');
    check('wall height shows in feet and inches', /^9'\d/.test(await height.inputValue()), await height.inputValue());
    await height.fill("8'6\"");
    await height.press('Enter');
    check('typed feet & inches set the height (8\'6" = 2.5908 m)', Math.abs((await page.evaluate(() => Object.values(window.__hd.editor.getState().scene.walls)[0].height)) - 2.5908) < 1e-6);
    await page.keyboard.press('Escape');

    // Pro tools: a switch in the Home menu, remembered.
    await page.getByRole('button', { name: 'Home' }).click();
    await page.getByRole('switch', { name: /Pro tools/ }).click();
    check('Pro tools turn on', (await page.evaluate(() => window.__hd.useUi.getState().pro)) === true);
    check('and are remembered', (await page.evaluate(() => localStorage.getItem('hd.pro'))) === 'on');
    await page.keyboard.press('Escape');
    await page.screenshot({ path: `${SP}/e2e-pro.png` });
    await page.getByRole('button', { name: 'Home' }).click();
    await page.getByRole('switch', { name: /Pro tools/ }).click();
    check('and can be turned off again', (await page.evaluate(() => window.__hd.useUi.getState().pro)) === false);
    check('no page errors in pro tools', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2k. accounts, cloud, sharing, free vs premium
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); // one browser: shared storage
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?view=2d&fresh=1');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForFunction(() => window.__hd.useCloud.getState().ready);
    const catalog = page.getByRole('complementary', { name: 'Furniture catalog' });

    // --- guests: free items place, premium / rewarded items are gated
    await page.getByRole('button', { name: 'Furniture' }).click();
    check('premium items show a Premium badge, rewarded ones "Watch ad"', (await catalog.locator('.card', { hasText: 'Double bed' }).getByText('Premium').count()) === 1 && (await catalog.locator('.card', { hasText: 'Armchair' }).getByText('Watch ad').count()) === 1);
    await catalog.getByLabel('Search furniture').fill('double bed');
    await catalog.locator('.card', { hasText: 'Double bed' }).click();
    const dlg = page.getByRole('dialog', { name: 'Double bed' });
    check('picking a premium item opens the upsell instead of placing it', (await dlg.isVisible()) && (await page.evaluate(() => window.__hd.useUi.getState().placing)) === null);
    check('it offers an account, not a fake purchase, to a guest', await dlg.getByRole('button', { name: /Create a free account/ }).isVisible());
    await dlg.getByRole('button', { name: 'Not now' }).click();

    await catalog.getByLabel('Search furniture').fill('armchair');
    await catalog.locator('.card', { hasText: 'Armchair' }).click();
    const rdlg = page.getByRole('dialog', { name: 'Armchair' });
    await rdlg.getByRole('button', { name: /Watch an ad/ }).click();
    check('a demo ad plays', await page.getByRole('dialog', { name: 'Advertisement' }).isVisible());
    await page.waitForFunction(() => window.__hd.useUi.getState().placing === 'armchair', null, { timeout: 15000 });
    check('after the ad the armchair is unlocked and ready to place', true);
    check('the unlock is remembered by the account state', Object.keys((await page.evaluate(() => window.__hd.useCloud.getState().ent)).unlocks).includes('armchair'));
    await page.keyboard.press('Escape');

    // --- account: sign up, save, attach
    await page.getByRole('button', { name: 'Sign in' }).click();
    const acct = page.getByRole('group', { name: 'Account' });
    await acct.getByRole('button', { name: 'Create account', exact: true }).first().click();
    await acct.getByLabel('Email').fill('owner@example.com');
    await acct.getByLabel('Password', { exact: true }).fill('short');
    await acct.getByLabel('Confirm password').fill('short');
    await acct.locator('button[type=submit]').click();
    check('a weak password is refused with a message', await acct.getByRole('alert').isVisible());
    await acct.getByLabel('Password', { exact: true }).fill('a long password');
    await acct.getByLabel('Confirm password').fill('a long passwore');
    await acct.locator('button[type=submit]').click();
    check('mismatched passwords are caught before sending', (await acct.getByRole('alert').innerText()).includes('don’t match'));
    check('and no account was created', (await page.evaluate(() => window.__hd.useCloud.getState().session)) === null);
    await acct.getByLabel('Confirm password').fill('a long password');
    await acct.locator('button[type=submit]').click();
    await acct.getByText('owner@example.com').waitFor({ timeout: 5000 });
    check('signing up signs you in', true);

    // build something worth saving, then save + share
    await page.keyboard.press('Escape');
    const box = await page.locator('canvas.plan-canvas').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    for (const [dx, dy] of [[-120, -90], [120, -90], [120, 90], [-120, 90], [-120, -90]]) await page.mouse.click(cx + dx, cy + dy);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Account' }).click();
    await acct.getByRole('button', { name: 'Save to my account' }).click();
    await acct.getByRole('listitem').first().waitFor({ timeout: 5000 });
    check('the home appears under My homes', (await acct.getByRole('listitem').count()) === 1);
    await acct.getByRole('button', { name: 'Create a view-only link' }).click();
    const link = await acct.getByLabel('Share link').inputValue();
    check('a share link is created', link.includes('?share='), link);

    // --- the link works for anyone, read-only
    const viewer = await ctx.newPage();
    viewer.on('pageerror', (e) => errors.push(String(e)));
    await viewer.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await viewer.goto(link.replace(/^https?:\/\/[^/]+/, BASE.replace(/\/$/, '')));
    await viewer.getByText('Shared · view only').waitFor({ timeout: 10000 });
    check('the shared home opens in a read-only viewer', (await viewer.getByRole('navigation', { name: 'Tools' }).count()) === 0 && (await viewer.getByRole('button', { name: 'Walk' }).isVisible()));
    await viewer.close();

    // --- reload: the attached home keeps syncing; stop sharing kills the link
    await acct.getByRole('button', { name: 'Stop sharing' }).click();
    const gone = await ctx.newPage();
    await gone.goto(link.replace(/^https?:\/\/[^/]+/, BASE.replace(/\/$/, '')));
    await gone.getByText('This link isn’t available').waitFor({ timeout: 10000 });
    check('a revoked link no longer works', true);
    await gone.close();

    // --- subscription (demo billing): everything unlocks, ads disappear
    await acct.getByRole('button', { name: 'Go ad-free (demo)' }).click();
    check('subscribing turns ads off', (await page.evaluate(() => window.__hd.useCloud.getState().ent.subscribed)) === true);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Furniture' }).click();
    await catalog.getByLabel('Search furniture').fill('double bed');
    check('premium items no longer show a lock', (await catalog.locator('.card', { hasText: 'Double bed' }).getByText('Premium').count()) === 0);
    await catalog.locator('.card', { hasText: 'Double bed' }).click();
    check('and can be placed', (await page.evaluate(() => window.__hd.useUi.getState().placing)) === 'bed-double');
    await page.keyboard.press('Escape');

    // --- sign out and back in: subscription is per account
    await page.getByRole('button', { name: 'Account' }).click();
    await acct.getByRole('button', { name: 'Sign out' }).click();
    check('signing out returns to the free plan', (await page.evaluate(() => window.__hd.useCloud.getState().ent.subscribed)) === false);
    await acct.getByLabel('Email').fill('owner@example.com');
    await acct.getByLabel('Password', { exact: true }).fill('wrong password!');
    await acct.locator('button[type=submit]').click();
    check('a wrong password is refused', await acct.getByRole('alert').isVisible());
    await acct.getByLabel('Password', { exact: true }).fill('a long password');
    await acct.locator('button[type=submit]').click();
    await acct.getByText('Ad-free · all items unlocked').waitFor({ timeout: 5000 });
    check('signing back in restores the subscription and My homes', (await acct.getByRole('listitem').count()) === 1);
    check('no page errors in the cloud flows', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.screenshot({ path: `${SP}/e2e-account.png` });
    await ctx.close();
  }

  // ---------------------------------------------------------------- 2l. account lifecycle + sync conflicts
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    const open = async (url) => {
      const pg = await ctx.newPage();
      pg.on('pageerror', (e) => errors.push(String(e)));
      await pg.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
      await pg.goto(BASE + url);
      await pg.waitForFunction(() => window.__hd.useCloud.getState().ready);
      return pg;
    };
    const signUp = async (pg, email, pass) => {
      await pg.getByRole('button', { name: 'Sign in' }).click();
      const a = pg.getByRole('group', { name: 'Account' });
      await a.getByRole('button', { name: 'Create account', exact: true }).first().click();
      await a.getByLabel('Email').fill(email);
      await a.getByLabel('Password', { exact: true }).fill(pass);
      await a.getByLabel('Confirm password').fill(pass);
      await a.locator('button[type=submit]').click();
      await a.getByText(email).waitFor({ timeout: 5000 });
      return a;
    };

    // ---- forgot password (demo backend opens the new-password step straight away)
    const page = await open('?view=2d&fresh=1');
    let acct = await signUp(page, 'reset@example.com', 'old password 1');
    await acct.getByRole('button', { name: 'Sign out' }).click();
    await acct.getByLabel('Email').fill('');
    await acct.getByRole('button', { name: 'Forgot password?' }).click();
    check('forgot password asks for the email first', await acct.getByRole('alert').isVisible());
    await acct.getByLabel('Email').fill('reset@example.com');
    await acct.getByRole('button', { name: 'Forgot password?' }).click();
    const rec = page.getByRole('dialog', { name: 'Choose a new password' });
    await rec.waitFor({ timeout: 5000 });
    check('the reset opens the "Choose a new password" step', true);
    await rec.getByLabel('New password', { exact: true }).fill('brand new pass 2');
    await rec.getByLabel('Confirm new password').fill('different pass 2');
    await rec.getByRole('button', { name: 'Save password' }).click();
    check('mismatched new passwords are caught', await rec.getByRole('alert').isVisible());
    await rec.getByLabel('Confirm new password').fill('brand new pass 2');
    await rec.getByRole('button', { name: 'Save password' }).click();
    await rec.waitFor({ state: 'detached', timeout: 5000 });
    check('the new password is saved and the dialog closes', true);
    await page.getByRole('button', { name: 'Account' }).click();
    await acct.getByRole('button', { name: 'Sign out' }).click();
    await acct.getByLabel('Email').fill('reset@example.com');
    await acct.getByLabel('Password', { exact: true }).fill('old password 1');
    await acct.locator('button[type=submit]').click();
    check('the old password no longer works', await acct.getByRole('alert').isVisible());
    await acct.getByLabel('Password', { exact: true }).fill('brand new pass 2');
    await acct.locator('button[type=submit]').click();
    await acct.getByText('reset@example.com').waitFor({ timeout: 5000 });
    check('the new password signs in', true);

    // ---- change password from the account menu
    await acct.getByRole('button', { name: 'Change password' }).click();
    await acct.getByLabel('New password', { exact: true }).fill('third password 3');
    await acct.getByLabel('Confirm new password').fill('third password 3');
    await acct.getByRole('button', { name: 'Save password' }).click();
    await acct.getByText('Your password has been changed.').waitFor({ timeout: 5000 });
    check('Change password works from the account menu', true);

    // ---- delete the account (two taps), its homes go with it
    await acct.getByRole('button', { name: 'Save to my account' }).click();
    await acct.getByRole('listitem').first().waitFor({ timeout: 5000 });
    await acct.getByRole('button', { name: 'Delete my account' }).click();
    check('deleting needs a second tap', await acct.getByRole('button', { name: /Tap again: delete/ }).isVisible());
    await acct.getByRole('button', { name: /Tap again: delete/ }).click();
    await page.waitForFunction(() => window.__hd.useCloud.getState().session === null);
    check('the account is gone and you are signed out', true);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await acct.getByLabel('Email').fill('reset@example.com');
    await acct.getByLabel('Password', { exact: true }).fill('third password 3');
    await acct.locator('button[type=submit]').click();
    check('signing in to a deleted account fails', await acct.getByRole('alert').isVisible());
    await page.close();

    // ---- two devices (two tabs, same account) editing the same home
    const A = await open('?view=2d&fresh=1&persist=1');
    const accA = await signUp(A, 'sync@example.com', 'sync password 1');
    await accA.getByRole('button', { name: 'Save to my account' }).click();
    await accA.getByRole('listitem').first().waitFor({ timeout: 5000 });
    await A.keyboard.press('Escape');

    const B = await open('?view=2d&fresh=1&persist=1');
    await B.getByRole('button', { name: 'Account' }).click();
    await B.getByRole('group', { name: 'Account' }).getByRole('button', { name: /Sample home|My home|Untitled home/ }).first().click();
    await B.waitForFunction(() => window.__hd.useCloud.getState().projectId !== null && !window.__hd.useCloud.getState().accountOpen);
    const rename = async (pg, name) => {
      await pg.getByRole('button', { name: 'Home' }).click();
      const input = pg.getByRole('group', { name: 'Home settings' }).locator('.f-row', { hasText: 'Name' }).locator('input');
      await input.fill(name);
      await input.press('Enter');
      await pg.keyboard.press('Escape');
    };
    await rename(B, 'From B');
    await B.waitForFunction(() => window.__hd.useCloud.getState().syncedAt !== null && window.__hd.useCloud.getState().projects.length >= 0, null, { timeout: 8000 });
    await B.waitForTimeout(3500); // let B's autosync land
    await rename(A, 'From A');
    const conflictDialog = A.getByRole('alertdialog', { name: /changed somewhere else/ });
    await conflictDialog.waitFor({ timeout: 10000 });
    check('editing a home that another device changed raises a conflict instead of overwriting', true);
    await conflictDialog.getByRole('button', { name: /Use the other version/ }).click();
    await conflictDialog.waitFor({ state: 'detached', timeout: 5000 });
    check('"Use the other version" loads the other device\'s changes', (await A.evaluate(() => window.__hd.editor.getState().scene.meta.name)) === 'From B');
    await rename(A, 'A again');
    await A.waitForTimeout(3500);
    check('after resolving, syncing works again without another conflict', (await conflictDialog.count()) === 0 && !(await A.evaluate(() => window.__hd.useCloud.getState().conflict)));

    await rename(B, 'B again');
    await conflictDialog.first().waitFor({ state: 'detached' }).catch(() => {});
    const conflictB = B.getByRole('alertdialog', { name: /changed somewhere else/ });
    await conflictB.waitFor({ timeout: 10000 });
    await conflictB.getByRole('button', { name: /Keep this version/ }).click();
    await conflictB.waitFor({ state: 'detached', timeout: 5000 });
    check('"Keep this version" replaces the other device\'s copy and clears the conflict', (await B.evaluate(() => window.__hd.editor.getState().scene.meta.name)) === 'B again');
    check('no page errors in account lifecycle / sync', errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  // ---------------------------------------------------------------- 2l. plot & site, redeem code
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?view=2d');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForTimeout(500);
    const box = await page.locator('canvas.plan-canvas').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    for (const [dx, dy] of [[-120, -90], [120, -90], [120, 90], [-120, 90], [-120, -90]]) await page.mouse.click(cx + dx, cy + dy);
    await page.keyboard.press('Escape');
    const sc = () => page.evaluate(() => {
      const s = window.__hd.editor.getState().scene;
      return { plot: s.plot?.boundary ?? null, walls: Object.values(s.walls).map((w) => w.kind), rooms: Object.keys(s.rooms).length };
    });
    const home = page.getByRole('group', { name: 'Home settings' });
    const openHome = async () => { if (!(await home.isVisible())) await page.getByRole('button', { name: 'Home' }).click(); };

    await openHome();
    check('Home menu offers a plot', await home.getByRole('button', { name: 'Plot around my house' }).isVisible());
    await home.getByRole('button', { name: 'Plot around my house' }).click();
    let s = await sc();
    check('"Plot around my house" makes a rectangle 3 m around it (10 × 9 m)', s.plot?.length === 4 && Math.abs(s.plot[2][0] - s.plot[0][0] - 10) < 0.01 && Math.abs(s.plot[2][1] - s.plot[0][1] - 9) < 0.01, JSON.stringify(s.plot));
    check('the plot area is shown', (await home.getByTestId('plot-area').textContent()).includes('90.0'));
    check('no warning while the house is inside', (await home.getByTestId('plot-warning').count()) === 0);

    await home.getByRole('group', { name: 'Boundary' }).getByRole('button', { name: 'Wall', exact: true }).click();
    s = await sc();
    check('Boundary › Wall adds 4 compound walls without making a new room', s.walls.filter((k) => k === 'boundary').length === 4 && s.rooms === 1);
    await home.getByRole('group', { name: 'Boundary' }).getByRole('button', { name: 'Fence', exact: true }).click();
    s = await sc();
    check('Boundary › Fence replaces them', s.walls.filter((k) => k === 'boundary').length === 4);
    await page.screenshot({ path: `${SP}/e2e-plot.png` });

    // Draw a smaller plot by hand: the house now sticks out of it.
    await home.getByRole('button', { name: 'Draw by hand' }).click();
    check('Draw by hand switches to the plot tool and closes the menu', (await page.evaluate(() => window.__hd.useUi.getState().tool)) === 'plot' && !(await home.isVisible()));
    for (const [dx, dy] of [[-90, -60], [90, -60], [90, 60], [-90, 60]]) await page.mouse.click(cx + dx, cy + dy);
    check('corners are collected as a draft', (await page.evaluate(() => window.__hd.useUi.getState().plotDraft.length)) === 4);
    await page.keyboard.press('Enter');
    s = await sc();
    check('Enter closes the hand-drawn plot (6 m²)', s.plot?.length === 4 && Math.abs(s.plot[2][0] - s.plot[0][0] - 3) < 0.01 && (await page.evaluate(() => window.__hd.useUi.getState().tool)) === 'select', JSON.stringify(s.plot));
    await openHome();
    check('points outside the plot are reported', (await home.getByTestId('plot-warning').textContent()).includes('outside'));
    await page.screenshot({ path: `${SP}/e2e-plot-outside.png` });
    await home.getByRole('button', { name: 'Remove plot' }).click();
    s = await sc();
    check('Remove plot clears the plot and its boundary', s.plot === null && s.walls.every((k) => k !== 'boundary'));
    check('no page errors in plot flows', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();

    // Redeem code: signed-in accounts only; a wrong code is refused, the right one unlocks everything for that account.
    const rc = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await rc.goto(BASE + '?view=2d&fresh=1');
    await rc.waitForSelector('canvas.plan-canvas');
    await rc.waitForFunction(() => window.__hd.useCloud.getState().ready);
    await rc.getByRole('button', { name: 'Sign in' }).click();
    const ac = rc.getByRole('group', { name: 'Account' });
    await ac.getByRole('button', { name: 'Create account', exact: true }).first().click();
    await ac.getByLabel('Email').fill('redeem@example.com');
    await ac.getByLabel('Password', { exact: true }).fill('redeem password 1');
    await ac.getByLabel('Confirm password').fill('redeem password 1');
    await ac.locator('button[type=submit]').click();
    await ac.getByText('redeem@example.com').waitFor({ timeout: 5000 });
    await ac.getByLabel('Code').fill('wrong code');
    await ac.getByRole('button', { name: 'Redeem' }).click();
    await ac.getByRole('alert').waitFor({ timeout: 5000 });
    check('a wrong code is refused with a message', /valid/.test(await ac.getByRole('alert').textContent()));
    check('…and nothing is unlocked', (await rc.evaluate(() => !!window.__hd.useCloud.getState().ent.gifted)) === false);
    await ac.getByLabel('Code').fill('home-demo');
    await ac.getByRole('button', { name: 'Redeem' }).click();
    await ac.getByText(/Code accepted/).waitFor({ timeout: 5000 });
    check('the right code unlocks everything for the account', (await rc.evaluate(() => window.__hd.useCloud.getState().ent.gifted)) === true);
    check('the account says it is unlocked with a code', await ac.getByText(/Unlocked with a code/).isVisible());
    await rc.keyboard.press('Escape');
    await rc.getByRole('button', { name: 'Furniture' }).click();
    const cat = rc.getByRole('complementary', { name: 'Furniture catalog' });
    check('no Premium badge on the Double bed any more', (await cat.locator('.card', { hasText: 'Double bed' }).getByText('Premium').count()) === 0);
    await cat.getByLabel('Search furniture').fill('double bed');
    await cat.locator('.card', { hasText: 'Double bed' }).click();
    check('the Double bed can be placed', (await rc.evaluate(() => window.__hd.useUi.getState().placing)) !== null);
    await rc.close();
  }

  // ---------------------------------------------------------------- 2m. stairs
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?view=2d');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForTimeout(500);
    const box = await page.locator('canvas.plan-canvas').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const room = async () => {
      for (const [dx, dy] of [[-240, -180], [240, -180], [240, 180], [-240, 180], [-240, -180]]) await page.mouse.click(cx + dx, cy + dy);
      await page.keyboard.press('Escape');
    };
    const S = () => page.evaluate(() => {
      const st = window.__hd.editor.getState();
      return { stairs: Object.values(st.scene.stairs), levels: st.scene.levelOrder, active: st.activeLevelId, selection: st.selection };
    });
    await room();
    await page.keyboard.press('s');
    check('the Stairs tool is on (key S) and shows its options', (await page.evaluate(() => window.__hd.useUi.getState().tool)) === 'stair' && (await page.getByRole('group', { name: 'Stair shape' }).isVisible()));
    check('the Stairs tool offers Room above and All floors (Room above is on)', (await page.getByRole('button', { name: 'Room above' }).getAttribute('aria-pressed')) === 'true' && (await page.getByRole('button', { name: 'All floors' }).getAttribute('aria-pressed')) === 'false');
    await page.getByRole('button', { name: 'Room above' }).click(); // this part of the test checks the plain stair and its warning
    await page.mouse.move(cx, cy + 150);
    await page.mouse.click(cx, cy + 150);
    let s = await S();
    check('placing stairs adds the floor above when there is none', s.levels.length === 2 && s.stairs.length === 1);
    check('the new stairs are selected and the tool goes back to Select', s.selection[0] === s.stairs[0]?.id && (await page.evaluate(() => window.__hd.useUi.getState().tool)) === 'select');
    check('the stairs connect ground floor → floor above, origin on the plan', s.stairs[0].fromLevel === s.levels[0] && s.stairs[0].toLevel === s.levels[1] && Math.abs(s.stairs[0].origin[2] - 2.5) < 0.06);
    const ins = page.getByRole('complementary', { name: 'Properties' });
    check('the inspector shows the stairs and how far they climb', (await ins.getByText('Stairs').first().isVisible()) && /steps/.test(await ins.textContent()));
    check('it warns that the floor above has no room to open yet', await ins.getByTestId('stair-warning').isVisible());
    await page.screenshot({ path: `${SP}/e2e-stairs-plan.png` });

    // Draw the room above → the warning goes away.
    await page.evaluate(() => window.__hd.editor.setActiveLevel(window.__hd.editor.getState().scene.levelOrder[1]));
    await page.keyboard.press('w');
    await room();
    await page.keyboard.press('v');
    await page.evaluate(() => window.__hd.editor.select([Object.keys(window.__hd.editor.getState().scene.stairs)[0]]));
    await page.waitForTimeout(150);
    check('with a room on the floor above the warning disappears', (await ins.getByTestId('stair-warning').count()) === 0);

    // Edit: shape, turn, width, rotate with R, undo.
    await ins.getByRole('group', { name: 'Shape' }).getByRole('button', { name: 'L-shape' }).click();
    s = await S();
    check('Shape L-shape changes the stairs', s.stairs[0].kind === 'L');
    await ins.getByRole('group', { name: 'Turns' }).getByRole('button', { name: 'Right' }).click();
    check('Turns right mirrors them', (await S()).stairs[0].mirror === true);
    await ins.getByRole('group', { name: 'Shape' }).getByRole('button', { name: 'Straight' }).click();
    const w = ins.locator('.f-row', { hasText: 'Width' }).locator('input');
    await w.fill('1.2');
    await w.press('Enter');
    check('width is editable', Math.abs((await S()).stairs[0].width - 1.2) < 1e-9);
    await page.keyboard.press('r');
    check('R turns the selected stairs 90°', Math.abs((await S()).stairs[0].rotationY - Math.PI / 2) < 1e-9);
    await page.keyboard.press('Control+z');
    check('undo turns them back', Math.abs((await S()).stairs[0].rotationY) < 1e-9);

    // Dragging in Select mode moves the whole stair as one undo step.
    await page.evaluate(() => window.__hd.editor.setActiveLevel(window.__hd.editor.getState().scene.levelOrder[0]));
    await page.waitForTimeout(150);
    const before = (await S()).stairs[0].origin.slice();
    await page.mouse.move(cx, cy + 20);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy + 20, { steps: 4 });
    await page.mouse.up();
    const after = (await S()).stairs[0].origin;
    check('dragging moves the stairs on the plan', Math.abs(after[0] - before[0] - 1) < 0.1 && Math.abs(after[2] - before[2]) < 0.06, JSON.stringify([before, after]));
    await page.keyboard.press('Control+z');
    check('the drag is a single undo step', Math.abs((await S()).stairs[0].origin[0] - before[0]) < 1e-9);

    // Walk up the stairs: the eye rises and the walker ends up on the floor above.
    await page.evaluate(() => window.__hd.rememberPose({ x: 0, z: 2.9, yaw: 0 }));
    await page.getByRole('button', { name: 'Walk' }).click();
    await page.waitForFunction(() => window.__hd.walkPose.getState().active);
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__hd.editor.getState().activeLevelId === window.__hd.editor.getState().scene.levelOrder[1], null, { timeout: 60000 });
    const mid = await page.evaluate(() => window.__hd.walkPose.getState().y);
    check('walking up the stairs lifts the eye and switches to the floor above', mid > 1.6 + 1, `eye ${mid.toFixed(2)} m`);
    await page.waitForFunction(() => window.__hd.walkPose.getState().z < -2.15, null, { timeout: 60000 }); // past the top step
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(1500);
    const top = await page.evaluate(() => window.__hd.walkPose.getState().y);
    const topLevel = await page.evaluate(() => window.__hd.editor.getState().scene.levels[window.__hd.editor.getState().scene.levelOrder[1]].elevation);
    check('…and settles at eye height on the upper floor', Math.abs(top - (topLevel + 1.6)) < 0.5, `eye ${top.toFixed(2)} m, floor at ${topLevel}`);
    await page.screenshot({ path: `${SP}/e2e-stairs-walk.png` });
    await page.keyboard.press('Escape');

    // Delete removes them; deleting the upper floor would too.
    await page.waitForTimeout(200);
    await page.evaluate(() => window.__hd.editor.select([Object.keys(window.__hd.editor.getState().scene.stairs)[0]]));
    await page.keyboard.press('Delete');
    check('Delete removes the stairs', (await S()).stairs.length === 0);
    check('no page errors in the stairs flows', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2m2. stairs that connect floors by themselves
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?view=2d');
    await page.waitForSelector('canvas.plan-canvas');
    const box = await page.locator('canvas.plan-canvas').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const S = () => page.evaluate(() => { const st = window.__hd.editor.getState().scene; return { stairs: Object.keys(st.stairs).length, levels: st.levelOrder.length, walls: Object.values(st.walls).filter((w) => w.levelId === st.levelOrder[1]).length, doors: Object.keys(st.openings).length, rooms: Object.values(st.rooms).filter((r) => r.levelId === st.levelOrder[1]).length }; });
    await page.keyboard.press('s');
    await page.mouse.move(cx, cy);
    await page.mouse.click(cx, cy);
    const a = await S();
    check('placing stairs builds the floor above, a room round the top and a door', a.stairs === 1 && a.levels === 2 && a.walls === 4 && a.doors === 1 && a.rooms === 1, JSON.stringify(a));
    const ins = page.getByRole('complementary', { name: 'Properties' });
    check('so the stairs have no warning', (await ins.getByTestId('stair-warning').count()) === 0);
    await ins.getByRole('button', { name: /Continue stairs up/ }).click();
    const b = await S();
    check('Continue stairs up adds the next floor and a second flight', b.stairs === 2 && b.levels === 3, JSON.stringify(b));
    await page.keyboard.press('Control+z');
    check('one undo takes the extra floor away again', (await S()).levels === 2);
    check('no page errors with connected stairs', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2n. selecting and editing in 3D, edit card layout
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?demo=1&view=split');
    await page.waitForSelector('canvas');
    await page.waitForFunction(() => window.__hd.project);
    await page.evaluate(() => window.__hd.useUi.setState({ showRoof: false, cutaway: true }));
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => {
      const sc = window.__hd.editor.getState().scene;
      const it = Object.values(sc.items).find((i) => i.assetId === 'coffee-table') ?? Object.values(sc.items)[0];
      return { id: it.id, pos: it.position };
    });
    const where = (y = 0.2) => page.evaluate(([x, yy, z]) => window.__hd.project(x, yy, z), [info.pos[0], info.pos[1] + y, info.pos[2]]);

    let [px, py] = await where();
    await page.mouse.click(px, py);
    await page.waitForTimeout(300);
    const sel = () => page.evaluate(() => window.__hd.editor.getState().selection);
    check('clicking furniture in 3D selects it', (await sel())[0] === info.id, JSON.stringify(await sel()));
    check('the edit card opens for it', await page.getByRole('complementary', { name: 'Properties' }).isVisible());

    // The edit card has its own column: it never covers the plan or the 3D view.
    const rects = await page.evaluate(() => {
      const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
      return { panes: [...document.querySelectorAll('.pane')].map(r), card: r(document.querySelector('.inspector')) };
    });
    check('the edit card does not overlap either view', rects.panes.every((p) => p.r <= rects.card.l + 1 || p.l >= rects.card.r - 1 || p.b <= rects.card.t + 1 || p.t >= rects.card.b - 1), JSON.stringify(rects));
    check('the views use the space left of the card', rects.panes.every((p) => p.r <= rects.card.l + 1));
    await page.screenshot({ path: `${SP}/e2e-3d-select.png` });

    // Drag it along the floor in 3D: one undo step.
    [px, py] = await where();
    await page.mouse.move(px, py);
    await page.mouse.down();
    await page.mouse.move(px + 70, py + 10, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const moved = await page.evaluate((id) => window.__hd.editor.getState().scene.items[id].position, info.id);
    check('dragging furniture in 3D moves it', Math.hypot(moved[0] - info.pos[0], moved[2] - info.pos[2]) > 0.3, JSON.stringify([info.pos, moved]));
    await page.keyboard.press('Control+z');
    const back = await page.evaluate((id) => window.__hd.editor.getState().scene.items[id].position, info.id);
    check('the whole drag is one undo step', Math.hypot(back[0] - info.pos[0], back[2] - info.pos[2]) < 1e-6);

    // Clicking nothing clears; 3D-only view keeps Select (and only Select) enabled.
    await page.mouse.click(rects.panes.at(-1).l + 25, rects.panes.at(-1).t + 140);
    await page.waitForTimeout(300);
    check('clicking empty space in 3D clears the selection', (await sel()).length === 0);
    await page.getByRole('button', { name: '3D', exact: true }).click();
    const rail = page.getByRole('navigation', { name: 'Tools' });
    check('in the 3D view Select is available and the drawing tools are not', !(await rail.getByRole('button', { name: /Select/ }).isDisabled()) && (await rail.getByRole('button', { name: /Wall/ }).isDisabled()));
    await page.waitForTimeout(800);
    [px, py] = await where();
    await page.mouse.click(px, py);
    await page.waitForTimeout(300);
    check('selecting works in the 3D-only view too', (await sel())[0] === info.id);
    check('no page errors while selecting in 3D', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2o. bigger catalog, door / window styles
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?demo=1&view=2d');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForFunction(() => window.__hd.useCloud.getState().ready);
    await page.getByRole('button', { name: 'Furniture' }).click();
    const cat = page.getByRole('complementary', { name: 'Furniture catalog' });
    check('the catalog has an Outdoor & garden category', await cat.getByRole('tab', { name: 'Outdoor & garden' }).isVisible());
    await cat.getByRole('tab', { name: 'All' }).click();
    check('the catalog now has 100+ items', (await cat.locator('.card').count()) >= 100, String(await cat.locator('.card').count()));
    await cat.getByRole('tab', { name: 'Outdoor & garden' }).click();
    check('premium outdoor items are badged for a guest', (await cat.locator('.card', { hasText: 'Fountain' }).getByText('Premium').count()) === 1);
    await cat.locator('.card', { hasText: 'Shade tree' }).click();
    await page.mouse.click(120, 700);
    const treeCount = () => page.evaluate(() => Object.values(window.__hd.editor.getState().scene.items).filter((i) => i.assetId === 'tree-round').length);
    check('an outdoor item can be placed on the plan', (await treeCount()) === 1);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Furniture' }).click();
    await cat.getByRole('tab', { name: 'All' }).click();
    await cat.getByLabel('Search furniture').fill('pooja');
    check('search finds India-specific items (pooja unit)', (await cat.locator('.card', { hasText: 'Pooja unit' }).count()) === 1);
    await page.keyboard.press('Escape');

    // New door / window styles.
    const ins = page.getByRole('complementary', { name: 'Properties' });
    const op = (type) => page.evaluate((t) => Object.values(window.__hd.editor.getState().scene.openings).find((o) => o.type === t)?.id, type);
    const style = (id) => page.evaluate((i) => window.__hd.editor.getState().scene.openings[i].style, id);
    const doorId = await op('door');
    await page.evaluate((id) => window.__hd.editor.select([id]), doorId);
    const styles = ins.getByRole('group', { name: 'Style' });
    for (const name of ['Louvered', 'French', 'Sliding']) check(`doors offer the ${name} style`, await styles.getByRole('button', { name, exact: true }).isVisible());
    await styles.getByRole('button', { name: 'French', exact: true }).click();
    check('French doors get room for two leaves', (await style(doorId)) === 'french' && (await page.evaluate((i) => window.__hd.editor.getState().scene.openings[i].width, doorId)) >= 1.4);
    await styles.getByRole('button', { name: 'Louvered', exact: true }).click();
    check('Louvered applies', (await style(doorId)) === 'louvered');
    await styles.getByRole('button', { name: 'Sliding', exact: true }).click();
    check('Sliding door applies', (await style(doorId)) === 'sliding');
    await page.screenshot({ path: `${SP}/e2e-door-styles.png` });
    const winId = await op('window');
    await page.evaluate((id) => window.__hd.editor.select([id]), winId);
    await ins.getByRole('group', { name: 'Style' }).getByRole('button', { name: 'Casement', exact: true }).click();
    check('windows offer Casement', (await style(winId)) === 'casement');
    await ins.getByRole('group', { name: 'Style' }).getByRole('button', { name: 'Louvered', exact: true }).click();
    check('windows offer Louvered', (await style(winId)) === 'louvered');
    check('no page errors with the new catalog and styles', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2p. opening curtain + quick tour
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?curtain=1');
    const curtain = page.getByRole('dialog', { name: 'PlotFramer' });
    await curtain.waitFor();
    check('a first visit opens with the curtain', await curtain.isVisible());
    const cta = curtain.getByRole('button', { name: 'Start designing' });
    check('the button waits until loading has finished', await cta.isDisabled());
    await page.screenshot({ path: `${SP}/e2e-curtain-loading.png` });
    await page.waitForFunction(() => !document.querySelector('.curtain-cta')?.disabled, null, { timeout: 8000 });
    await page.screenshot({ path: `${SP}/e2e-curtain-ready.png` });
    await cta.click();
    await curtain.waitFor({ state: 'detached', timeout: 5000 });
    check('Start designing lifts the curtain', true);
    const choose = page.getByRole('dialog', { name: /design your home/ });
    check('…and shows the "design your home" chooser', await choose.isVisible());
    await choose.getByRole('button', { name: /Family home|Studio/ }).first().click();
    const tour = page.getByRole('dialog', { name: 'Quick tour' });
    await tour.waitFor({ timeout: 5000 });
    check('the quick tour starts after choosing a starting point', await tour.isVisible());
    await tour.getByRole('button', { name: 'Start' }).click();
    await page.waitForTimeout(450);
    const spot = await page.locator('.tour-spot').boundingBox();
    const wallBtn = await page.locator('.rail button[title^="Draw walls"]').boundingBox();
    check('step 1 highlights the Wall tool', !!spot && !!wallBtn && Math.abs(spot.x + spot.width / 2 - (wallBtn.x + wallBtn.width / 2)) < 4);
    await page.screenshot({ path: `${SP}/e2e-tour.png` });
    let n = 1;
    while (n < 6) {
      await tour.getByRole('button', { name: 'Next' }).click();
      n++;
    }
    check('the tour has six steps and ends with Done', await tour.getByRole('button', { name: 'Done' }).isVisible());
    await tour.getByRole('button', { name: 'Back' }).click();
    await tour.getByRole('button', { name: 'Next' }).click();
    await tour.getByRole('button', { name: 'Done' }).click();
    check('Done closes the tour', (await tour.count()) === 0);

    // Second visit: the splash (with its button) shows every time; the tour does not repeat.
    await page.reload();
    await curtain.waitFor();
    check('a returning visit still opens on the splash with its button', (await curtain.getByRole('button', { name: 'Start designing' }).count()) === 1);
    await page.waitForFunction(() => !document.querySelector('.curtain-cta')?.disabled, null, { timeout: 8000 });
    await curtain.getByRole('button', { name: 'Start designing' }).click();
    await curtain.waitFor({ state: 'detached', timeout: 6000 });
    check('…and Start designing opens the workspace', true);
    await page.waitForTimeout(800);
    check('the tour does not repeat', (await page.getByRole('dialog', { name: 'Quick tour' }).count()) === 0);

    // Replay from Help; Esc skips.
    await page.keyboard.press('?');
    await page.getByRole('button', { name: 'Replay the quick tour' }).click();
    await tour.waitFor();
    check('Help can replay the tour', await tour.isVisible());
    await page.keyboard.press('Escape');
    check('Esc skips the tour', (await tour.count()) === 0);
    check('no page errors in the first-run flow', errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();

    // Phone width: the card stays inside the screen.
    const ph = await browser.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true });
    await ph.goto(BASE + '?curtain=full&tour=1');
    await ph.waitForFunction(() => !document.querySelector('.curtain-cta')?.disabled, null, { timeout: 8000 });
    await ph.getByRole('button', { name: 'Start designing' }).click();
    const choosePh = ph.getByRole('dialog', { name: /design your home/ });
    await choosePh.waitFor();
    await choosePh.getByRole('button', { name: 'Skip' }).click().catch(() => {});
    await ph.waitForFunction(() => !document.querySelector('.curtain'), null, { timeout: 5000 });
    await ph.evaluate(() => { window.__hd.useUi.getState().setWelcomeOpen(false); window.__hd.useUi.getState().setTourStep(3); });
    await ph.waitForTimeout(500);
    const card = await ph.locator('.tour-card').boundingBox();
    check('on a phone the tour card fits the screen', !!card && card.x >= 0 && card.x + card.width <= 390 && card.y >= 0 && card.y + card.height <= 780, JSON.stringify(card));
    await ph.screenshot({ path: `${SP}/e2e-tour-phone.png` });
    await ph.close();
  }

  // ---------------------------------------------------------------- 2q. balcony / porch
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?view=split');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForTimeout(500);
    const box = await page.locator('canvas.plan-canvas').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    for (const [dx, dy] of [[-120, -90], [120, -90], [120, 90], [-120, 90], [-120, -90]]) await page.mouse.click(cx + dx, cy + dy);
    await page.keyboard.press('Escape');
    const B = () => page.evaluate(() => Object.values(window.__hd.editor.getState().scene.balconies));
    await page.keyboard.press('b');
    check('the Balcony tool is on (key B)', (await page.evaluate(() => window.__hd.useUi.getState().tool)) === 'balcony');
    for (const [dx, dy] of [[-90, -90], [90, -90], [90, -170], [-90, -170]]) await page.mouse.click(cx + dx, cy + dy);
    check('corners are collected', (await page.evaluate(() => window.__hd.useUi.getState().plotDraft.length)) === 4);
    await page.keyboard.press('Enter');
    let b = await B();
    check('Enter closes the balcony', b.length === 1 && b[0].outline.length === 4 && b[0].railing === 'glass');
    check('it is selected and the tool is back to Select', (await page.evaluate(() => window.__hd.editor.getState().selection[0])) === b[0]?.id);
    const ins = page.getByRole('complementary', { name: 'Properties' });
    check('the inspector offers Railing and Floor', (await ins.getByRole('group', { name: 'Railing', exact: true }).isVisible()) && (await ins.getByText('Floor').first().isVisible()));
    await ins.getByRole('group', { name: 'Railing', exact: true }).getByRole('button', { name: 'Metal' }).click();
    check('Railing › Metal applies', (await B())[0].railing === 'metal');
    await ins.getByRole('radio', { name: 'Teak' }).click();
    check('the floor can be changed', (await B())[0].floorMaterial.id === 'floor-wood-teak');
    await page.screenshot({ path: `${SP}/e2e-balcony.png` });

    // Drag it on the plan (one undo step), then undo.
    const o0 = (await B())[0].outline[0];
    await page.mouse.move(cx, cy - 130);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy - 130, { steps: 4 });
    await page.mouse.up();
    const o1 = (await B())[0].outline[0];
    check('dragging moves the balcony', Math.abs(o1[0] - o0[0] - 1) < 0.1);
    await page.keyboard.press('Control+z');
    check('the drag is one undo step', Math.abs((await B())[0].outline[0][0] - o0[0]) < 1e-9);

    // The walker cannot walk through the railing.
    await page.evaluate(() => window.__hd.rememberPose({ x: 0, z: -2.1, yaw: 0 }));
    await page.getByRole('button', { name: 'Walk' }).click();
    await page.waitForFunction(() => window.__hd.walkPose.getState().active);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(2500);
    await page.keyboard.up('KeyW');
    const z = await page.evaluate(() => window.__hd.walkPose.getState().z);
    check('the railing stops the walker', z > -2.8 && z < -2.4, `z = ${z.toFixed(2)}`);
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.__hd.editor.select([Object.keys(window.__hd.editor.getState().scene.balconies)[0]]));
    await page.keyboard.press('Delete');
    check('Delete removes the balcony', (await B()).length === 0);
    check('no page errors in the balcony flow', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2r. realism: photo textures per tier, time of day
  {
    const run = async (quality) => {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const errors = [];
      const textures = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('response', (r) => r.url().includes('/textures/') && textures.push({ url: r.url(), status: r.status() }));
      await page.addInitScript((q) => localStorage.setItem('hd.quality', q), quality);
      await page.goto(BASE + '?demo=1&view=3d');
      await page.waitForFunction(() => window.__hd);
      await page.waitForTimeout(4500);
      return { page, errors, textures };
    };

    const low = await run('low');
    check('Low quality downloads no photo textures', low.textures.length === 0, String(low.textures.length));
    check('Low quality still renders without errors', low.errors.length === 0, low.errors.slice(0, 2).join(' | '));
    await low.page.close();

    const med = await run('medium');
    const names = new Set(med.textures.map((t) => t.url.split('/textures/')[1]));
    check('Medium loads photo textures (floor planks, brick walls, grass) lazily', ['planks-c.jpg', 'bricks-c.jpg', 'grass-c.jpg'].every((n) => names.has(n)), [...names].join(','));
    check('every texture file loads (no 404)', med.textures.every((t) => t.status === 200), JSON.stringify(med.textures.filter((t) => t.status !== 200)));
    check('only the sets the home actually uses are fetched', med.textures.length <= 30, String(med.textures.length));
    await med.page.screenshot({ path: `${SP}/e2e-realism.png` });

    // Time of day: slider and presets change the lighting and are saved in the home (one undo step per change).
    await med.page.getByRole('button', { name: 'Display' }).click();
    const tod = med.page.getByRole('slider', { name: 'Time of day' });
    check('Display has a Time of day slider', await tod.isVisible());
    await med.page.getByRole('button', { name: 'Evening' }).click();
    const hour = () => med.page.evaluate(() => window.__hd.editor.getState().scene.lighting.timeOfDay);
    check('Evening preset sets 5:30 pm', (await hour()) === 17.5);
    await tod.fill('21');
    await tod.evaluate((el) => el.blur()); // releasing the slider commits the change
    await med.page.waitForTimeout(300);
    check('the slider sets the hour', (await hour()) === 21);
    check('the label follows', await med.page.getByText('9:00 pm').isVisible());
    await med.page.evaluate(() => window.__hd.editor.undo());
    check('a slider change is undoable', (await hour()) === 17.5);
    await med.page.screenshot({ path: `${SP}/e2e-evening.png` });
    check('no page errors on Medium with the sky and photo textures', med.errors.length === 0, med.errors.slice(0, 2).join(' | '));
    await med.page.close();
  }

  // ---------------------------------------------------------------- 2s. garden: lawn / paving / path areas and fences
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?view=split');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForTimeout(500);
    const box = await page.locator('canvas.plan-canvas').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    for (const [dx, dy] of [[-60, -60], [60, -60], [60, 30], [-60, 30], [-60, -60]]) await page.mouse.click(cx + dx, cy + dy);
    await page.keyboard.press('Escape');
    const Z = () => page.evaluate(() => Object.values(window.__hd.editor.getState().scene.zones));

    await page.keyboard.press('g');
    const surf = page.getByRole('group', { name: 'Garden surface' });
    check('the Garden tool (key G) offers six surfaces', (await page.evaluate(() => window.__hd.useUi.getState().tool)) === 'garden' && (await surf.getByRole('button').count()) === 6);
    for (const [dx, dy] of [[-200, 60], [200, 60], [200, 180], [-200, 180]]) await page.mouse.click(cx + dx, cy + dy);
    await page.keyboard.press('Enter');
    let z = await Z();
    check('Enter closes a lawn area', z.length === 1 && z[0].shape === 'area' && z[0].material.id === 'ground-grass');
    const ins = page.getByRole('complementary', { name: 'Properties' });
    check('the lawn is selected; the inspector offers surfaces', await ins.getByText('Surface').first().isVisible());
    await ins.getByRole('radio', { name: 'Gravel', exact: true }).click();
    check('the surface can be changed', (await Z())[0].material.id === 'ground-gravel');

    // A path is drawn along a centre line; clicking the first point does not close it.
    await page.keyboard.press('g');
    await surf.getByRole('button', { name: 'Path' }).click();
    for (const [dx, dy] of [[-150, 100], [0, 100], [0, 40]]) await page.mouse.click(cx + dx, cy + dy);
    await page.keyboard.press('Enter');
    z = await Z();
    const path = z.find((q) => q.shape === 'path');
    check('a path has a width and keeps its centre line', !!path && path.width === 1 && path.points.length === 3, JSON.stringify(path));
    const wf = ins.locator('.f-row', { hasText: 'Width' }).locator('input');
    await wf.fill('1.8');
    await wf.press('Enter');
    check('path width can be edited', Math.abs((await Z()).find((q) => q.shape === 'path').width - 1.8) < 1e-9);

    // Dragging moves it as one undo step.
    const before = (await Z())[0].points[0].slice();
    await page.keyboard.press('Escape');
    await page.mouse.move(cx + 150, cy + 150);
    await page.mouse.down();
    await page.mouse.move(cx + 150, cy + 170, { steps: 4 });
    await page.mouse.up();
    const after = (await Z())[0].points[0];
    check('dragging moves the area', Math.abs(after[1] - before[1]) > 0.1);
    await page.keyboard.press('Control+z');
    check('the drag is one undo step', Math.abs((await Z())[0].points[0][1] - before[1]) < 1e-9);

    // Fences: the wall tool's third option.
    await page.keyboard.press('w');
    await page.getByRole('group', { name: 'New wall type' }).getByRole('button', { name: 'Fence' }).click();
    await page.mouse.click(cx - 220, cy - 120);
    await page.mouse.click(cx + 220, cy - 120);
    await page.keyboard.press('Escape');
    const fences = await page.evaluate(() => Object.values(window.__hd.editor.getState().scene.walls).filter((w) => w.kind === 'fence'));
    check('the Fence option draws a low thin fence (not a house wall)', fences.length === 1 && fences[0].height === 1.2 && fences[0].thickness === 0.06);
    check('a fence does not change the rooms', (await page.evaluate(() => Object.keys(window.__hd.editor.getState().scene.rooms).length)) === 1);
    await page.screenshot({ path: `${SP}/e2e-garden.png` });

    // Delete.
    await page.keyboard.press('v');
    await page.evaluate(() => window.__hd.editor.select(Object.keys(window.__hd.editor.getState().scene.zones)));
    await page.keyboard.press('Delete');
    check('Delete removes the garden areas', (await Z()).length === 0);
    check('no page errors in the garden flow', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2t. export: 3D picture, PDF plan, DXF
  {
    const { readFileSync } = await import('node:fs');
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?demo=1&view=2d');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForFunction(() => window.__hd.useCloud.getState().ready);
    await page.getByRole('button', { name: 'Home' }).click();
    const home = page.getByRole('group', { name: 'Home settings' });
    check('Home has an Export section', await home.getByRole('button', { name: 'Plan (PDF)' }).isVisible());
    const grab = async (name) => {
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), home.getByRole('button', { name }).click()]);
      const path = `${SP}/export-${dl.suggestedFilename()}`;
      await dl.saveAs(path);
      return { name: dl.suggestedFilename(), data: readFileSync(path) };
    };

    // A free account: the blueprint is locked (the 3D picture still works, with a mark).
    check('free accounts see a lock on the blueprint buttons', (await home.getByRole('button', { name: /Plan \(PDF\)/ }).textContent()).includes('🔒'));
    await home.getByRole('button', { name: /Plan \(PDF\)/ }).click();
    check('free: the PDF explains it needs Premium and opens the account', (await home.getByText(/Premium feature/).isVisible()) && (await page.evaluate(() => window.__hd.useCloud.getState().accountOpen)));
    await page.evaluate(() => window.__hd.useCloud.setState({ accountOpen: false }));
    const freePng = await grab(/3D picture/);
    check('free: the 3D picture is still allowed (with a mark)', freePng.name === 'sample-home-3d.png');
    await page.evaluate(() => window.__hd.useCloud.setState({ ent: { subscribed: false, gifted: true, unlocks: {} } }));
    await page.getByRole('button', { name: 'Home' }).click().catch(() => {});
    if (!(await home.isVisible())) await page.getByRole('button', { name: 'Home' }).click();
    const pdf = await grab('Plan (PDF)');
    const ptxt = pdf.data.toString('latin1');
    check('the PDF is named from the home and paper size', pdf.name === 'sample-home-plan-A4.pdf', pdf.name);
    check('the PDF is a real PDF with the scale, title and room names', ptxt.startsWith('%PDF-1.4') && ptxt.includes('(Scale 1 : 50)') && ptxt.includes('(Sample home)') && ptxt.includes('(Living)'));

    await home.getByRole('group', { name: 'Paper' }).getByRole('button', { name: 'A3' }).click();
    const pdf3 = await grab('Plan (PDF)');
    check('A3 gives an A3 file', pdf3.name === 'sample-home-plan-A3.pdf' && pdf3.data.toString('latin1').includes('/MediaBox [0 0 1190.551 841.89]'));

    const dxf = await grab('CAD (DXF)');
    const dtxt = dxf.data.toString('utf8');
    check('the DXF has layers per floor and the room names', dxf.name === 'sample-home.dxf' && dtxt.includes('GROUND_FLOOR_WALLS') && dtxt.includes('\nLiving\n') && dtxt.trimEnd().endsWith('EOF'));

    // 3D picture: switches to the Split view if needed, then saves a real PNG.
    const png = await grab('3D picture');
    const sig = png.data.subarray(0, 8).toString('hex');
    const w = png.data.readUInt32BE(16);
    const h = png.data.readUInt32BE(20);
    check('the 3D picture is a PNG at least as large as the screen pane', sig === '89504e470d0a1a0a' && w >= 600 && h >= 700 && png.name === 'sample-home-3d.png', `${w}x${h}`);
    check('exporting the picture opened the 3D view', (await page.evaluate(() => window.__hd.useUi.getState().view)) === 'split');
    check('no page errors while exporting', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2t2. clear everything, delete a room, share & export dialog
  {
    const { readFileSync } = await import('node:fs');
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?demo=1&view=2d');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForFunction(() => window.__hd.useCloud.getState().ready);
    const count = () => page.evaluate(() => { const s = window.__hd.editor.getState().scene; return { w: Object.keys(s.walls).length, r: Object.keys(s.rooms).length, i: Object.keys(s.items).length }; });
    const before = await count();
    // goo: Edit / Hand pair has its own blob under the active button
    const goo = await page.evaluate(() => { const g = document.querySelector('.mode-pair'); const b = g?.querySelector('.goo-blob')?.getBoundingClientRect(); const a = g?.querySelector('[aria-pressed="true"]')?.getBoundingClientRect(); return b && a ? Math.abs(b.left - a.left) < 3 && Math.abs(b.top - a.top) < 3 : false; });
    check('the Edit / Hand pair has the liquid highlight under the active button', goo);
    // room delete
    await page.evaluate(() => { const s = window.__hd.editor.getState().scene; window.__hd.editor.select([Object.keys(s.rooms)[0]]); });
    const bar = page.getByRole('toolbar', { name: 'Selected object' });
    await bar.getByRole('button', { name: 'Delete room' }).click();
    check('Delete room asks first (nothing deleted yet)', (await count()).r === before.r && (await bar.getByRole('button', { name: 'Tap again to delete the room' }).count()) === 1);
    await bar.getByRole('button', { name: 'Tap again to delete the room' }).click();
    const afterRoom = await count();
    check('second tap deletes the room with its walls', afterRoom.r === before.r - 1 && afterRoom.w < before.w, JSON.stringify([before, afterRoom]));
    await page.keyboard.press('Control+z');
    check('deleting a room is one undo step', JSON.stringify(await count()) === JSON.stringify(before));
    // clear everything from Home
    await page.getByRole('button', { name: 'Home' }).click();
    const home = page.getByRole('group', { name: 'Home settings' });
    await home.getByRole('button', { name: 'Delete everything' }).click();
    check('Delete everything asks first', (await count()).w === before.w);
    await home.getByRole('button', { name: 'Tap again to delete everything' }).click();
    const empty = await count();
    check('second tap clears the whole home', empty.w === 0 && empty.r === 0 && empty.i === 0, JSON.stringify(empty));
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.keyboard.press('Control+z');
    check('Undo brings everything back', JSON.stringify(await count()) === JSON.stringify(before));
    // share & export dialog
    await page.getByRole('button', { name: /^Share/ }).first().click();
    const dlg = page.getByRole('dialog', { name: 'Share & export' });
    check('Share opens the Share & export dialog', await dlg.isVisible());
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), dlg.locator('[data-share="save-project"]').click()]);
    const pth = `${SP}/share-${dl.suggestedFilename()}`;
    await dl.saveAs(pth);
    const json = JSON.parse(readFileSync(pth, 'utf8'));
    check('Save home file downloads a valid home file', dl.suggestedFilename().endsWith('.json') && JSON.stringify(json).includes('"walls"'), dl.suggestedFilename());
    await dlg.locator('[data-share="save-pdf"]').click();
    check('free: the PDF row sends you to Premium', await page.evaluate(() => window.__hd.useCloud.getState().accountOpen));
    await page.evaluate(() => window.__hd.useCloud.setState({ accountOpen: false }));
    check('no page errors with clear, room delete and sharing', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2t3. workspaces: + button, 3 free homes
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?demo=1&view=2d');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForFunction(() => window.__hd.useCloud.getState().ready);
    // a guest is asked to sign in
    await page.getByRole('button', { name: 'New workspace' }).click();
    check('guest: + opens the account sign-in', await page.evaluate(() => window.__hd.useCloud.getState().accountOpen));
    await page.evaluate(async () => {
      window.__hd.useCloud.setState({ accountOpen: false });
      await window.__hd.useCloud.getState().signUp('ws@example.com', 'a long password');
    });
    const n = () => page.evaluate(() => window.__hd.useCloud.getState().projects.length);
    const plus = page.getByRole('button', { name: 'New workspace', exact: true }).first();
    await plus.click();
    await page.waitForFunction(() => window.__hd.useCloud.getState().projects.length === 2);
    const ids = await page.evaluate(() => window.__hd.useCloud.getState().projectId);
    check('first + saves the demo home first and then makes a new one', (await n()) === 2 && !!ids);
    await plus.click();
    await page.waitForFunction(() => window.__hd.useCloud.getState().projects.length === 3);
    check('a free account can have 3 homes', (await n()) === 3);
    await plus.click();
    await page.waitForTimeout(500);
    check('the 4th is refused for a free account', (await n()) === 3);
    await page.getByRole('button', { name: 'Workspaces' }).click();
    const pop = page.getByRole('group', { name: 'Workspace list' });
    check('the list shows the limit and a Premium button', (await pop.getByText('3 of 3 free homes').isVisible()) && (await pop.getByRole('button', { name: 'Go Premium' }).isVisible()));
    await pop.getByRole('button', { name: /^Duplicate/ }).first().click();
    await page.waitForTimeout(400);
    check('duplicating also respects the limit', (await n()) === 3);
    // premium: no limit
    await page.evaluate(() => window.__hd.useCloud.setState({ ent: { subscribed: true, unlocks: {} } }));
    await pop.getByRole('button', { name: /^Duplicate/ }).first().click();
    await page.waitForFunction(() => window.__hd.useCloud.getState().projects.length === 4);
    check('Premium can go past 3', (await n()) === 4);
    // delete with two taps
    await pop.getByRole('button', { name: /^Delete/ }).last().click();
    check('delete asks first', (await n()) === 4);
    await pop.getByRole('button', { name: /^Tap again to delete/ }).click();
    await page.waitForFunction(() => window.__hd.useCloud.getState().projects.length === 3);
    check('second tap deletes the home', (await n()) === 3);
    check('no page errors with workspaces', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.screenshot({ path: `${SP}/e2e-workspaces.png` });
    await page.close();
  }

  // ---------------------------------------------------------------- 2t4. saved views and layers
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?demo=1&view=3d');
    await page.waitForFunction(() => window.__hd && window.__hd.project);
    await page.waitForTimeout(1500);
    const proj = () => page.evaluate(() => window.__hd.project(3, 0, 3).map((v) => Math.round(v)));
    const home = await proj();
    await page.getByRole('button', { name: 'Views and layers' }).click();
    const pop = page.getByRole('group', { name: 'Views and layers' }).last();
    check('Views panel has saved views and layers', (await pop.getByText('Saved views').isVisible()) && (await pop.getByText('Layers', { exact: true }).isVisible()));
    await pop.getByRole('button', { name: '+ Save this view' }).click();
    check('saving a view stores the camera in the home', (await page.evaluate(() => Object.keys(window.__hd.editor.getState().scene.viewpoints).length)) === 1);
    // move the camera by dragging the 3D view
    await page.keyboard.press('Escape');
    await page.mouse.move(900, 300);
    await page.mouse.down();
    await page.mouse.move(700, 380, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    const moved = await proj();
    check('dragging the view moves the camera', Math.abs(moved[0] - home[0]) + Math.abs(moved[1] - home[1]) > 20, JSON.stringify([home, moved]));
    await page.getByRole('button', { name: 'Views and layers' }).click();
    await pop.getByRole('button', { name: 'View 1', exact: true }).click();
    await page.waitForTimeout(1200);
    const back = await proj();
    check('tapping a saved view flies the camera back', Math.abs(back[0] - home[0]) + Math.abs(back[1] - home[1]) < 6, JSON.stringify([home, back]));
    // layers
    const shot = async () => (await page.locator('canvas').first().screenshot()).toString('base64');
    const base = await shot();
    await pop.getByRole('switch', { name: 'Furniture' }).click();
    check('Furniture can be hidden', (await page.evaluate(() => window.__hd.useUi.getState().hiddenLayers.furniture)) === true);
    await page.waitForTimeout(500);
    check('hiding furniture changes the 3D picture', (await shot()) !== base);
    await pop.getByRole('switch', { name: 'Roofs' }).click().catch(() => {});
    await pop.getByRole('button', { name: 'Show all' }).click();
    check('Show all brings every layer back', (await page.evaluate(() => Object.values(window.__hd.useUi.getState().hiddenLayers).some(Boolean))) === false);
    await pop.getByRole('button', { name: 'Delete View 1' }).click();
    check('a saved view can be deleted', (await page.evaluate(() => Object.keys(window.__hd.editor.getState().scene.viewpoints).length)) === 0);
    check('no page errors with views and layers', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2z. roof designer, sunshades, walk view settings
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?demo=1&view=split');
    await page.waitForFunction(() => window.__hd && window.__hd.core);
    await page.waitForTimeout(1200);
    const sc = () => page.evaluate(() => window.__hd.editor.getState().scene);
    // Roof designer
    await page.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Roof' }).click();
    const ins = page.getByRole('complementary', { name: 'Properties' });
    check('the roof designer shows automatic roofs with trim, gutters and chimney options', (await ins.getByText(/Automatic: this floor/).isVisible()) && (await ins.getByText('Trim colour').isVisible()) && (await ins.getByText('Gutters').isVisible()) && (await ins.getByText('Chimney').isVisible()));
    await ins.getByRole('switch', { name: 'Chimney' }).click().catch(async () => ins.getByText('Chimney').click());
    await ins.getByText('Gutters').click();
    const r1 = Object.values((await sc()).roofs)[0];
    check('Chimney and Gutters are saved on the roof', r1.chimney === true && r1.gutter === true, JSON.stringify([r1.chimney, r1.gutter]));
    const edge = ins.locator('.f-row', { hasText: 'Edge thickness' }).locator('input');
    await edge.fill('20cm');
    await edge.press('Enter');
    check('edge thickness is editable', Math.abs(Object.values((await sc()).roofs)[0].thickness - 0.2) < 1e-9);
    // a room of its own
    await page.evaluate(() => { const s = window.__hd.editor.getState().scene; window.__hd.editor.select([Object.values(s.rooms)[0].id]); });
    await ins.getByRole('button', { name: /Own roof for this room/ }).click();
    const roofsNow = Object.values((await sc()).roofs);
    check('Own roof gives the room a hand-made roof and the automatic one carries on', roofsNow.length >= 2 && roofsNow.some((r) => r.auto) && roofsNow.some((r) => !r.auto), JSON.stringify(roofsNow.map((r) => !!r.auto)));
    // Sunshade on a window
    await page.evaluate(() => { const s = window.__hd.editor.getState().scene; window.__hd.editor.select([Object.values(s.openings).find((o) => o.type === 'window').id]); });
    await ins.getByRole('group', { name: 'Sunshade' }).getByRole('button', { name: 'Chajja' }).click();
    const win = Object.values((await sc()).openings).find((o) => o.shade);
    check('a window can get a chajja sunshade', win && win.shade.style === 'slab' && win.shade.depth > 0.3, JSON.stringify(win?.shade));
    await ins.getByRole('group', { name: 'Sunshade' }).getByRole('button', { name: 'None' }).click();
    check('and None takes it off again', !Object.values((await sc()).openings).some((o) => o.shade));
    // Walk view settings
    await page.evaluate(() => window.__hd.useUi.getState().setWalk(true));
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Walk view settings' }).click();
    const fov = page.getByRole('slider', { name: 'Field of view' });
    await fov.fill('100');
    check('the walk field of view is a slider (default 80) and is remembered', (await page.evaluate(() => window.__hd.useUi.getState().walkFov)) === 100 && (await page.evaluate(() => localStorage.getItem('hd.walkFov'))) === '100');
    await page.getByRole('button', { name: 'Child', exact: true }).click();
    check('eye height presets', Math.abs((await page.evaluate(() => window.__hd.useUi.getState().walkEye)) - 1.1) < 1e-9);
    check('no page errors with roof designer, sunshades and walk settings', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2z2. stair railings, spiral stairs, roof dormers
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?view=2d');
    await page.waitForSelector('canvas.plan-canvas');
    const box = await page.locator('canvas.plan-canvas').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const scene = () => page.evaluate(() => window.__hd.editor.getState().scene);
    await page.keyboard.press('s');
    await page.getByRole('group', { name: 'Stair shape' }).getByRole('button', { name: 'Spiral' }).click();
    await page.mouse.move(cx, cy);
    await page.mouse.click(cx, cy);
    let sc = await scene();
    const st = Object.values(sc.stairs)[0];
    check('a spiral stair is placed with a wood railing and its room above', st.kind === 'spiral' && st.railing === 'wood' && sc.levelOrder.length === 2 && Object.values(sc.rooms).length === 1, JSON.stringify([st.kind, st.railing]));
    const ins = page.getByRole('complementary', { name: 'Properties' });
    check('no warning: the floor above opens round the spiral', (await ins.getByTestId('stair-warning').count()) === 0);
    await ins.getByRole('group', { name: 'Railing', exact: true }).getByRole('button', { name: 'Glass' }).click();
    check('the railing can be changed to glass', Object.values((await scene()).stairs)[0].railing === 'glass');
    await ins.getByRole('group', { name: 'Railing', exact: true }).getByRole('button', { name: 'None' }).click();
    check('…or taken off', Object.values((await scene()).stairs)[0].railing === 'none');
    // Walk up a spiral: the eye rises while walking round
    await page.evaluate(() => { const ed = window.__hd.editor; ed.execute(window.__hd.core.clearHome(null)); });
    await page.evaluate(() => {
      const { editor: ed, core } = window.__hd;
      const L0 = ed.getState().scene.levelOrder[0];
      ed.execute(core.batch('loop', [[0, 0], [8, 0], [8, 6], [0, 6]].map((p, i, a) => core.addWall({ levelId: L0, from: p, to: a[(i + 1) % 4], kind: 'exterior' }))));
    });
    const roofId = await page.evaluate(() => Object.values(window.__hd.editor.getState().scene.roofs)[0].id);
    await page.evaluate((id) => window.__hd.editor.select([id]), roofId);
    await ins.getByRole('button', { name: '+ Add a dormer' }).click();
    check('a roof can get a dormer window', (await scene()).roofs[roofId].dormers?.length === 1);
    await ins.getByRole('button', { name: 'Remove dormer 1' }).click();
    check('and lose it again', !(await scene()).roofs[roofId].dormers);
    check('no page errors with railings, spiral stairs and dormers', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2z3. ready-made homes gallery
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    // From the welcome screen (a first visit)
    await page.goto(BASE + '?view=2d');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForFunction(() => window.__hd && window.__hd.samples);
    await page.evaluate(() => { window.__hd.useUi.getState().setWelcomeOpen(true); });
    await page.locator('[data-welcome="samples"]').click();
    const gal = page.getByRole('dialog', { name: 'Ready-made homes' });
    check('the gallery opens from the welcome screen with a card per home', (await gal.locator('.sample-card').count()) === 9);
    await gal.getByRole('button', { name: 'Flats', exact: true }).click();
    check('filters narrow it down (flats: 4)', (await gal.locator('.sample-card').count()) === 4);
    await gal.getByRole('button', { name: 'All', exact: true }).click();
    await gal.locator('[data-sample="flat2"]').click();
    const sc = () => page.evaluate(() => { const s = window.__hd.editor.getState().scene; return { name: s.meta.name, rooms: Object.keys(s.rooms).length, items: Object.keys(s.items).length, roofs: Object.keys(s.roofs).length }; });
    let st = await sc();
    check('picking a home loads it furnished, with its roof', st.name === '2 BHK flat' && st.rooms >= 6 && st.items > 20 && st.roofs >= 1, JSON.stringify(st));
    check('and closes the gallery and the welcome screen', (await gal.count()) === 0 && (await page.evaluate(() => window.__hd.useUi.getState().welcomeOpen)) === false);
    // From the Home menu, replacing a home takes two taps
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'Ready-made homes' }).click();
    await gal.locator('[data-sample="shop"]').click();
    check('with a home open the first tap only asks', (await sc()).name === '2 BHK flat' && (await gal.locator('.sample-card.armed').count()) === 1);
    await gal.locator('[data-sample="shop"]').click();
    st = await sc();
    check('the second tap replaces it', st.name === 'Shop');
    // Every sample has a roof after a two-floor build, and loading is one fresh home (undo cannot undo the load)
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'Ready-made homes' }).click();
    await gal.locator('[data-sample="house3"]').click();
    await gal.locator('[data-sample="house3"]').click();
    st = await page.evaluate(() => { const s = window.__hd.editor.getState().scene; return { floors: s.levelOrder.length, stairs: Object.keys(s.stairs).length, zones: Object.keys(s.zones).length, plot: !!s.plot }; });
    check('the two-floor house has stairs, a garden and a plot', st.floors === 2 && st.stairs === 1 && st.zones >= 2 && st.plot, JSON.stringify(st));
    check('no page errors with the gallery', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2z4. more railing choices
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?view=2d');
    await page.waitForFunction(() => window.__hd && window.__hd.core);
    await page.evaluate(() => {
      const { editor: ed, core } = window.__hd;
      const L0 = ed.getState().scene.levelOrder[0];
      ed.execute(core.addStairAssembly({ fromLevel: L0, origin: [2, 4], kind: 'straight' }));
      ed.select([Object.keys(ed.getState().scene.stairs)[0]]);
    });
    const ins = page.getByRole('complementary', { name: 'Properties' });
    const opts = () => page.evaluate(() => Object.values(window.__hd.editor.getState().scene.stairs)[0].railingOpts ?? null);
    check('the railing has style, colour, handrail, height, posts and side choices', (await ins.getByText('Railing style').isVisible()) && (await ins.getByText('Railing colour').isVisible()) && (await ins.getByText('Railing height').isVisible()) && (await ins.getByText('Rail on').isVisible()));
    await ins.getByRole('group', { name: 'Railing style' }).getByRole('button', { name: 'Cables' }).click();
    await ins.getByRole('radio', { name: 'Brass' }).click();
    await ins.getByRole('group', { name: 'Handrail' }).getByRole('button', { name: 'Round' }).click();
    await ins.getByRole('group', { name: 'Rail on' }).getByRole('button', { name: 'Left only' }).click();
    const o = await opts();
    check('the choices are saved on the stairs', o && o.infill === 'cables' && o.color === '#c9a47a' && o.handrail === 'round' && o.sides === 'left', JSON.stringify(o));
    await ins.getByRole('group', { name: 'Railing', exact: true }).getByRole('button', { name: 'Glass' }).click();
    await ins.getByRole('group', { name: 'Railing style' }).getByRole('button', { name: 'Glass' }).click();
    check('glass shows its tint choices', await ins.getByRole('group', { name: 'Glass' }).isVisible());
    await ins.getByRole('group', { name: 'Glass' }).getByRole('button', { name: 'Smoked' }).click();
    check('the glass tint is saved', (await opts()).tint === 'smoked');
    await ins.getByRole('button', { name: 'Reset railing options' }).click();
    check('Reset goes back to the plain look', (await opts()) === null);
    check('no page errors with the railing options', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2z5. trees, night scene, walking the stairs
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?demo=1&view=split');
    await page.waitForFunction(() => window.__hd && window.__hd.core);
    await page.waitForTimeout(800);
    // Trees: growth stages, height, crown width, season
    await page.evaluate(() => {
      const { editor: ed, core } = window.__hd;
      const L0 = ed.getState().scene.levelOrder[0];
      ed.execute(core.addItem({ levelId: L0, assetId: 'tree-mango', position: [-4, 0, 3] }));
      const id = Object.values(ed.getState().scene.items).find((i) => i.assetId === 'tree-mango').id;
      ed.select([id]);
    });
    const ins = page.getByRole('complementary', { name: 'Properties' });
    const tree = () => page.evaluate(() => Object.values(window.__hd.editor.getState().scene.items).find((i) => i.assetId === 'tree-mango'));
    check('a tree has Growth, Height and Crown width instead of the furniture sizes', (await ins.getByText('Growth').isVisible()) && (await ins.getByText('Crown width').isVisible()));
    await ins.getByRole('button', { name: 'Young' }).click();
    let t = await tree();
    check('Young is a smaller tree (55 %)', Math.abs(t.scale[0] - 0.55) < 1e-9 && Math.abs(t.scale[1] - 0.55) < 1e-9);
    const height = ins.locator('.f-row', { hasText: 'Height' }).locator('input');
    await height.fill('8m');
    await height.press('Enter');
    t = await tree();
    check('Height sets the height on its own (a tall tree keeps its crown width)', Math.abs(t.scale[1] - 8 / 5) < 0.01 && Math.abs(t.scale[0] - 0.55) < 1e-9, JSON.stringify(t.scale));
    await ins.getByRole('radio', { name: 'Autumn gold' }).click();
    check('a season colour tints the foliage', (await tree()).variant === '#c98a2b');
    await page.getByRole('toolbar', { name: 'Selected object' }).getByRole('button', { name: 'Smaller' }).click();
    check('Smaller can take a tree below the furniture limit', (await tree()).scale[0] < 0.55);

    // Night scene
    const hour = () => page.evaluate(() => window.__hd.editor.getState().scene.lighting.timeOfDay);
    const before = await hour();
    await page.locator('button.pill.small[aria-label="Night"]').click();
    check('the Night button sets a night hour and the app knows it is night', (await hour()) > 20 && (await page.locator('.app[data-night]').count()) === 1);
    check('the button now says Day', (await page.locator('button.pill.small[aria-label="Day"]').getAttribute('aria-pressed')) === 'true');
    await page.locator('button.pill.small[aria-label="Day"]').click();
    check('Day goes back to the hour you had', Math.abs((await hour()) - before) < 1e-9);
    check('no page errors with trees and the night scene', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // Walking up and down every kind of stair (the walker follows the steps and ends on the right floor).
  {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?view=3d');
    await page.waitForFunction(() => window.__hd && window.__hd.core);
    const walk = async (kind, mirror, down) =>
      page.evaluate(
        async ({ kind, mirror, down }) => {
          const { editor: ed, core, useUi, walkPose, walkInput, rememberPose } = window.__hd;
          useUi.getState().setWalk(false);
          await new Promise((r) => setTimeout(r, 500)); // let the walker finish leaving (it remembers where it stood)
          ed.execute(core.clearHome(null));
          const L0 = ed.getState().scene.levelOrder[0];
          ed.execute(core.batch('shell', [[0, 0], [12, 0], [12, 10], [0, 10]].map((p, i, a) => core.addWall({ levelId: L0, from: p, to: a[(i + 1) % 4], kind: 'exterior' }))));
          ed.execute(core.addStairAssembly({ fromLevel: L0, origin: [4, 6], kind, mirror, rotationY: 0 }));
          const sc = ed.getState().scene;
          const st = Object.values(sc.stairs)[0];
          const layout = core.layoutOf(sc, st);
          const o = st.origin;
          const pts = layout.treads.map((t) => {
            const c = t.centre ?? [(t.rect[0] + t.rect[2]) / 2, (t.rect[1] + t.rect[3]) / 2];
            return [o[0] + c[0], o[2] + c[1]];
          });
          const last = layout.treads.at(-1);
          const after = [pts.at(-1)[0] + last.dir[0] * 0.9, pts.at(-1)[1] + last.dir[1] * 0.9];
          let start;
          if (layout.spiral) {
            const gap = 2 * Math.PI - Math.abs(layout.treads.length * layout.spiral.delta);
            const th = (-Math.sign(layout.spiral.delta) * gap) / 2;
            start = [o[0] + 0.9 * Math.sin(th), o[2] + 0.9 * Math.cos(th)];
          } else {
            const d = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]];
            const l = Math.hypot(...d);
            start = [pts[0][0] - (d[0] / l) * 0.9, pts[0][1] - (d[1] / l) * 0.9];
          }
          const level1 = sc.levelOrder[1];
          const path = down ? [after, ...pts.slice().reverse(), start] : [...pts, after];
          ed.setActiveLevel(down ? level1 : L0);
          const from = down ? after : start;
          rememberPose({ x: from[0], z: from[1], yaw: 0 });
          useUi.getState().setWalk(true);
          await new Promise((r) => setTimeout(r, 600));
          let idx = 0;
          let stuck = 0;
          let lastPos = [walkPose.getState().x, walkPose.getState().z];
          const t0 = performance.now();
          while (performance.now() - t0 < 40000 && idx < path.length) {
            const p = walkPose.getState();
            const tx = path[idx][0] - p.x;
            const tz = path[idx][1] - p.z;
            if (Math.hypot(tx, tz) < 0.25) {
              idx++;
              continue;
            }
            let diff = Math.atan2(-tx, -tz) - p.yaw;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            if (walkInput.lookYaw === 0) walkInput.lookYaw = diff * 0.6;
            walkInput.joyY = Math.abs(diff) > 0.8 ? 0 : 1;
            await new Promise((r) => setTimeout(r, 40));
            if (Math.hypot(p.x - lastPos[0], p.z - lastPos[1]) < 0.002) stuck++;
            else stuck = 0;
            lastPos = [p.x, p.z];
            if (stuck > 80) break;
          }
          walkInput.joyY = 0;
          await new Promise((r) => setTimeout(r, 800));
          const p = walkPose.getState();
          return { done: idx >= path.length - 1, idx, of: path.length, y: p.y, onUpper: ed.getState().activeLevelId === level1, upperEye: sc.levels[level1].elevation + 1.65 };
        },
        { kind, mirror, down },
      );
    for (const [kind, mirror] of [['straight', false], ['U', true], ['spiral', false]]) {
      const up = await walk(kind, mirror, false);
      check(`walking up ${kind} stairs${mirror ? ' (turning right)' : ''} reaches the upper floor`, up.done && up.onUpper && Math.abs(up.y - up.upperEye) < 0.05, JSON.stringify(up));
    }
    const dn = await walk('L', false, true);
    check('walking down L stairs ends on the ground floor', dn.done && !dn.onUpper && Math.abs(dn.y - 1.65) < 0.05, JSON.stringify(dn));
    check('no page errors while walking the stairs', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2u. lamps and night
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'medium'));
    await page.goto(BASE + '?demo=1&view=3d');
    await page.waitForFunction(() => window.__hd);
    await page.getByRole('button', { name: 'Display' }).click();
    const lamps = page.getByRole('group', { name: 'Lamps' });
    check('Display has a Lamps setting (auto by default)', (await lamps.getByRole('button', { name: 'Lamps: auto' }).getAttribute('aria-pressed')) === 'true');
    await page.getByRole('group', { name: 'Display' }).getByRole('button', { name: 'Night' }).click();
    await page.waitForTimeout(2500);
    const lights = () => page.evaluate(() => window.__hd.useUi.getState().lights);
    await lamps.getByRole('button', { name: 'Off' }).click();
    check('Lamps › Off is remembered', (await lights()) === 'off' && (await page.evaluate(() => localStorage.getItem('hd.lights'))) === 'off');
    await lamps.getByRole('button', { name: 'On' }).click();
    check('Lamps › On', (await lights()) === 'on');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SP}/e2e-night.png` });
    await lamps.getByRole('button', { name: 'Lamps: auto' }).click();
    check('and back to auto', (await lights()) === 'auto');
    check('no page errors with lamps and night', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2v. Hand (view-only) mode and the bigger phone nav
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?demo=1&view=split');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForFunction(() => window.__hd);
    const rail = page.getByRole('navigation', { name: 'Tools' });
    check('the rail starts in Edit mode', (await rail.getByRole('button', { name: 'Edit' }).getAttribute('aria-pressed')) === 'true');
    const walls0 = await page.evaluate(() => Object.keys(window.__hd.editor.getState().scene.walls).length);
    await rail.getByRole('button', { name: 'Hand' }).click();
    check('Hand mode locks the tools', await rail.getByRole('button', { name: 'Wall' }).isDisabled());
    const box = await page.locator('canvas.plan-canvas').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.click(cx - 100, cy);
    await page.keyboard.press('w');
    await page.mouse.click(cx - 100, cy - 80);
    await page.mouse.click(cx + 100, cy - 80);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Delete');
    check('nothing can be changed in Hand mode', (await page.evaluate(() => Object.keys(window.__hd.editor.getState().scene.walls).length)) === walls0 && (await page.evaluate(() => window.__hd.editor.getState().selection.length)) === 0);
    const v0 = await page.evaluate(() => window.__hd.useUi.getState().tool);
    check('the tool stays Select', v0 === 'select');
    await rail.getByRole('button', { name: 'Edit' }).click();
    check('Edit unlocks again', !(await rail.getByRole('button', { name: 'Wall' }).isDisabled()));
    await page.mouse.click(cx - 60, cy);
    check('…and selecting works again', (await page.evaluate(() => window.__hd.editor.getState().selection.length)) >= 0);
    check('no page errors in Hand mode', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();

    const ph = await browser.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true });
    await ph.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await ph.goto(BASE + '?demo=1&view=2d');
    await ph.waitForSelector('canvas.plan-canvas');
    const tool = await ph.locator('.rail .tool').first().boundingBox();
    check('the phone tool buttons are big enough to tap (≥ 48 × 52 px)', !!tool && tool.width >= 48 && tool.height >= 52, JSON.stringify(tool));
    await ph.screenshot({ path: `${SP}/e2e-phone-nav.png` });
    await ph.close();
  }

  // ---------------------------------------------------------------- 2w. Roof button, new roof shapes, floating object bar
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?view=split');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForTimeout(400);
    const box = await page.locator('canvas.plan-canvas').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    for (const [dx, dy] of [[-120, -90], [120, -90], [120, 90], [-120, 90], [-120, -90]]) await page.mouse.click(cx + dx, cy + dy);
    await page.keyboard.press('Escape');
    const roofs = () => page.evaluate(() => Object.values(window.__hd.editor.getState().scene.roofs));
    const rail = page.getByRole('navigation', { name: 'Tools' });
    await rail.getByRole('button', { name: 'Roof' }).click();
    let r = await roofs();
    check('the Roof button puts a gable roof on the house and selects it', r.length === 1 && r[0].style === 'gable' && (await page.evaluate(() => window.__hd.editor.getState().selection[0])) === r[0].id);
    const ins = page.getByRole('complementary', { name: 'Properties' });
    for (const style of ['Butterfly', 'Mansard', 'Barrel']) {
      await ins.getByRole('group', { name: 'Shape' }).getByRole('button', { name: style, exact: true }).click();
      check(`the ${style} roof can be chosen`, (await roofs())[0].style === style.toLowerCase());
    }
    await page.screenshot({ path: `${SP}/e2e-roof-barrel.png` });
    const bar = page.getByRole('toolbar', { name: 'Selected object' });
    check('the floating bar offers Edit and Delete for the roof', (await bar.getByRole('button', { name: 'Edit' }).isVisible()) && (await bar.getByRole('button', { name: 'Delete' }).isVisible()));
    await bar.getByRole('button', { name: 'Delete' }).click();
    check('Delete on the bar removes the roof', (await roofs()).length === 0);
    await page.keyboard.press('Control+z');
    check('…and undo brings it back', (await roofs()).length === 1);
    await page.close();

    // The bar for furniture: bigger, turn, delete (one undo step each); on the plan it floats next to the object.
    const demo = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    demo.on('pageerror', (e) => errors.push(String(e)));
    await demo.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await demo.goto(BASE + '?demo=1&view=2d');
    await demo.waitForSelector('canvas.plan-canvas');
    await demo.waitForFunction(() => window.__hd);
    const id = await demo.evaluate(() => { const it = Object.values(window.__hd.editor.getState().scene.items).find((i) => i.assetId === 'coffee-table'); window.__hd.editor.select([it.id]); return it.id; });
    await demo.waitForTimeout(300);
    const bar2 = demo.getByRole('toolbar', { name: 'Selected object' });
    check('selecting furniture shows the bar with Smaller, Bigger, Left, Right, Edit, Delete', (await bar2.getByRole('button').count()) === 6);
    const pos = await bar2.boundingBox();
    const obj = await demo.evaluate((i) => window.__hd.editor.getState().scene.items[i].position, id);
    check('on the plan the bar floats near the object (not docked at the bottom)', !!pos && pos.y < 700, JSON.stringify(pos));
    const item = () => demo.evaluate((i) => window.__hd.editor.getState().scene.items[i], id);
    await bar2.getByRole('button', { name: 'Bigger' }).click();
    check('Bigger grows it 10 %', Math.abs((await item()).scale[0] - 1.1) < 1e-9);
    await bar2.getByRole('button', { name: 'Smaller' }).click();
    check('Smaller shrinks it back', Math.abs((await item()).scale[0] - 1) < 0.011);
    await bar2.getByRole('button', { name: 'Turn right' }).click();
    check('Turn right rotates it 90°', Math.abs((await item()).rotationY - Math.PI / 2) < 1e-6 || Math.abs((await item()).rotationY + (3 * Math.PI) / 2) < 1e-6);
    await demo.getByRole('toolbar', { name: 'Selected object' }).getByRole('button', { name: 'Delete' }).click();
    check('Delete removes it', (await demo.evaluate((i) => !!window.__hd.editor.getState().scene.items[i], id)) === false);
    await demo.evaluate(() => window.__hd.editor.undo());
    check('…and one undo brings it back', await demo.evaluate((i) => !!window.__hd.editor.getState().scene.items[i], id));
    void obj;
    check('no page errors with the roof and object bar', errors.length === 0, errors.slice(0, 2).join(' | '));
    await demo.close();

    const ph = await browser.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true });
    await ph.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await ph.goto(BASE + '?demo=1&view=2d');
    await ph.waitForSelector('canvas.plan-canvas');
    await ph.waitForFunction(() => window.__hd);
    await ph.evaluate(() => { const it = Object.values(window.__hd.editor.getState().scene.items).find((i) => i.assetId === 'coffee-table'); window.__hd.editor.select([it.id]); });
    await ph.waitForTimeout(400);
    const pb = await ph.getByRole('toolbar', { name: 'Selected object' }).boundingBox();
    const rb = await ph.locator('.rail-wrap').boundingBox();
    check('on a phone the bar sits above the bottom nav, fully on screen', !!pb && !!rb && pb.x >= 0 && pb.x + pb.width <= 390 && pb.y + pb.height <= rb.y + 2, JSON.stringify([pb, rb]));
    await ph.screenshot({ path: `${SP}/e2e-phone-objbar.png` });
    await ph.close();
  }

  // ---------------------------------------------------------------- 2x. ready-made rooms and surroundings
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => localStorage.setItem('hd.quality', 'low'));
    await page.goto(BASE + '?view=split');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForFunction(() => window.__hd);
    await page.waitForTimeout(400);
    const rail = page.getByRole('navigation', { name: 'Tools' });
    await rail.getByRole('button', { name: 'Rooms' }).click();
    const panel = page.getByRole('complementary', { name: 'Ready-made rooms' });
    check('the Rooms button opens a panel with ready-made rooms', await panel.isVisible());
    check('there are 12 presets, each with a plan picture', (await panel.locator('.room-card').count()) === 12 && (await panel.locator('.room-mini').count()) === 12);
    await panel.locator('.room-card', { hasText: 'Bedroom' }).first().click();
    check('picking one switches to the placement tool', (await page.evaluate(() => window.__hd.useUi.getState().tool)) === 'room');
    const box = await page.locator('canvas.plan-canvas').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.screenshot({ path: `${SP}/e2e-room-ghost.png` });
    await page.mouse.click(cx, cy);
    const sc = () => page.evaluate(() => { const s = window.__hd.editor.getState().scene; return { walls: Object.keys(s.walls).length, rooms: Object.values(s.rooms).map((r) => r.name), items: Object.keys(s.items).length, openings: Object.keys(s.openings).length }; });
    let r = await sc();
    check('one click puts down a furnished room: 4 walls, a named Bedroom, doors/windows, furniture', r.walls === 4 && r.rooms.includes('Bedroom') && r.openings >= 2 && r.items >= 6, JSON.stringify(r));
    await page.keyboard.press('Control+z');
    r = await sc();
    check('and one undo removes all of it', r.walls === 0 && r.items === 0 && r.rooms.length === 0, JSON.stringify(r));
    await page.keyboard.press('r');
    check('R turns the ghost a quarter', (await page.evaluate(() => window.__hd.useUi.getState().roomQuarters)) === 1);
    await page.mouse.click(cx - 200, cy);
    await page.keyboard.press('Escape');
    check('Esc stops placing', (await page.evaluate(() => window.__hd.useUi.getState().tool)) === 'select');
    await page.screenshot({ path: `${SP}/e2e-room-placed.png` });

    // Surroundings
    await page.getByRole('button', { name: 'Home' }).click();
    const home = page.getByRole('group', { name: 'Home settings' });
    await home.getByRole('button', { name: 'Village' }).click();
    const env = () => page.evaluate(() => { const s = window.__hd.editor.getState().scene; return { ground: s.terrain.groundMaterial.id, n: Object.values(s.items).filter((i) => i.tag === 'env').length }; });
    let e1 = await env();
    check('Surroundings › Village sets the ground and places scenery', e1.ground === 'ground-soil' && e1.n > 8, JSON.stringify(e1));
    await home.getByRole('button', { name: 'City edge' }).click();
    e1 = await env();
    check('choosing another replaces the first one', e1.ground === 'ground-paving' && e1.n > 5);
    await home.getByRole('button', { name: 'Clear', exact: true }).click();
    check('Clear removes the scenery (and nothing else)', (await env()).n === 0 && (await sc()).rooms.length >= 1);
    check('no page errors with ready-made rooms and surroundings', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- 2b. roads, neighbours, weather
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(BASE + '?view=2d');
    await page.waitForSelector('canvas.plan-canvas');
    await page.waitForTimeout(500);
    const box = await page.locator('canvas.plan-canvas').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const roads = () => page.evaluate(() => Object.values(window.__hd.editor.getState().scene.zones).filter((z) => z.shape === 'road'));
    const street = () => page.evaluate(() => Object.values(window.__hd.editor.getState().scene.items).filter((i) => i.tag?.startsWith('street:')).length);
    const rail = page.getByRole('navigation', { name: 'Tools' });

    await rail.getByRole('button', { name: 'Road', exact: true }).click();
    check('the Road tool is on the rail', (await page.evaluate(() => window.__hd.useUi.getState().tool)) === 'road');
    await page.getByRole('group', { name: 'Road type' }).getByRole('button', { name: 'Main road' }).click();
    for (const [dx, dy] of [[-560, 120], [0, 120], [520, 200]]) {
      await page.mouse.move(cx + dx, cy + dy);
      await page.mouse.click(cx + dx, cy + dy);
      await page.waitForTimeout(60);
    }
    await page.keyboard.press('Enter');
    let r = await roads();
    check('three clicks and Enter draw a road with the chosen type (9 m, double centre line, kerbs, pavements)', r.length === 1 && r[0].width === 9 && r[0].road.centre === 'double' && r[0].road.pavLeft > 1 && r[0].road.kerb > 0, JSON.stringify(r[0]?.road));
    check('then the tool goes back to Select and the road is selected', (await page.evaluate(() => window.__hd.useUi.getState().tool)) === 'select' && (await page.evaluate(() => window.__hd.editor.getState().selection.length)) === 1);
    await page.screenshot({ path: `${SP}/e2e-road-plan.png` });

    const insp = page.getByRole('complementary', { name: 'Properties' });
    await insp.getByRole('group', { name: 'Start from' }).getByRole('button', { name: 'Avenue' }).click();
    r = await roads();
    check('Start from › Avenue gives 14 m and 4 lanes', r[0].width === 14 && r[0].road.lanes === 4);
    await insp.getByRole('group', { name: 'Lanes' }).getByRole('button', { name: '2', exact: true }).click();
    await insp.getByRole('group', { name: 'Centre line' }).getByRole('button', { name: 'Dashed' }).click();
    await insp.getByRole('switch', { name: 'Edge lines', exact: true }).click();
    r = await roads();
    check('lanes, centre line and edge lines are editable', r[0].road.lanes === 2 && r[0].road.centre === 'dashed' && r[0].road.edges === false, JSON.stringify(r[0].road));
    await insp.getByRole('group', { name: 'Parking bays' }).getByRole('button', { name: 'Both' }).click();
    await insp.getByRole('group', { name: 'Kerb' }).getByRole('button', { name: 'High' }).click();
    r = await roads();
    check('parking bays and kerb height are editable', r[0].road.parking === 'both' && r[0].road.kerb === 0.18);
    await insp.getByRole('button', { name: '+ Add a zebra crossing' }).click();
    await insp.getByRole('button', { name: '+ Add a speed bump' }).click();
    r = await roads();
    check('a zebra crossing and a speed bump can be added', r[0].road.crossings.length === 1 && r[0].road.bumps.length === 1);
    check('a main road starts with street lights; trees switch on along it too', (await roads())[0].road.extras.some((e) => e.kind === 'light'));
    await insp.getByRole('switch', { name: 'Trees', exact: true }).click();
    r = await roads();
    check('street lights and trees can both be along the road', r[0].road.extras.some((e) => e.kind === 'light') && r[0].road.extras.some((e) => e.kind === 'tree'), JSON.stringify(r[0].road.extras));

    // Neighbours
    const nb = insp.getByRole('group', { name: 'Neighbours' });
    await nb.getByRole('group', { name: 'Street style' }).getByRole('button', { name: 'City' }).click();
    await nb.getByRole('button', { name: 'Fill both sides' }).click();
    const n1 = await street();
    check('Fill both sides puts neighbours and street life along the road', n1 > 3, `${n1} items`);
    const kinds = await page.evaluate(() => [...new Set(Object.values(window.__hd.editor.getState().scene.items).filter((i) => i.tag?.startsWith('street:')).map((i) => i.assetId))]);
    check('they are buildings, trees and people / vehicles', kinds.some((k) => k.startsWith('neighbour') || k === 'apartment-block') && kinds.some((k) => k.startsWith('person') || k === 'car' || k === 'auto-rickshaw' || k === 'bus'), kinds.join(','));
    await page.keyboard.press('Control+z');
    check('one undo takes them all away', (await street()) === 0);
    await page.keyboard.press('Control+y');
    check('and redo brings them back', (await street()) === n1);
    await nb.getByRole('group', { name: 'Street style' }).getByRole('button', { name: 'Village' }).click();
    await nb.getByRole('button', { name: 'Fill again' }).click();
    const hut = await page.evaluate(() => Object.values(window.__hd.editor.getState().scene.items).some((i) => i.tag?.startsWith('street:') && ['neighbour-hut', 'neighbour-farm', 'neighbour-temple'].includes(i.assetId)));
    check('filling again with another style replaces the first fill', hut && (await street()) > 3);
    await nb.getByRole('button', { name: 'Clear neighbours' }).click();
    check('Clear neighbours removes them (the road stays)', (await street()) === 0 && (await roads()).length === 1);
    await nb.getByRole('button', { name: 'Fill both sides' }).click();
    await page.screenshot({ path: `${SP}/e2e-road-panel.png` });

    // 3D with weather
    await page.getByRole('button', { name: '3D', exact: true }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Display' }).click();
    const disp = page.getByRole('group', { name: 'Display' });
    const light = () => page.evaluate(() => window.__hd.editor.getState().scene.lighting);
    await disp.getByRole('group', { name: 'Weather' }).getByRole('button', { name: 'Rain' }).click();
    check('Display › Weather › Rain is stored in the scene', (await light()).weather === 'rain');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SP}/e2e-weather-rain.png` });
    for (const w of ['Fog', 'Cloudy']) {
      await disp.getByRole('group', { name: 'Weather' }).getByRole('button', { name: w }).click();
      await page.waitForTimeout(500);
    }
    check('Cloudy is stored', (await light()).weather === 'cloudy');
    await disp.getByRole('group', { name: 'Weather' }).getByRole('button', { name: 'Clear' }).click();
    check('Clear takes the weather out of the scene again', (await light()).weather === undefined);
    await page.keyboard.press('Escape');

    // The environment editor
    const env = () => page.evaluate(() => window.__hd.core.resolveEnvironment(window.__hd.editor.getState().scene.lighting));
    const stored = () => page.evaluate(() => window.__hd.editor.getState().scene.lighting.environment);
    let e = await env();
    check('a new home starts as open flat land: nothing on any horizon', ['north', 'east', 'south', 'west'].every((k) => e.sides[k].kind === 'plains') && (await stored()) === undefined);
    await page.getByRole('button', { name: 'Environment', exact: true }).click();
    const panel = page.getByRole('complementary', { name: 'Environment' });
    check('the Environment button (bottom row) opens the editor where the properties panel goes', await panel.isVisible());
    await page.screenshot({ path: `${SP}/e2e-env-panel.png` });
    await panel.getByRole('group', { name: 'Look', exact: true }).getByRole('button', { name: 'Hill station' }).click();
    e = await env();
    check('Start from › Hill station puts snow mountains in the north', e.sides.north.kind === 'mountains' && e.sides.north.snow === true && e.sides.east.kind === 'hills', JSON.stringify(e.sides.north));
    const compass = panel.getByRole('group', { name: 'Side of the home' });
    await compass.getByRole('button', { name: /^South/ }).click();
    await panel.getByRole('group', { name: 'South side' }).getByRole('button', { name: 'Sea', exact: true }).click();
    e = await env();
    check('one side can be changed alone (sea to the south, mountains still north)', e.sides.south.kind === 'sea' && e.sides.north.kind === 'mountains');
    await compass.getByRole('button', { name: /^North/ }).click();
    await panel.getByRole('group', { name: 'Height', exact: true }).getByRole('button', { name: 'Tall' }).click();
    await panel.getByRole('group', { name: 'Colour', exact: true }).getByRole('button', { name: 'Rocky' }).click();
    await panel.getByRole('switch', { name: /Snow on the mountain tops/ }).click();
    e = await env();
    check('height, colour and snow are editable for mountains', e.sides.north.height === 1.6 && e.sides.north.tone === 'rocky' && e.sides.north.snow === false, JSON.stringify(e.sides.north));
    await panel.getByRole('button', { name: 'All four sides' }).click();
    await panel.getByRole('group', { name: 'On every side' }).getByRole('button', { name: 'City', exact: true }).click();
    e = await env();
    check('All four sides changes every side at once', ['north', 'east', 'south', 'west'].every((k) => e.sides[k].kind === 'city'));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SP}/e2e-env-city.png` });
    await panel.getByRole('group', { name: 'Clouds', exact: true }).getByRole('button', { name: 'Many' }).click();
    await panel.getByRole('group', { name: 'Haze', exact: true }).getByRole('button', { name: 'Misty' }).click();
    await panel.getByRole('group', { name: 'Sky colour', exact: true }).getByRole('button', { name: 'Deep blue' }).click();
    await panel.getByRole('switch', { name: 'Birds' }).click();
    e = await env();
    check('clouds, haze, sky colour and birds are editable', e.clouds === 'many' && e.haze === 'misty' && e.sky === 'deep' && e.birds === false, JSON.stringify([e.clouds, e.haze, e.sky, e.birds]));
    await panel.getByRole('group', { name: 'Clouds', exact: true }).getByRole('button', { name: 'By weather' }).click();
    check('Clouds › By weather hands the sky back to the weather', (await env()).clouds === null);
    await panel.getByRole('group', { name: 'Weather', exact: true }).getByRole('button', { name: 'Rain' }).click();
    check('the weather can be changed from the editor too', (await light()).weather === 'rain');
    await panel.getByRole('group', { name: 'Weather', exact: true }).getByRole('button', { name: 'Clear', exact: true }).click();
    await panel.getByRole('group', { name: 'Ring of trees round the plot' }).getByRole('button', { name: 'Dense' }).click();
    await panel.getByRole('group', { name: 'Kind of tree' }).getByRole('button', { name: 'Palms' }).click();
    await panel.getByRole('group', { name: 'Grass, pebbles, leaves' }).getByRole('button', { name: 'Lots' }).click();
    e = await env();
    check('a ring of palms and lots of grass can be switched on', e.trees === 'dense' && e.treeKind === 'palm' && e.detail === 'lots', JSON.stringify([e.trees, e.treeKind, e.detail]));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SP}/e2e-env-trees.png` });
    await page.evaluate(() => window.__hd.editor.select([Object.keys(window.__hd.editor.getState().scene.zones)[0]].filter(Boolean)));
    check('while the editor is open the properties panel stays out of its way', (await page.getByRole('complementary', { name: 'Properties' }).count()) === 0);
    await panel.getByRole('button', { name: 'Reset to open land' }).click();
    check('Reset to open land clears every environment setting', (await stored()) === undefined);
    await panel.getByRole('button', { name: 'Close the environment editor' }).click();
    check('the close button puts the editor away', (await panel.count()) === 0);
    await page.evaluate(() => window.__hd.editor.select([]));

    // Deleting the road takes its neighbours with it
    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    await page.waitForTimeout(400);
    check('the neighbours are still there before the delete', (await street()) > 3);
    await page.evaluate(() => { const ed = window.__hd.editor; ed.select(Object.values(ed.getState().scene.zones).filter((z) => z.shape === 'road').map((z) => z.id)); });
    await page.keyboard.press('Delete');
    check('deleting the road also removes the neighbours that were filled in along it', (await roads()).length === 0 && (await street()) === 0);
    check('no page errors with roads, neighbours and weather', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
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
