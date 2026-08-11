import express from 'express';
import Board from '../models/Board.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// POST /api/boards — Create a new board
router.post('/', async (req, res) => {
  const board = await Board.create({ ownerId: req.user.userId });
  res.status(201).json(board);
});

// GET /api/boards/my-boards — Get all boards owned by current user
router.get('/my-boards', async (req, res) => {
  const boards = await Board.find({ ownerId: req.user.userId }).sort({ updatedAt: -1 });
  res.json(boards);
});

// GET /api/boards/:id — Get single board (owner or approved guest only)
router.get('/:id', async (req, res) => {
  const board = await Board.findById(req.params.id);
  if (!board) return res.status(404).json({ message: 'Board not found' });

  const isOwner = board.ownerId.toString() === req.user.userId;
  const guestEntry = board.guests.find(g => g.guestId.toString() === req.user.userId);
  const isApproved = guestEntry?.status === 'APPROVED';

  if (!isOwner && !isApproved) {
    // Check if there's a pending entry; if not, upsert PENDING
    if (!guestEntry) {
      board.guests.push({ guestId: req.user.userId, status: 'PENDING' });
      await board.save();
    }
    return res.status(403).json({ message: 'Access pending approval', status: guestEntry?.status ?? 'PENDING' });
  }

  res.json(board);
});

// PATCH /api/boards/:id/save — Overwrite elements (owner or approved guest)
router.patch('/:id/save', async (req, res) => {
  const board = await Board.findById(req.params.id);
  if (!board) return res.status(404).json({ message: 'Board not found' });

  const isOwner = board.ownerId.toString() === req.user.userId;
  const isApproved = board.guests.some(
    g => g.guestId.toString() === req.user.userId && g.status === 'APPROVED'
  );
  if (!isOwner && !isApproved) return res.status(403).json({ message: 'Forbidden' });

  board.elements = req.body.elements ?? board.elements;
  board.comments = req.body.comments ?? board.comments;
  board.updatedAt = new Date();
  await board.save();
  res.json({ message: 'Saved', updatedAt: board.updatedAt });
});

// DELETE /api/boards/:id — Owner only
router.delete('/:id', async (req, res) => {
  const board = await Board.findById(req.params.id);
  if (!board) return res.status(404).json({ message: 'Board not found' });
  if (board.ownerId.toString() !== req.user.userId)
    return res.status(403).json({ message: 'Forbidden' });

  await Board.findByIdAndDelete(req.params.id);
  res.json({ message: 'Board deleted' });
});

export default router;
