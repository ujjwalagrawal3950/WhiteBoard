import jwt from 'jsonwebtoken';
import Board from '../models/Board.js';
import cookie from 'cookie';

// Map to track userId -> socketId for owner routing
const userSocketMap = new Map();

export function initSocket(io) {
  // ─── JWT auth middleware on socket connection ────────────────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { userId, email }
      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.userId;
    userSocketMap.set(userId, socket.id);

    // ─── Join a board room ─────────────────────────────────────────────────────
    socket.on('join-board', ({ boardId }) => {
      socket.join(boardId);
    });

    // ─── PHASE 4: Guest requests access ───────────────────────────────────────
    socket.on('request-access', async ({ boardId, guest }) => {
      try {
        const board = await Board.findById(boardId);
        if (!board) return;
        const ownerSocketId = userSocketMap.get(board.ownerId.toString());
        if (ownerSocketId) {
          io.to(ownerSocketId).emit('access-requested', {
            boardId,
            guest,           // { id, name }
            guestSocketId: socket.id,
          });
        }
      } catch (err) {
        console.error('request-access error:', err);
      }
    });

    // ─── PHASE 4: Host grants or denies ───────────────────────────────────────
    socket.on('grant-access', async ({ boardId, guestId, status, guestSocketId }) => {
      try {
        // Update DB
        await Board.findOneAndUpdate(
          { _id: boardId, 'guests.guestId': guestId },
          { $set: { 'guests.$.status': status } }
        );

        const board = await Board.findById(boardId);

        if (status === 'APPROVED') {
          // Tell the guest they're in, send the board elements and comments
          io.to(guestSocketId).emit('access-granted', {
            boardElements: board.elements,
            boardTitle: board.title,
            comments: board.comments || []
          });
          // Add guest socket to the board room
          const guestSocket = io.sockets.sockets.get(guestSocketId);
          if (guestSocket) guestSocket.join(boardId);
        } else {
          io.to(guestSocketId).emit('access-denied');
        }
      } catch (err) {
        console.error('grant-access error:', err);
      }
    });

    // ─── PHASE 5: Real-time element updates ───────────────────────────────────
    socket.on('element-update', ({ boardId, element }) => {
      // Broadcast to everyone in the room EXCEPT the sender
      socket.to(boardId).emit('element-update', element);
    });

    socket.on('element-delete', ({ boardId, elementIds }) => {
      socket.to(boardId).emit('element-delete', { elementIds });
    });

    // ─── PHASE 7: Comments sync ───────────────────────────────────────────────
    socket.on('comment-update', ({ boardId, comment }) => {
      socket.to(boardId).emit('comment-update', comment);
    });

    socket.on('comment-delete', ({ boardId, commentId }) => {
      socket.to(boardId).emit('comment-delete', { commentId });
    });

    // ─── PHASE 5: Live cursor movement ────────────────────────────────────────
    socket.on('cursor-move', ({ boardId, x, y, userName, userId: cursorUserId }) => {
      socket.to(boardId).emit('cursor-moved', { x, y, userName, userId: cursorUserId });
    });

    // ─── Cleanup ──────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      userSocketMap.delete(userId);
    });
  });
}
