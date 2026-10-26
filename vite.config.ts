import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';
import { calculateRoadDistance } from './src/server/distanceHandler.ts';
import { verifyAdminPassword, validateSessionToken, revokeSessionToken, changeAdminPassword } from './src/server/adminAuth.ts';
import {
  processOrderLineNotification,
  sendToLineNotify,
  startLineNotifyBackgroundWorker,
  getStoreSettingsFromFirestore,
} from './src/server/lineNotifyHandler.ts';
import { streamSourceZip } from './src/server/sourceDownloader.ts';

function backendApiPlugin(): Plugin {
  return {
    name: 'backend-api-plugin',
    configureServer(server) {
      // Start background worker to automatically notify any new unnotified orders from Firestore
      startLineNotifyBackgroundWorker(30000);

      server.middlewares.use(async (req, res, next) => {
        // 1. Distance Calculation Endpoint
        if (req.url?.startsWith('/api/calculate-distance') && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}');
              const { origin, destination, orderSubtotal } = data;

              if (!origin || !destination) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Origin and destination coordinates are required' }));
                return;
              }

              const result = await calculateRoadDistance(origin, destination, Number(orderSubtotal || 0));
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err?.message || 'Calculation error' }));
            }
          });
          return;
        }

        // 2. Admin Login Endpoint
        if (req.url === '/api/admin/login' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const { username, password } = JSON.parse(body || '{}');
              const result = verifyAdminPassword(username, password);
              if (result.success) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(result));
              } else {
                res.statusCode = 401;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(result));
              }
            } catch {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'ข้อมูลคำขอไม่ถูกต้อง' }));
            }
          });
          return;
        }

        // 3. Admin Verify Session Endpoint
        if (req.url === '/api/admin/verify' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const { token } = JSON.parse(body || '{}');
              const isValid = validateSessionToken(token);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ valid: isValid }));
            } catch {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ valid: false }));
            }
          });
          return;
        }

        // 4. Admin Logout Endpoint
        if (req.url === '/api/admin/logout' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const { token } = JSON.parse(body || '{}');
              if (token) revokeSessionToken(token);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            }
          });
          return;
        }

        // 5. Line Notify Order Notification Endpoint
        if ((req.url === '/api/notify-line/send' || req.url === '/api/line-notify/send') && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}');
              const { orderId, order, token } = data;
              const targetOrderId = orderId || order?.id;

              if (!targetOrderId) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, message: 'กรุณาระบุ orderId' }));
                return;
              }

              const result = await processOrderLineNotification(targetOrderId, order, token);
              res.statusCode = result.success ? 200 : 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, message: err?.message || 'Error processing Line notification' }));
            }
          });
          return;
        }

        // 6. Line Notify Test Endpoint
        if ((req.url === '/api/notify-line/test' || req.url === '/api/line-notify/test') && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}');
              let token = data.token;

              if (!token || !token.trim()) {
                const settings = await getStoreSettingsFromFirestore();
                token = settings?.lineNotifyToken || process.env.LINE_NOTIFY_TOKEN || process.env.VITE_LINE_NOTIFY_TOKEN;
              }

              if (!token || !token.trim()) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, message: 'กรุณากรอก LINE Notify Token ก่อนทดสอบ' }));
                return;
              }

              const testMsg = `\n🔔 [ร้านขายถูกที่นี่ชุมแพ] ทดสอบการเชื่อมต่อ LINE Notify สำเร็จ!\nระบบแจ้งเตือนออเดอร์ใหม่พร้อมใช้งานแล้ว เมื่อมีลูกค้าสั่งซื้อสินค้า ข้อความจะส่งเข้าแชทนี้ทันทีโดยไม่ต้องเปิดหน้าจอแอดมินทิ้งไว้ 🎉\n⏰ เวลาทดสอบ: ${new Date().toLocaleString('th-TH')}`;
              const result = await sendToLineNotify(token, testMsg);
              res.statusCode = result.success ? 200 : 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, message: err?.message || 'Server error' }));
            }
          });
          return;
        }

        // GET endpoint test for health check
        if (req.url === '/api/calculate-distance' && req.method === 'GET') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'ok', service: 'chumphae-road-distance-backend' }));
          return;
        }

        // 7. Download Source Code ZIP Endpoint (Admin only)
        if (
          req.url?.startsWith('/chumphae-store-source.zip') ||
          req.url?.startsWith('/api/admin/download-source')
        ) {
          const zipPath = path.resolve(import.meta.dirname, 'public', 'chumphae-store-source.zip');
          if (fs.existsSync(zipPath)) {
            const stat = fs.statSync(zipPath);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Length', stat.size);
            res.setHeader('Content-Disposition', 'attachment; filename="chumphae-store-source.zip"');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

            if (req.method === 'HEAD') {
              res.end();
              return;
            }

            const stream = fs.createReadStream(zipPath);
            stream.pipe(res);
            return;
          }
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), backendApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
