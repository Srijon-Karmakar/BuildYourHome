import type { Scene } from '@hd/scene-schema';

/** "Villa Rosa" → "villa-rosa" (used for download names). */
export function exportBaseName(scene: Scene): string {
  const slug = scene.meta.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'home';
}

/** Hand a file to the browser's download flow. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
