/**
 * Bridge between the Views panel and the live 3D canvas: the canvas registers how to read and move the orbit camera.
 */
export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}
interface CameraApi {
  get(): CameraPose;
  fly(to: CameraPose): void;
}

let current: CameraApi | null = null;

export function registerCamera(api: CameraApi): () => void {
  current = api;
  return () => {
    if (current === api) current = null;
  };
}
export const hasCamera = (): boolean => current !== null;
export const getCameraPose = (): CameraPose | null => (current ? current.get() : null);
export const flyCameraTo = (pose: CameraPose): void => current?.fly(pose);
