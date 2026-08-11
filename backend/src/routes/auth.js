import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ─── Step 1: Redirect to Google ───────────────────────────────────────────────
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// ─── Step 2: Google callback ──────────────────────────────────────────────────
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}/?error=auth`, session: false }),
  (req, res) => {
    const payload = { userId: req.user._id.toString(), email: req.user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }
);

// ─── Step 3: Get current user ─────────────────────────────────────────────────
router.get('/me', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.userId).select('-__v');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({
    id:          user._id,
    name:        user.displayName,
    email:       user.email,
    avatar:      user.avatarUrl,
  });
});

// ─── Step 4: Logout ──────────────────────────────────────────────────────────
router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

export default router;
