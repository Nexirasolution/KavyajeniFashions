import mongoose from 'mongoose';
import Product from '@/models/Product';
import Combo from '@/models/Combo';
import Coupon from '@/models/Coupon';
import Settings from '@/models/Settings';
import { genCouponCheck } from '@/lib/utils';

export async function tryDecrementStock(productId, variantId, size, qty) {
  const updated = await Product.findOneAndUpdate(
    {
      _id: productId,
      'variants._id': variantId,
      'variants.sizes.size': size,
      'variants.sizes.stock': { $gte: qty }
    },
    { $inc: { 'variants.$[v].sizes.$[s].stock': -qty, soldCount: qty } },
    { arrayFilters: [{ 'v._id': variantId }, { 's.size': size }] }
  );
  return !!updated;
}

export async function restoreStock(productId, variantId, size, qty) {
  await Product.updateOne(
    { _id: productId, 'variants._id': variantId, 'variants.sizes.size': size },
    { $inc: { 'variants.$[v].sizes.$[s].stock': qty, soldCount: -qty } },
    { arrayFilters: [{ 'v._id': variantId }, { 's.size': size }] }
  );
}

export async function rollbackStock(reservations = []) {
  for (const d of reservations) {
    await restoreStock(d.productId, d.variantId, d.size, d.qty);
  }
}

export async function releaseCoupon(couponCode) {
  if (!couponCode) return;
  await Coupon.updateOne({ code: couponCode }, { $inc: { usedCount: -1 } });
}

// Validates cart items against the DB and atomically reserves stock for
// each one. Returns { orderItems, subtotal, decremented } where
// `decremented` is the exact list needed to reverse the reservation later
// (this gets persisted on the Order as `stockReservations` — it's the only
// way a webhook/cron job, running long after this request, can know what
// to give back).
export async function reserveItemsAndBuildOrder(items) {
  const decremented = [];
  let subtotal = 0;
  const orderItems = [];

  try {
    for (const item of items) {
      if (item.isCombo === true && item.comboId) {
        if (!mongoose.Types.ObjectId.isValid(item.comboId)) continue;
        const combo = await Combo.findById(item.comboId);
        if (!combo || !combo.isActive) {
          const err = new Error('This combo is no longer available');
          err.status = 400;
          throw err;
        }
        for (const sub of combo.products) {
          const ok = await tryDecrementStock(sub.product, sub.variantId, sub.size, item.qty);
          if (!ok) {
            const err = new Error(`Combo "${combo.name}" is out of stock`);
            err.status = 409;
            throw err;
          }
          decremented.push({ productId: sub.product, variantId: sub.variantId, size: sub.size, qty: item.qty });
        }
        subtotal += combo.comboPrice * item.qty;
        orderItems.push({
          product: null,
          comboId: combo._id,
          name: combo.name,
          image: combo.image || '',
          color: '',
          size: '',
          price: combo.comboPrice,
          qty: item.qty,
          isCombo: true
        });
        continue;
      }

      if (!mongoose.Types.ObjectId.isValid(item.productId) || !mongoose.Types.ObjectId.isValid(item.variantId)) {
        continue;
      }
      const product = await Product.findById(item.productId);
      if (!product) continue;
      const variant = product.variants.id(item.variantId);
      if (!variant) continue;
      const sizeEntry = variant.sizes.find((s) => s.size === item.size);
      if (!sizeEntry) continue;

      const ok = await tryDecrementStock(item.productId, item.variantId, item.size, item.qty);
      if (!ok) {
        const err = new Error(`${product.name} (${variant.color}, ${item.size}) is out of stock`);
        err.status = 409;
        throw err;
      }
      decremented.push({ productId: item.productId, variantId: item.variantId, size: item.size, qty: item.qty });

      subtotal += variant.price * item.qty;
      orderItems.push({
        product: product._id,
        name: product.name,
        image: variant.images?.[0] || '',
        color: variant.color,
        size: item.size,
        price: variant.price,
        qty: item.qty
      });
    }
  } catch (err) {
    await rollbackStock(decremented);
    throw err;
  }

  if (!orderItems.length) {
    await rollbackStock(decremented);
    const err = new Error('No valid items in cart');
    err.status = 400;
    throw err;
  }

  return { orderItems, subtotal, decremented };
}

export async function applyCouponToSubtotal(couponCode, subtotal) {
  let discount = 0;
  let appliedCoupon = '';
  if (!couponCode) return { discount, appliedCoupon };
  const coupon = await Coupon.findOne({ code: genCouponCheck(couponCode), isActive: true });
  if (coupon && subtotal >= (coupon.minOrderValue || 0)) {
    if (!coupon.expiresAt || coupon.expiresAt > new Date()) {
      if (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit) {
        discount = coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value;
        if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
        appliedCoupon = coupon.code;
        coupon.usedCount += 1;
        await coupon.save();
      }
    }
  }
  return { discount, appliedCoupon };
}

export async function computeShippingFee(subtotalAfterDiscount) {
  const settings = (await Settings.findOne({ key: 'global' })) || { shippingFee: 49, freeShippingAbove: 999 };
  return subtotalAfterDiscount >= settings.freeShippingAbove ? 0 : settings.shippingFee;
}