// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — Super Admin · All Departments Overview
import { useState, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../../../utils/api';
import { formatKES } from '../../../utils/helpers';
import IncomeProjectionChart from '../../components/IncomeProjectionChart';
import { Spinner } from '../../../components/UI';

// Rich metadata for known departments (branch names, features, descriptions)
const DEPT_META = {
  internet: { branch: 'Signal', features: ['Client Management', 'Bandwidth Monitoring', 'Network Health', 'ISP Billing'] },
  webdev: { branch: 'Forge', features: ['Project Pipeline', 'Sprint Tracking', 'Client Portals', 'Deployment'] },
  playstation: { branch: 'Pulse', features: ['Station Management', 'Session Tracking', 'Tournament Ops', 'Community'] },
  repair: { branch: 'Restore', features: ['Job Cards', 'Parts Inventory', 'Repair Tracking', 'Diagnostics'] },
  cybersecurity: { branch: 'Sentinel', features: ['Threat Monitoring', 'Security Contracts', 'Compliance', 'Incident Response'] },
  govadmin: { branch: 'Civic', features: ['Document Processing', 'Compliance Filings', 'Permit Management', 'Client Tracking'] },
};
const DEFAULT_META = { branch: 'Dept', features: ['Dashboard', 'Reports', 'Settings'] };

export default function DepartmentsPage() {
  const [breakdown, setBreakdown] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bd, us, deptRes] = await Promise.all([
        api.get('/finance/breakdown'),
        api.get('/users'),
        api.get('/departments'),
      ]);
      setBreakdown(bd.data);
      setUsers(us.data);
      // Merge API data with local metadata
      const depts = (deptRes.data || []).filter(d => d.isActive !== false).map(d => {
        const meta = DEPT_META[d.slug] || DEFAULT_META;
        return {
          slug: d.slug,
          label: d.name,
          branch: meta.branch,
          icon: d.icon || '◈',
          color: d.color || '#2BB6A3',
          desc: d.description || `${d.name} department`,
          features: meta.features,
        };
      });
      setDepartments(depts);
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const deptRevenue = (slug) => breakdown.find((b) => b._id === slug)?.total || 0;
  const deptUserCount = (slug) => users.filter((u) => u.departmentSlug === slug).length;
  const totalRevenue = breakdown.reduce((sum, b) => sum + (b.total || 0), 0);
  const totalStaff = users.length;

  const activeDepts = departments.filter((d) => filter === 'all' || d.slug === filter);

  if (loading) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: 18, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#EE6100', fontFamily: "'Rajdhani',sans-serif" }}>
          ◉ All Departments
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: '#6A8A82', fontFamily: "'Poppins',sans-serif" }}>
          Overview of all six operational branches — revenue, staffing, and status at a glance
        </p>
      </div>

      {/* ── Summary KPIs ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        {[
          { label: 'Total Departments', value: departments.length, color: '#EE6100' },
          { label: 'Total Revenue', value: formatKES(totalRevenue), color: '#2BB6A3' },
          { label: 'Total Staff', value: totalStaff, color: '#a78bfa' },
          { label: 'Active Branches', value: departments.length, color: '#39FF88' },
        ].map((kpi) => (
          <div key={kpi.label} style={{
            background: 'linear-gradient(160deg,#0F2620,#0F2620)', border: `1px solid ${kpi.color}22`, borderRadius: 8, padding: '1rem 1.25rem',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: kpi.color, opacity: 0.5 }} />
            <div style={{ fontSize: 9, color: kpi.color, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6, fontFamily: "'Share Tech Mono',monospace" }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#F4F1EA', fontFamily: "'Rajdhani',sans-serif" }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ── Filter Tabs ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('all')}
          style={{ padding: '0.4rem 0.85rem', borderRadius: 4, border: `1px solid ${filter === 'all' ? '#EE6100' : 'rgba(36,74,68,0.4)'}`, background: filter === 'all' ? 'rgba(238,97,0,0.12)' : 'transparent', color: filter === 'all' ? '#EE6100' : '#6A8A82', cursor: 'pointer', fontWeight: 600, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Share Tech Mono',monospace", transition: 'all 0.15s' }}>
          All
        </button>
        {departments.map((d) => (
          <button key={d.slug} onClick={() => setFilter(d.slug)}
            style={{ padding: '0.4rem 0.85rem', borderRadius: 4, border: `1px solid ${filter === d.slug ? d.color : 'rgba(36,74,68,0.4)'}`, background: filter === d.slug ? `${d.color}18` : 'transparent', color: filter === d.slug ? d.color : '#6A8A82', cursor: 'pointer', fontWeight: 600, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Share Tech Mono',monospace", transition: 'all 0.15s' }}>
            {d.icon} {d.branch}
          </button>
        ))}
      </div>

      {/* ── Department Cards ───────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
        {activeDepts.map((dept) => {
          const revenue = deptRevenue(dept.slug);
          const staff = deptUserCount(dept.slug);
          const pct = totalRevenue > 0 ? ((revenue / totalRevenue) * 100).toFixed(1) : '0.0';
          return (
            <NavLink key={dept.slug} to={`/admin/${dept.slug}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'linear-gradient(160deg,#0F2620,#0F2620)', border: `1px solid ${dept.color}22`, borderRadius: 10, padding: '1.25rem',
                position: 'relative', overflow: 'hidden', transition: 'all 0.25s', cursor: 'pointer', height: '100%',
              }}
                onMouseOver={(e) => { e.currentTarget.style.border = `1px solid ${dept.color}55`; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 30px ${dept.color}15`; }}
                onMouseOut={(e) => { e.currentTarget.style.border = `1px solid ${dept.color}22`; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                {/* Bottom accent line */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${dept.color}, transparent)`, opacity: 0.6 }} />

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.75rem' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: `${dept.color}15`, border: `1px solid ${dept.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{dept.icon}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#F4F1EA', fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.04em' }}>{dept.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dept.color, boxShadow: `0 0 6px ${dept.color}60` }} />
                      <span style={{ fontSize: 10, color: dept.color, fontFamily: "'Share Tech Mono',monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>Branch: {dept.branch}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p style={{ margin: '0 0 1rem', fontSize: 12, color: '#A9C4BE', lineHeight: 1.6, fontFamily: "'Poppins',sans-serif" }}>{dept.desc}</p>

                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                  <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(8,25,22,0.5)', borderRadius: 6 }}>
                    <div style={{ fontSize: 9, color: '#6A8A82', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Share Tech Mono',monospace" }}>Revenue</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: dept.color, fontFamily: "'Rajdhani',sans-serif" }}>{formatKES(revenue)}</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(8,25,22,0.5)', borderRadius: 6 }}>
                    <div style={{ fontSize: 9, color: '#6A8A82', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Share Tech Mono',monospace" }}>Staff</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#F4F1EA', fontFamily: "'Rajdhani',sans-serif" }}>{staff}</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(8,25,22,0.5)', borderRadius: 6 }}>
                    <div style={{ fontSize: 9, color: '#6A8A82', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Share Tech Mono',monospace" }}>Share</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#F4F1EA', fontFamily: "'Rajdhani',sans-serif" }}>{pct}%</div>
                  </div>
                </div>

                {/* Feature tags */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {dept.features.map((f) => (
                    <span key={f} style={{ padding: '2px 8px', borderRadius: 3, background: `${dept.color}10`, border: `1px solid ${dept.color}25`, fontSize: 9, color: dept.color, fontFamily: "'Share Tech Mono',monospace", letterSpacing: '0.05em' }}>{f}</span>
                  ))}
                </div>

                {/* Open branch CTA */}
                <div style={{ marginTop: '1rem', padding: '0.5rem', background: `${dept.color}0D`, border: `1px solid ${dept.color}20`, borderRadius: 4, textAlign: 'center', fontSize: 11, fontWeight: 600, color: dept.color, fontFamily: "'Poppins',sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Open Branch →
                </div>
              </div>
            </NavLink>
          );
        })}
      </div>

      {/* ── Revenue Chart ─────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(160deg,#0F2620,#0F2620)', border: '1px solid rgba(238,97,0,0.12)', borderRadius: 8, padding: '1.25rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A9C4BE', fontFamily: "'Rajdhani',sans-serif" }}>◆ Revenue Comparison</h3>
        {breakdown.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {departments.map((dept) => {
              const rev = deptRevenue(dept.slug);
              const maxRev = Math.max(...breakdown.map((b) => b.total || 0), 1);
              const width = (rev / maxRev) * 100;
              return (
                <div key={dept.slug} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 110, fontSize: 11, color: '#A9C4BE', fontFamily: "'Poppins',sans-serif", display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 14 }}>{dept.icon}</span>
                    {dept.branch}
                  </div>
                  <div style={{ flex: 1, height: 24, background: 'rgba(8,25,22,0.5)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ height: '100%', width: `${width}%`, background: `linear-gradient(90deg, ${dept.color}CC, ${dept.color}66)`, borderRadius: 4, transition: 'width 0.6s ease', minWidth: rev > 0 ? 4 : 0 }} />
                    <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#F4F1EA', fontFamily: "'Share Tech Mono',monospace" }}>{formatKES(rev)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: '#6A8A82', textAlign: 'center', fontSize: 12, padding: '1rem' }}>No revenue data available</p>
        )}
      </div>

      {/* ── Department Distribution Pie ────────────────────────── */}
      <div style={{ background: 'linear-gradient(160deg,#0F2620,#0F2620)', border: '1px solid rgba(238,97,0,0.12)', borderRadius: 8, padding: '1.25rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A9C4BE', fontFamily: "'Rajdhani',sans-serif" }}>◆ Staff Distribution</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {departments.map((dept) => {
            const staff = deptUserCount(dept.slug);
            const pct = totalStaff > 0 ? ((staff / totalStaff) * 100).toFixed(0) : '0';
            return (
              <div key={dept.slug} style={{ textAlign: 'center', padding: '0.75rem', background: `${dept.color}08`, border: `1px solid ${dept.color}20`, borderRadius: 8 }}>
                <div style={{ fontSize: 24 }}>{dept.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#F4F1EA', fontFamily: "'Rajdhani',sans-serif", marginTop: 4 }}>{staff}</div>
                <div style={{ fontSize: 10, color: dept.color, fontFamily: "'Share Tech Mono',monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>{dept.branch}</div>
                <div style={{ fontSize: 9, color: '#6A8A82', marginTop: 2 }}>{pct}% of total</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
