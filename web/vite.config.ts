import { defineConfig } from 'vite';
import path from 'path';

const publicDir = path.resolve(__dirname, '../backend/public');

export default defineConfig({
  build: {
    outDir: publicDir,
    emptyOutDir: false,
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
});
