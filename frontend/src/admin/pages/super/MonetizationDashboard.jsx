// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — Monetization Dashboard for Super Admin.
// Shows unified view of all revenue streams: ads, promo codes, platform fees, and product/service revenue.

import { useState, useEffect } from 'react';
import { api } from '../../../utils/api';
import { formatKES } from '../../../utils/helpers';

const COLORS = {
  primary: '#EE6100',
  teal: '#2BB6A3',
  green: '#39FF88',
  amber: '#FFB020',
  red: '#FF3B3B',
  bg: '#081916',
  surface: '#0F2620',
  text: '#F4F1EA',
  muted: '#6A8A82',
  dim: '#A9C4BE',
};

const card = {
  background: COLORS.surface,
  border: '1px solid rgba(36,74,68,0.3)',
  borderRadius: 10,
  padding: '1.25rem',
};

const statCard = (color) => ({
  ...card,
  borderLeft: `3px solid ${color}`,
});

export default function MonetizationDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/monetization/dashboard')
      .then(({ data }) => setStats(data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load monetization data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, color: COLORS.muted, fontFamily: "'Share Tech Mono',monospace" }}>Loading monetization data...</div>;
  if (error) return <div style={{ padding: 40, color: COLORS.red, fontFamily: "'Share Tech Mono',monospace" }}>⚠ {error}</div>;
  if (!stats) return null;

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontFamily: "'Rajdhani','Poppins',sans-serif", fontSize: 28, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>
        💰 Monetization Dashboard
      </h1>
      <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: COLORS.muted, marginBottom: 32, letterSpacing: '0.05em' }}>
        LAST 30 DAYS · UNIFIED REVENUE VIEW
      </p>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div style={statCard(COLORS.primary)}>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: COLORS.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>TOTAL REVENUE</div>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 24, fontWeight: 700, color: COLORS.text }}>{formatKES(stats.totalMonetizationRevenue30d)}</div>
        </div>
        <div style={statCard(COLORS.teal)}>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: COLORS.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>PRODUCT SALES</div>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 24, fontWeight: 700, color: COLORS.text }}>{formatKES(stats.revenue?.products30d?.total || 0)}</div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>{stats.revenue?.products30d?.count || 0} orders</div>
        </div>
        <div style={statCard(COLORS.green)}>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: COLORS.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>PLATFORM FEES</div>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 24, fontWeight: 700, color: COLORS.text }}>{formatKES(stats.fees?.totalFees30d || 0)}</div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>{stats.fees?.feePercentage || 5}% · {stats.fees?.transactionCount30d || 0} transactions</div>
        </div>
        <div style={statCard(COLORS.amber)}>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: COLORS.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>AD REVENUE</div>
          <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 24, fontWeight: 700, color: COLORS.text }}>{formatKES(stats.ads?.totalRevenue || 0)}</div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>{stats.ads?.activeCampaigns || 0} active · CTR {stats.ads?.ctr || 0}%</div>
        </div>
      </div>

      {/* Detailed sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20 }}>
        {/* Ad Campaigns */}
        <div style={card}>
          <h3 style={{ fontFamily: "'Rajdhani','Poppins',sans-serif", fontSize: 16, fontWeight: 700, color: COLORS.teal, marginBottom: 16 }}>📢 Ad Campaigns</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <StatRow label="Active Campaigns" value={stats.ads?.activeCampaigns || 0} />
            <StatRow label="Impressions (30d)" value={(stats.ads?.impressions30d || 0).toLocaleString()} />
            <StatRow label="Clicks (30d)" value={(stats.ads?.clicks30d || 0).toLocaleString()} />
            <StatRow label="Click-through Rate" value={`${stats.ads?.ctr || 0}%`} />
            <StatRow label="Revenue" value={formatKES(stats.ads?.totalRevenue || 0)} color={COLORS.green} />
          </div>
        </div>

        {/* Promo Codes */}
        <div style={card}>
          <h3 style={{ fontFamily: "'Rajdhani','Poppins',sans-serif", fontSize: 16, fontWeight: 700, color: COLORS.amber, marginBottom: 16 }}>🎫 Promo Codes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <StatRow label="Active Codes" value={stats.promos?.activeCodes || 0} />
            <StatRow label="Revenue Generated" value={formatKES(stats.promos?.totalRevenueGenerated30d || 0)} />
            <StatRow label="Discounts Given" value={formatKES(stats.promos?.totalDiscountGiven30d || 0)} color={COLORS.red} />
            <StatRow label="Net Revenue" value={formatKES(stats.promos?.netRevenue || 0)} color={COLORS.green} />
          </div>
        </div>

        {/* Platform Fees */}
        <div style={card}>
          <h3 style={{ fontFamily: "'Rajdhani','Poppins',sans-serif", fontSize: 16, fontWeight: 700, color: COLORS.green, marginBottom: 16 }}>💳 Platform Fees</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <StatRow label="Gross Volume" value={formatKES(stats.fees?.totalGross30d || 0)} />
            <StatRow label="Fee Rate" value={`${stats.fees?.feePercentage || 5}%`} />
            <StatRow label="Fees Collected" value={formatKES(stats.fees?.totalFees30d || 0)} color={COLORS.green} />
            <StatRow label="Transactions" value={stats.fees?.transactionCount30d || 0} />
          </div>
        </div>

        {/* Revenue Breakdown */}
        <div style={card}>
          <h3 style={{ fontFamily: "'Rajdhani','Poppins',sans-serif", fontSize: 16, fontWeight: 700, color: COLORS.primary, marginBottom: 16 }}>📊 Revenue Breakdown</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <StatRow label="Products" value={formatKES(stats.revenue?.products30d?.total || 0)} />
            <StatRow label="Bookings" value={formatKES(stats.revenue?.bookings30d?.total || 0)} />
            <StatRow label="Consultations" value={formatKES(stats.revenue?.consultations30d?.total || 0)} />
            <div style={{ borderTop: '1px solid rgba(36,74,68,0.3)', paddingTop: 8, marginTop: 4 }}>
              <StatRow label="Total (30d)" value={formatKES(stats.totalMonetizationRevenue30d)} color={COLORS.primary} bold />
            </div>
          </div>
        </div>
      </div>

      {/* Recent platform fee transactions */}
      {stats.fees?.recentTransactions?.length > 0 && (
        <div style={{ ...card, marginTop: 24 }}>
          <h3 style={{ fontFamily: "'Rajdhani','Poppins',sans-serif", fontSize: 16, fontWeight: 700, color: COLORS.teal, marginBottom: 16 }}>🕒 Recent Transactions</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Time', 'Source', 'Gross', 'Fee', 'Description'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid rgba(36,74,68,0.4)', fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: COLORS.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.fees.recentTransactions.map((tx) => (
                  <tr key={tx._id}>
                    <td style={{ padding: '8px 12px', color: COLORS.dim, borderBottom: '1px solid rgba(36,74,68,0.2)' }}>{new Date(tx.collectedAt).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', color: COLORS.dim, borderBottom: '1px solid rgba(36,74,68,0.2)', textTransform: 'capitalize' }}>{tx.sourceType}</td>
                    <td style={{ padding: '8px 12px', color: COLORS.text, fontFamily: "'Share Tech Mono',monospace", borderBottom: '1px solid rgba(36,74,68,0.2)' }}>{formatKES(tx.grossAmount)}</td>
                    <td style={{ padding: '8px 12px', color: COLORS.green, fontFamily: "'Share Tech Mono',monospace", borderBottom: '1px solid rgba(36,74,68,0.2)' }}>{formatKES(tx.feeAmount)}</td>
                    <td style={{ padding: '8px 12px', color: COLORS.muted, borderBottom: '1px solid rgba(36,74,68,0.2)' }}>{tx.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: COLORS.dim, fontFamily: "'Inter',sans-serif" }}>{label}</span>
      <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 400, color: color || COLORS.text }}>{value}</span>
    </div>
  );
}
