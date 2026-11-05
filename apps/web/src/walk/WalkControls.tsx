import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from 'zustand';
import { buildColliders, moveWithCollision } from '@hd/geometry';
import { editor, useUi } from '../plan/session';
import { rememberPose, resetWalkInput, spawnPose, walkInput, walkPose } from './walkState';

const EYE_HEIGHT_M = 1.6;
const WALK_SPEED = 1.7; // m/s
const RUN_SPEED = 3.4;
const MAX_PITCH = (80 * Math.PI) / 180;

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
  const levelId = useStore(editor.store, (s) => s.activeLevelId);

  const colliders = useMemo(
    () =>
      buildColliders(
        nodes,
        Object.values(walls).filter((w) => w.levelId === levelId),
        Object.values(openings), // doors / arches leave gaps you can walk through
      ),
    [nodes, walls, openings, levelId],
  );
  const collidersRef = useRef(colliders);
  collidersRef.current = colliders;

  const st = useRef({ x: 0, z: 0, yaw: 0, pitch: 0 });
  const keys = useRef(new Set<string>());

  useEffect(() => {
    const s = editor.getState();
    const sp = spawnPose(s.scene, s.activeLevelId);
    st.current = { x: sp.x, z: sp.z, yaw: sp.yaw, pitch: 0 };
    camera.rotation.order = 'YXZ';
    resetWalkInput();
    walkPose.setState({ active: true, x: sp.x, z: sp.z, yaw: sp.yaw });

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

    const [nx, nz] = moveWithCollision([s.x, s.z], [dx, dz], collidersRef.current);
    s.x = nx;
    s.z = nz;

    const level = editor.getState().scene.levels[editor.getState().activeLevelId];
    camera.position.set(s.x, (level?.elevation ?? 0) + EYE_HEIGHT_M, s.z);
    camera.rotation.set(s.pitch, s.yaw, 0);

    const p = walkPose.getState();
    if (Math.abs(p.x - s.x) > 1e-4 || Math.abs(p.z - s.z) > 1e-4 || Math.abs(p.yaw - s.yaw) > 1e-4) {
      walkPose.setState({ x: s.x, z: s.z, yaw: s.yaw });
    }
    invalidate(); // keep the demand-driven canvas rendering every frame while walking
  });

  return null;
}
