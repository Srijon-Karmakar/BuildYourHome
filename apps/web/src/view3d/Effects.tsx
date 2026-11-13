import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/**
 * High-tier post-processing: ambient occlusion (grounds furniture/walls, the biggest realism win for interiors),
 * MSAA, and ACES tone mapping (the composer bypasses the renderer's own tone mapping).
 * Lazy-loaded so low/medium devices never download it.
 */
export default function Effects({ msaa, quality, bloom, smaa }: { msaa: number; quality: 'performance' | 'medium'; bloom: boolean; smaa: boolean }) {
  return (
    <EffectComposer multisampling={msaa} enableNormalPass={false}>
      <N8AO aoRadius={0.9} distanceFalloff={1.2} intensity={2.4} quality={quality} halfRes />
      {bloom && <Bloom intensity={0.55} luminanceThreshold={0.95} luminanceSmoothing={0.25} mipmapBlur radius={0.7} />}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {smaa && <SMAA />}
    </EffectComposer>
  );
}
