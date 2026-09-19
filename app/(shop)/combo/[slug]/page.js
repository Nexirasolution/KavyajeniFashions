export const dynamic = 'force-dynamic';
import { dbConnect } from '@/lib/mongodb';
import Combo from '@/models/Combo';
import Image from 'next/image';
import { formatINR } from '@/lib/utils';
import AddComboButton from '@/components/AddComboButton';
import { Package, Tag, CheckCircle2, Zap, RotateCcw, Shield, Truck } from 'lucide-react';

export default async function ComboPage({ params }) {
  await dbConnect();
  const combo = await Combo.findOne({ slug: params.slug, isActive: true })
    .populate('products.product', 'name slug variants')
    .lean();

  if (!combo) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-brand-ink/50">Combo not found.</div>;
  }

  const plain = JSON.parse(JSON.stringify(combo));
  const savings = plain.originalPrice - plain.comboPrice;
  const savingsPct = plain.originalPrice > 0 ? Math.round((savings / plain.originalPrice) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Urgency banner */}
      <div className="bg-brand-magenta text-white text-center text-xs font-semibold py-2 rounded-xl mb-6 flex items-center justify-center gap-2">
        <Zap size={13} fill="white" />
        LIMITED COMBO OFFER — Save {savingsPct}% when you bundle
        <Zap size={13} fill="white" />
      </div>

      <div className="grid sm:grid-cols-2 gap-8">

        {/* Image — fully covered */}
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-md">
          {plain.image
            ? <Image src={plain.image} alt={plain.name} fill sizes="(max-width:640px) 100vw, 50vw" className="object-cover" />
            : <div className="w-full h-full bg-brand-cream" />
          }
          {savingsPct > 0 && (
            <div className="absolute top-3 left-3 bg-brand-magenta text-white text-xs font-bold px-3 py-1 rounded-full shadow">
              {savingsPct}% OFF
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col">
          <p className="text-xs font-semibold text-brand-magenta uppercase tracking-widest mb-1">Exclusive Bundle</p>
          <h1 className="font-display text-3xl font-bold text-brand-ink leading-tight">{plain.name}</h1>
          <p className="text-brand-ink/60 text-sm mt-2 leading-relaxed">{plain.description}</p>

          {/* Pricing */}
          <div className="mt-5 bg-brand-cream rounded-xl p-4">
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold text-brand-magenta">{formatINR(plain.comboPrice)}</span>
              {plain.originalPrice > plain.comboPrice && (
                <span className="text-brand-ink/40 line-through text-lg mb-0.5">{formatINR(plain.originalPrice)}</span>
              )}
            </div>
            {savings > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Tag size={13} className="text-green-600" />
                <p className="text-green-600 text-sm font-semibold">You save {formatINR(savings)} with this combo!</p>
              </div>
            )}
          </div>

          {/* What's included */}
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-3">
              <Package size={15} className="text-brand-magenta" />
              <h3 className="font-semibold text-sm">What's included ({plain.products?.length} items)</h3>
            </div>
            <div className="space-y-2">
              {plain.products?.map((p, i) => (
                <div key={i} className="flex items-center gap-2 bg-brand-cream/60 rounded-lg px-3 py-2">
                  <CheckCircle2 size={15} className="text-brand-magenta shrink-0" />
                  <span className="text-sm text-brand-ink/80 font-medium">{p.product?.name}</span>
                  {p.size && <span className="ml-auto text-xs bg-white border rounded-full px-2 py-0.5 text-brand-ink/50">Size {p.size}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <AddComboButton combo={plain} />
          <p className="text-xs text-center text-brand-ink/40 mt-2">
            Combo price applies automatically at checkout
          </p>
        </div>
      </div>

      {/* Trust + Policy section */}
      {/* <div className="mt-10 grid sm:grid-cols-3 gap-4">
        <div className="border rounded-xl p-4 flex gap-3 items-start">
          <Truck size={20} className="text-brand-magenta shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Free Delivery</p>
            <p className="text-xs text-brand-ink/50 mt-0.5">Free shipping on all combo orders across India.</p>
          </div>
        </div>
        <div className="border rounded-xl p-4 flex gap-3 items-start">
          <RotateCcw size={20} className="text-brand-magenta shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">7-Day Returns</p>
            <p className="text-xs text-brand-ink/50 mt-0.5">Not satisfied? Return within 7 days for a full refund — no questions asked.</p>
          </div>
        </div>
        <div className="border rounded-xl p-4 flex gap-3 items-start">
          <Shield size={20} className="text-brand-magenta shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">100% Genuine</p>
            <p className="text-xs text-brand-ink/50 mt-0.5">Every piece is quality-checked before dispatch. What you see is what you get.</p>
          </div>
        </div>
      </div> */}

      {/* Bottom reassurance */}
      <div className="mt-6 border-t pt-6 text-center">
        <p className="text-sm text-brand-ink/50">
          💡 Buying individually would cost{' '}
          <span className="line-through">{formatINR(plain.originalPrice)}</span> — get this combo for just{' '}
          <span className="text-brand-magenta font-semibold">{formatINR(plain.comboPrice)}</span>
        </p>
      </div>

    </div>
  );
}