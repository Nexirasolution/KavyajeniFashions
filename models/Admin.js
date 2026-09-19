import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema(
  {
    name: { type: String, default: 'Admin' },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'owner' }
  },
  { timestamps: true }
);

export default mongoose.models.Admin || mongoose.model('Admin', AdminSchema);
