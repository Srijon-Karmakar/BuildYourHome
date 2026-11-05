import type { ReactNode } from 'react';

/** Minimal 24×24 stroke icons (1.5 px, round caps). Styling comes from `.tool svg` in styles.css. */
const wrap = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {children}
  </svg>
);

export const IconSelect = () => wrap(<path d="M6 4l12 7-5.2 1.6L11 18z" />);

export const IconWall = () =>
  wrap(
    <>
      <path d="M5 19L19 5" />
      <circle cx="5" cy="19" r="1.6" />
      <circle cx="19" cy="5" r="1.6" />
    </>,
  );

export const IconUndo = () =>
  wrap(
    <>
      <path d="M9 8L5 12l4 4" />
      <path d="M5 12h9a5 5 0 010 10h-2" transform="translate(0 -4)" />
    </>,
  );

export const IconRedo = () =>
  wrap(
    <>
      <path d="M15 8l4 4-4 4" />
      <path d="M19 12h-9a5 5 0 000 10h2" transform="translate(0 -4)" />
    </>,
  );

export const IconSnap = () =>
  wrap(
    <>
      <path d="M4 9h16M4 15h16M9 4v16M15 4v16" />
    </>,
  );

export const IconTrash = () =>
  wrap(
    <>
      <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
    </>,
  );

export const IconFurniture = () =>
  wrap(
    <>
      <path d="M5 11V8a2 2 0 012-2h10a2 2 0 012 2v3" />
      <path d="M3.5 17v-4a1.5 1.5 0 013 0v1.5h11V13a1.5 1.5 0 013 0v4" />
      <path d="M6 17v2M18 17v2M6.5 14.5h11" />
    </>,
  );

export const IconStairs = () =>
  wrap(
    <>
      <path d="M4 20h4v-4h4v-4h4V8h4" />
      <path d="M4 20v-0M20 8v12H4" />
    </>,
  );

export const IconDoor = () =>
  wrap(
    <>
      <path d="M6 20V5a1 1 0 011-1h10a1 1 0 011 1v15M4 20h16" />
      <circle cx="14.5" cy="12.5" r="0.9" />
    </>,
  );

export const IconWindow = () =>
  wrap(
    <>
      <rect x="5" y="4.5" width="14" height="15" rx="1" />
      <path d="M12 4.5v15M5 12h14" />
    </>,
  );
