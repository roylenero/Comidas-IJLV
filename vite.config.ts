/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// El theme color debe coincidir con --brand-primary en src/styles/tokens.css.
const THEME_COLOR = '#2c5f7c';

const REQUIRED_PROD_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

/** Un build de producción sin configuración de Firebase publicaría una app rota: se detiene. */
function assertProductionEnv(mode: string) {
  if (mode !== 'production') return;
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (env.VITE_USE_EMULATORS === 'true') {
    throw new Error('VITE_USE_EMULATORS=true no está permitido en un build de producción.');
  }
  const missing = REQUIRED_PROD_ENV.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Falta configuración de Firebase para producción (${missing.join(', ')}). Crea .env.production.local (ver .env.example).`);
  }
}

export default defineConfig(({ mode, command }) => {
  if (command === 'build') assertProductionEnv(mode);
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Instituto Juan Luis Vives — Comidas',
          short_name: 'IJLV Comidas',
          description: 'Pedidos de desayunos y comidas del Instituto Juan Luis Vives.',
          lang: 'es-MX',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f7f6f2',
          theme_color: THEME_COLOR,
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Solo se cachea la interfaz (app shell). Firestore/Auth son de otro origen y
          // NUNCA pasan por el service worker: los pedidos siempre requieren red real.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: '/index.html',
          // /__/ son rutas reservadas de Firebase Hosting (p. ej. el handler de Auth).
          navigateFallbackDenylist: [/^\/__\//],
          cleanupOutdatedCaches: true,
          runtimeCaching: [],
        },
        devOptions: { enabled: false },
      }),
    ],
    server: { port: 5173 },
    build: {
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 900,
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
    },
  };
});
