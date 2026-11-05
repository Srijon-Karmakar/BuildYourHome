/**
 * Brand logo. The source PNG is pre-trimmed to its artwork (transparent background)
 * The app is light-only, so the dark-ink variant is used; `logo-loght.png`
 * (white ink) is kept in /public/logo for a future dark theme.
 */
export function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <span className={`brand-logo ${className}`.trim()}>
      <img src="/logo/byhome-dark.png" alt="Home Designer" draggable={false} />
    </span>
  );
}
