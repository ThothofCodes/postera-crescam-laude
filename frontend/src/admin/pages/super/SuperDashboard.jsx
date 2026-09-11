// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — Circuit Canopy SuperAdminLayout with collapsible dropdown sidebar
import { useEffect, useState, useCallback, useRef } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../../../utils/api';
import { formatKES } from '../../../utils/helpers';
import IncomeProjectionChart from '../../components/IncomeProjectionChart';
import { Spinner } from '../../../components/UI';
import { useAdminAuth } from '../../context/AdminAuthContext';
import PCLLogo from '../../../components/Logo';
import NotificationBell from '../../components/NotificationBell';
import ChatMonitor from '../../components/ChatMonitor';
import PulseBoard from '../../../components/PulseBoard';
import PaymentNotifications from '../../components/PaymentNotifications';
import { getSocketAuthToken } from '../../../hooks/useSocket';

const DEPT_COLORS = { internet:'#2BB6A3', webdev:'#a78bfa', playstation:'#ffd700', repair:'#ff8800', cybersecurity:'#ff3366', govadmin:'#00ff88' };

const SUPER_LINKS = [
  ['Dashboard','◈','/admin/super'],
  ['All Departments','◉','/admin/super/departments'],
  ['Manage Departments','⚙','/admin/super/manage-departments'],
  ['Dept Analytics','📊','/admin/super/dept-analytics'],
  ['Admin Allocation','◆','/admin/super/admin-allocation'],
  ['Devices','🖥','/admin/super/devices'],
  ['User Management','◫','/admin/super/users'],
  ['Chat','💬','/admin/super/chat'],
  ['Email Allocation','◆','/admin/super/email'],
  ['Finance','◆','/admin/super/finance'],
  ['Payment History','💰','/admin/super/payments'],
  ['All Tickets','◧','/admin/super/tickets'],
  ['Inventory Master','◈','/admin/super/inventory'],
  ['Blog Management','📝','/admin/super/blog'],
  ['Tech Studio','🎛','/admin/super/studio'],
  ['Meeting Room','📹','/admin/super/meetings'],
  ['💰 Monetization','💰','/admin/super/monetization'],
  ['🐛 Errors','🐛','/admin/super/errors'],
  ['Audit Log','☰','/admin/super/audit'],
  ['Broadcast','◈','/admin/super/broadcast'],
  ['Settings','◉','/admin/super/settings'],
  ['API Health','◎','/admin/super/health'],
];

/* ── Animated accordion section ── */
function SidebarSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef(null);
  const [height, setHeight] = useState(defaultOpen ? 'auto' : '0px');

  useEffect(() => {
    if (!contentRef.current) return;
    if (open) {
      setHeight(contentRef.current.scrollHeight + 'px');
      const t = setTimeout(() => setHeight('auto'), 350);
      return () => clearTimeout(t);
    } else {
      setHeight(contentRef.current.scrollHeight + 'px');
      requestAnimationFrame(() => requestAnimationFrame(() => setHeight('0px')));
    }
  }, [open]);

  return (
    <div style={{ marginBottom: 2 }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 6, width: '100%',
        padding: '6px 12px', background: 'transparent', border: 'none',
        cursor: 'pointer', textAlign: 'left', borderRadius: 4,
        transition: 'background 0.15s ease',
      }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(238,97,0,0.04)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{
          fontSize: 8, color: '#6A8A82', letterSpacing: '0.18em', textTransform: 'uppercase',
          fontFamily: "'Share Tech Mono',monospace", flex: 1, fontWeight: 600,
        }}>{title}</span>
        <span style={{
          fontSize: 8, color: '#6A8A82',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          display: 'inline-block',
        }}>▾</span>
      </button>
      <div ref={contentRef} style={{
        overflow: 'hidden', maxHeight: height, opacity: open ? 1 : 0,
        transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
      }}>
        {children}
      </div>
    </div>
  );
}

