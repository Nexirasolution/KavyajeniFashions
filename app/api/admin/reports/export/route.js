import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';
import { requireAdmin } from '@/lib/apiAuth';

// GET /api/admin/reports/export?from=2026-01-01&to=2026-01-31 -> CSV download
export const GET = requireAdmin(async (req) => {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const query = {};
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to + 'T23:59:59');
  }
  const orders = await Order.find(query).sort({ createdAt: -1 });

  const header = [
    'Order Number', 'Date', 'Customer', 'Phone', 'Items', 'Subtotal', 'Discount',
    'Coupon', 'Shipping', 'Total', 'Payment Method', 'Payment Status', 'Order Status'
  ];
  const rows = orders.map((o) => [
    o.orderNumber,
    new Date(o.createdAt).toLocaleString('en-IN'),
    o.customer?.name || '',
    o.customer?.phone || '',
    o.items.map((i) => `${i.name} (${i.color}/${i.size} x${i.qty})`).join('; '),
    o.subtotal,
    o.discount,
    o.couponCode,
    o.shippingFee,
    o.total,
    o.paymentMethod,
    o.paymentStatus,
    o.status
  ]);

  const csv = [header, ...rows]
    .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="sales-report-${Date.now()}.csv"`
    }
  });
});
