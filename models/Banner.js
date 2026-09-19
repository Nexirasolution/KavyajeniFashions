import mongoose from 'mongoose';

const BannerSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    image: { type: String, required: true },
    mobileImage: { type: String, default: '' },
    link: { type: String, default: '' },
    buttonText: { type: String, default: 'Shop Now' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.models.Banner || mongoose.model('Banner', BannerSchema);
