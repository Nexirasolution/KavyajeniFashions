'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import toast from 'react-hot-toast';
import { useCart } from '@/components/CartContext';
import { formatINR } from '@/lib/utils';
import { INDIAN_STATES } from '@/lib/shippingConfig';
import { AlertTriangle } from 'lucide-react';

export default function CheckoutPage() {
  const { items, subtotal, clearCart, checkStockOnly, updateQty, removeItem } = useCart();
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', phone: '', email: '',
    line1: '', line2: '', city: '', state: '', pincode: '', landmark: ''
  });
  const [coupon, setCoupon] = useState('');
  const [discount, setDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [checkingStock, setCheckingStock] = useState(true);
  // Map of "productId-variantId-size" -> { available, reason } for unavailable items
  const [stockIssues, setStockIssues] = useState({});

  // 'online' | 'cod'
  const [paymentMethod, setPaymentMethod] = useState('online');

  // Shipping + COD quote for the selected state, from /api/shipping/quote.
  // Shape: { shippingFee, freeShippingAbove, cod: { available, fee, reason }, forState }
  const [quote, setQuote] = useState(null);
  const [shippingLoading, setShippingLoading] = useState(false);

  // Automatic, tiered discount from /api/discounts/quote (no coupon needed).
  // Shape: { label, discountPercent, discountAmount, minAmount, minQty, exactQty } | null
  const [autoDiscount, setAutoDiscount] = useState(null);
  const [showDiscountPopup, setShowDiscountPopup] = useState(false);
  const lastPoppedDiscountKey = useRef(null);

  // Whichever discount is bigger wins — a manually applied coupon or the
  // automatic tiered discount. They don't stack.
  const bestDiscountAmount = Math.max(discount, autoDiscount?.discountAmount || 0);
  const usingAutoDiscount = (autoDiscount?.discountAmount || 0) > discount;
  const discountedSubtotal = subtotal - bestDiscountAmount;

  // Ignore a quote that belongs to a previously selected state.
  const activeQuote = quote && quote.forState === form.state ? quote : null;
  const shipping = activeQuote ? activeQuote.shippingFee : null;
  const freeShippingAbove = activeQuote ? activeQuote.freeShippingAbove : 0;
  const cod = activeQuote ? activeQuote.cod : null;
  const codAvailable = !!cod?.available;
  const codFee = paymentMethod === 'cod' && codAvailable ? cod.fee : 0;

  const total = shipping !== null ? Math.round(discountedSubtotal + shipping + codFee) : null;

  // Stable string so the quote effect doesn't re-run on every render.
  const itemsKey = JSON.stringify(
    items.map((i) => ({
      productId: i.productId, variantId: i.variantId, size: i.size, qty: i.qty,
      isCombo: i.isCombo || false, comboId: i.comboId
    }))
  );

  // Recalculate shipping + COD whenever state, cart, or discount changes.
  useEffect(() => {
    if (!form.state) {
      setQuote(null);
      setShippingLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setShippingLoading(true);
      try {
        const res = await fetch('/api/shipping/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: JSON.parse(itemsKey),
            state: form.state,
            subtotal: discountedSubtotal
          })
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setQuote({ ...data, forState: form.state });
        } else {
          setQuote(null);
          toast.error(data.error || 'Could not calculate shipping');
        }
      } catch {
        if (!cancelled) {
          setQuote(null);
          toast.error('Could not calculate shipping');
        }
      } finally {
        if (!cancelled) setShippingLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [form.state, itemsKey, discountedSubtotal]);

  // Recalculate the automatic discount whenever the cart changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/discounts/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: JSON.parse(itemsKey), subtotal })
        });
        const data = await res.json();
        if (!cancelled) setAutoDiscount(res.ok ? data.discount : null);
      } catch {
        if (!cancelled) setAutoDiscount(null);
      }
    })();
    return () => { cancelled = true; };
  }, [itemsKey, subtotal]);

  // Pop the "you got a discount" modal once per distinct discount — not on
  // every re-render, and not again if the same tier still applies.
  useEffect(() => {
    if (!autoDiscount) return;
    const key = `${autoDiscount.label}-${autoDiscount.discountPercent}-${autoDiscount.discountAmount}`;
    if (lastPoppedDiscountKey.current !== key) {
      lastPoppedDiscountKey.current = key;
      setShowDiscountPopup(true);
    }
  }, [autoDiscount]);

  // If COD stops being available (state or cart changed), fall back to online.
  useEffect(() => {
    if (paymentMethod === 'cod' && activeQuote && !activeQuote.cod?.available) {
      setPaymentMethod('online');
    }
  }, [activeQuote, paymentMethod]);

  function issueKey(i) {
    return [i.productId, i.variantId, i.size].filter(Boolean).join('-');
  }

  const runStockCheck = useCallback(async () => {
    setCheckingStock(true);
    const data = await checkStockOnly();
    const issues = {};
    if (!data.allOk) {
      data.results.forEach((r) => {
        if (!r.ok) {
          issues[[r.productId, r.variantId, r.size].filter(Boolean).join('-')] = {
            available: r.available,
            reason: r.reason
          };
        }
      });
    }
    setStockIssues(issues);
    setCheckingStock(false);
    return Object.keys(issues).length === 0;
  }, [checkStockOnly]);

  // Check stock once when checkout loads
  useEffect(() => {
    runStockCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasStockIssues = Object.keys(stockIssues).length > 0;

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function applyCoupon() {
    if (!coupon.trim()) return;
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: coupon, subtotal })
    });
    const data = await res.json();
    if (data.valid) {
      setDiscount(data.discount);
      toast.success(data.message);
    } else {
      setDiscount(0);
      toast.error(data.message);
    }
  }

  async function placeOrder() {
    if (!form.name || !form.phone || !form.line1 || !form.city || !form.state || !form.pincode) {
      toast.error('Please fill all required fields');
      return;
    }
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    if (shipping === null) {
      toast.error('Shipping is still being calculated, please wait');
      return;
    }

    setSubmitting(true);

    // Client-side pre-check for instant feedback. The real, authoritative
    // check happens server-side inside /api/payment/create-order, which
    // atomically reserves stock — this call just avoids opening the
    // payment modal when we already know something's wrong.
    const ok = await runStockCheck();
    if (!ok) {
      toast.error('Some items in your cart are unavailable. Please remove or adjust them before checking out.');
      setSubmitting(false);
      return;
    }

    const orderItems = items.map((i) => ({
      productId: i.productId, variantId: i.variantId, size: i.size, qty: i.qty,
      isCombo: i.isCombo || false, comboId: i.comboId
    }));

    try {
      const orderRes = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: orderItems,
          customer: { name: form.name, phone: form.phone, email: form.email },
          shippingAddress: form,
          couponCode: coupon,
          paymentMethod
        })
      });
      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        if (orderRes.status === 409) {
          // Stock changed between our pre-check and the reservation attempt.
          await runStockCheck();
        }
        toast.error(orderData.error || 'Payment gateway error');
        setSubmitting(false);
        return;
      }

      // Cash on Delivery: the order is already placed, no payment modal.
      if (orderData.cod) {
        clearCart();
        router.push(`/order-success/${orderData.dbOrderId}`);
        setSubmitting(false);
        return;
      }

      const { order: rzpOrder, keyId, dbOrderId } = orderData;

      const rzp = new window.Razorpay({
        key: keyId,
        amount: rzpOrder.amount,
        currency: 'INR',
        name: 'Lakshmibala Clothing Store',
        order_id: rzpOrder.id,
        prefill: { name: form.name, contact: form.phone, email: form.email },
        theme: { color: '#C2185B' },
        handler: async function (response) {
          const finalRes = await fetch('/api/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dbOrderId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });
          const finalData = await finalRes.json();
          if (finalRes.ok) {
            clearCart();
            router.push(`/order-success/${finalData.order._id}`);
          } else {
            // Payment likely succeeded on Razorpay's side even if this
            // call failed — the webhook will finalize the order shortly.
            toast.error(finalData.error || 'Payment received — confirming your order.');
            router.push('/track-order');
          }
          setSubmitting(false);
        },
        modal: {
          ondismiss: () => {
            fetch('/api/payment/cancel', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dbOrderId })
            }).catch(() => {});
            setSubmitting(false);
          }
        }
      });
      rzp.open();
    } catch {
      toast.error('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  const placeOrderDisabled =
    submitting || shippingLoading || checkingStock || shipping === null || items.length === 0 || hasStockIssues;

  const ctaLabel = submitting
    ? 'Placing Order…'
    : checkingStock
      ? 'Checking stock…'
      : hasStockIssues
        ? 'Fix unavailable items to continue'
        : !form.state
          ? 'Select your state to continue'
          : shippingLoading
            ? 'Calculating shipping…'
            : total !== null
              ? paymentMethod === 'cod'
                ? `Place COD Order · ${formatINR(total)}`
                : `Pay ${formatINR(total)}`
              : 'Proceed to Pay';

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />

      {/* Automatic discount popup */}
      {showDiscountPopup && autoDiscount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 text-center">
            <p className="text-3xl mb-2">🎉</p>
            <h3 className="font-display text-lg font-bold text-brand-magenta mb-1">
              You&apos;ve unlocked {autoDiscount.discountPercent}% off!
            </h3>
            <p className="text-sm text-brand-ink/70 mb-4">
              {autoDiscount.label || `You get ${formatINR(autoDiscount.discountAmount)} off this order.`}
            </p>
            <button
              onClick={() => setShowDiscountPopup(false)}
              className="btn-primary w-full py-2.5 text-sm"
            >
              Awesome, continue
            </button>
          </div>
        </div>
      )}

      <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-magenta mb-5 sm:mb-6">
        Checkout
      </h1>

      {/* Unavailable item banner */}
      {hasStockIssues && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-4">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>
            One or more items in your cart are unavailable in the requested quantity. Please remove or adjust them below to continue.
          </span>
        </div>
      )}

      {/* Free shipping nudge (only for states that have a free-shipping threshold) */}
      {freeShippingAbove > 0 && shipping !== null && shipping > 0 && !hasStockIssues && (
        <p className="text-xs text-brand-ink/60 bg-brand-magenta/5 border border-brand-magenta/15 rounded-lg px-3 py-2 mb-4">
          Add {formatINR(freeShippingAbove - discountedSubtotal)} more to get <span className="font-semibold text-brand-green">free shipping</span>!
        </p>
      )}

      <div className="flex flex-col gap-6 sm:grid sm:grid-cols-2 sm:gap-8">

        {/* ── Shipping Details ── */}
        <div className="card-soft p-4 sm:p-5 space-y-3">
          <h2 className="font-semibold text-brand-ink mb-1 text-sm sm:text-base">Shipping Details</h2>

          <input
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta/40"
            placeholder="Full Name *"
            autoComplete="name"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
          />
          <input
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta/40"
            placeholder="Phone Number *"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
          />
          <input
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta/40"
            placeholder="Email (optional)"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
          />
          <input
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta/40"
            placeholder="Address Line 1 *"
            autoComplete="address-line1"
            value={form.line1}
            onChange={(e) => update('line1', e.target.value)}
          />
          <input
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta/40"
            placeholder="Address Line 2"
            autoComplete="address-line2"
            value={form.line2}
            onChange={(e) => update('line2', e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta/40"
              placeholder="City *"
              autoComplete="address-level2"
              value={form.city}
              onChange={(e) => update('city', e.target.value)}
            />
            {/* Dropdown (not free text) so the state always matches an admin rule exactly */}
            <select
              className="border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-magenta/40"
              autoComplete="address-level1"
              value={form.state}
              onChange={(e) => update('state', e.target.value)}
            >
              <option value="">State *</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta/40"
              placeholder="Pincode *"
              inputMode="numeric"
              maxLength={6}
              autoComplete="postal-code"
              value={form.pincode}
              onChange={(e) => update('pincode', e.target.value)}
            />
            <input
              className="border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta/40"
              placeholder="Landmark"
              value={form.landmark}
              onChange={(e) => update('landmark', e.target.value)}
            />
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-4">

          {/* Order Summary */}
          <div className="card-soft p-4 sm:p-5">
            <h2 className="font-semibold text-brand-ink mb-3 text-sm sm:text-base">Order Summary</h2>

            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {items.map((i, idx) => {
                const key = issueKey(i);
                const issue = stockIssues[key];
                return (
                  <div key={idx} className={issue ? 'py-1.5 border-b border-red-100' : 'py-1'}>
                    <div className="flex justify-between text-sm text-brand-ink/70 gap-2">
                      <span className="truncate">{i.name} ({i.color}/{i.size}) ×{i.qty}</span>
                      <span className="shrink-0">{formatINR(i.price * i.qty)}</span>
                    </div>
                    {issue && (
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className="text-xs text-red-600">
                          {issue.available <= 0 ? 'Out of stock' : `Only ${issue.available} available`} — remove or adjust to continue
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {issue.available > 0 && (
                            <button
                              onClick={async () => {
                                updateQty(
                                  [i.productId, i.variantId, i.size, i.comboId].filter(Boolean).join('-'),
                                  issue.available
                                );
                                await runStockCheck();
                              }}
                              className="text-xs underline text-brand-magenta"
                            >
                              Set to {issue.available}
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              removeItem([i.productId, i.variantId, i.size, i.comboId].filter(Boolean).join('-'));
                              await runStockCheck();
                            }}
                            className="text-xs underline text-red-600"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Auto-discount banner */}
            {autoDiscount && (
              <p className="text-xs text-brand-green bg-brand-green/5 border border-brand-green/20 rounded-lg px-3 py-2 mt-3">
                🎉 {autoDiscount.label || `${autoDiscount.discountPercent}% off applied automatically`}
              </p>
            )}

            {/* Coupon */}
            <div className="flex gap-2 mt-3">
              <input
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-magenta/40 min-w-0"
                placeholder="Coupon code"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
              />
              <button onClick={applyCoupon} className="btn-outline px-4 text-sm shrink-0">Apply</button>
            </div>
            {discount > 0 && usingAutoDiscount && (
              <p className="text-xs text-brand-ink/50 mt-1">
                Your automatic discount is bigger, so it&apos;s the one applied instead of this coupon.
              </p>
            )}

            <hr className="my-3" />

            {/* Price breakdown */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-brand-ink/70">Subtotal</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              {bestDiscountAmount > 0 && (
                <div className="flex justify-between text-brand-green">
                  <span>{usingAutoDiscount ? (autoDiscount.label || 'Discount') : 'Coupon Discount'}</span>
                  <span>−{formatINR(bestDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-brand-ink/70">Shipping</span>
                <span>
                  {shippingLoading
                    ? <span className="text-brand-ink/40">Calculating…</span>
                    : !form.state
                      ? <span className="text-brand-ink/40">Select state</span>
                      : shipping === 0
                        ? <span className="text-brand-green font-medium">Free</span>
                        : shipping !== null
                          ? formatINR(shipping)
                          : <span className="text-brand-ink/40">—</span>
                  }
                </span>
              </div>
              {codFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-brand-ink/70">COD charge</span>
                  <span>{formatINR(codFee)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between font-bold text-base sm:text-lg mt-3 pt-3 border-t">
              <span>Total</span>
              <span className="text-brand-magenta">
                {total !== null ? formatINR(total) : '—'}
              </span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="card-soft p-4 sm:p-5">
            <h2 className="font-semibold text-brand-ink mb-2 text-sm sm:text-base">Payment Method</h2>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-brand-ink/80 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'online'}
                  onChange={() => setPaymentMethod('online')}
                />
                <span>Pay Online (Cards / UPI / Netbanking)</span>
              </label>

              <label
                className={`flex items-center gap-2 text-sm ${
                  codAvailable ? 'text-brand-ink/80 cursor-pointer' : 'text-brand-ink/40 cursor-not-allowed'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  disabled={!codAvailable}
                  checked={paymentMethod === 'cod'}
                  onChange={() => setPaymentMethod('cod')}
                />
                <span>
                  Cash on Delivery
                  {codAvailable && cod.fee > 0 ? ` (+${formatINR(cod.fee)} COD charge)` : ''}
                </span>
              </label>

              {!form.state && (
                <p className="text-xs text-brand-ink/60">
                  Select your state to see whether Cash on Delivery is available.
                </p>
              )}
              {activeQuote && !codAvailable && cod?.reason && (
                <p className="text-xs text-brand-ink/60">{cod.reason}</p>
              )}
            </div>
          </div>

          {/* Place Order CTA */}
          <button
            onClick={placeOrder}
            disabled={placeOrderDisabled}
            className="btn-primary w-full py-3 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}