import mongoose from 'mongoose';

const ComboSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    image: { type: String, default: '' },
    description: { type: String, default: '' },
    products: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        variantId: { type: String },
        size: { type: String }
      }
    ],
    comboPrice: { type: Number, required: true },
    originalPrice: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.models.Combo || mongoose.model('Combo', ComboSchema);
