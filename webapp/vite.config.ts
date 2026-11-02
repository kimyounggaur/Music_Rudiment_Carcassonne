import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';

/** 아티팩트 빌드에는 서비스워커가 없으므로 등록 함수를 빈 함수로 */
function pwaStub(): Plugin {
  return {
    name: 'pwa-register-stub',
    resolveId(id) { return id === 'virtual:pwa-register' ? '\0pwa-stub' : null; },
    load(id) { return id === '\0pwa-stub' ? 'export function registerSW(){ return () => {}; }' : null; },
  };
}

/** 아티팩트 빌드는 한 파일이라 워커를 만들지 않는다 → 워커 생성 모듈을 빈 모듈로 바꾼다 */
function aiWorkerStub(): Plugin {
  const stub = fileURLToPath(new URL('./src/game/aiWorkerClient.stub.ts', import.meta.url));
  return {
    name: 'ai-worker-stub',
    enforce: 'pre',
    resolveId(id) { return /(^|\/)aiWorkerClient(\.ts)?$/.test(id) ? stub : null; },
  };
}

export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact';
  return {
    base: './',
    define: { __TARGET__: JSON.stringify(artifact ? 'artifact' : 'web') },
    plugins: [
      react({ jsxRuntime: 'classic' }),
      ...(artifact
        ? [pwaStub(), aiWorkerStub(), viteSingleFile({ removeViteModuleLoader: true })]
        : [VitePWA({
          registerType: 'autoUpdate',
          injectRegister: null,
          includeAssets: ['icons/apple-touch-icon.png', 'icons/icon-192.png'],
          manifest: {
            name: '리듬마을',
            short_name: '리듬마을',
            description: '음표 타일을 이어 4박 마디를 완성하는 카르카손형 음악 보드게임',
            lang: 'ko',
            start_url: './',
            scope: './',
            display: 'standalone',
            orientation: 'any',
            background_color: '#EFE3CB',
            theme_color: '#2E6B3F',
            icons: [
              { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
              { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
            navigateFallback: 'index.html',
            runtimeCaching: [
              { urlPattern: /^https:\/\/fonts\.googleapis\.com\//, handler: 'StaleWhileRevalidate', options: { cacheName: 'google-fonts-css' } },
              { urlPattern: /^https:\/\/fonts\.gstatic\.com\//, handler: 'CacheFirst', options: { cacheName: 'google-fonts-files', expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } } },
            ],
          },
        })]),
    ],
    worker: { format: 'es' as const },
    build: artifact
      ? {
        outDir: 'dist-artifact',
        emptyOutDir: true,
        copyPublicDir: false,
        rollupOptions: {
          external: ['react', 'react-dom', 'react-dom/client'],
          output: { format: 'iife', globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' } },
        },
      }
      : { outDir: 'dist-web', emptyOutDir: true },
  };
});
