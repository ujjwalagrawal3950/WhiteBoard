import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

import configurePassport from './src/config/passport.js';
import authRouter from './src/routes/auth.js';
import boardsRouter from './src/routes/boards.js';
import librariesRouter from './src/routes/libraries.js';
import { initSocket } from './src/socket/index.js';

const app = express();
app.set('trust proxy', 1);
const httpServer = createServer(app);

// ─── CORS Configuration ────────────────────────────────────────────────────────
const allowedOrigins = [
  ...(process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((u) => u.trim().replace(/\/+$/, ''))
    : []),
  'https://white-board-lac.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow non-browser requests (curl, postman, server-to-server)
  const normalizedOrigin = origin.replace(/\/+$/, '');
  if (allowedOrigins.includes(normalizedOrigin)) return true;
  try {
    const hostname = new URL(origin).hostname;
    if (hostname.endsWith('.vercel.app')) return true;
  } catch (_e) {
    // Ignore URL parse error
  }
  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// ─── Body / Cookie parsing ─────────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());

// ─── Passport (no sessions) ────────────────────────────────────────────────────
configurePassport();
app.use(passport.initialize());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/boards', boardsRouter);
app.use('/api/libraries', librariesRouter);

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Socket CORS blocked origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
});
initSocket(io);

// ─── Error handler ────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message });
});

// ─── Connect to MongoDB & start server ────────────────────────────────────────
const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅  MongoDB connected');
    httpServer.listen(PORT, () => console.log(`🚀  Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('❌  MongoDB connection error:', err);
    process.exit(1);
  });
