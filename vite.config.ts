import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './', // relative paths — works on GitHub Pages under any repo name
  plugins: [react(), tailwindcss()],
  // local `vite preview` only: never let a browser reuse an old index.html between builds
  preview: { headers: { 'Cache-Control': 'no-store' } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          postprocessing: [
            'three/examples/jsm/postprocessing/EffectComposer.js',
            'three/examples/jsm/postprocessing/RenderPass.js',
            'three/examples/jsm/postprocessing/UnrealBloomPass.js',
            'three/examples/jsm/postprocessing/OutputPass.js',
            'three/examples/jsm/postprocessing/SMAAPass.js',
          ],
        },
      },
    },
  },
});
