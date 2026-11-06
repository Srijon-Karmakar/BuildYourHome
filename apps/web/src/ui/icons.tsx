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

export const IconGarden = () =>
  wrap(
    <>
      <path d="M12 20v-7" />
      <path d="M12 13c-4 0-6-3-6-7 4 0 6 3 6 7zM12 13c4 0 6-3 6-7-4 0-6 3-6 7z" />
      <path d="M5 20h14" />
    </>,
  );

export const IconHand = () =>
  wrap(
    <>
      <path d="M8 12V6.5a1.5 1.5 0 013 0V11M11 11V5a1.5 1.5 0 013 0v6M14 11V6.5a1.5 1.5 0 013 0V13M8 12v1.2l-1.3-1.5a1.4 1.4 0 00-2.1 1.8L8 19.5c1 1.2 2.4 1.5 4 1.5h1.5c2.5 0 4.5-2 4.5-4.5V13" />
    </>,
  );

export const IconPen = () =>
  wrap(
    <>
      <path d="M5 19l1-4L16.5 4.5a1.8 1.8 0 012.5 0l.5.5a1.8 1.8 0 010 2.5L9 18z" />
      <path d="M14.5 6.5l3 3" />
    </>,
  );

export const IconRotL = () =>
  wrap(
    <>
      <path d="M5 9a8 8 0 111.5 8.5" />
      <path d="M5 4v5h5" />
    </>,
  );

export const IconRotR = () =>
  wrap(
    <>
      <path d="M19 9a8 8 0 10-1.5 8.5" />
      <path d="M19 4v5h-5" />
    </>,
  );

export const IconMinus = () => wrap(<path d="M5 12h14" />);

export const IconPlus = () => wrap(<path d="M5 12h14M12 5v14" />);

export const IconRoof = () =>
  wrap(
    <>
      <path d="M3 12L12 4l9 8" />
      <path d="M6 10v9h12v-9" />
    </>,
  );

export const IconRooms = () =>
  wrap(
    <>
      <path d="M4 5h16v14H4zM4 11h8M12 5v14M16 12v4" />
    </>,
  );

export const IconBalcony = () =>
  wrap(
    <>
      <path d="M4 10h16v3H4zM6 13v6M12 13v6M18 13v6M4 19h16" />
      <path d="M6 10V6h12v4" />
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
