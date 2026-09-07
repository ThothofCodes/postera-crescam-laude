// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — Department Analytics Page
// Per-department revenue, tickets, and staffing charts
import { useState, useEffect } from 'react';
import { api } from '../../../utils/api';
import { formatKES } from '../../../utils/helpers';
import { Spinner } from '../../../components/UI';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area,
} from 'recharts';

const CHART_COLORS = ['#2BB6A3', '#A78BFA', '#FFB020', '#FF8800', '#FF3B3B', '#00FF88', '#60A5FA', '#F472B6'];

export default function DepartmentAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [chartView, setChartView] = useState('overview'); // overview, revenue, tickets, staffing
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => { fetchAnalytics(); }, [year]);
  useEffect(() => {
    if (selectedDept) fetchTimeline(selectedDept);
  }, [selectedDept]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/analytics/departments', { params: { year } });
      setData(data);
    } catch { setData(null); }
    setLoading(false);
  };

  const fetchTimeline = async (slug) => {
    try {
      const { data } = await api.get(`/analytics/departments/${slug}/timeline`, { params: { year } });
      setTimeline(data);
    } catch { setTimeline(null); }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const response = await fetch(`/api/analytics/departments/pdf?year=${year}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to download');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dept-analytics-${year}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Silent — user can try again
    }
    setDownloadingPdf(false);
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Spinner /></div>;
  if (!data?.departments?.length) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <h2 style={{ color: '#A9C4BE', fontFamily: "'Rajdhani',sans-serif" }}>No Department Data</h2>
        <p style={{ color: '#6A8A82', fontSize: 13 }}>Create departments and add transactions to see analytics.</p>
      </div>
    );
  }

  const depts = data.departments;
  const totalRevenue = depts.reduce((s, d) => s + d.revenue, 0);
  const totalTickets = depts.reduce((s, d) => s + d.tickets, 0);
  const totalStaff = depts.reduce((s, d) => s + d.staffCount, 0);
  const totalOpenTickets = depts.reduce((s, d) => s + d.ticketsOpen, 0);

  // Chart data
  const revenueChartData = depts.map(d => ({ name: d.name.split(' ')[0], revenue: d.revenue, color: d.color }));
  const ticketChartData = depts.map(d => ({
    name: d.name.split(' ')[0],
    open: d.ticketsOpen,
    resolved: d.ticketsResolved,
    closed: d.ticketsClosed,
    slaBreach: d.slaBreachCount,
  }));
  const staffChartData = depts.map(d => ({ name: d.name.split(' ')[0], staff: d.staffCount, color: d.color }));
  const pieData = depts.map(d => ({ name: d.name, value: d.revenue, color: d.color }));

  // Radar data for comparing departments
  const maxRevenue = Math.max(...depts.map(d => d.revenue), 1);
  const maxTickets = Math.max(...depts.map(d => d.tickets), 1);
  const maxStaff = Math.max(...depts.map(d => d.staffCount), 1);
  const radarData = depts.map(d => ({
    name: d.name.split(' ')[0],
    revenue: Math.round((d.revenue / maxRevenue) * 100),
    tickets: Math.round((d.tickets / maxTickets) * 100),
    staff: Math.round((d.staffCount / maxStaff) * 100),
    invoices: d.invoicesPaid > 0 ? Math.round((d.invoicesPaid / Math.max(d.invoices, 1)) * 100) : 0,
  }));

  const selectedDeptData = depts.find(d => d.slug === selectedDept);

  return (
    <div style={{ minHeight: '100vh', background: '#081916', color: '#A9C4BE', fontFamily: "'Poppins', sans-serif" }}>
      <div style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 28, fontWeight: 700, color: '#EE6100', margin: 0 }}>
              📊 Department Analytics
            </h1>
            <p style={{ fontSize: 13, color: '#6A8A82', margin: '4px 0 0' }}>
              Per-department revenue, tickets, and staffing overview
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              style={{ padding: '0.4rem 0.75rem', background: '#0B1F1B', color: '#E8F0EE', border: '1px solid rgba(36,74,68,0.4)', borderRadius: 4, fontSize: 12, fontFamily: "'Poppins', sans-serif" }}>
              {[0, 1, 2].map(y => <option key={y} value={new Date().getFullYear() - y}>{new Date().getFullYear() - y}</option>)}
            </select>
            <button onClick={handleDownloadPdf} disabled={downloadingPdf}
              style={{
                padding: '0.4rem 1rem', borderRadius: 4, fontSize: 12, fontWeight: 700,
                background: downloadingPdf ? '#6A8A82' : '#EE6100',
                color: '#fff', border: 'none', cursor: downloadingPdf ? 'not-allowed' : 'pointer',
                fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.2s',
              }}>
              {downloadingPdf ? '⏳ Generating...' : '📥 Download PDF'}
            </button>
          </div>
        </div>

        {/* KPI Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: '2rem' }}>
          {[
            { label: 'TOTAL REVENUE', value: formatKES(totalRevenue), color: '#2BB6A3', icon: '💰' },
            { label: 'TOTAL TICKETS', value: totalTickets.toLocaleString(), color: '#A78BFA', icon: '🎫' },
            { label: 'OPEN TICKETS', value: totalOpenTickets.toLocaleString(), color: '#FF3B3B', icon: '⚠️' },
            { label: 'TOTAL STAFF', value: totalStaff.toLocaleString(), color: '#FFB020', icon: '👥' },
            { label: 'DEPARTMENTS', value: depts.length, color: '#60A5FA', icon: '🏢' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: '#0B1F1B', border: `1px solid ${kpi.color}30`, borderRadius: 10, padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#6A8A82', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{kpi.label}</span>
                <span style={{ fontSize: 18 }}>{kpi.icon}</span>
              </div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 28, fontWeight: 700, color: kpi.color, marginTop: 6 }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* View Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { key: 'overview', label: '◈ Overview' },
            { key: 'revenue', label: '💰 Revenue' },
            { key: 'tickets', label: '🎫 Tickets' },
            { key: 'staffing', label: '👥 Staffing' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setChartView(tab.key)}
              style={{
                padding: '0.5rem 1rem', borderRadius: 4, fontSize: 12, fontWeight: 600,
                background: chartView === tab.key ? 'rgba(238,97,0,0.15)' : 'transparent',
                color: chartView === tab.key ? '#EE6100' : '#6A8A82',
                border: `1px solid ${chartView === tab.key ? '#EE6100' : 'rgba(36,74,68,0.4)'}`,
                cursor: 'pointer', fontFamily: "'Poppins', sans-serif", transition: 'all 0.15s',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: chartView === 'overview' ? 'repeat(2, 1fr)' : '1fr', gap: 20, marginBottom: '2rem' }}>
          {/* Revenue Bar Chart */}
          {(chartView === 'overview' || chartView === 'revenue') && (
            <div style={{ background: '#0B1F1B', border: '1px solid rgba(36,74,68,0.3)', borderRadius: 10, padding: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: '#A9C4BE', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 1rem' }}>
                💰 Revenue by Department
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(36,74,68,0.2)" />
                  <XAxis dataKey="name" tick={{ fill: '#6A8A82', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6A8A82', fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip contentStyle={{ background: '#0B1F1B', border: '1px solid rgba(36,74,68,0.4)', borderRadius: 6 }} formatter={(v) => formatKES(v)} />
                  <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                    {revenueChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Revenue Pie */}
          {(chartView === 'overview' || chartView === 'revenue') && (
            <div style={{ background: '#0B1F1B', border: '1px solid rgba(36,74,68,0.3)', borderRadius: 10, padding: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: '#A9C4BE', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 1rem' }}>
                📊 Revenue Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value"
                    label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0B1F1B', border: '1px solid rgba(36,74,68,0.4)', borderRadius: 6 }} formatter={(v) => formatKES(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tickets Stacked Bar */}
          {(chartView === 'overview' || chartView === 'tickets') && (
            <div style={{ background: '#0B1F1B', border: '1px solid rgba(36,74,68,0.3)', borderRadius: 10, padding: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: '#A9C4BE', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 1rem' }}>
                🎫 Tickets by Status
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ticketChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(36,74,68,0.2)" />
                  <XAxis dataKey="name" tick={{ fill: '#6A8A82', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6A8A82', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#0B1F1B', border: '1px solid rgba(36,74,68,0.4)', borderRadius: 6 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#6A8A82' }} />
                  <Bar dataKey="open" stackId="a" fill="#FF3B3B" name="Open" />
                  <Bar dataKey="resolved" stackId="a" fill="#2BB6A3" name="Resolved" />
                  <Bar dataKey="closed" stackId="a" fill="#6A8A82" name="Closed" />
                  <Bar dataKey="slaBreach" stackId="a" fill="#FFB020" name="SLA Breach" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Staff Bar Chart */}
          {(chartView === 'overview' || chartView === 'staffing') && (
            <div style={{ background: '#0B1F1B', border: '1px solid rgba(36,74,68,0.3)', borderRadius: 10, padding: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: '#A9C4BE', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 1rem' }}>
                👥 Staff Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={staffChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(36,74,68,0.2)" />
                  <XAxis dataKey="name" tick={{ fill: '#6A8A82', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6A8A82', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#0B1F1B', border: '1px solid rgba(36,74,68,0.4)', borderRadius: 6 }} />
                  <Bar dataKey="staff" radius={[4, 4, 0, 0]}>
                    {staffChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Radar Chart (full width) */}
        {chartView === 'overview' && (
          <div style={{ background: '#0B1F1B', border: '1px solid rgba(36,74,68,0.3)', borderRadius: 10, padding: '1.25rem', marginBottom: '2rem' }}>
            <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: '#A9C4BE', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 1rem' }}>
              🎯 Department Performance Radar
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(36,74,68,0.3)" />
                <PolarAngleAxis dataKey="name" tick={{ fill: '#6A8A82', fontSize: 11 }} />
                <PolarRadiusAxis tick={{ fill: '#6A8A82', fontSize: 10 }} domain={[0, 100]} />
                <Radar name="Revenue" dataKey="revenue" stroke="#2BB6A3" fill="#2BB6A3" fillOpacity={0.2} />
                <Radar name="Tickets" dataKey="tickets" stroke="#A78BFA" fill="#A78BFA" fillOpacity={0.2} />
                <Radar name="Staff" dataKey="staff" stroke="#FFB020" fill="#FFB020" fillOpacity={0.2} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#6A8A82' }} />
                <Tooltip contentStyle={{ background: '#0B1F1B', border: '1px solid rgba(36,74,68,0.4)', borderRadius: 6 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Department Timeline (when one is selected) */}
        {selectedDept && timeline && (
          <div style={{ background: '#0B1F1B', border: `1px solid ${selectedDeptData?.color || '#2BB6A3'}40`, borderRadius: 10, padding: '1.25rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: selectedDeptData?.color || '#2BB6A3', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                📈 {selectedDeptData?.name || selectedDept} — Monthly Timeline
              </h3>
              <button onClick={() => { setSelectedDept(null); setTimeline(null); }}
                style={{ background: 'none', border: '1px solid rgba(36,74,68,0.4)', color: '#6A8A82', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 11 }}>
                ✕ Close
              </button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timeline.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(36,74,68,0.2)" />
                <XAxis dataKey="month" tick={{ fill: '#6A8A82', fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fill: '#6A8A82', fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6A8A82', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#0B1F1B', border: '1px solid rgba(36,74,68,0.4)', borderRadius: 6 }} formatter={(v, name) => name === 'revenue' ? formatKES(v) : v} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#6A8A82' }} />
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#2BB6A3" fill="#2BB6A3" fillOpacity={0.15} name="Revenue" />
                <Area yAxisId="right" type="monotone" dataKey="tickets" stroke="#A78BFA" fill="#A78BFA" fillOpacity={0.15} name="Tickets" />
                <Area yAxisId="right" type="monotone" dataKey="ticketsResolved" stroke="#39FF88" fill="#39FF88" fillOpacity={0.1} name="Resolved" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Department Detail Table */}
        <div style={{ background: '#0B1F1B', border: '1px solid rgba(36,74,68,0.3)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(36,74,68,0.3)' }}>
            <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: '#A9C4BE', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              📋 Department Breakdown
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(36,74,68,0.3)' }}>
                  {['Department', 'Revenue', 'Transactions', 'Tickets', 'Open', 'SLA Breach', 'Staff', 'Invoices', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#6A8A82', fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {depts.map(d => (
                  <tr key={d.slug} style={{ borderBottom: '1px solid rgba(36,74,68,0.15)', cursor: 'pointer', transition: 'background 0.15s' }}
                    onClick={() => setSelectedDept(d.slug)}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(36,74,68,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                        <div>
                          <div style={{ color: '#E8F0EE', fontWeight: 600 }}>{d.name}</div>
                          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: d.color }}>/{d.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#2BB6A3', fontWeight: 700, fontFamily: "'Rajdhani', sans-serif" }}>{formatKES(d.revenue)}</td>
                    <td style={{ padding: '10px 14px', color: '#A9C4BE' }}>{d.transactionCount}</td>
                    <td style={{ padding: '10px 14px', color: '#A9C4BE' }}>{d.tickets}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ color: d.ticketsOpen > 0 ? '#FF3B3B' : '#2BB6A3', fontWeight: 600 }}>{d.ticketsOpen}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ color: d.slaBreachCount > 0 ? '#FFB020' : '#6A8A82', fontWeight: d.slaBreachCount > 0 ? 700 : 400 }}>{d.slaBreachCount}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#A78BFA', fontWeight: 600 }}>{d.staffCount}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ color: '#2BB6A3' }}>{d.invoicesPaid}</span>
                      <span style={{ color: '#6A8A82' }}>/</span>
                      <span style={{ color: '#FF3B3B' }}>{d.invoicesUnpaid}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#6A8A82', fontSize: 10 }}>▸</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
