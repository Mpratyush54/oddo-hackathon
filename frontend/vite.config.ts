import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  envDir: '..',
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/jsqr')) return 'qr-scanner';
          if (id.includes('node_modules/qrcode') || id.includes('node_modules/pngjs'))
            return 'qr-generator';
        },
      },
    },
  },
});
