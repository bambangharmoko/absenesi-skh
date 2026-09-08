import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rootEnv = loadEnv(mode, '../', '');
  Object.assign(process.env, env, rootEnv);

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'api-send-otp-dev',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url === '/api/send-otp' && req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', async () => {
                try {
                  // @ts-ignore
                  const { default: handler } = await import('../api/send-otp.js');
                  (req as any).body = JSON.parse(body || '{}');
                  await handler(req, res);
                } catch (e: any) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: e.message }));
                }
              });
              return;
            }
            next();
          });
        }
      },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*.png'],
        manifest: {
          name: 'Absensi Siswa SKH Santo Fransiskus Asisi',
          short_name: 'Absensi SKH',
          description: 'Sistem Presensi Siswa Face Recognition Kiosk & Dashboard SKH Santo Fransiskus Asisi',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'any',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        }
      })
    ],
    server: {
      port: 5173,
      host: true,
    }
  };
})
