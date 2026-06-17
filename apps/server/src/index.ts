import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { SocketService } from './services/socketService';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

const httpServer = createServer(app);

// Spin up Socket Layer Engine
new SocketService(httpServer);

httpServer.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🌌 LOA REALTIME ENGINE RUNNING ON PORT ${PORT} `);
  console.log(`=========================================`);
});
