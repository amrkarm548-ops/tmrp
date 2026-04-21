import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

// Ensure standard TS path resolving works and init telegram
import { initTelegramBot } from './src/server/telegramBot.ts';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  
  app.use(express.json());

  // Internal API to sync website state to a local file for the Bot
  app.post('/api/internal/bot-sync', (req, res) => {
    try {
      const data = req.body;
      const syncPath = path.join(process.cwd(), 'bot-memory.json');
      fs.writeFileSync(syncPath, JSON.stringify(data, null, 2), 'utf-8');
      res.json({ success: true });
    } catch (err: any) {
      console.error("Bot sync error", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Initialize Telegram Bot
  initTelegramBot();
  
  // ... existing socket.io setup ...
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
    },
  });

  app.use(express.json());

  // Socket.io for Multiplayer Quiz
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      console.log(`User ${socket.id} joined room ${roomId}`);
    });

    socket.on('submit-answer', (data) => {
      // Broadcast answer to the room for real-time leaderboard
      io.to(data.roomId).emit('answer-update', {
        userId: socket.id,
        userName: data.userName,
        score: data.score,
      });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Vite middleware for development
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

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
