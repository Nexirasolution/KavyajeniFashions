import mongoose from 'mongoose';

const OrderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    comboId: { type: mongoose.Schema.Types.ObjectId, ref: 'Combo', default: null },
    name: String,
    image: String,
    color: String,
    size: String,
    price: Number,
    qty: Number,
    isCombo: { type: Boolean, default: false }
  },
  { _id: false }
);

const StockReservationSchema = new mongoose.Schema(
  {
    productId: mongoose.Schema.Types.ObjectId,
    variantId: mongoose.Schema.Types.ObjectId,
    size: String,
    qty: Number
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    items: [OrderItemSchema],
    customer: {
      name: String,
      phone: String,
      email: String
    },
    shippingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String
    },
    subtotal: Number,
    discount: { type: Number, default: 0 },
    couponCode: { type: String, default: '' },
    shippingFee: { type: Number, default: 0 },
    total: Number,
    // Razorpay is the only payment method now.
    paymentMethod: { type: String, enum: ['razorpay'], default: 'razorpay' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    status: {
      type: String,
      enum: ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'],
      default: 'placed'
    },
    courier: {
      partner: { type: String, default: '' },
      trackingId: { type: String, default: '' },
      awbNumber: { type: String, default: '' }
    },
    notes: { type: String, default: '' },
    // Set on creation to a short window (~15 min). The cron sweep cancels
    // and releases stock for any order still 'pending' past this time
    // (i.e. the customer never completed or abandoned payment cleanly).
    // Cleared once paymentStatus leaves 'pending'.
    expiresAt: { type: Date, default: null },
    // Exact stock deltas reserved for this order, kept separately from
    // `items` so a webhook or cron job — running long after the original
    // request — knows precisely what to give back on failure/expiry.
    stockReservations: { type: [StockReservationSchema], default: [] }
  },
  { timestamps: true }
);

OrderSchema.index({ razorpayOrderId: 1 }, { unique: true, sparse: true });
OrderSchema.index({ paymentMethod: 1, paymentStatus: 1, expiresAt: 1 });

export default mongoose.models.Order || mongoose.model('Order', OrderSchema);