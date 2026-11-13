import { DOOR_BLOCKS_BELOW, newId, type Id, type Opening } from '@hd/scene-schema';
import { defaultSize, freeOffset, OPENING_HEAD_CLEARANCE_M } from '../openings';
import type { Command } from '../types';

/** Open, close or toggle doors. `open` is 0 (closed) to 1 (fully open); 'toggle' flips each door between closed and open. */
export function setDoorsOpen(ids: readonly Id[], open: number | 'toggle'): Command {
  return {
    type: 'SetDoorsOpen',
    label: open === 'toggle' ? 'Open or close door' : open <= 0 ? 'Close door' : 'Open door',
    apply(d) {
      for (const id of ids) {
        const o = d.openings[id];
        if (!o || o.type !== 'door') continue;
        const next = open === 'toggle' ? ((o.open ?? 1) >= DOOR_BLOCKS_BELOW ? 0 : 1) : Math.min(1, Math.max(0, open));
        if (next >= 1) delete o.open;
        else o.open = next;
      }
    },
  };
}

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

export type OpeningProps = Partial<Pick<Opening, 'width' | 'height' | 'sill' | 'style' | 'frameColor' | 'leafColor' | 'glass' | 'panes' | 'head' | 'handle'>> & {
  flip?: Partial<Opening['flip']>;
  /** A sunshade (fields given are merged into the current one; a style is needed to create it); `null` removes it. */
  shade?: Partial<NonNullable<Opening['shade']>> | null;
  /** Box frame / bay (merged; `kind` is needed to create it); `null` removes it. Windows only. */
  box?: Partial<NonNullable<Opening['box']>> | null;
  /** Grill (merged; `pattern` is needed to create it); `null` removes it. Windows only. */
  grill?: Partial<NonNullable<Opening['grill']>> | null;
  /** Frame bar width / finish (merged); `null` resets both. */
  frame?: Partial<NonNullable<Opening['frame']>> | null;
  /** Trim round the outside (merged; `style` is needed to create it); `null` removes it. */
  surround?: Partial<NonNullable<Opening['surround']>> | null;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Default projection of a new box: a frame box stands 0.3 m proud, a bay 0.6 m. */
export const BOX_DEPTH = { frame: 0.3, bay: 0.6 } as const;

/** Apply the ADR-030 extras of `props` to opening `o` (in a draft). */
function applyExtras(o: Opening, props: OpeningProps): void {
  if (props.glass !== undefined) o.glass = props.glass;
  if (props.panes !== undefined) o.panes = props.panes;
  if (props.head !== undefined) o.head = props.head;
  if (props.handle !== undefined) o.handle = props.handle;

  if (props.box === null) delete o.box;
  else if (props.box && o.type === 'window') {
    const kind = props.box.kind ?? o.box?.kind;
    if (kind) {
      // Switching kind starts from that kind's own depth unless one is given.
      const keep = o.box && o.box.kind === kind ? o.box : undefined;
      const depth = clamp(props.box.depth ?? keep?.depth ?? BOX_DEPTH[kind], 0.05, 1.2);
      const next = { ...keep, ...props.box, kind, depth };
      if (next.thickness !== undefined) next.thickness = clamp(next.thickness, 0.03, 0.4);
      o.box = next;
    }
  }

  if (props.grill === null) delete o.grill;
  else if (props.grill && o.type === 'window') {
    const pattern = props.grill.pattern ?? o.grill?.pattern;
    if (pattern) o.grill = { ...o.grill, ...props.grill, pattern };
  }

  if (props.frame === null) delete o.frame;
  else if (props.frame) {
    const next = { ...o.frame, ...props.frame };
    if (next.width !== undefined) next.width = clamp(next.width, 0.03, 0.15);
    o.frame = next;
  }

  if (props.surround === null) delete o.surround;
  else if (props.surround) {
    const style = props.surround.style ?? o.surround?.style;
    if (style) {
      const width = clamp(props.surround.width ?? o.surround?.width ?? 0.12, 0.04, 0.5);
      o.surround = { ...o.surround, ...props.surround, style, width };
    }
  }
}

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
      applyExtras(o, props);
      if (props.shade === null) delete o.shade;
      else if (props.shade) {
        const cur = o.shade;
        const style = props.shade.style ?? cur?.style;
        if (style) {
          const depth = Math.min(2, Math.max(0.15, props.shade.depth ?? cur?.depth ?? 0.5));
          const color = props.shade.color ?? cur?.color;
          o.shade = { style, depth, ...(color ? { color } : {}) };
        }
      }
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
