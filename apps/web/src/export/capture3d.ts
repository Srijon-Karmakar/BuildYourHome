/**
 * Bridge between the export menu and the live 3D canvas. The canvas registers a function that renders one frame
 * at higher resolution and returns it as a PNG; the menu only calls `capture3D()`.
 */
type Capture = () => Promise<Blob | null>;

let current: Capture | null = null;

export function registerCapture(fn: Capture): () => void {
  current = fn;
  return () => {
    if (current === fn) current = null;
  };
}

export const hasCapture = (): boolean => current !== null;

export async function capture3D(): Promise<Blob | null> {
  return current ? current() : null;
}
