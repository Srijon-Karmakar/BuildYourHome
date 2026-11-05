import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/**
 * High-tier post-processing: ambient occlusion (grounds furniture/walls, the biggest realism win for interiors),
 * MSAA, and ACES tone mapping (the composer bypasses the renderer's own tone mapping).
 * Lazy-loaded so low/medium devices never download it.
 */
export default function Effects({ msaa }: { msaa: number }) {
  return (
    <EffectComposer multisampling={msaa} enableNormalPass={false}>
      <N8AO aoRadius={0.9} distanceFalloff={1.2} intensity={2.4} quality="medium" halfRes />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
