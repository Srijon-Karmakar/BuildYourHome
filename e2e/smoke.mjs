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
    await inspector.getByRole('radio', { name: 'Walnut' }).click();
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
    await inspector.getByRole('button', { name: 'Side 2' }).click();
    await inspector.getByRole('radio', { name: 'Light stone' }).count(); // (ground swatch lives in Home menu, not here)
    await inspector.getByRole('radio', { name: 'Stone' }).first().click();
    let w = (await sceneOf()).walls[wallId];
    check('painting only Side 2 leaves Side 1 alone', w.materialB.id === 'wall-stone' && w.materialA.id === before.materialA.id, `${w.materialA.id} | ${w.materialB.id}`);
    await inspector.getByRole('button', { name: 'Both sides' }).click();
    await inspector.getByRole('radio', { name: 'White brick' }).click();
    w = (await sceneOf()).walls[wallId];
    check('"Both sides" paints both faces with a finish', w.materialA.id === 'wall-brick-white' && w.materialB.id === 'wall-brick-white');

    // Room: ceiling paint + a different floor.
    await page.keyboard.press('Escape');
    await page.mouse.click(530, 300);
    await inspector.getByRole('radio', { name: 'Sky' }).click();
    await inspector.getByRole('radio', { name: 'Terrazzo' }).click();
    const room = Object.values(await sceneOf().then((x) => x.rooms)).find((r) => r.name === 'Living');
    check('ceiling paint and terrazzo floor apply to the room', room.ceilingMaterial?.id === 'paint-sky' && room.floorMaterial.id === 'floor-terrazzo');

    // Door style + colours (front door is a double door in the demo; restyle it).
    await page.keyboard.press('Escape');
    const door = Object.values((await sceneOf()).openings).find((o) => o.type === 'door');
    await page.evaluate((id) => window.__hd.editor.select([id]), door.id);
    await page.waitForTimeout(200);
    await inspector.getByRole('button', { name: 'Glass', exact: true }).click();
    await inspector.getByRole('radio', { name: 'Black' }).first().click(); // frame colour
    await inspector.getByRole('radio', { name: 'Sage' }).click(); // door colour
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
    await home.getByRole('radio', { name: 'Sand' }).click();
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
    check('search by name', (await panel.locator('.card').count()) === 2);
    await panel.getByLabel('Search furniture').fill('couch');
    check('search by tag finds sofas', (await panel.locator('.card').count()) === 2);
    await panel.getByLabel('Search furniture').fill('');
    await panel.getByRole('tab', { name: 'Bathroom' }).click();
    const names = await panel.locator('.card-name').allTextContents();
    check('category filter', names.includes('Toilet') && !names.includes('Sofa, 2-seat'), names.join(','));
    await panel.getByRole('tab', { name: 'All' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.furniture .card-thumb img').length >= 6, null, { timeout: 30000 }).catch(() => {});
    check('thumbnails are rendered from the models', (await page.locator('.furniture .card-thumb img').count()) >= 6);

    // Place an armchair in open floor.
    await panel.getByLabel('Search furniture').fill('armchair');
    await panel.locator('.card', { hasText: 'Armchair' }).click();
    check('picking closes the catalog and starts placing', !(await panel.isVisible()) && (await page.evaluate(() => window.__hd.useUi.getState().placing)) === 'armchair');
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
    await panel.locator('.card', { hasText: 'Wardrobe' }).click();
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

    // Select the armchair and edit it in the inspector.
    await page.evaluate((id) => window.__hd.editor.select([id]), placed.id);
    await page.waitForTimeout(200);
    check('inspector shows the item', await inspector.getByText('Armchair').first().isVisible());
    await field('Rotation').fill('45');
    await field('Rotation').press('Enter');
    check('exact rotation in degrees', Math.abs((await items()).find((i) => i.id === placed.id).rotationY - Math.PI / 4) < 1e-6);
    await inspector.getByRole('radio', { name: 'Navy' }).click();
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
    await menu.getByRole('radio', { name: 'Slate' }).click();
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

    // Adding a floor moves the roof to the new top floor.
    await group.getByRole('button', { name: 'Add floor' }).click();
    const ids = await page.evaluate(() => ({ top: window.__hd.editor.getState().scene.levelOrder.at(-1), roofLevel: Object.values(window.__hd.editor.getState().scene.roofs)[0]?.levelId }));
    check('adding a floor moves the roof to the new top', ids.top === ids.roofLevel);
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
    check('it lists shortcuts', (await help.getByText('Rotate furniture 90°').count()) === 1);
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
