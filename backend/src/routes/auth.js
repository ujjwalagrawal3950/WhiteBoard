import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const getPrimaryFrontendUrl = () => {
  const urlStr = process.env.FRONTEND_URL || 'https://white-board-lac.vercel.app';
  return urlStr.split(',')[0].trim().replace(/\/+$/, '');
};

// ─── Step 1: Redirect to Google ───────────────────────────────────────────────
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// ─── Step 2: Google callback ──────────────────────────────────────────────────
router.get(
  '/google/callback',
  (req, res, next) => {
    const primaryFrontend = getPrimaryFrontendUrl();
    passport.authenticate('google', { failureRedirect: `${primaryFrontend}/?error=auth`, session: false })(req, res, next);
  },
  (req, res) => {
    const payload = { userId: req.user._id.toString(), email: req.user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const primaryFrontend = getPrimaryFrontendUrl();
    res.redirect(`${primaryFrontend}/dashboard`);
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
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });
  res.json({ message: 'Logged out' });
});

export default router;
