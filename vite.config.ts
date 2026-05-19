import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import groqChatHandler from './api/ai/groq/chat.js';
import groqTranslateHandler from './api/ai/groq/translate.js';
import geminiChatHandler from './api/ai/gemini/chat.js';
import musicSearchHandler from './api/music/search.js';
import calendarConnectHandler from './api/calendar/connect.js';
import calendarCallbackHandler from './api/calendar/callback.js';
import calendarAccountsHandler from './api/calendar/accounts.js';
import calendarCalendarsHandler from './api/calendar/calendars.js';
import calendarEventsHandler from './api/calendar/events.js';

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
          if (pathname === '/api/ai/groq/chat') {
            await groqChatHandler(req, res);
            return;
          }
          if (pathname === '/api/ai/groq/translate') {
            await groqTranslateHandler(req, res);
            return;
          }
          if (pathname === '/api/ai/gemini/chat') {
            await geminiChatHandler(req, res);
            return;
          }
          if (pathname === '/api/music/search') {
            await musicSearchHandler(req, res);
            return;
          }
          if (pathname === '/api/calendar/connect') {
            await calendarConnectHandler(req, res);
            return;
          }
          if (pathname === '/api/calendar/callback') {
            await calendarCallbackHandler(req, res);
            return;
          }
          if (pathname === '/api/calendar/accounts') {
            await calendarAccountsHandler(req, res);
            return;
          }
          if (pathname === '/api/calendar/calendars') {
            await calendarCalendarsHandler(req, res);
            return;
          }
          if (pathname === '/api/calendar/events') {
            await calendarEventsHandler(req, res);
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
