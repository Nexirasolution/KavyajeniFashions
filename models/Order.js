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
    // Extra charge added for Cash on Delivery orders (0 for online orders).
    codFee: { type: Number, default: 0 },
    total: Number,
    // 'razorpay' = paid online, 'cod' = Cash on Delivery.
    paymentMethod: { type: String, enum: ['razorpay', 'cod'], default: 'razorpay' },
    // 'pending' = zero-fee COD order, or a plain online order awaiting payment.
    // 'cod_fee_pending' = COD order created, waiting on its handling-fee charge.
    // 'cod_fee_paid' = COD order's fee is settled online; the rest is cash on
    //   delivery — set to 'paid' from the admin panel once that cash is collected.
    // 'paid' = a plain online order, fully settled.
    paymentStatus: {
      type: String,
      enum: ['pending', 'cod_fee_pending', 'cod_fee_paid', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
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
    // Set on creation to a short window (~15 min) for any order with money
    // still outstanding online — a plain online order, or a COD order with a
    // fee still due ('pending' or 'cod_fee_pending'). The cron sweep cancels
    // and releases stock for any such order still unpaid past this time.
    // A zero-fee COD order never gets an expiresAt, so the sweep can't touch
    // it. Cleared once paymentStatus reaches a settled state.
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

// In development, drop the cached model so schema edits (like adding 'cod')
// take effect after a hot reload instead of needing a full server restart.
if (process.env.NODE_ENV !== 'production' && mongoose.models.Order) {
  delete mongoose.models.Order;
}

export default mongoose.models.Order || mongoose.model('Order', OrderSchema);