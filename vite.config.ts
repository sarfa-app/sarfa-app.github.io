/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE || '/sarfa/';
  const supabaseOrigin = env.VITE_SUPABASE_URL ? new URL(env.VITE_SUPABASE_URL).origin : '';

  return {
    base,
    build: { target: 'safari14' },
    define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.0.0') },
    plugins: [
      react(),
      {
        // Политика безопасности контента: скрипты только свои, сеть — только к своему Supabase.
        name: 'sarfa-csp',
        transformIndexHtml(html, ctx) {
          // В режиме разработки Vite вставляет встроенные скрипты — там политика не нужна.
          if (ctx.server) return html.replace(/<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/, '');
          return html.replace('%SUPABASE_ORIGIN%', supabaseOrigin);
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Сарфа — бюджет по конвертам',
          short_name: 'Сарфа',
          description: 'Личный бюджет по конвертам',
          lang: 'ru',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#EDEFF1',
          theme_color: '#EDEFF1',
          icons: [
            { src: 'icon-180.png', sizes: '180x180', type: 'image/png' },
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
    },
  };
});
