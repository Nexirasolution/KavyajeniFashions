export const dynamic = 'force-dynamic';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';
import Settings from '@/models/Settings';
import { formatINR } from '@/lib/utils';
import PrintButton from '@/components/PrintButton';

export default async function InvoicePage({ params }) {
  await dbConnect();
  const order = await Order.findById(params.orderId).lean();
  const settings = await Settings.findOne({ key: 'global' }).lean();

  if (!order) return <div className="p-10 text-center">Invoice not found.</div>;

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white text-brand-ink">
      <div className="flex justify-between items-start border-b border-brand-ink/10 pb-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-magenta">{settings?.storeName || 'Kavyajeni Fashions'}</h1>
          <p className="text-sm text-brand-ink/60">{settings?.address || 'Nagercoil, Kanyakumari Dt, Tamil Nadu'}</p>
          <p className="text-sm text-brand-ink/60">WhatsApp: +{settings?.whatsapp}</p>
        </div>
        <div className="text-right">
          <h2 className="font-bold text-lg">INVOICE</h2>
          <p className="text-sm">{order.orderNumber}</p>
          <p className="text-sm text-brand-ink/60">{new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div>
          <p className="font-semibold mb-1">Billed To</p>
          <p>{order.customer?.name}</p>
          <p>{order.customer?.phone}</p>
          <p>{order.shippingAddress?.line1}, {order.shippingAddress?.line2}</p>
          <p>{order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}</p>
        </div>
        <div>
          <p className="font-semibold mb-1">Payment</p>
          <p>Method: {order.paymentMethod === 'razorpay' ? 'Online Payment' : 'Cash on Delivery'}</p>
          <p>Status: {order.paymentStatus}</p>
        </div>
      </div>

      <table className="w-full text-sm border-collapse mb-6">
        <thead>
          <tr className="border-b border-brand-ink/15 text-left">
            <th className="py-2">Item</th>
            <th className="py-2">Color/Size</th>
            <th className="py-2 text-right">Price</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, i) => (
            <tr key={i} className="border-b border-brand-ink/5">
              <td className="py-2">{item.name}</td>
              <td className="py-2">{item.color}/{item.size}</td>
              <td className="py-2 text-right">{formatINR(item.price)}</td>
              <td className="py-2 text-right">{item.qty}</td>
              <td className="py-2 text-right">{formatINR(item.price * item.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="w-56 text-sm space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(order.subtotal)}</span></div>
          {order.discount > 0 && <div className="flex justify-between"><span>Discount {order.couponCode && `(${order.couponCode})`}</span><span>-{formatINR(order.discount)}</span></div>}
          <div className="flex justify-between"><span>Shipping</span><span>{order.shippingFee === 0 ? 'Free' : formatINR(order.shippingFee)}</span></div>
          <div className="flex justify-between font-bold text-base border-t border-brand-ink/15 pt-1 mt-1"><span>Total</span><span>{formatINR(order.total)}</span></div>
        </div>
      </div>

      <p className="text-center text-xs text-brand-ink/40 mt-10">Thank you for shopping with Kavyajeni Fashions!</p>

      <PrintButton />
    </div>
  );
}
