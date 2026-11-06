import logoUrl from '../assets/plotframer-logo.png?inline';

/**
 * Brand logo. The PNG is trimmed to its artwork (transparent background) and embedded in the app bundle
 * (`?inline` = data URI), so it paints together with the screen it sits on, with no separate request.
 * The white-ink variant (`public/logo/logo-loght.png`) is kept for a future dark theme.
 */
export function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <span className={`brand-logo ${className}`.trim()}>
      <img src={logoUrl} width={520} height={182} alt="PlotFramer" decoding="sync" draggable={false} />
    </span>
  );
}
