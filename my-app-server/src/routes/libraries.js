import express from 'express';
import Library from '../models/Library.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ─── GET /api/libraries — List templates (public, paginated) ──────────────────
router.get('/', async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  let filter = {};
  let sort = { downloads: -1, createdAt: -1 };

  if (search && search.trim()) {
    filter.$text = { $search: search.trim() };
    sort = { score: { $meta: 'textScore' }, downloads: -1 };
  }

  const [templates, total] = await Promise.all([
    Library.find(filter, search ? { score: { $meta: 'textScore' } } : undefined)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .select('-elements')  // Don't send full elements in listing — saves bandwidth
      .lean(),
    Library.countDocuments(filter),
  ]);

  res.json({
    templates,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
    total,
  });
});

// ─── GET /api/libraries/:id — Get single template with full elements ──────────
router.get('/:id', async (req, res) => {
  const template = await Library.findById(req.params.id).lean();
  if (!template) return res.status(404).json({ message: 'Template not found' });
  res.json(template);
});

// ─── POST /api/libraries — Upload a new template (auth required) ──────────────
// router.post('/', authenticateToken, async (req, res) => { // User requested to disable auth
router.post('/', async (req, res) => {
  const { name, description, elements, thumbnail, tags } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Template name is required' });
  }
  if (!elements || !Array.isArray(elements) || elements.length === 0) {
    return res.status(400).json({ message: 'At least one element is required' });
  }
  if (elements.length > 5000) {
    return res.status(400).json({ message: 'Max 5000 elements per template' });
  }

  // Look up user display name
  const User = (await import('../models/User.js')).default;
  const user = req.user ? await User.findById(req.user.userId).lean() : null;
  const authorName = user?.displayName || 'Guest';

  const template = await Library.create({
    name: name.trim(),
    description: (description || '').trim(),
    authorId: req.user?.userId || undefined,
    authorName,
    elements,
    thumbnail: thumbnail || '',
    tags: Array.isArray(tags) ? tags.slice(0, 10).map(t => t.trim().toLowerCase()) : [],
  });

  res.status(201).json(template);
});

// ─── PATCH /api/libraries/:id/download — Increment download counter ───────────
router.patch('/:id/download', async (req, res) => {
  const result = await Library.findByIdAndUpdate(
    req.params.id,
    { $inc: { downloads: 1 } },
    { new: true, select: 'downloads' }
  );
  if (!result) return res.status(404).json({ message: 'Template not found' });
  res.json({ downloads: result.downloads });
});

// ─── DELETE /api/libraries/:id — Delete own template (auth required) ──────────
router.delete('/:id', authenticateToken, async (req, res) => {
  const template = await Library.findById(req.params.id);
  if (!template) return res.status(404).json({ message: 'Template not found' });
  if (template.authorId.toString() !== req.user.userId) {
    return res.status(403).json({ message: 'You can only delete your own templates' });
  }
  await Library.findByIdAndDelete(req.params.id);
  res.json({ message: 'Template deleted' });
});

export default router;
