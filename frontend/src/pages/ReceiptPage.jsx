// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — Circuit Canopy Receipt Page
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { formatKES } from '../utils/helpers';
import { Spinner } from '../components/UI';
import toast from 'react-hot-toast';

const STORE = {
  name: 'Postera Crescam Laude',
  tagline: "Empowering Kenya's Digital Future",
  address: 'PCL Centre, Nairobi County, Kenya',
  phone: '+254 140 918 502',
  email: 'info@posteracrescamlaude.co.ke',
  taxId: 'PCL/VAT/2026',
  website: 'posteracrescamlaude.co.ke',
  returnPolicy: 'Returns accepted within 7 days of purchase with receipt.',
};

export default function ReceiptPage() {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const receiptRef = useRef(null);

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      try {
        // Use the public receipt endpoint
        const res = await fetch(`/api/orders/receipt/${orderNumber}`);
        if (!res.ok) throw new Error('not found');
        const data = await res.json();
        setOrder(data);
      } catch {
        setError('Order not found. Please check your order number.');
      }
      setLoading(false);
    };
    if (orderNumber) fetchOrder();
  }, [orderNumber]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const baseUrl = api.defaults?.baseURL || '/api';
      const url = `${baseUrl}/orders/receipt/${orderNumber}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to download');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `receipt-${orderNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success('Receipt downloaded!');
    } catch {
      toast.error('Failed to download receipt. Please try again.');
    }
    setDownloading(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Spinner />
    </div>
  );

  if (error) return (
    <div style={{ maxWidth: 500, margin: '4rem auto', padding: '2rem', background: '#0F2620', border: '1px solid rgba(36,74,68,0.4)', borderRadius: 10, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
      <h2 style={{ color: '#FF3B3B', fontFamily: "'Rajdhani',sans-serif", margin: '0 0 0.5rem' }}>Receipt Not Found</h2>
      <p style={{ color: '#A9C4BE', fontSize: 13, fontFamily: "'Poppins',sans-serif" }}>{error}</p>
      <button onClick={() => navigate('/store')} style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', background: '#EE6100', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontFamily: "'Poppins',sans-serif" }}>
        Back to Store
      </button>
    </div>
  );

  if (!order) return null;

  const receiptItems = order.items || [];
  const subtotal = order.subtotal || receiptItems.reduce((s, i) => s + (i.subtotal || i.price * i.quantity), 0);
  const deliveryFee = order.deliveryFee || 0;
  const total = order.total || subtotal + deliveryFee;
  const trackingUrl = `${STORE.website}/track/${order.orderNumber}`;

  return (
    <div style={{ minHeight: '100vh', background: '#081916' }}>
      {/* ── Action bar (hidden on print) ── */}
      <div className="no-print" style={{
        display: 'flex', justifyContent: 'center', gap: '0.75rem', padding: '1.5rem',
        borderBottom: '1px solid rgba(36,74,68,0.3)', background: '#0B1F1B',
      }}>
        <button onClick={handlePrint}
          style={{ padding: '0.65rem 1.5rem', background: 'transparent', color: '#2BB6A3', border: '1px solid #2BB6A3', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontFamily: "'Poppins',sans-serif", fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(43,182,163,0.1)'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}>
          🖨️ Print Receipt
        </button>
        <button onClick={handleDownloadPDF} disabled={downloading}
          style={{ padding: '0.65rem 1.5rem', background: downloading ? '#6A8A82' : '#EE6100', color: '#fff', border: 'none', borderRadius: 4, cursor: downloading ? 'not-allowed' : 'pointer', fontWeight: 700, fontFamily: "'Poppins',sans-serif", fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}>
          {downloading ? '⏳ Generating...' : '📥 Download PDF'}
        </button>
        <button onClick={() => navigate(-1)}
          style={{ padding: '0.65rem 1.5rem', background: 'transparent', color: '#6A8A82', border: '1px solid rgba(36,74,68,0.4)', borderRadius: 4, cursor: 'pointer', fontFamily: "'Poppins',sans-serif", fontSize: 13, transition: 'all 0.2s' }}>
          ← Back
        </button>
      </div>

      {/* ── Receipt (on-screen + print) ── */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div ref={receiptRef} style={{
          background: '#F4F1EA', borderRadius: 10, padding: '2rem',
          color: '#244A44', fontFamily: "'Poppins',sans-serif", fontSize: 13,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          border: '1px solid rgba(36,74,68,0.2)',
        }}>
          {/* ── Header ── */}
          <div style={{ textAlign: 'center', borderBottom: '3px solid #EE6100', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <img src="/postera-mark.png" alt="PCL Logo" style={{ width: 60, height: 60, margin: '0 auto 8px', display: 'block', objectFit: 'contain' }} />
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 22, color: '#244A44', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{STORE.name}</div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: '#6A8A82', letterSpacing: '0.08em', marginTop: 2 }}>{STORE.tagline}</div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: '#6A8A82', marginTop: 4 }}>{STORE.address}</div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: '#6A8A82', marginTop: 2 }}>{STORE.phone} · {STORE.email} · {STORE.taxId}</div>
          </div>

          {/* ── Invoice Title ── */}
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 16, color: '#EE6100', letterSpacing: '0.15em', textTransform: 'uppercase' }}>PURCHASE RECEIPT</span>
          </div>

          {/* ── Order Meta ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 2rem', marginBottom: '1rem', fontSize: 11 }}>
            <div><span style={{ color: '#6A8A82' }}>Order Number</span><div style={{ fontFamily: "'Share Tech Mono',monospace", fontWeight: 700, color: '#EE6100', fontSize: 13 }}>{order.orderNumber}</div></div>
            <div><span style={{ color: '#6A8A82' }}>Payment Method</span><div style={{ fontWeight: 600 }}>{order.paymentMethod === 'mpesa' ? 'M-Pesa' : order.paymentMethod === 'cash' ? 'Cash on Pickup' : order.paymentMethod}</div></div>
            <div><span style={{ color: '#6A8A82' }}>Date</span><div style={{ fontWeight: 600 }}>{new Date(order.createdAt).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}</div></div>
            <div><span style={{ color: '#6A8A82' }}>Status</span><div style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{order.status || 'pending'}</div></div>
            <div><span style={{ color: '#6A8A82' }}>Time</span><div style={{ fontWeight: 600 }}>{new Date(order.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</div></div>
            <div><span style={{ color: '#6A8A82' }}>Delivery</span><div style={{ fontWeight: 600 }}>{order.deliveryType === 'delivery' ? 'Delivery' : 'Pickup'}</div></div>
          </div>

          {/* ── Customer ── */}
          {order.customer && (
            <div style={{ background: 'rgba(36,74,68,0.06)', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: 11 }}>
              <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 10, color: '#EE6100', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Customer Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 1rem' }}>
                {order.customer.name && <div><span style={{ color: '#6A8A82' }}>Name: </span><span style={{ fontWeight: 600 }}>{order.customer.name}</span></div>}
                {order.customer.phone && <div><span style={{ color: '#6A8A82' }}>Phone: </span><span style={{ fontWeight: 600 }}>{order.customer.phone}</span></div>}
                {order.customer.email && <div><span style={{ color: '#6A8A82' }}>Email: </span><span>{order.customer.email}</span></div>}
                {order.deliveryType === 'delivery' && order.customer.deliveryAddress && (
                  <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#6A8A82' }}>Address: </span><span>{order.customer.deliveryAddress}</span></div>
                )}
              </div>
            </div>
          )}

          {/* ── Line Items ── */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 10, color: '#EE6100', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Items Purchased</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontSize: 9, color: '#6A8A82', letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '2px solid #244A44', padding: '4px 0' }}>Item</th>
                  <th style={{ textAlign: 'center', fontSize: 9, color: '#6A8A82', letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '2px solid #244A44', padding: '4px 0' }}>Qty</th>
                  <th style={{ textAlign: 'right', fontSize: 9, color: '#6A8A82', letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '2px solid #244A44', padding: '4px 0' }}>Price</th>
                  <th style={{ textAlign: 'right', fontSize: 9, color: '#6A8A82', letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '2px solid #244A44', padding: '4px 0' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {receiptItems.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '6px 0', borderBottom: '1px solid #e0e0e0', fontWeight: 500 }}>{item.name}</td>
                    <td style={{ padding: '6px 0', borderBottom: '1px solid #e0e0e0', textAlign: 'center', fontFamily: "'Share Tech Mono',monospace" }}>{item.quantity}</td>
                    <td style={{ padding: '6px 0', borderBottom: '1px solid #e0e0e0', textAlign: 'right', fontFamily: "'Share Tech Mono',monospace" }}>{formatKES(item.price)}</td>
                    <td style={{ padding: '6px 0', borderBottom: '1px solid #e0e0e0', textAlign: 'right', fontFamily: "'Share Tech Mono',monospace", fontWeight: 600 }}>{formatKES(item.subtotal || item.price * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Totals ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <div style={{ width: 250 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, color: '#6A8A82' }}>
                <span>Subtotal</span><span style={{ fontFamily: "'Share Tech Mono',monospace" }}>{formatKES(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, color: '#6A8A82' }}>
                <span>Delivery</span><span style={{ fontFamily: "'Share Tech Mono',monospace" }}>{deliveryFee ? formatKES(deliveryFee) : 'Free'}</span>
              </div>
              <div style={{ borderTop: '2px solid #EE6100', paddingTop: 8, marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 16, color: '#244A44' }}>TOTAL</span>
                <span style={{ fontFamily: "'Share Tech Mono',monospace", fontWeight: 700, fontSize: 16, color: '#EE6100' }}>{formatKES(total)}</span>
              </div>
            </div>
          </div>

          {/* ── Payment + QR ── */}
          <div style={{ borderTop: '1px solid #ddd', paddingTop: '1rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              {order.mpesaRef && (
                <div style={{ fontSize: 10, color: '#6A8A82', marginBottom: 4 }}>
                  <span>M-Pesa Ref: </span><span style={{ fontFamily: "'Share Tech Mono',monospace", fontWeight: 600 }}>{order.mpesaRef}</span>
                </div>
              )}
              <div style={{ fontSize: 10, color: '#6A8A82', marginTop: 8 }}>
                <div>{STORE.returnPolicy}</div>
              </div>
              <div style={{ fontSize: 9, color: '#A9C4BE', marginTop: 8, fontFamily: "'Share Tech Mono',monospace" }}>
                {STORE.name} · {STORE.website}
              </div>
            </div>

            {/* QR Code placeholder — will show when PDF is downloaded */}
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{
                width: 90, height: 90, border: '2px solid #244A44', borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#fff', position: 'relative', overflow: 'hidden',
              }}>
                {/* QR pattern simulation */}
                <svg viewBox="0 0 100 100" width="70" height="70">
                  {/* Top-left finder */}
                  <rect x="5" y="5" width="25" height="25" fill="none" stroke="#244A44" strokeWidth="3"/>
                  <rect x="11" y="11" width="13" height="13" fill="#244A44"/>
                  {/* Top-right finder */}
                  <rect x="70" y="5" width="25" height="25" fill="none" stroke="#244A44" strokeWidth="3"/>
                  <rect x="76" y="11" width="13" height="13" fill="#244A44"/>
                  {/* Bottom-left finder */}
                  <rect x="5" y="70" width="25" height="25" fill="none" stroke="#244A44" strokeWidth="3"/>
                  <rect x="11" y="76" width="13" height="13" fill="#244A44"/>
                  {/* Data modules (decorative pattern) */}
                  <rect x="35" y="5" width="5" height="5" fill="#244A44"/>
                  <rect x="45" y="5" width="5" height="5" fill="#244A44"/>
                  <rect x="55" y="5" width="5" height="5" fill="#EE6100"/>
                  <rect x="35" y="15" width="5" height="5" fill="#EE6100"/>
                  <rect x="45" y="15" width="5" height="5" fill="#244A44"/>
                  <rect x="55" y="15" width="5" height="5" fill="#244A44"/>
                  <rect x="5" y="35" width="5" height="5" fill="#244A44"/>
                  <rect x="15" y="35" width="5" height="5" fill="#EE6100"/>
                  <rect x="25" y="35" width="5" height="5" fill="#244A44"/>
                  <rect x="35" y="35" width="5" height="5" fill="#244A44"/>
                  <rect x="45" y="35" width="5" height="5" fill="#EE6100"/>
                  <rect x="55" y="35" width="5" height="5" fill="#244A44"/>
                  <rect x="65" y="35" width="5" height="5" fill="#244A44"/>
                  <rect x="75" y="35" width="5" height="5" fill="#EE6100"/>
                  <rect x="85" y="35" width="5" height="5" fill="#244A44"/>
                  <rect x="5" y="45" width="5" height="5" fill="#EE6100"/>
                  <rect x="15" y="45" width="5" height="5" fill="#244A44"/>
                  <rect x="25" y="45" width="5" height="5" fill="#244A44"/>
                  <rect x="35" y="45" width="5" height="5" fill="#EE6100"/>
                  <rect x="45" y="45" width="5" height="5" fill="#244A44"/>
                  <rect x="55" y="45" width="5" height="5" fill="#EE6100"/>
                  <rect x="65" y="45" width="5" height="5" fill="#244A44"/>
                  <rect x="75" y="45" width="5" height="5" fill="#244A44"/>
                  <rect x="85" y="45" width="5" height="5" fill="#EE6100"/>
                  <rect x="5" y="55" width="5" height="5" fill="#244A44"/>
                  <rect x="15" y="55" width="5" height="5" fill="#244A44"/>
                  <rect x="35" y="55" width="5" height="5" fill="#244A44"/>
                  <rect x="55" y="55" width="5" height="5" fill="#244A44"/>
                  <rect x="75" y="55" width="5" height="5" fill="#244A44"/>
                  <rect x="85" y="55" width="5" height="5" fill="#244A44"/>
                  <rect x="35" y="65" width="5" height="5" fill="#EE6100"/>
                  <rect x="45" y="65" width="5" height="5" fill="#244A44"/>
                  <rect x="55" y="65" width="5" height="5" fill="#244A44"/>
                  <rect x="65" y="65" width="5" height="5" fill="#EE6100"/>
                  <rect x="75" y="65" width="5" height="5" fill="#244A44"/>
                  <rect x="35" y="75" width="5" height="5" fill="#244A44"/>
                  <rect x="45" y="75" width="5" height="5" fill="#EE6100"/>
                  <rect x="55" y="75" width="5" height="5" fill="#244A44"/>
                  <rect x="65" y="75" width="5" height="5" fill="#244A44"/>
                  <rect x="35" y="85" width="5" height="5" fill="#244A44"/>
                  <rect x="55" y="85" width="5" height="5" fill="#EE6100"/>
                  <rect x="65" y="85" width="5" height="5" fill="#244A44"/>
                  <rect x="75" y="85" width="5" height="5" fill="#244A44"/>
                  <rect x="85" y="85" width="5" height="5" fill="#244A44"/>
                </svg>
              </div>
              <div style={{ fontSize: 8, color: '#6A8A82', marginTop: 4, fontFamily: "'Share Tech Mono',monospace" }}>Scan to track</div>
              <div style={{ fontSize: 7, color: '#A9C4BE', marginTop: 2 }}>{trackingUrl}</div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div style={{ textAlign: 'center', marginTop: '1.5rem', borderTop: '1px dashed #ccc', paddingTop: '0.75rem' }}>
            <div style={{ fontSize: 10, color: '#6A8A82', lineHeight: 1.8 }}>
              Thank you for your purchase!
            </div>
            <div style={{ fontSize: 9, color: '#A9C4BE', marginTop: 4 }}>
              <span style={{ color: '#EE6100', fontWeight: 600 }}>{STORE.name}</span> · {STORE.website}
            </div>
            <div style={{ fontSize: 8, color: '#A9C4BE', marginTop: 2 }}>
              Empowering Kenya's Digital Future 🇰🇪
            </div>
          </div>
        </div>

        {/* ── Bottom CTA ── */}
        <div className="no-print" style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button onClick={() => navigate('/store')}
            style={{ padding: '0.75rem 2rem', background: '#EE6100', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontFamily: "'Poppins',sans-serif", fontSize: 13 }}>
            Continue Shopping
          </button>
        </div>
      </div>

      {/* ── Print styles ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          div[style*="background: rgb(8, 25, 22)"] { background: #fff !important; }
          div[style*="boxShadow"] { box-shadow: none !important; }
          img[alt="PCL Logo"] { display: block !important; margin: 0 auto 8px !important; width: 60px !important; height: 60px !important; }
        }
      `}</style>
    </div>
  );
}
