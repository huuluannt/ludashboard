import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import geminiApiHandler from './api/ai/gemini/[...path].js';
import groqApiHandler from './api/ai/groq/[...path].js';
import calendarApiHandler from './api/calendar/[...path].js';
import driveApiHandler from './api/drive/[...path].js';
import gmailApiHandler from './api/gmail/[...path].js';
import musicApiHandler from './api/music/[...path].js';
import oneDriveApiHandler from './api/onedrive/[...path].js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    process.env[key] ??= value;
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
      name: 'ludashboard-ai-api-dev',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const pathname = req.url?.split('?')[0];
          if (pathname?.startsWith('/api/ai/groq/')) {
            await groqApiHandler(req, res);
            return;
          }
          if (pathname?.startsWith('/api/ai/gemini/')) {
            await geminiApiHandler(req, res);
            return;
          }
          if (pathname?.startsWith('/api/calendar/')) {
            await calendarApiHandler(req, res);
            return;
          }
          if (pathname?.startsWith('/api/drive/')) {
            await driveApiHandler(req, res);
            return;
          }
          if (pathname?.startsWith('/api/gmail/')) {
            await gmailApiHandler(req, res);
            return;
          }
          if (pathname?.startsWith('/api/music/')) {
            await musicApiHandler(req, res);
            return;
          }
          if (pathname?.startsWith('/api/onedrive/')) {
            await oneDriveApiHandler(req, res);
            return;
          }
          next();
        });
      },
      },
      VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icon-192.svg',
        'icon-512.svg',
        'apple-touch-icon.svg',
        'vite.svg',
      ],
      manifest: {
        name: 'LuDashboard',
        short_name: 'LuDashboard',
        description: 'A personal modular workspace system — open independent tools in tabs, like a mini operating environment.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        categories: ['productivity', 'utilities'],
        icons: [
          {
            src: 'icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Never let the SPA navigation fallback handle API/OAuth callback URLs.
        // OAuth popup navigations must reach Vercel Functions directly.
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],

        // Cache all static assets (JS, CSS, HTML, fonts, images)
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],

        // Runtime caching strategies
        runtimeCaching: [
          {
            // Google Fonts stylesheets
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            // Google Fonts webfont files
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            // Google user profile images (avatars)
            urlPattern: /^https:\/\/lh3\.googleusercontent\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-avatars',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true, // Enable PWA in dev for testing
      },
      }),
    ],
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  };
});
