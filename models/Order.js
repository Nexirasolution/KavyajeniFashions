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
      district: String,
      state: String,
      pincode: String,
      landmark: String
    },
    subtotal: Number,
    discount: { type: Number, default: 0 },
    couponCode: { type: String, default: '' },
    // Shipping charge worked out from the number of nighties (and the
    // payment method: online and COD can have different charges).
    shippingFee: { type: Number, default: 0 },
    // LEGACY: older COD orders prepaid a "COD handling fee" online. New COD
    // orders are never prepaid, so this stays 0 for them.
    codFee: { type: Number, default: 0 },
    total: Number,
    // 'razorpay' = paid online, 'cod' = Cash on Delivery (all cash on delivery).
    paymentMethod: { type: String, enum: ['razorpay', 'cod'], default: 'razorpay' },
    // 'pending' = COD order (cash due on delivery), or an online order awaiting payment.
    // 'paid' = online order settled, or COD cash collected (set from the admin panel).
    // 'cod_fee_pending' / 'cod_fee_paid' are kept only for COD orders placed
    //   before COD became fully pay-on-delivery.
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
    // Courier chosen at checkout: online -> e.g. "ST Courier",
    // COD -> e.g. "Postal Courier" (names come from the admin settings).
    deliveryPartner: { type: String, default: '' },
    courier: {
      partner: { type: String, default: '' },
      trackingId: { type: String, default: '' },
      awbNumber: { type: String, default: '' }
    },
    notes: { type: String, default: '' },
    // Set on creation to a short window for an online order that is still
    // awaiting payment. The cron sweep cancels and releases stock for any
    // such order still unpaid past this time. COD orders never get an
    // expiresAt (nothing is paid online), so the sweep can't touch them.
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

// In development, drop the cached model so schema edits take effect after a
// hot reload instead of needing a full server restart.
if (process.env.NODE_ENV !== 'production' && mongoose.models.Order) {
  delete mongoose.models.Order;
}

export default mongoose.models.Order || mongoose.model('Order', OrderSchema);