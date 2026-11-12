/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Sisältöturvakäytäntö vain tuotantoversioon (SPEC 11): yhteydet vain omaan alkuperään.
// Kehityspalvelin tarvitsee inline-skriptejä (HMR), joten sitä ei rajata.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const cspPlugin = (): Plugin => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
  ],
});

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cspPlugin(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Liikkumisen seuranta',
        short_name: 'Liikkuminen',
        description: 'Lapsen ja aikuisen liikkumisen seuranta suhteessa suomalaisiin liikkumissuosituksiin.',
        lang: 'fi',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        // PC: otsikkopalkki sulautuu sovellukseen (sivupalkin väri); muuten tavallinen ikkuna.
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'portrait',
        background_color: '#f6f5f0',
        theme_color: '#1f4a5b',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Tehtäväpalkin / aloitusvalikon pikatoiminnot (hiiren oikea painike kuvakkeesta).
        shortcuts: [
          { name: 'Kirjaa liikunta', short_name: 'Kirjaa', url: './?action=add', icons: [{ src: 'pwa-192.png', sizes: '192x192' }] },
          { name: 'Synkronoi puhelimen kanssa', short_name: 'Synkronoi', url: './?action=sync', icons: [{ src: 'pwa-192.png', sizes: '192x192' }] },
          { name: 'Käy viikko läpi', short_name: 'Läpikäynti', url: './?action=review', icons: [{ src: 'pwa-192.png', sizes: '192x192' }] },
        ],
        // Asennusikkunan esikatselukuvat (esimerkkiprofiili, ei oikeita tietoja).
        screenshots: [
          { src: 'screenshot-wide.png', sizes: '1280x800', type: 'image/png', form_factor: 'wide', label: 'Viikkonäkymä PC:llä' },
          { src: 'screenshot-narrow.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'Viikkonäkymä puhelimella' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        globIgnores: ['**/screenshot-*.png'], // asennusikkunan kuvat eivät kuulu välimuistiin
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
