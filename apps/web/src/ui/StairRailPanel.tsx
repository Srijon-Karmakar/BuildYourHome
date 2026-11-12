import type { Stair } from '@hd/scene-schema';
import { updateStairs } from '@hd/editor-core';
import { editor } from '../plan/session';
import { RailingPanel } from './RailingPanel';

/** More railing choices for stairs: how it is filled, colour, handrail, height, spacing, posts, which side and the glass tint. */
export function StairRailPanel({ stairs }: { stairs: Stair[] }) {
  const ids = stairs.map((s) => s.id);
  const spiral = stairs.every((s) => s.kind === 'spiral');
  return (
    <RailingPanel
      rails={stairs.map((s) => ({ railing: s.railing, opts: s.railingOpts }))}
      sides={!spiral}
      guard={!spiral}
      onEdit={(railingOpts) => editor.execute(updateStairs(ids, { railingOpts }))}
      onReset={() => editor.execute(updateStairs(ids, { railingOpts: null }))}
    />
  );
}
