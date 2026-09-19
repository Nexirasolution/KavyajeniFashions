import mongoose from 'mongoose';

const ReviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null }, // set only for customer reviews tied to a real order
    customerName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
    images: [{ type: String }],
    isApproved: { type: Boolean, default: false },  // ← was true
    isFeatured: { type: Boolean, default: false },
    isVerifiedPurchase: { type: Boolean, default: false } // true only when submitted from a delivered order
  },
  { timestamps: true }
);

export default mongoose.models.Review || mongoose.model('Review', ReviewSchema);