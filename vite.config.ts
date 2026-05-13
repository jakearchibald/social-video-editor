import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [
    preact(),
    cloudflare({
      experimental: { headersAndRedirectsDevModeSupport: true },
    }),
  ],
  environments: {
    client: {
      build: {
        minify: false,
        rollupOptions: {
          input: {
            index: 'index.html',
          },
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) return 'vendor';
            },
          },
        },
      },
    },
  },
});
