'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import toast from 'react-hot-toast';
import { useCart } from '@/components/CartContext';
import { formatINR } from '@/lib/utils';
import { INDIAN_STATES } from '@/lib/shippingConfig';
import { AlertTriangle } from 'lucide-react';

// ─────────────────────────── Address validation helpers ───────────────────────────

const NAME_RE = /^[A-Za-z][A-Za-z\s.'-]{1,}$/;
const PIN_RE = /^[1-9]\d{5}$/;

// Lowercase letters only, so "Jammu & Kashmir" matches "Jammu and Kashmir".
const norm = (s = '') => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');

// Strips +91 / 91 / 0 prefixes and any non-digits.
function cleanPhone(p = '') {
  let d = String(p).replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

// Returns an object of { fieldName: 'error message' }. Empty object = valid.
// Key order matches the on-screen field order so the first key is the first
// field to focus.
function validateAddress(f, pinInfo) {
  const e = {};
  if (!NAME_RE.test(f.name.trim())) e.name = 'Enter your full name';
  if (!/^[6-9]\d{9}$/.test(cleanPhone(f.phone))) e.phone = 'Enter a valid 10-digit mobile number';
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) {
    e.email = 'Enter a valid email';
  }
  if (f.line1.trim().length < 5) e.line1 = 'Enter your house / street address';
  if (!NAME_RE.test(f.city.trim())) e.city = 'Enter a valid city';
  if (!INDIAN_STATES.includes(f.state)) e.state = 'Select your state';

  if (!PIN_RE.test(f.pincode)) {
    e.pincode = 'Enter a valid 6-digit pincode';
  } else if (pinInfo.pin === f.pincode) {
    if (pinInfo.status === 'invalid') {
      e.pincode = 'This pincode does not exist';
    } else if (pinInfo.status === 'valid' && f.state && norm(pinInfo.state) !== norm(f.state)) {
      e.pincode = `This pincode belongs to ${pinInfo.state}, not ${f.state}`;
    }
  }
  return e;
}

function Field({ error, className = '', ...props }) {
  return (
    <div className={className}>
      <input
        {...props}
        aria-invalid={!!error}
        className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${
          error ? 'border-red-400 focus:ring-red-300' : 'focus:ring-brand-magenta/40'
        }`}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// ─────────────────────────────────── Page ───────────────────────────────────

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

  // ── Address validation state ──
  const [showErrors, setShowErrors] = useState(false); // true after first Place Order click
  const [touched, setTouched] = useState({});
  // status: idle | checking | valid | invalid | unknown (lookup service unreachable)
  const [pinInfo, setPinInfo] = useState({ pin: '', status: 'idle', state: '' });

  const errors = validateAddress(form, pinInfo);
  // Only show an error once the field was touched or the user tried to submit.
  const err = (f) => (showErrors || touched[f] ? errors[f] : null);
  const blur = (f) => () => setTouched((t) => ({ ...t, [f]: true }));

  const pinPending =
    PIN_RE.test(form.pincode) && (pinInfo.pin !== form.pincode || pinInfo.status === 'checking');

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

  // Order total = items − discount + shipping. The COD charge is NOT part of
  // it: it's a separate handling fee paid online right now.
  const total = shipping !== null ? Math.round(discountedSubtotal + shipping) : null;
  // For a COD order this whole total is collected in cash at the doorstep.
  const codCashDue = total;

  // Stable string so the quote effect doesn't re-run on every render.
  const itemsKey = JSON.stringify(
    items.map((i) => ({
      productId: i.productId, variantId: i.variantId, size: i.size, qty: i.qty,
      isCombo: i.isCombo || false, comboId: i.comboId
    }))
  );

  // Verify the pincode with India Post and auto-fill the state if it's empty.
  // If the lookup service is down we fail open (status 'unknown') so a
  // third-party outage never blocks real customers.
  useEffect(() => {
    const pin = form.pincode;
    if (!PIN_RE.test(pin)) {
      setPinInfo({ pin, status: 'idle', state: '' });
      return;
    }
    let cancelled = false;
    setPinInfo({ pin, status: 'checking', state: '' });
    (async () => {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        const data = await res.json();
        if (cancelled) return;
        const po = data?.[0]?.PostOffice;
        if (data?.[0]?.Status === 'Success' && po?.length) {
          const st = po[0].State;
          setPinInfo({ pin, status: 'valid', state: st });
          const match = INDIAN_STATES.find((s) => norm(s) === norm(st));
          if (match) setForm((f) => (f.state ? f : { ...f, state: match }));
        } else if (data?.[0]?.Status === 'Error') {
          setPinInfo({ pin, status: 'invalid', state: '' });
        } else {
          setPinInfo({ pin, status: 'unknown', state: '' });
        }
      } catch {
        if (!cancelled) setPinInfo({ pin, status: 'unknown', state: '' });
      }
    })();
    return () => { cancelled = true; };
  }, [form.pincode]);

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
    // 1. Address must be complete and correct.
    setShowErrors(true);
    const firstBad = Object.keys(errors)[0];
    if (firstBad) {
      toast.error('Please fix the highlighted address fields');
      document
        .querySelector(`[data-field="${firstBad}"] input, [data-field="${firstBad}"] select`)
        ?.focus();
      return;
    }
    if (pinPending) {
      toast.error('Verifying pincode, please wait');
      return;
    }

    // 2. Cart / shipping checks.
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

    // Send trimmed, normalised values (10-digit phone, no +91 / 0 prefix).
    const cleanedPhone = cleanPhone(form.phone);
    const cleanedForm = {
      ...form,
      name: form.name.trim(),
      phone: cleanedPhone,
      email: form.email.trim(),
      line1: form.line1.trim(),
      line2: form.line2.trim(),
      city: form.city.trim(),
      landmark: form.landmark.trim()
    };

    try {
      const orderRes = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: orderItems,
          customer: { name: cleanedForm.name, phone: cleanedPhone, email: cleanedForm.email },
          shippingAddress: cleanedForm,
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

      // Pure Cash on Delivery — no online charge at all (e.g. COD fee is 0
      // for this state/order). Order is placed directly, nothing to pay now.
      // The backend should only return this shape when there's no fee to collect.
      if (orderData.cod && !orderData.order) {
        clearCart();
        router.push(`/order-success/${orderData.dbOrderId}`);
        setSubmitting(false);
        return;
      }

      // Either a full online payment, or a COD order that still has a COD
      // handling fee to collect online. In both cases the backend returns a
      // Razorpay order — for COD, `rzpOrder.amount` should be just the fee,
      // not the full order total. `orderData.cod` tells us which case we're in.
      const { order: rzpOrder, keyId, dbOrderId } = orderData;
      const isCodFeePayment = !!orderData.cod;

      const rzp = new window.Razorpay({
        key: keyId,
        amount: rzpOrder.amount,
        currency: 'INR',
        name: 'Kavyajeni Nighties',
        order_id: rzpOrder.id,
        description: isCodFeePayment
          ? `COD handling charge — ${formatINR(codCashDue)} balance due in cash on delivery`
          : undefined,
        prefill: { name: cleanedForm.name, contact: cleanedPhone, email: cleanedForm.email },
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
                ? codFee > 0
                  ? `Pay ${formatINR(codFee)} COD charge online`
                  : `Place COD Order · ${formatINR(total)}`
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
        <div className="card-soft p-4 sm:p-5 space-y-3 self-start">
          <h2 className="font-semibold text-brand-ink mb-1 text-sm sm:text-base">Shipping Details</h2>

          <div data-field="name">
            <Field
              placeholder="Full Name *"
              autoComplete="name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              onBlur={blur('name')}
              error={err('name')}
            />
          </div>
          <div data-field="phone">
            <Field
              placeholder="Mobile Number *"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              onBlur={blur('phone')}
              error={err('phone')}
            />
          </div>
          <div data-field="email">
            <Field
              placeholder="Email (optional)"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              onBlur={blur('email')}
              error={err('email')}
            />
          </div>
          <div data-field="line1">
            <Field
              placeholder="Address Line 1 (house no., street) *"
              autoComplete="address-line1"
              value={form.line1}
              onChange={(e) => update('line1', e.target.value)}
              onBlur={blur('line1')}
              error={err('line1')}
            />
          </div>
          <Field
            placeholder="Address Line 2 (optional)"
            autoComplete="address-line2"
            value={form.line2}
            onChange={(e) => update('line2', e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div data-field="city">
              <Field
                placeholder="City *"
                autoComplete="address-level2"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                onBlur={blur('city')}
                error={err('city')}
              />
            </div>
            {/* Dropdown (not free text) so the state always matches an admin rule exactly */}
            <div data-field="state">
              <select
                className={`w-full border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 ${
                  err('state') ? 'border-red-400 focus:ring-red-300' : 'focus:ring-brand-magenta/40'
                }`}
                autoComplete="address-level1"
                aria-invalid={!!err('state')}
                value={form.state}
                onChange={(e) => update('state', e.target.value)}
                onBlur={blur('state')}
              >
                <option value="">State *</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {err('state') && <p className="text-xs text-red-600 mt-1">{errors.state}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div data-field="pincode">
              <Field
                placeholder="Pincode *"
                inputMode="numeric"
                maxLength={6}
                autoComplete="postal-code"
                value={form.pincode}
                onChange={(e) => update('pincode', e.target.value.replace(/\D/g, ''))}
                onBlur={blur('pincode')}
                error={err('pincode')}
              />
              {pinPending && <p className="text-xs text-brand-ink/50 mt-1">Verifying…</p>}
              {pinInfo.status === 'valid' && pinInfo.pin === form.pincode && !errors.pincode && (
                <p className="text-xs text-brand-green mt-1">✓ {pinInfo.state}</p>
              )}
            </div>
            <Field
              placeholder="Landmark (optional)"
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
            </div>

            <div className="flex justify-between font-bold text-base sm:text-lg mt-3 pt-3 border-t">
              <span>Total</span>
              <span className="text-brand-magenta">
                {total !== null ? formatINR(total) : '—'}
              </span>
            </div>

            {paymentMethod === 'cod' && codFee > 0 && codCashDue !== null && (
              <div className="mt-3 rounded-lg border border-brand-magenta/15 bg-brand-magenta/5 px-3 py-2.5 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-brand-ink/70">Pay now online (COD charge)</span>
                  <span className="font-medium">{formatINR(codFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-ink/70">Pay in cash on delivery</span>
                  <span className="font-medium">{formatINR(codCashDue)}</span>
                </div>
              </div>
            )}
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
                  {codAvailable && cod.fee > 0 ? ` (+${formatINR(cod.fee)} COD charge, paid online)` : ''}
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