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
          preserveEntrySignatures: 'strict',
          output: {
            preserveModules: true,
            preserveModulesRoot: '.',
          },
        },
      },
    },
  },
});
