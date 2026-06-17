import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.GITHUB_PAGES_BASE ?? (process.env.GITHUB_PAGES === 'true' ? '/HBNU-Semiconductor-Center/' : '/'),
  plugins: [react()],
  server: {
    port: 5173
  }
});
