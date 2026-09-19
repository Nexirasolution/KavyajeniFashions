import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    image: { type: String, default: '' },
    description: { type: String, default: '' },
    sizes: [{ type: String }], // available size options for filter, e.g. S,M,L,XL,XXL
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null }, // null = top-level category, set = subcategory
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    seoTitle: String,
    seoDescription: String
  },
  { timestamps: true }
);

// Speeds up "give me all subcategories of X" queries used on the admin & category pages
CategorySchema.index({ parent: 1, sortOrder: 1 });

export default mongoose.models.Category || mongoose.model('Category', CategorySchema);