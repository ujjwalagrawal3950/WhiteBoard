import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  email:    { type: String, required: true },
  displayName: { type: String, required: true },
  avatarUrl: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('User', userSchema);
