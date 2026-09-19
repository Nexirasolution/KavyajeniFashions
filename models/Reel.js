import mongoose from 'mongoose';

const ReelSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    videoUrl: { type: String, required: true }, // mp4 or instagram embed url
    thumbnail: { type: String, default: '' },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    instagramLink: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.models.Reel || mongoose.model('Reel', ReelSchema);
