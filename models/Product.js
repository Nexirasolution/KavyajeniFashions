import mongoose from 'mongoose';

const VariantSchema = new mongoose.Schema(
  {
    color: { type: String, default: '' }, // optional now
    colorHex: { type: String, default: '#000000' },
    images: [{ type: String }],
    price: { type: Number, required: true },
    compareAtPrice: { type: Number, default: 0 },
    sizes: [
      {
        size: { type: String, required: true },
        stock: { type: Number, default: 0 },
        sku: { type: String }
      }
    ]
  },
  { _id: true }
);

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    fabric: { type: String, default: '' },
    tags: [{ type: String }],
    variants: [VariantSchema],
    basePrice: { type: Number, required: true },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    isBestSeller: { type: Boolean, default: false },
    isTopSeller: { type: Boolean, default: false },
    isActiveSeller: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    soldCount: { type: Number, default: 0 },
    seoTitle: String,
    seoDescription: String
  },
  { timestamps: true }
);

ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);