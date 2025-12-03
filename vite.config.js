import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Optimize build output
    minify: true,
    // Increase chunk size limit for GeoJSON files
    chunkSizeWarningLimit: 1000,
    // Disable source maps for production
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
    middlewareMode: true
  },
  // Optimize static file serving
  assetsInclude: ['**/*.geojson'],
  optimizeDeps: {
    include: ['leaflet']
  }
});
