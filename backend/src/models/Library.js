import mongoose from 'mongoose';

const librarySchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', trim: true, maxlength: 500 },
  authorId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName:  { type: String, required: true },
  elements:    { type: [mongoose.Schema.Types.Mixed], default: [], validate: [arr => arr.length <= 5000, 'Max 5000 elements per template'] },
  thumbnail:   { type: String, default: '' },   // base64 data URL of preview
  downloads:   { type: Number, default: 0 },
  tags:        { type: [String], default: [] },
  createdAt:   { type: Date, default: Date.now },
});

// Text index for fast full-text search on name, description, tags
librarySchema.index({ name: 'text', description: 'text', tags: 'text' });
// Sort index for popular templates listing
librarySchema.index({ downloads: -1, createdAt: -1 });

export default mongoose.model('Library', librarySchema);
