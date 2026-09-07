import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],


  server: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0', // Bind to all network interfaces for public access
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: { '*': '' },
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const cookies = proxyRes.headers['set-cookie'];
            if (cookies) {
              proxyRes.headers['set-cookie'] = cookies.map(c =>
                c.replace(/Domain=[^;]+;?/gi, '')
              );
            }
          });
        },
      },
      '/socket.io': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist', // Changed from 'build' to 'dist' for Vercel compatibility
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('react')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/react-router-dom')) {
            return 'router-vendor';
          }
          if (id.includes('node_modules/socket.io-client')) {
            return 'socket-vendor';
          }
          if (id.includes('node_modules/recharts')) {
            return 'chart-vendor';
          }
        },
      },
    },
  },
  define: {
    'process.env': '{}',
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  }

});