export function SuperAdminLayout() {
  const { user, loading, logout } = useAdminAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isSiteManager = user?.role === 'SITE_MANAGER';
  const hasAccess = isSuperAdmin || isSiteManager;
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const sidebarRef = useRef(null);

  // Close mobile sidebar on navigation
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileOpen]);

  // Keyboard shortcut: Escape to close mobile sidebar
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && mobileOpen) setMobileOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileOpen]);

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!hasAccess) return <Navigate to="/403" replace />;

  const sidebarWidth = sidebarOpen ? 232 : 0;
  const isActive = (path) => location.pathname === path || (path !== '/admin/super' && location.pathname.startsWith(path));

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#081916' }}>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(8,25,22,0.8)',
          zIndex: 1098, backdropFilter: 'blur(6px)',
          animation: 'pcl-fade-in 0.2s ease',
        }} />
      )}        {/* ── Collapsible Sidebar ── */}
      <aside
        ref={sidebarRef}
        className={`admin-sidebar${mobileOpen ? ' open' : ''}`}
        style={{
          width: sidebarWidth || undefined,
          minWidth: sidebarWidth || undefined,
          background: 'linear-gradient(180deg,#0D2420 0%,#0A1A17 50%,#081916 100%)',
          borderRight: sidebarWidth ? '1px solid rgba(238,97,0,0.12)' : 'none',
          display: 'flex', flexDirection: 'column', position: 'relative',
          overflow: 'hidden',
          transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1), min-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
          opacity: sidebarWidth ? 1 : 0,
          pointerEvents: sidebarWidth ? 'auto' : 'none',
        }}
      >
        {/* Top glow line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, #EE6100, #FF8A3D, #EE6100, transparent)',
          opacity: 0.5, pointerEvents: 'none', zIndex: 1,
        }} />

        {/* Logo + Collapse toggle */}
        <div style={{
          padding: '12px 10px', borderBottom: '1px solid rgba(238,97,0,0.1)',
          display: 'flex', alignItems: 'center', gap: 6, minHeight: 52,
        }}>
          <NavLink to="/admin/super" end style={{ textDecoration: 'none', flex: 1, overflow: 'hidden' }}>
            <PCLLogo size={24} showText={true} textSize="10px" />
            <div style={{
              fontSize: 7, color: '#EE6100', letterSpacing: '0.2em',
              textTransform: 'uppercase', marginTop: 3, fontWeight: 700,
              fontFamily: "'Share Tech Mono',monospace",
            }}>{isSiteManager ? 'Site Manager' : 'Super Admin'}</div>
          </NavLink>
          {/* Collapse button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            style={{
              background: 'rgba(238,97,0,0.06)', border: '1px solid rgba(238,97,0,0.15)',
              color: '#EE6100', borderRadius: 4, width: 22, height: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 10, flexShrink: 0,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(238,97,0,0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(238,97,0,0.06)'; }}
          >
            {sidebarOpen ? '◂' : '▸'}
          </button>
        </div>

        {/* ── Scrollable Navigation ── */}
        <nav style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: '4px 0',
          /* Custom scrollbar */
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(238,97,0,0.2) transparent',
        }}>
          <style>{`
            .admin-sidebar nav::-webkit-scrollbar { width: 4px; }
            .admin-sidebar nav::-webkit-scrollbar-track { background: transparent; }
            .admin-sidebar nav::-webkit-scrollbar-thumb { background: rgba(238,97,0,0.2); border-radius: 2px; }
            .admin-sidebar nav::-webkit-scrollbar-thumb:hover { background: rgba(238,97,0,0.4); }
          `}</style>

          <SidebarSection title="COMMAND" defaultOpen={true}>
            <div style={{ padding: '0 4px' }}>
              {SUPER_LINKS.map(([label, icon, path]) => (
                <NavLink key={path} to={path} end={path === '/admin/super'}
                  style={({ isActive: active }) => ({
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 8px', marginBottom: 1, borderRadius: 4,
                    color: active ? '#EE6100' : '#6A8A82', textDecoration: 'none',
                    fontSize: 9.5, fontWeight: active ? 700 : 400,
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                    background: active ? 'rgba(238,97,0,0.08)' : 'transparent',
                    borderLeft: active ? '2px solid #EE6100' : '2px solid transparent',
                    transition: 'all 0.2s ease', position: 'relative',
                    whiteSpace: 'nowrap',
                  })}
                  onMouseEnter={(e) => { if (!isActive(path)) { e.currentTarget.style.background = 'rgba(238,97,0,0.04)'; e.currentTarget.style.color = '#F4F1EA'; }}}
                  onMouseLeave={(e) => { if (!isActive(path)) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6A8A82'; }}}
                >
                  <span style={{ fontSize: 10, width: 16, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
                  {label}
                </NavLink>
              ))}
            </div>
          </SidebarSection>

          <div style={{
            height: 1, margin: '4px 12px',
            background: 'linear-gradient(90deg, transparent, rgba(238,97,0,0.2), transparent)',
          }} />

          <SidebarSection title="DEPARTMENTS" defaultOpen={true}>
            <div style={{ padding: '0 4px' }}>
              {Object.entries(DEPT_COLORS).map(([slug, color]) => (
                <NavLink key={slug} to={`/admin/${slug}`} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 8px', marginBottom: 1, borderRadius: 4,
                  color: '#6A8A82', textDecoration: 'none', fontSize: 9.5,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  transition: 'all 0.2s ease', whiteSpace: 'nowrap',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = `${color}0a`; e.currentTarget.style.color = '#F4F1EA'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6A8A82'; }}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: color,
                    flexShrink: 0, boxShadow: `0 0 6px ${color}40`,
                  }} />
                  {slug}
                </NavLink>
              ))}
            </div>
          </SidebarSection>
        </nav>

        {/* Logout */}
        <div style={{ padding: '6px 8px', borderTop: '1px solid rgba(238,97,0,0.08)' }}>
          <button onClick={logout} style={{
            width: '100%', padding: '5px', background: 'rgba(255,51,102,0.06)',
            color: '#ff3366', border: '1px solid rgba(255,51,102,0.2)',
            borderRadius: 4, fontSize: 8.5, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
            transition: 'all 0.2s ease', whiteSpace: 'nowrap',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,51,102,0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,51,102,0.06)'; }}
          >⏻ Logout</button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <header style={{
          height: 48, background: 'linear-gradient(90deg,#0D2420,#0F2620)',
          borderBottom: '1px solid rgba(238,97,0,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 1rem', flexShrink: 0, gap: 8,
        }}>
          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(!mobileOpen)}
            className="admin-hamburger"
            style={{
              display: 'none', background: 'none', border: 'none',
              color: '#EE6100', fontSize: 20, cursor: 'pointer',
              padding: '4px 6px', lineHeight: 1,
            }}>
            {mobileOpen ? '✕' : '☰'}
          </button>

          {/* Desktop toggle */}
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="admin-sidebar-toggle"
            style={{
              background: 'none', border: '1px solid rgba(238,97,0,0.2)',
              color: '#EE6100', borderRadius: 4, width: 28, height: 28,
              alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 12, flexShrink: 0,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(238,97,0,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            title="Expand sidebar"
          >☰</button>

          <div className="admin-header-title" style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#EE6100',
            fontFamily: "'Share Tech Mono',monospace", whiteSpace: 'nowrap',
          }}>POSTERA — COMMAND CENTRE</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NotificationBell />
            <div className="admin-header-user" style={{ fontSize: 10, color: '#6A8A82', whiteSpace: 'nowrap' }}>
              {user.name} · <span style={{ color: '#EE6100' }}>{isSiteManager ? 'SITE MANAGER' : 'SUPER ADMIN'}</span>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <PulseBoard authToken={getSocketAuthToken() || localStorage.getItem('adminToken')} />
          </div>
          <Outlet />
        </main>
        <PaymentNotifications maxVisible={5} />
      </div>

      <style>{`
        @keyframes pcl-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @media (max-width: 768px) {
          .admin-sidebar {
            position: fixed !important; top: 0 !important; left: 0 !important;
            height: 100vh !important; z-index: 1099 !important;
            transform: translateX(-100%) !important;
            width: 260px !important; min-width: 260px !important;
            opacity: 1 !important; pointer-events: auto !important;
          }
          .admin-sidebar.open { transform: translateX(0) !important; }
          .admin-hamburger { display: flex !important; }
          .admin-sidebar-toggle { display: none !important; }
          .admin-header-title { font-size: 9px !important; }
          .admin-header-user { display: none !important; }
        }
        @media (min-width: 769px) {
          .admin-hamburger { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ── Super Admin Home Dashboard ─────────────────────────────────────────────
export default function SuperDashboard() {
  const [breakdown, setBreakdown] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showChatModule, setShowChatModule] = useState(false);
  const [deptColors, setDeptColors] = useState(DEPT_COLORS);

  useEffect(() => {
    api.get('/departments').then(({ data }) => {
      const colors = {};
      data.forEach(d => { if (d.color) colors[d.slug] = d.color; });
      setDeptColors(prev => ({ ...prev, ...colors }));
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bd, us] = await Promise.all([
        api.get('/finance/breakdown'),
        api.get('/users'),
      ]);
      setBreakdown(bd.data);
      setUsers(us.data);
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const deptUserCount = (slug) => users.filter((u) => u.departmentSlug === slug).length;

  if (loading) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(238,97,0,0.08)', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: 16, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#EE6100' }}>◈ Command Centre</h2>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={() => setShowChatModule(!showChatModule)}
            style={{
              padding: '0.4rem 0.8rem', background: 'rgba(238,97,0,0.1)', color: '#EE6100',
              border: '1px solid rgba(238,97,0,0.3)', borderRadius: 4, fontSize: '0.75rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}>
            💬 Support Chat
          </button>
          <span style={{ fontSize: 9, color: '#6A8A82', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '0.8rem' }}>
        {Object.entries(deptColors).map(([slug, color]) => {
          const deptData = breakdown.find((b) => b._id === slug);
          return (
            <NavLink key={slug} to={`/admin/${slug}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'linear-gradient(160deg,#0F2620,#0F2620)', border: `1px solid ${color}22`, borderRadius: 8, padding: '0.8rem', position: 'relative', overflow: 'hidden', transition: 'all 0.2s', cursor: 'pointer' }}
                onMouseOver={(e) => { e.currentTarget.style.border = `1px solid ${color}55`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.border = `1px solid ${color}22`; e.currentTarget.style.transform = 'translateY(0)'; }}>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.6 }} />
                <div style={{ fontSize: 8, color, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{slug}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#F4F1EA' }}>{formatKES(deptData?.total || 0)}</div>
                <div style={{ fontSize: 9, color: '#6A8A82', marginTop: 3 }}>{deptUserCount(slug)} staff</div>
              </div>
            </NavLink>
          );
        })}
      </div>

      <IncomeProjectionChart departmentId={null} departmentLabel="All Departments" showDepartmentBreakdown={true} />

      {breakdown.length > 0 && (
        <div style={{ background: 'linear-gradient(160deg,#0F2620,#0F2620)', border: '1px solid rgba(238,97,0,0.12)', borderRadius: 8, padding: '1rem' }}>
          <h3 style={{ margin: '0 0 0.8rem', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A9C4BE' }}>◆ Revenue by Department</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={breakdown.map((b) => ({ name: b._id, value: b.total }))} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {breakdown.map((b) => <Cell key={b._id} fill={deptColors[b._id] || '#EE6100'} />)}
              </Pie>
              <Tooltip formatter={(v) => formatKES(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {showChatModule && (
        <ChatMonitor 
          authToken={getSocketAuthToken() || localStorage.getItem('adminToken')}
          onClose={() => setShowChatModule(false)}
        />
      )}
    </div>
  );
}
