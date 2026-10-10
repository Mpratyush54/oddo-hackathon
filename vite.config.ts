import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
  build: {
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
