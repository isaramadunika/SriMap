import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Optimize build output
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true
      }
    },
    // Increase chunk size limit for GeoJSON files
    chunkSizeWarningLimit: 1000,
    // Enable source maps for production debugging
    sourcemap: false,
    // Optimize rollup bundling
    rollupOptions: {
      output: {
        // Manual chunks to optimize loading
        manualChunks: {
          'leaflet': ['leaflet']
        }
      }
    }
  },
  server: {
    // Optimize development server
    middlewareMode: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost'
    }
  },
  // Optimize static file serving
  assetsInclude: ['**/*.geojson'],
  optimizeDeps: {
    include: ['leaflet']
  }
});
