import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // In dev, Vite proxies /api/* to the Vercel dev server (port 3000)
      // which automatically runs your api/ serverless functions.
      // Start dev with: vercel dev (not npm run dev)
      '/api': {
        target:       'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});