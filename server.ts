import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initializeGameServer } from './apps/server/src/gameServer';
import { authRouter } from './apps/server/src/routes/authRoutes';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // Add JSON body parser middleware
  app.use(express.json());

  // Initialize real-time Socket.IO mechanics
  initializeGameServer(server);

  // Mount Authentication APIs
  app.use('/api/auth', authRouter);

  // Health check API point
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // Integrate Vite dev middleware or serve pre-built assets
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Bind server listener to 0.0.0.0 port 3000 for sandboxed access
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌌 Legends of Psalterion integrated server running on port: ${PORT}`);
  });
}

startServer();
