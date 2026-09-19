import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';
import Review from '@/models/Review';
import Product from '@/models/Product';

// POST /api/orders/:id/review -> customer rates one product from their own delivered order
export async function POST(req, { params }) {
  await dbConnect();
  const body = await req.json();
  const { phone, productId, rating, comment, images } = body;

  if (!phone || !productId || !rating) {
    return NextResponse.json({ error: 'Phone, product and rating are required' }, { status: 400 });
  }

  const order = await Order.findById(params.id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // verify the phone actually matches this order — prevents anyone with the order id from reviewing it
  const cleanedInput = String(phone).replace(/\D/g, '').slice(-10);
  const cleanedOrder = String(order.customer?.phone || '').replace(/\D/g, '').slice(-10);
  if (!cleanedInput || cleanedInput !== cleanedOrder) {
    return NextResponse.json({ error: 'Phone number does not match this order' }, { status: 403 });
  }

  if (order.status !== 'delivered') {
    return NextResponse.json({ error: 'You can only review items after delivery' }, { status: 400 });
  }

  const item = order.items.find((it) => it.product && String(it.product) === String(productId));
  if (!item) {
    return NextResponse.json({ error: 'This product is not part of your order' }, { status: 400 });
  }

  const existing = await Review.findOne({ order: order._id, product: productId });
  if (existing) {
    return NextResponse.json({ error: 'You already reviewed this product' }, { status: 400 });
  }

  const review = await Review.create({
    product: productId,
    order: order._id,
    customerName: order.customer.name,
    rating: Number(rating),
    comment: comment || '',
    images: Array.isArray(images) ? images : [],
    isApproved: false, // still goes through admin approval, just flagged as a verified purchase
    isVerifiedPurchase: true
  });

  return NextResponse.json({ review, message: 'Thanks for your review! It will appear after approval.' }, { status: 201 });
}