import * as THREE from 'three';

/**
 * Cheap detail for large ground surfaces, worked out in the shader from the world position (no extra textures):
 *  - colour patches at two large scales (a few metres and ~20 m) so a lawn is not one flat tint and a photo texture does
 *    not show its repeat from above,
 *  - optional fine bumps (a procedural normal tilt at ~0.4 m and ~1.3 m) that catch the low sun; they fade out with distance
 *    so far ground does not shimmer.
 * Costs a few value-noise lookups per pixel; the bumps are left out on Low.
 */
export interface GroundDetailOptions {
  bump: boolean;
  /** How strong the colour patches are (0..1). */
  patches?: number;
}

const NOISE = /* glsl */ `
varying vec3 vGroundW;
float gdHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float gdNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  float a = gdHash(i), b = gdHash(i + vec2(1.0, 0.0)), c = gdHash(i + vec2(0.0, 1.0)), d = gdHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float gdBump(vec2 p) { return gdNoise(p / 0.42) * 0.55 + gdNoise(p / 1.3 + 17.0) * 0.45; }
`;

export function addGroundDetail(mat: THREE.MeshStandardMaterial, opts: GroundDetailOptions): THREE.MeshStandardMaterial {
  const patches = Math.min(1, Math.max(0, opts.patches ?? 1));
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.uniforms.gdPatches = { value: patches };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGroundW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGroundW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    let fs = shader.fragmentShader.replace('#include <common>', `#include <common>\nuniform float gdPatches;\n${NOISE}`);
    // Colour patches: darker / greener and lighter / drier areas.
    fs = fs.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      {
        vec2 gp = vGroundW.xz;
        float m1 = gdNoise(gp / 21.0 + 3.1);
        float m2 = gdNoise(gp / 6.5 - 8.3);
        float m3 = gdNoise(gp / 1.7 + 1.9);
        float v = m1 * 0.55 + m2 * 0.3 + m3 * 0.15;
        vec3 dry = diffuseColor.rgb * vec3(1.18, 1.10, 0.80);
        vec3 lush = diffuseColor.rgb * vec3(0.74, 0.88, 0.72);
        vec3 tinted = mix(lush, dry, smoothstep(0.2, 0.8, v)) * (0.88 + 0.24 * m3);
        // Fine grain up close (blades, soil showing through); faded out with distance so it never flickers.
        float near = 1.0 - smoothstep(6.0, 28.0, length(vViewPosition));
        float grain = gdNoise(gp / 0.16) * 0.6 + gdNoise(gp / 0.06 + 5.0) * 0.4;
        tinted *= mix(1.0, 0.82 + 0.34 * grain, near);
        diffuseColor.rgb = mix(diffuseColor.rgb, tinted, gdPatches);
      }`,
    );
    if (opts.bump) {
      fs = fs.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float fade = 1.0 - smoothstep(14.0, 42.0, length(vViewPosition));
          if (fade > 0.0) {
            vec2 gp = vGroundW.xz;
            float e = 0.06;
            float h0 = gdBump(gp);
            float gx = (gdBump(gp + vec2(e, 0.0)) - h0) / e;
            float gz = (gdBump(gp + vec2(0.0, e)) - h0) / e;
            vec3 tilt = (viewMatrix * vec4(-gx, 0.0, -gz, 0.0)).xyz * 0.24 * fade;
            normal = normalize(normal + tilt);
          }
        }`,
      );
    }
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => `ground-detail-${opts.bump ? 1 : 0}`;
  mat.needsUpdate = true;
  return mat;
}
