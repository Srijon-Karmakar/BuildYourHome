import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from 'zustand';
import { buildColliders, moveWithCollision, stairHeightAt, stairToLocal } from '@hd/geometry';
import { itemColliders, layoutOf } from '@hd/editor-core';
import { editor, useUi } from '../plan/session';
import { rememberPose, resetWalkInput, spawnPose, walkInput, walkPose } from './walkState';

const EYE_HEIGHT_M = 1.6;
const WALK_SPEED = 1.7; // m/s
const RUN_SPEED = 3.4;
const MAX_PITCH = (80 * Math.PI) / 180;
/** How quickly the eye settles onto a new step height (1/s). */
const EYE_SMOOTHING = 14;
/** The biggest step the walker can take up or down in one move (a stair riser is ≈ 17 cm); anything more is a wall. */
const MAX_STEP_M = 0.4;

/**
 * First-person controller (lives inside the R3F Canvas).
 * Move: WASD / arrows (Shift = run) or the on-screen stick. Look: drag (mouse or touch).
 * Collides with walls (sliding), stays at eye height on the active level, Esc exits.
 */
export function WalkControls() {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const nodes = useStore(editor.store, (s) => s.scene.nodes);
  const walls = useStore(editor.store, (s) => s.scene.walls);
  const openings = useStore(editor.store, (s) => s.scene.openings);
  const items = useStore(editor.store, (s) => s.scene.items);
  const levelId = useStore(editor.store, (s) => s.activeLevelId);
  const stairs = useStore(editor.store, (s) => s.scene.stairs);
  const levels = useStore(editor.store, (s) => s.scene.levels);

  const colliders = useMemo(
    () => [
      ...buildColliders(
        nodes,
        Object.values(walls).filter((w) => w.levelId === levelId),
        Object.values(openings), // doors / arches leave gaps you can walk through
      ),
      ...itemColliders(editor.getState().scene, levelId), // large furniture blocks the way
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, walls, openings, items, levelId],
  );
  const collidersRef = useRef(colliders);
  collidersRef.current = colliders;

  // Stairs with their steps worked out once per change (not every frame).
  const stairData = useMemo(() => {
    const scene = editor.getState().scene;
    return Object.values(stairs).flatMap((s) => {
      const layout = layoutOf(scene, s);
      const from = levels[s.fromLevel];
      return layout && from ? [{ s, layout, fromElevation: from.elevation }] : [];
    });
  }, [stairs, levels]);
  const stairsRef = useRef(stairData);
  stairsRef.current = stairData;

  const st = useRef({ x: 0, z: 0, yaw: 0, pitch: 0, y: 0, feet: 0 });

  /** What is under (x, z): the height of the floor there and which floor the walker then belongs to. */
  const floorAt = (x: number, z: number): { y: number; level: string } => {
    const state = editor.getState();
    for (const { s: stair, layout, fromElevation } of stairsRef.current) {
      if (stair.fromLevel !== state.activeLevelId && stair.toLevel !== state.activeLevelId) continue;
      const h = stairHeightAt(layout, stairToLocal([stair.origin[0], stair.origin[2]], stair.rotationY, [x, z]));
      if (h !== null) return { y: fromElevation + h, level: h >= layout.rise / 2 ? stair.toLevel : stair.fromLevel };
    }
    return { y: state.scene.levels[state.activeLevelId]?.elevation ?? 0, level: state.activeLevelId };
  };
  const keys = useRef(new Set<string>());

  useEffect(() => {
    const s = editor.getState();
    const sp = spawnPose(s.scene, s.activeLevelId);
    const feet = floorAt(sp.x, sp.z);
    if (feet.level !== s.activeLevelId) editor.setActiveLevel(feet.level);
    st.current = { x: sp.x, z: sp.z, yaw: sp.yaw, pitch: 0, y: feet.y + EYE_HEIGHT_M, feet: feet.y };
    camera.rotation.order = 'YXZ';
    resetWalkInput();
    walkPose.setState({ active: true, x: sp.x, z: sp.z, yaw: sp.yaw, y: st.current.y });

    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.code === 'Escape') {
        useUi.getState().setWalk(false);
        return;
      }
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      keys.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    invalidate();

    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      rememberPose(st.current);
      walkPose.setState({ active: false });
      camera.rotation.order = 'XYZ';
      resetWalkInput();
    };
  }, [camera, invalidate]);

  useFrame((_, delta) => {
    // A long frame must not teleport the player; collision is sub-stepped (≤ 10 cm) so 100 ms is safe,
    // and slow devices (≈ 10 fps) still walk at full speed.
    const dt = Math.min(delta, 0.1);
    const s = st.current;
    const k = keys.current;

    s.yaw += walkInput.lookYaw;
    s.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, s.pitch + walkInput.lookPitch));
    walkInput.lookYaw = walkInput.lookPitch = 0;

    let fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) + walkInput.joyY;
    let side = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + walkInput.joyX;
    const mag = Math.hypot(fwd, side);
    if (mag > 1) {
      fwd /= mag;
      side /= mag;
    }
    const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? RUN_SPEED : WALK_SPEED;
    const sin = Math.sin(s.yaw);
    const cos = Math.cos(s.yaw);
    // Forward = (−sin, −cos), right = (cos, −sin) in (x, z).
    const dx = (-sin * fwd + cos * side) * speed * dt;
    const dz = (-cos * fwd - sin * side) * speed * dt;

    // Walls first, then the step-height limit: a move that would climb or drop more than a step is refused
    // (sliding along the edge instead). That is what keeps you off the sides of a flight and out of the stairwell.
    const moved = moveWithCollision([s.x, s.z], [dx, dz], collidersRef.current);
    let at = floorAt(moved[0], moved[1]);
    let target: [number, number] = moved;
    if (Math.abs(at.y - s.feet) > MAX_STEP_M) {
      const alts: [number, number][] = [[moved[0], s.z], [s.x, moved[1]]];
      const ok = alts.find((p) => Math.abs(floorAt(p[0], p[1]).y - s.feet) <= MAX_STEP_M);
      target = ok ?? [s.x, s.z];
      at = floorAt(target[0], target[1]);
    }
    s.x = target[0];
    s.z = target[1];

    // The steps while on a stair (the active floor switches half-way up), else the floor itself; the eye settles onto it.
    s.feet = at.y;
    if (at.level !== editor.getState().activeLevelId) editor.setActiveLevel(at.level);
    s.y += (s.feet + EYE_HEIGHT_M - s.y) * (1 - Math.exp(-EYE_SMOOTHING * dt));
    camera.position.set(s.x, s.y, s.z);
    camera.rotation.set(s.pitch, s.yaw, 0);

    const p = walkPose.getState();
    if (Math.abs(p.x - s.x) > 1e-4 || Math.abs(p.z - s.z) > 1e-4 || Math.abs(p.yaw - s.yaw) > 1e-4 || Math.abs(p.y - s.y) > 1e-3) {
      walkPose.setState({ x: s.x, z: s.z, yaw: s.yaw, y: s.y });
    }
    invalidate(); // keep the demand-driven canvas rendering every frame while walking
  });

  return null;
}
