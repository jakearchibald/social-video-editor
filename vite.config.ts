import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import preact from '@preact/preset-vite';
import fsShim from './fs-shim/vite-plugin.ts';

export default defineConfig({
  plugins: [
    fsShim(),
    preact(),
    cloudflare({
      experimental: { headersAndRedirectsDevModeSupport: true },
    }),
  ],
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: {
            index: 'index.html',
          },
        },
      },
    },
  },
});
