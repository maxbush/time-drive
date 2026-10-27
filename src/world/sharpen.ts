import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Contrast-adaptive sharpening (a compact take on AMD's CAS): 5 taps, sharpens
// only where there is local contrast and never past the neighbourhood's min/max,
// so it does not ring or amplify noise. Used on phones, where the scene is
// rendered below the screen's native resolution and FXAA softens it further.

const SharpenShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1 / 1024, 1 / 1024) }, // 1 / drawing-buffer size
    uSharp: { value: 0.65 }, // 0 = gentle, 1 = strong
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float uSharp;
    varying vec2 vUv;

    void main() {
      vec3 e = texture2D(tDiffuse, vUv).rgb;
      vec3 b = texture2D(tDiffuse, vUv + vec2(0.0, -resolution.y)).rgb;
      vec3 d = texture2D(tDiffuse, vUv + vec2(-resolution.x, 0.0)).rgb;
      vec3 f = texture2D(tDiffuse, vUv + vec2( resolution.x, 0.0)).rgb;
      vec3 h = texture2D(tDiffuse, vUv + vec2(0.0,  resolution.y)).rgb;

      vec3 mn = min(min(min(d, e), min(f, b)), h);
      vec3 mx = max(max(max(d, e), max(f, b)), h);
      vec3 amp = clamp(min(mn, 1.0 - mx) / max(mx, vec3(1e-4)), 0.0, 1.0);
      amp = sqrt(amp);

      float peak = -1.0 / mix(8.0, 5.0, uSharp);
      vec3 w = amp * peak;
      vec3 col = (b * w + d * w + f * w + h * w + e) / (1.0 + 4.0 * w);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};

export function createSharpenPass(sharpness: number): ShaderPass {
  const pass = new ShaderPass(SharpenShader);
  pass.uniforms.uSharp.value = THREE.MathUtils.clamp(sharpness, 0, 1);
  return pass;
}
