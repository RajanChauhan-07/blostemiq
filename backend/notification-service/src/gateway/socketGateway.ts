import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { readFileSync, existsSync } from 'fs';
import { logger } from '../lib/logger';

// ─── Connection registry ──────────────────────────────────
// orgId → Set<socketId>  — tells us which sockets belong to which org
const orgRooms = new Map<string, Set<string>>();
let _io: Server;

// ─── Metrics ─────────────────────────────────────────────
let totalConnections = 0;
let totalNotificationsSent = 0;

export function getMetrics() {
  return {
    connectedClients: _io?.sockets?.sockets?.size ?? 0,
    totalConnections,
    totalNotificationsSent,
    orgRooms: Object.fromEntries([...orgRooms.entries()].map(([k, v]) => [k, v.size])),
  };
}

// ─── JWT verification ─────────────────────────────────────
function verifyToken(token: string): { userId: string; orgId: string } | null {
  try {
    // Try RS256 first (our JWT format)
    const pubKeyPath = process.env.JWT_PUBLIC_KEY_PATH;
    if (pubKeyPath && existsSync(pubKeyPath)) {
      const pubKey = readFileSync(pubKeyPath);
      const payload = jwt.verify(token, pubKey, { algorithms: ['RS256'] }) as jwt.JwtPayload;
      return { userId: payload.sub!, orgId: payload.orgId };
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;
    return { userId: payload.sub!, orgId: payload.orgId };
  } catch {
    return null;
  }
}

// ─── Init Socket Gateway ──────────────────────────────────
export function initSocketGateway(httpServer: HttpServer): Server {
  _io = new Server(httpServer, {
    cors: {
      origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  // ─── Auth middleware ────────────────────────────────────
  _io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      // Allow unauthenticated in dev for easy testing
      if (process.env.NODE_ENV === 'development') {
        socket.data.orgId = socket.handshake.query?.orgId || 'dev-org';
        socket.data.userId = 'dev-user';
        return next();
      }
      return next(new Error('Authentication required'));
    }

    const payload = verifyToken(token);
    if (!payload) return next(new Error('Invalid token'));

    socket.data.userId = payload.userId;
    socket.data.orgId = payload.orgId;
    next();
  });

  // ─── Connection handler ─────────────────────────────────
  _io.on('connection', (socket: Socket) => {
    const { orgId, userId } = socket.data;
    totalConnections++;

    // Join org room — all dashboard tabs for this org receive the same events
    socket.join(`org:${orgId}`);
    if (!orgRooms.has(orgId)) orgRooms.set(orgId, new Set());
    orgRooms.get(orgId)!.add(socket.id);

    logger.info({ socketId: socket.id, orgId, userId }, '🔌 Client connected');

    // Send current connection confirmation
    socket.emit('CONNECTED', {
      socketId: socket.id,
      orgId,
      serverTime: new Date().toISOString(),
    });

    // ─── Client can subscribe to specific partners ────────
    socket.on('WATCH_PARTNER', (partnerId: string) => {
      socket.join(`partner:${orgId}:${partnerId}`);
      logger.debug({ socketId: socket.id, partnerId }, 'Watching partner');
    });

    socket.on('UNWATCH_PARTNER', (partnerId: string) => {
      socket.leave(`partner:${orgId}:${partnerId}`);
    });

    // ─── Ping/pong for latency measurement ───────────────
    socket.on('PING', () => socket.emit('PONG', { ts: Date.now() }));

    // ─── Disconnect ───────────────────────────────────────
    socket.on('disconnect', (reason) => {
      orgRooms.get(orgId)?.delete(socket.id);
      if (orgRooms.get(orgId)?.size === 0) orgRooms.delete(orgId);
      logger.info({ socketId: socket.id, orgId, reason }, '🔌 Client disconnected');
    });
  });

  return _io;
}

// ─── Broadcast helpers (called by consumers) ─────────────

export function broadcastToOrg(orgId: string, event: string, payload: unknown) {
  if (!_io) return;
  _io.to(`org:${orgId}`).emit(event, payload);
  totalNotificationsSent++;
  logger.debug({ orgId, event }, '📤 Broadcast to org');
}

export function broadcastToPartner(orgId: string, partnerId: string, event: string, payload: unknown) {
  if (!_io) return;
  _io.to(`partner:${orgId}:${partnerId}`).emit(event, payload);
  totalNotificationsSent++;
}

export function broadcastToAll(event: string, payload: unknown) {
  if (!_io) return;
  _io.emit(event, payload);
  totalNotificationsSent++;
}
