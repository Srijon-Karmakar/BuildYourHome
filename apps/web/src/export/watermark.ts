/**
 * Free exports of the 3D picture carry a small mark in the corner. Premium accounts (subscription or redeem code)
 * get a clean picture and the blueprint files.
 */
export const WATERMARK_TEXT = 'Made with BYHOME · free version';

export async function addWatermark(png: Blob, text: string = WATERMARK_TEXT): Promise<Blob> {
  const bmp = await createImageBitmap(png);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const g = c.getContext('2d');
  if (!g) return png;
  g.drawImage(bmp, 0, 0);
  const size = Math.max(14, Math.round(bmp.width / 55));
  g.font = `600 ${size}px system-ui, sans-serif`;
  const w = g.measureText(text).width;
  const pad = size * 0.7;
  g.fillStyle = 'rgba(17,17,17,0.55)';
  g.beginPath();
  g.roundRect(bmp.width - w - pad * 3, bmp.height - size - pad * 2.4, w + pad * 2, size + pad * 1.4, size * 0.5);
  g.fill();
  g.fillStyle = '#ffffff';
  g.textBaseline = 'middle';
  g.fillText(text, bmp.width - w - pad * 2, bmp.height - size / 2 - pad * 1.7);
  bmp.close();
  return new Promise((res) => c.toBlob((b) => res(b ?? png), 'image/png'));
}
