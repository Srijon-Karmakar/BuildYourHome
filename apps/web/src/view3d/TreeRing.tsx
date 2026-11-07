import { useMemo } from 'react';
import { useStore } from 'zustand';
import { planTreeRing, resolveEnvironment, type TreeSpot } from '@hd/editor-core';
import { editor, useUi } from '../plan/session';
import { Instances } from './RoadMesh';

/** A key that changes only when something that decides where the trees go changes (plot, roads, big buildings, tree setting). */
function ringKey(s: ReturnType<typeof editor.getState>): string {
  const sc = s.scene;
  const e = resolveEnvironment(sc.lighting);
  if (e.trees === 'none') return 'none';
  const roads = Object.values(sc.zones).filter((z) => z.shape === 'road').map((z) => [z.points, z.width, z.road?.pavLeft, z.road?.pavRight]);
  const items = Object.values(sc.items).filter((i) => i.tag?.startsWith('street:') || i.tag === 'env' || /neighbour|apartment|pavilion|gazebo/.test(i.assetId)).map((i) => [i.assetId, i.position, i.scale]);
  const walls = Object.values(sc.walls).length;
  return JSON.stringify([e.trees, e.treeKind, sc.plot?.boundary, roads, items, walls]);
}

/** The ring of trees round the plot (environment editor › Ground and plants). Instanced: a few draw calls however many trees. */
export default function TreeRing() {
  const key = useStore(editor.store, ringKey);
  const hidden = useUi((s) => s.hiddenLayers.outdoor);
  const byAsset = useMemo(() => {
    if (key === 'none') return [];
    const scene = editor.getState().scene;
    const spots = planTreeRing(scene, resolveEnvironment(scene.lighting));
    const map = new Map<string, TreeSpot[]>();
    for (const t of spots) map.set(t.asset, [...(map.get(t.asset) ?? []), t]);
    return [...map.entries()];
  }, [key]);
  if (hidden) return null;
  return (
    <>
      {byAsset.map(([asset, spots]) => (
        <Instances key={asset} asset={asset} spots={spots} />
      ))}
    </>
  );
}
