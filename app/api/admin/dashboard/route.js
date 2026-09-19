import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/apiAuth';
import { daysAgo, startOfDay } from '@/lib/utils';

export const GET = requireAdmin(async () => {
  await dbConnect();

  const today = startOfDay(new Date());
  const last7 = daysAgo(7);
  const last30 = daysAgo(30);

  const [todayOrders, weekOrders, monthOrders, totalOrders, totalProducts, pendingOrders, lowStock] = await Promise.all([
    Order.find({ createdAt: { $gte: today } }),
    Order.find({ createdAt: { $gte: last7 } }),
    Order.find({ createdAt: { $gte: last30 } }),
    Order.countDocuments(),
    Product.countDocuments({ isActive: true }),
    Order.countDocuments({ status: { $in: ['placed', 'confirmed'] } }),
    Product.find({ 'variants.sizes.stock': { $lte: 5, $gt: 0 } }).select('name variants').limit(10)
  ]);

  const sum = (orders) => orders.reduce((s, o) => s + (o.total || 0), 0);

  // last 14 days trend for chart
  const trend = [];
  for (let i = 13; i >= 0; i--) {
    const day = daysAgo(i);
    const nextDay = daysAgo(i - 1);
    const dayOrders = await Order.find({ createdAt: { $gte: day, $lt: nextDay } });
    trend.push({
      date: day.toISOString().slice(5, 10),
      sales: sum(dayOrders),
      orders: dayOrders.length
    });
  }

  // top selling products
  const topProducts = await Product.find({ isActive: true }).sort({ soldCount: -1 }).limit(5).select('name soldCount basePrice');

  return NextResponse.json({
    today: { sales: sum(todayOrders), orders: todayOrders.length },
    week: { sales: sum(weekOrders), orders: weekOrders.length },
    month: { sales: sum(monthOrders), orders: monthOrders.length },
    totalOrders,
    totalProducts,
    pendingOrders,
    lowStock,
    trend,
    topProducts
  });
});
