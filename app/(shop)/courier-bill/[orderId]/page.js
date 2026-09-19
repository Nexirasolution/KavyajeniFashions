export const dynamic = 'force-dynamic';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';
import Settings from '@/models/Settings';
import PrintButton from '@/components/PrintButton';

export default async function CourierBillPage({ params }) {
  await dbConnect();
  const order = await Order.findById(params.orderId).lean();
  const settings = await Settings.findOne({ key: 'global' }).lean();

  if (!order) return <div className="p-10 text-center">Shipping label not found.</div>;

  return (
    <div className="max-w-md mx-auto p-6 bg-white text-brand-ink border-2 border-brand-ink/20 m-6 rounded-xl2">
      <div className="flex justify-between items-center border-b-2 border-dashed border-brand-ink/20 pb-3 mb-3">
        <h1 className="font-bold text-lg">SHIPPING LABEL</h1>
        <span className="text-xs font-mono bg-brand-cream px-2 py-1 rounded">{order.orderNumber}</span>
      </div>

      <p className="text-xs text-brand-ink/50 mb-1">FROM</p>
      <p className="text-sm font-semibold">{settings?.storeName || 'Kavyajeni Fashions'}</p>
      <p className="text-sm">{settings?.address || 'Nagercoil, Kanyakumari Dt, Tamil Nadu'}</p>

      <p className="text-xs text-brand-ink/50 mt-4 mb-1">TO</p>
      <p className="text-sm font-semibold">{order.customer?.name}</p>
      <p className="text-sm">{order.customer?.phone}</p>
      <p className="text-sm">{order.shippingAddress?.line1}, {order.shippingAddress?.line2}</p>
      <p className="text-sm">{order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}</p>
      {order.shippingAddress?.landmark && <p className="text-sm text-brand-ink/60">Landmark: {order.shippingAddress.landmark}</p>}

      <div className="border-t-2 border-dashed border-brand-ink/20 mt-4 pt-3 text-sm space-y-1">
        <div className="flex justify-between"><span>Items</span><span>{order.items.length}</span></div>
        <div className="flex justify-between"><span>Payment</span><span>{order.paymentMethod === 'cod' ? `COD - ₹${order.total}` : 'Prepaid'}</span></div>
        <div className="flex justify-between"><span>Courier Partner</span><span>{order.courier?.partner || '—'}</span></div>
        <div className="flex justify-between"><span>AWB / Tracking No.</span><span>{order.courier?.awbNumber || '—'}</span></div>
      </div>

      <PrintButton label="Print Label" />
    </div>
  );
}
