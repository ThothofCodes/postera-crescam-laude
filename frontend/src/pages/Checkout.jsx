// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — Circuit Canopy Checkout
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { api } from '../utils/api';
import { formatKES } from '../utils/helpers';
import PaymentForm from '../components/PaymentForm';
import toast from 'react-hot-toast';
import { T } from '../utils/theme';
import analytics from '../utils/analytics';
import PromoCodeInput from '../components/PromoCodeInput';

const DELIVERY_FEE = 300;

const card = { background: '#0F2620', border: '1px solid rgba(36,74,68,0.4)', borderRadius: 10, padding: '1.25rem' };

/* ── Receipt text formatter (shared by email/SMS/print) ──────────────── */
function buildReceiptText(order, items, deliveryFee, grandTotal) {
  const lines = [
    '══════════════════════════════════',
    '  POSTERA CRESCAM LAUDE',
    '  Empowering Kenya\'s Digital Future',
    '  PCL Centre, Nairobi County',
    '══════════════════════════════════',
    '',
    `Order: ${order?.orderNumber || '—'}`,
    `Date: ${new Date().toLocaleDateString('en-KE', { year:'numeric', month:'long', day:'numeric' })}`,
    `Time: ${new Date().toLocaleTimeString('en-KE', { hour:'2-digit', minute:'2-digit' })}`,
  ];
  if (order?.customer?.name) lines.push(`Customer: ${order.customer.name}`);
  if (order?.customer?.phone) lines.push(`Phone: ${order.customer.phone}`);
  lines.push('', '─── ITEMS ───');
  (items.length > 0 ? items : []).forEach((i) => {
    lines.push(`${i.name} x${i.quantity} — ${formatKES(i.price * i.quantity)}`);
  });
  lines.push('', '─── TOTALS ───');
  lines.push(`Subtotal: ${formatKES(items.reduce((s, i) => s + i.price * i.quantity, 0))}`);
  lines.push(`Delivery: ${deliveryFee ? formatKES(deliveryFee) : 'Free'}`);
  lines.push(`TOTAL: ${formatKES(grandTotal)}`);
  lines.push('', `Payment: ${order?.paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash on Pickup'}`);
  lines.push('', 'Thank you for your purchase!');
  lines.push('Postera Crescam Laude · posteracrescamlaude.co.ke');
  return lines.join('\n');
}

/* ── Send receipt via email ──────────────────────────────────────────── */
function sendReceiptEmail(order, items, deliveryFee, grandTotal) {
  const receiptBody = buildReceiptText(order, items, deliveryFee, grandTotal);
  const subject = encodeURIComponent(`Receipt — Order ${order?.orderNumber || ''} | PCL`);
  const body = encodeURIComponent(receiptBody);
  const email = order?.customer?.email || '';
  window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
}

/* ── Send receipt via SMS ────────────────────────────────────────────── */
function sendReceiptSMS(order, items, deliveryFee, grandTotal) {
  // SMS has ~160 char segments — build a compact summary
  const itemList = (items.length > 0 ? items : [])
    .map((i) => `${i.name}x${i.quantity}`)
    .join(', ');
  const msg = [
    `PCL Receipt`,
    `Order: ${order?.orderNumber || '—'}`,
    `Items: ${itemList}`,
    `Total: ${formatKES(grandTotal)}`,
    `Payment: ${order?.paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash'}`,
    `Thank you! — Postera Crescam Laude`,
  ].join('\n');
  const phone = (order?.customer?.phone || '').replace(/[^0-9+]/g, '');
  window.open(`sms:${phone}?body=${encodeURIComponent(msg)}`, '_blank');
}

