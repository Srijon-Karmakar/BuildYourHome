import logoUrl from '../assets/plotframer-logo.png?inline';
import logoLightUrl from '../assets/plotframer-logo-light.png?inline';

/**
 * Brand logo. The PNGs are trimmed to their artwork (transparent background, 520x182) and embedded in the app bundle
 * (`?inline` = data URI), so they paint together with the screen they sit on, with no separate request.
 * `light` = the white-ink variant for dark backgrounds (made from `public/logo/logo-loght.png`).
 */
export function BrandLogo({ className = '', light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`brand-logo ${className}`.trim()}>
      <img
        src={light ? logoLightUrl : logoUrl}
        width={520}
        height={182}
        alt="PlotFramer"
        decoding="sync"
        draggable={false}
      />
    </span>
  );
}
