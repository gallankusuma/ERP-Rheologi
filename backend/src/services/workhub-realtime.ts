import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { dbGet } from '../config/database';

let io: Server | null = null;

export function attachWorkHubRealtime(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',').map((item) => item.trim()).filter(Boolean) || '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
      socket.data.userId = Number(decoded.userId);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = Number(socket.data.userId);
    socket.join(`user:${userId}`);

    socket.on('workhub:join', async (conversationId: number | string, acknowledge?: (result: any) => void) => {
      try {
        const membership = await dbGet(
          'SELECT id FROM workhub_conversation_members WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL',
          [conversationId, userId]
        );
        if (!membership) return acknowledge?.({ ok: false, error: 'Access denied' });
        socket.join(`workhub:${conversationId}`);
        acknowledge?.({ ok: true });
      } catch {
        acknowledge?.({ ok: false, error: 'Unable to join conversation' });
      }
    });

    socket.on('workhub:leave', (conversationId: number | string) => {
      socket.leave(`workhub:${conversationId}`);
    });

    socket.on('workhub:typing', async (payload: { conversation_id: number | string; typing: boolean }) => {
      const conversationId = payload?.conversation_id;
      if (!conversationId) return;
      const membership = await dbGet(
        'SELECT id FROM workhub_conversation_members WHERE conversation_id = ? AND user_id = ? AND archived_at IS NULL',
        [conversationId, userId]
      );
      if (!membership) return;
      socket.to(`workhub:${conversationId}`).emit('workhub:typing', {
        conversation_id: Number(conversationId),
        user_id: userId,
        typing: Boolean(payload.typing),
      });
    });
  });

  return io;
}

export function emitWorkHubMessage(conversationId: number | string, memberIds: number[], message: any) {
  if (!io) return;
  io.to(`workhub:${conversationId}`).emit('workhub:message', message);
  for (const memberId of memberIds) {
    io.to(`user:${memberId}`).emit('workhub:conversation-updated', {
      conversation_id: Number(conversationId),
      message,
    });
  }
}

export function emitWorkHubRead(conversationId: number | string, userId: number, messageId: number | string) {
  io?.to(`workhub:${conversationId}`).emit('workhub:read', {
    conversation_id: Number(conversationId),
    user_id: userId,
    message_id: Number(messageId),
  });
}