/* ── Print receipt helper ─────────────────────────────────────────────── */
function printReceipt(order, items, deliveryFee, grandTotal) {
  const receiptHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt – ${order?.orderNumber || 'PCL'}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&family=Share+Tech+Mono&family=Rajdhani:wght@600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Poppins',sans-serif;background:#fff;color:#244A44;padding:2rem;max-width:420px;margin:0 auto}
  .header{text-align:center;border-bottom:2px solid #EE6100;padding-bottom:1rem;margin-bottom:1rem}
  .brand{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:18px;color:#244A44;letter-spacing:0.1em;text-transform:uppercase}
  .tagline{font-family:'Share Tech Mono',monospace;font-size:10px;color:#6A8A82;letter-spacing:0.08em;margin-top:2px}
  .meta{font-family:'Share Tech Mono',monospace;font-size:11px;color:#6A8A82;margin-top:6px}
  h2{font-family:'Rajdhani',sans-serif;font-size:14px;color:#EE6100;letter-spacing:0.12em;text-transform:uppercase;margin:1rem 0 0.5rem}
  table{width:100%;border-collapse:collapse;margin-bottom:0.5rem}
  th{text-align:left;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#6A8A82;border-bottom:1px solid #ddd;padding:4px 0}
  td{font-size:12px;padding:4px 0;border-bottom:1px solid #f0f0f0}
  td:last-child{text-align:right;font-family:'Share Tech Mono',monospace}
  .totals{margin-top:0.75rem;border-top:2px solid #244A44;padding-top:0.5rem}
  .totals .row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;color:#6A8A82}
  .totals .grand{font-size:16px;font-weight:700;color:#244A44;border-top:1px solid #244A44;padding-top:6px;margin-top:6px}
  .totals .grand span:last-child{font-family:'Share Tech Mono',monospace}
  .footer{text-align:center;margin-top:1.5rem;border-top:1px dashed #ddd;padding-top:0.75rem;font-size:10px;color:#6A8A82;line-height:1.6}
  .footer .brand-name{color:#EE6100;font-weight:600}
  .detail-row{font-size:11px;margin-bottom:2px;display:flex;justify-content:space-between}
  .detail-row span:first-child{color:#6A8A82}
  .detail-row span:last-child{color:#244A44;font-weight:500}
  @media print{body{padding:1rem;max-width:100%}}
</style></head><body>
  <div class="header">
    <div class="brand">Postera Crescam Laude</div>
    <div class="tagline">Empowering Kenya's Digital Future</div>
    <div class="meta">PCL Centre, Nairobi County, Kenya</div>
  </div>

  <div class="detail-row"><span>Order Number</span><span style="font-family:'Share Tech Mono',monospace;color:#EE6100;font-weight:700">${order?.orderNumber || '—'}</span></div>
  <div class="detail-row"><span>Date</span><span>${new Date().toLocaleDateString('en-KE', { year:'numeric', month:'long', day:'numeric' })}</span></div>
  <div class="detail-row"><span>Time</span><span>${new Date().toLocaleTimeString('en-KE', { hour:'2-digit', minute:'2-digit' })}</span></div>
  ${order?.customer ? `<div class="detail-row"><span>Customer</span><span>${order.customer.name || '—'}</span></div>` : ''}
  ${order?.customer?.phone ? `<div class="detail-row"><span>Phone</span><span>${order.customer.phone}</span></div>` : ''}

  <h2>Items Purchased</h2>
  <table>
    <tr><th>Item</th><th>Qty</th><th>Amount</th></tr>
    ${items.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${formatKES(i.price * i.quantity)}</td></tr>`).join('')}
  </table>

  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${formatKES(items.reduce((s,i)=>s+i.price*i.quantity,0))}</span></div>
    <div class="row"><span>Delivery</span><span>${deliveryFee ? formatKES(deliveryFee) : 'Free'}</span></div>
    <div class="row grand"><span>Total</span><span>${formatKES(grandTotal)}</span></div>
  </div>

  <div class="footer">
    <div>Thank you for your purchase!</div>
    <div style="margin-top:4px">Payment: <strong>${order?.paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash on Pickup'}</strong></div>
    ${order?.paymentMethod === 'mpesa' ? '<div style="margin-top:2px;font-family:Share Tech Mono,monospace">Awaiting M-Pesa confirmation</div>' : ''}
    <div style="margin-top:8px"><span class="brand-name">Postera Crescam Laude</span> · posteracrescamlaude.co.ke</div>
    <div>Empowering Kenya's Digital Future 🇰🇪</div>
  </div>

  <script>window.onload=function(){window.print();}</script>
</body></html>`;
  const w = window.open('', '_blank', 'width=480,height=700');
  if (w) { w.document.write(receiptHtml); w.document.close(); }
}

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [order, setOrder] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', deliveryType: 'pickup', deliveryAddress: '', notes: '', paymentMethod: 'mpesa' });
  const [submitting, setSubmitting] = useState(false);
  const receiptRef = useRef(null);

  const [promoDiscount, setPromoDiscount] = useState(0);
  const [appliedPromo, setAppliedPromo] = useState(null);

  const deliveryFee = form.deliveryType === 'delivery' ? DELIVERY_FEE : 0;
  const grandTotal = Math.max(0, total + deliveryFee - promoDiscount);

  const placeOrder = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      const { data } = await api.post('/orders', {
        customer: { name: form.name, phone: form.phone, email: form.email, deliveryAddress: form.deliveryAddress },
        items: items.map((i) => ({ product: i._id, quantity: i.quantity })),
        deliveryType: form.deliveryType, deliveryFee, notes: form.notes, paymentMethod: form.paymentMethod,
        promoCode: appliedPromo?.code || undefined, promoDiscount,
      });
      setOrder(data);
      // Track order creation
      analytics.orderCreated(data.orderNumber || data._id, data.totalAmount || grandTotal, items.length);
      // Warn if STK push failed but order was created
      if (data._stkError) {
        toast.error(data._stkError, { duration: 6000 });
      }
      if (form.paymentMethod === 'mpesa') setStep(2);
      else { clearCart(); setStep(3); }
    } catch (err) { toast.error(err.response?.data?.message || 'Order failed'); }
    setSubmitting(false);
  };

  /* ── Step 3: Order Confirmation + Receipt ─────────────────────────── */
  if (step === 3) return (
    <div style={{ maxWidth: 600, margin: '4rem auto', padding: '0 1.5rem' }}>
      <div style={{ ...card, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(57,255,136,0.1)', border: '2px solid #39FF88', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: 36, color: '#39FF88' }}>✓</div>
        <h2 style={{ margin: '0 0 0.5rem', color: '#39FF88', fontFamily: "'Rajdhani',sans-serif", fontSize: 22, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Order Placed Successfully</h2>
        <p style={{ color: '#A9C4BE', fontFamily: "'Share Tech Mono',monospace", fontSize: 14 }}>
          Order: <strong style={{ color: '#EE6100' }}>{order?.orderNumber}</strong>
        </p>
        <p style={{ color: '#6A8A82', fontSize: 13, fontFamily: "'Poppins',sans-serif", marginTop: 8 }}>You'll receive an SMS confirmation shortly.</p>

        {/* Receipt preview */}
        <div ref={receiptRef} style={{
          background: '#F4F1EA', borderRadius: 8, padding: '1.25rem', marginTop: '1.5rem',
          textAlign: 'left', border: '1px solid rgba(36,74,68,0.2)', color: '#244A44',
          fontFamily: "'Poppins',sans-serif", fontSize: 12,
        }}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid #EE6100', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 16, color: '#244A44', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Postera Crescam Laude</div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: '#6A8A82', letterSpacing: '0.08em' }}>Empowering Kenya's Digital Future</div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: '#6A8A82', marginTop: 4 }}>PCL Centre, Nairobi County</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span style={{ color: '#6A8A82' }}>Order Number</span><span style={{ fontFamily: "'Share Tech Mono',monospace", color: '#EE6100', fontWeight: 700 }}>{order?.orderNumber}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span style={{ color: '#6A8A82' }}>Date</span><span>{new Date().toLocaleDateString('en-KE', { year:'numeric', month:'long', day:'numeric' })}</span></div>
          {order?.customer?.name && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span style={{ color: '#6A8A82' }}>Customer</span><span style={{ fontWeight: 500 }}>{order.customer.name}</span></div>}
          {order?.customer?.phone && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}><span style={{ color: '#6A8A82' }}>Phone</span><span>{order.customer.phone}</span></div>}

          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#EE6100', margin: '0.75rem 0 0.4rem' }}>Items</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6A8A82', borderBottom: '1px solid #ddd', padding: '3px 0' }}>Item</th><th style={{ textAlign: 'center', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6A8A82', borderBottom: '1px solid #ddd', padding: '3px 0' }}>Qty</th><th style={{ textAlign: 'right', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6A8A82', borderBottom: '1px solid #ddd', padding: '3px 0' }}>Amount</th></tr></thead>
            <tbody>
              {(items.length > 0 ? items : []).map((i) => (
                <tr key={i._id}><td style={{ padding: '3px 0', borderBottom: '1px solid #f0f0f0' }}>{i.name}</td><td style={{ padding: '3px 0', borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>{i.quantity}</td><td style={{ padding: '3px 0', borderBottom: '1px solid #f0f0f0', textAlign: 'right', fontFamily: "'Share Tech Mono',monospace" }}>{formatKES(i.price * i.quantity)}</td></tr>
              ))}
            </tbody>
          </table>

          <div style={{ padding: '0.75rem 0' }}>
            <PromoCodeInput
              orderAmount={total + deliveryFee}
              itemType="products"
              appliedPromo={appliedPromo}
              onApply={(discount, promo) => { setPromoDiscount(discount); setAppliedPromo(promo); }}
              onRemove={() => { setPromoDiscount(0); setAppliedPromo(null); }}
            />
          </div>

          <div style={{ borderTop: '2px solid #244A44', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, color: '#6A8A82' }}><span>Subtotal</span><span>{formatKES(total)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, color: '#6A8A82' }}><span>Delivery</span><span>{deliveryFee ? formatKES(deliveryFee) : 'Free'}</span></div>
            {promoDiscount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, color: '#39FF88' }}><span>Promo ({appliedPromo?.code})</span><span>−{formatKES(promoDiscount)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, color: '#244A44', borderTop: '1px solid #244A44', paddingTop: 6, marginTop: 6 }}><span>Total</span><span style={{ fontFamily: "'Share Tech Mono',monospace" }}>{formatKES(grandTotal)}</span></div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '1rem', borderTop: '1px dashed #ccc', paddingTop: '0.5rem', fontSize: 10, color: '#6A8A82', lineHeight: 1.6 }}>
            <div>Payment: <strong style={{ color: '#244A44' }}>{order?.paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash on Pickup'}</strong></div>
            <div style={{ marginTop: 4 }}><span style={{ color: '#EE6100', fontWeight: 600 }}>Postera Crescam Laude</span> · posteracrescamlaude.co.ke</div>
            <div>Empowering Kenya's Digital Future 🇰🇪</div>
          </div>
        </div>

        {/* View full receipt link */}
        <button
          onClick={() => navigate(`/receipt/${order?.orderNumber}`)}
          className="no-print"
          style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: 'transparent', color: '#2BB6A3', border: '1px solid rgba(43,182,163,0.3)', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontFamily: "'Poppins',sans-serif", fontSize: 11, letterSpacing: '0.05em' }}
        >📄 View Full Receipt & Download PDF</button>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem', alignItems: 'center' }}>
          {/* Primary actions */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => printReceipt(order, items.length > 0 ? items : order?.items || [], deliveryFee, grandTotal)}
              style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: '#2BB6A3', border: '1px solid #2BB6A3', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontFamily: "'Poppins',sans-serif", fontSize: 13, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(43,182,163,0.1)'; e.currentTarget.style.borderColor = '#2BB6A3'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(43,182,163,0.3)'; }}
            >🖨️ Print Receipt</button>
            <button
              onClick={() => navigate('/store')}
              style={{ padding: '0.75rem 1.5rem', background: '#EE6100', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontFamily: "'Poppins',sans-serif", fontSize: 13, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}
              onMouseOver={(e) => { if (!submitting) e.currentTarget.style.boxShadow = '0 0 20px rgba(238,97,0,0.3)'; }}
              onMouseOut={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
            >Continue Shopping</button>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 400 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(36,74,68,0.3)' }} />
            <span style={{ fontSize: 10, color: '#6A8A82', fontFamily: "'Share Tech Mono',monospace", letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>OR SEND RECEIPT</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(36,74,68,0.3)' }} />
          </div>

          {/* Email / SMS delivery */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => sendReceiptEmail(order, items.length > 0 ? items : order?.items || [], deliveryFee, grandTotal)}
              style={{ padding: '0.65rem 1.25rem', background: 'transparent', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontFamily: "'Poppins',sans-serif", fontSize: 12, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(167,139,250,0.08)'; e.currentTarget.style.borderColor = '#a78bfa'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)'; }}
            >📧 Email Receipt</button>
            <button
              onClick={() => sendReceiptSMS(order, items.length > 0 ? items : order?.items || [], deliveryFee, grandTotal)}
              style={{ padding: '0.65rem 1.25rem', background: 'transparent', color: '#39FF88', border: '1px solid rgba(57,255,136,0.4)', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontFamily: "'Poppins',sans-serif", fontSize: 12, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(57,255,136,0.08)'; e.currentTarget.style.borderColor = '#39FF88'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(57,255,136,0.4)'; }}
            >💬 SMS Receipt</button>
          </div>

          {/* Helper text */}
          {order?.customer?.email && (
            <p style={{ margin: 0, fontSize: 11, color: '#6A8A82', fontFamily: "'Share Tech Mono',monospace" }}>
              Email → {order.customer.email}
            </p>
          )}
          {order?.customer?.phone && (
            <p style={{ margin: 0, fontSize: 11, color: '#6A8A82', fontFamily: "'Share Tech Mono',monospace" }}>
              SMS → {order.customer.phone}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  if (step === 2) return (
    <div style={{ maxWidth: 500, margin: '4rem auto', padding: '2rem', ...card }}>
      <h2 style={{ margin: '0 0 1.5rem', textAlign: 'center', color: '#F4F1EA', fontFamily: "'Rajdhani',sans-serif" }}>Complete Payment</h2>
      <PaymentForm orderId={order._id} amount={grandTotal} onSuccess={() => { clearCart(); setStep(3); }} />
    </div>
  );

  /* ── Step 1: Checkout Form ──────────────────────────────────────── */
  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', padding: '0 1.5rem' }}>
      <h1 style={{ margin: '0 0 1.5rem', fontFamily: "'Rajdhani','Poppins',sans-serif", color: '#F4F1EA', fontSize: 'clamp(22px, 5vw, 28px)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Checkout</h1>

      <div className="checkout-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
        {/* ── Left: Form ── */}
        <form onSubmit={placeOrder} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={card}>
            <h3 style={{ margin: '0 0 1rem', color: '#F4F1EA', fontFamily: "'Rajdhani',sans-serif", fontSize: 15, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Your Details</h3>
            {[['name','Full Name','text'],['phone','Phone (M-Pesa)','tel'],['email','Email (optional)','email']].map(([k,l,t]) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ ...T.label, display: 'block', marginBottom: 4, fontSize: 11, color: '#A9C4BE', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{l}</label>
                <input type={t} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} required={k !== 'email'}
                  style={{ width: '100%', minHeight: 44, padding: '0.65rem 0.75rem', background: '#081916', border: '1px solid rgba(36,74,68,0.4)', borderRadius: 4, color: '#F4F1EA', fontFamily: "'Poppins',sans-serif", fontSize: 13, outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                  placeholder={k === 'phone' ? '+254712345678' : undefined}
                  onFocus={(e) => e.target.style.borderColor = '#EE6100'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(36,74,68,0.4)'}
                />
              </div>
            ))}
          </div>

          <div style={card}>
            <h3 style={{ margin: '0 0 1rem', color: '#F4F1EA', fontFamily: "'Rajdhani',sans-serif", fontSize: 15, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Delivery</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {['pickup','delivery'].map((t) => (
                <button key={t} type="button" onClick={() => setForm({ ...form, deliveryType: t })}
                  style={{ flex: 1, minWidth: 140, padding: '0.65rem', borderRadius: 4, border: `2px solid ${form.deliveryType === t ? '#EE6100' : 'rgba(36,74,68,0.4)'}`, background: form.deliveryType === t ? 'rgba(238,97,0,0.12)' : 'transparent', color: form.deliveryType === t ? '#EE6100' : '#6A8A82', cursor: 'pointer', fontWeight: 600, fontFamily: "'Poppins',sans-serif", fontSize: 12, transition: 'all 0.2s ease', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {t === 'pickup' ? '🏪 Pickup (Free)' : `🚚 Delivery (+${formatKES(DELIVERY_FEE)})`}
                </button>
              ))}
            </div>
            {form.deliveryType === 'delivery' && (
              <div>
                <label style={{ ...T.label, display: 'block', marginBottom: 4, fontSize: 11, color: '#A9C4BE', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Delivery Address</label>
                <input value={form.deliveryAddress} onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })} required
                  placeholder="Estate, road, landmark..."
                  style={{ width: '100%', minHeight: 44, padding: '0.65rem 0.75rem', background: '#081916', border: '1px solid rgba(36,74,68,0.4)', borderRadius: 4, color: '#F4F1EA', fontFamily: "'Poppins',sans-serif", fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  onFocus={(e) => e.target.style.borderColor = '#EE6100'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(36,74,68,0.4)'}
                />
              </div>
            )}
          </div>

          <div style={card}>
            <h3 style={{ margin: '0 0 1rem', color: '#F4F1EA', fontFamily: "'Rajdhani',sans-serif", fontSize: 15, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Payment Method</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {['mpesa','cash'].map((m) => (
                <button key={m} type="button" onClick={() => setForm({ ...form, paymentMethod: m })}
                  style={{ flex: 1, padding: '0.65rem', borderRadius: 4, border: `2px solid ${form.paymentMethod === m ? '#39FF88' : 'rgba(36,74,68,0.4)'}`, background: form.paymentMethod === m ? 'rgba(57,255,136,0.08)' : 'transparent', color: form.paymentMethod === m ? '#39FF88' : '#6A8A82', cursor: 'pointer', fontWeight: 600, fontFamily: "'Poppins',sans-serif", fontSize: 12, transition: 'all 0.2s ease', minHeight: 44 }}>
                  {m === 'mpesa' ? '📱 M-Pesa' : '💵 Cash on Pickup'}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={submitting}
            style={{ padding: '0.9rem', background: '#EE6100', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: 15, fontFamily: "'Poppins',sans-serif", transition: 'all 0.2s ease', opacity: submitting ? 0.7 : 1 }}
            onMouseOver={(e) => { if (!submitting) e.currentTarget.style.boxShadow = '0 0 20px rgba(238,97,0,0.3)'; }}
            onMouseOut={(e) => { e.currentTarget.style.boxShadow = 'none'; }}>
            {submitting ? 'Placing Order...' : `Place Order — ${formatKES(grandTotal)}`}
          </button>
        </form>

        {/* ── Right: Order Summary (sticky) ── */}
        <div className="checkout-summary" style={{ ...card, position: 'sticky', top: 80 }}>
          <h3 style={{ margin: '0 0 1rem', color: '#F4F1EA', fontFamily: "'Rajdhani',sans-serif", fontSize: 15, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid rgba(36,74,68,0.3)', paddingBottom: '0.5rem' }}>Order Summary</h3>
          {items.map((i) => (
            <div key={i._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#A9C4BE', fontFamily: "'Poppins',sans-serif" }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{i.name} ×{i.quantity}</span>
              <span style={{ color: '#F4F1EA', fontFamily: "'Share Tech Mono',monospace", flexShrink: 0 }}>{formatKES(i.price * i.quantity)}</span>
            </div>
          ))}
          <div style={{ height: 1, background: 'rgba(36,74,68,0.3)', margin: '0.75rem 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: '#A9C4BE', fontFamily: "'Poppins',sans-serif" }}>
            <span>Subtotal</span><span style={{ fontFamily: "'Share Tech Mono',monospace" }}>{formatKES(total)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10, color: '#A9C4BE', fontFamily: "'Poppins',sans-serif" }}>
            <span>Delivery</span><span style={{ fontFamily: "'Share Tech Mono',monospace" }}>{deliveryFee ? formatKES(deliveryFee) : 'Free'}</span>
          </div>
          <div style={{ height: 1, background: 'rgba(238,97,0,0.3)', margin: '0.5rem 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 20, fontFamily: "'Rajdhani','Poppins',sans-serif" }}>
            <span style={{ color: '#F4F1EA' }}>Total</span>
            <span style={{ color: '#EE6100', fontFamily: "'Share Tech Mono',monospace" }}>{formatKES(grandTotal)}</span>
          </div>

          {items.length === 0 && (
            <div style={{ textAlign: 'center', padding: '1rem 0', color: '#6A8A82', fontSize: 12 }}>
              Your cart is empty
            </div>
          )}
        </div>
      </div>

      {/* Responsive overrides */}
      <style>{`
        @media (max-width: 768px) {
          .checkout-grid {
            grid-template-columns: 1fr !important;
          }
          .checkout-summary {
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}
