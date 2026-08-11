import mongoose from 'mongoose';

const guestSchema = new mongoose.Schema({
  guestId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status:  { type: String, enum: ['PENDING', 'APPROVED', 'DENIED'], default: 'PENDING' },
}, { _id: false });

const boardSchema = new mongoose.Schema({
  ownerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:    { type: String, default: 'Untitled Board' },
  elements: { type: [mongoose.Schema.Types.Mixed], default: [] },
  comments: { type: [mongoose.Schema.Types.Mixed], default: [] },
  guests:   { type: [guestSchema], default: [] },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model('Board', boardSchema);
