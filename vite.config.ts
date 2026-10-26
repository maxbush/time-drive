import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './', // relative paths — works on GitHub Pages under any repo name
  plugins: [react(), tailwindcss()],
});
