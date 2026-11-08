import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        registerType: 'autoUpdate',
        injectRegister: null,
        injectManifest: {
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        },
        manifest: {
          name: 'ИИ Агрономист',
          short_name: 'Агрономист',
          description: 'ИИ помощник для агрономов и фермеров',
          theme_color: '#064e3b',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'https://placehold.co/192x192/064e3b/ffffff/png?text=Agro',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://placehold.co/512x512/064e3b/ffffff/png?text=Agro',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        devOptions: {
          enabled: false
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      hmr: false,
      ws: false,
    },
  };
});
