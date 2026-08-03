import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    watch: {
      usePolling: true,
      interval: 100,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
    // Hot Module Replacement configuration
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
    // Enable file watching for auto-reload
    middlewareMode: false,
  },
  // Dependency optimization
  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia', 'axios', 'tailwindcss'],
    esbuildOptions: {
      target: 'esnext',
      loader: {
        '.js': 'jsx',
      },
    },
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'js/[name].[hash].js',
        chunkFileNames: 'js/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]',
      },
    },
  },
});
