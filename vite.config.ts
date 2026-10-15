import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { readFileSync } from 'fs';
import path from 'path';
import { viteEnvs } from 'vite-envs';
import { VitePWA, VitePWAOptions } from 'vite-plugin-pwa';

const pwaManifest: Partial<VitePWAOptions> = {
  // main.tsx asks before reloading into a new version
  registerType: 'prompt',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    // The store screenshots are only for the install dialog, never needed offline
    globIgnores: ['**/screenshot_*'],
    // The map chunk (maplibre) is larger than workbox's 2 MB default
    maximumFileSizeToCacheInBytes: 1024 * 1024 * 5,
    importScripts: ['push-sw.js'],
    // The API shares the origin under /api (https://jotihunt.silkepilon.dev/api); its URLs (e.g. the APK download) are never app routes
    navigateFallbackDenylist: [/^\/api(\/|$)/],
    // Would follow build.sourcemap but reference the maps from sw.js; Sentry doesn't run in the service worker
    sourcemap: false,
  },
  manifest: {
    name: 'Jotihunt Tracker',
    short_name: 'Jotihunt Tracker',
    description: 'Volg de Jotihunt in real-time met de Jotihunt Tracker!',
    // Lets Chrome's getInstalledRelatedApps() see the Android app (the APK also needs an asset statement for this site)
    related_applications: [{ platform: 'play', url: 'https://play.google.com/store/apps/details?id=nl.jotihunt.tracker', id: 'nl.jotihunt.tracker' }],
    prefer_related_applications: false,
    icons: [
      {
        src: 'pwa-64x64.png',
        sizes: '64x64',
        type: 'image/png',
      },
      {
        src: 'pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: 'icon_maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    // Demo-mode data, light and dark (the install dialog shows them as a carousel)
    screenshots: [
      {
        src: 'screenshot_wide_light.webp',
        sizes: '3800x2136',
        type: 'image/webp',
        form_factor: 'wide',
        label: 'Jotihunt Tracker: kaart met vossen, hints en hunts (licht)',
      },
      {
        src: 'screenshot_wide_dark.webp',
        sizes: '3800x2136',
        type: 'image/webp',
        form_factor: 'wide',
        label: 'Jotihunt Tracker: kaart met vossen, hints en hunts (donker)',
      },
      {
        src: 'screenshot_narrow_light.webp',
        sizes: '900x1600',
        type: 'image/webp',
        form_factor: 'narrow',
        label: 'Jotihunt Tracker: kaart met vossen, hints en hunts (licht)',
      },
      {
        src: 'screenshot_narrow_dark.webp',
        sizes: '900x1600',
        type: 'image/webp',
        form_factor: 'narrow',
        label: 'Jotihunt Tracker: kaart met vossen, hints en hunts (donker)',
      },
    ],
  },
};

// Source maps go to Sentry in the CI image build (SENTRY_AUTH_TOKEN as a build secret) and are deleted from dist/
// afterwards; without a token (local builds, `vite preview` at container start) the plugin is left out
const sentryRelease = process.env.GIT_SHA || JSON.parse(readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf-8')).version;
const uploadSourceMaps = !!process.env.SENTRY_AUTH_TOKEN?.trim();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteEnvs({
      declarationFile: '.env.example',
      computedEnv: async () => {
        const path = await import('path');
        const fs = await import('fs/promises');

        const packageJson = JSON.parse(await fs.readFile(path.resolve(import.meta.dirname, 'package.json'), 'utf-8'));

        return {
          BUILD_TIME: Date.now(),
          VERSION: packageJson.version,
          // Git commit of the build (CI build arg), reported as the Sentry release; the version when built locally
          SENTRY_RELEASE: sentryRelease,
        };
      },
    }),
    VitePWA(pwaManifest),
    ...(uploadSourceMaps
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            release: { name: sentryRelease },
            sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
            telemetry: false,
          }),
        ]
      : []),
  ],
  legacy: {
    // react-auth-kit / @auth-kit/react-router ship Babel-compiled CommonJS
    // (`exports.default` + `__esModule`). Vite 8 follows Node semantics for
    // default imports from a `"type": "module"` package, which would resolve
    // those default imports to the whole `module.exports` object.
    inconsistentCjsInterop: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  preview: {
    port: 80,
    strictPort: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    allowedHosts: true
  },
  worker: {
    // MapLibre's worker is an ES module worker
    format: 'es',
  },
  build: {
    // Generated for the Sentry upload but not referenced from the JS, so browsers never fetch them
    sourcemap: 'hidden',
    rolldownOptions: {
      output: {
        chunkFileNames: '[name].[hash].js',
      },
    },
  },
});
