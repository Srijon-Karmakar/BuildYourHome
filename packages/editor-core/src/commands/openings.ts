import { newId, type Id, type Opening } from '@hd/scene-schema';
import { defaultSize, freeOffset, OPENING_HEAD_CLEARANCE_M } from '../openings';
import type { Command } from '../types';

export interface AddOpeningParams {
  wallId: Id;
  type: Opening['type'];
  /** Desired centre, distance from node a. The nearest free spot is used. */
  offset: number;
  width?: number;
  height?: number;
  sill?: number;
  /** Door opens toward the wall's R side instead of L. */
  swing?: boolean;
  /** Hinge at the far end instead of the near end. */
  hinge?: boolean;
}

/** Adds a door/window/arch; does nothing when there is no room for it on that wall. */
export function addOpening(params: AddOpeningParams, rng?: () => number): Command {
  const id = newId('open', rng);
  return {
    type: 'AddOpening',
    label: params.type === 'window' ? 'Add window' : params.type === 'arch' ? 'Add archway' : 'Add door',
    apply(d) {
      const wall = d.walls[params.wallId];
      if (!wall) return;
      const size = defaultSize(params.type, wall);
      const width = params.width ?? size.width;
      const sill = params.sill ?? size.sill;
      const height = Math.min(params.height ?? size.height, wall.height - OPENING_HEAD_CLEARANCE_M - sill);
      if (height < 0.2) return;
      const offset = freeOffset(d, params.wallId, params.offset, width);
      if (offset === null) return;
      d.openings[id] = {
        id,
        wallId: params.wallId,
        type: params.type,
        assetId: size.assetId,
        offset,
        width,
        height,
        sill,
        flip: { swing: params.swing ?? false, side: params.hinge ?? false },
      };
    },
  };
}

/** Slide an opening along its wall, or onto another wall. Snaps to the nearest free spot; no-op if none. */
export function moveOpening(openingId: Id, wallId: Id, offset: number): Command {
  return {
    type: 'MoveOpening',
    label: 'Move opening',
    apply(d) {
      const o = d.openings[openingId];
      if (!o || !d.walls[wallId]) return;
      const spot = freeOffset(d, wallId, offset, o.width, openingId);
      if (spot === null) return;
      o.wallId = wallId;
      o.offset = spot;
    },
  };
}

export type OpeningProps = Partial<Pick<Opening, 'width' | 'height' | 'sill' | 'style' | 'frameColor' | 'leafColor'>> & {
  flip?: Partial<Opening['flip']>;
};

/** Resize / flip. A width that no longer fits next to its neighbours or the wall ends is refused. */
export function setOpeningProps(openingId: Id, props: OpeningProps): Command {
  return {
    type: 'SetOpeningProps',
    label: 'Edit opening',
    apply(d) {
      const o = d.openings[openingId];
      const wall = o && d.walls[o.wallId];
      if (!o || !wall) return;

      // A width that doesn't fit is ignored on its own — the other changes in the same edit still apply.
      let offset = o.offset;
      let width = o.width;
      if (props.width !== undefined && props.width !== o.width && props.width >= 0.3) {
        const spot = freeOffset(d, o.wallId, o.offset, props.width, openingId);
        // Resizing may nudge the opening to fit, but must never relocate it (e.g. hop over a neighbour).
        if (spot !== null && Math.abs(spot - o.offset) <= Math.abs(props.width - o.width) / 2 + 0.2) {
          offset = spot;
          width = props.width;
        }
      }
      const sill = Math.max(0, props.sill ?? o.sill);
      const maxHeight = wall.height - OPENING_HEAD_CLEARANCE_M - sill;
      const height = Math.min(props.height ?? o.height, maxHeight);
      if (height < 0.2) return;

      if (width !== o.width) o.width = width;
      if (offset !== o.offset) o.offset = offset;
      if (props.style !== undefined) o.style = props.style;
      if (props.frameColor !== undefined) o.frameColor = props.frameColor;
      if (props.leafColor !== undefined) o.leafColor = props.leafColor;
      o.sill = sill;
      o.height = height;
      if (props.flip) o.flip = { ...o.flip, ...props.flip };
    },
  };
}

export function removeOpenings(ids: Id[]): Command {
  return {
    type: 'RemoveOpenings',
    label: ids.length > 1 ? 'Delete openings' : 'Delete opening',
    apply(d) {
      for (const id of ids) delete d.openings[id];
    },
  };
}
