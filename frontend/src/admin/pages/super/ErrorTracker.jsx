// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — Self-Hosted Error Tracker Dashboard
// Shows error stats, list, filtering, and resolution actions.
import { useState, useEffect } from 'react';
import { api } from '../../../utils/api';
import { Spinner } from '../../../components/UI';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  open: '#FF3B3B',
  investigating: '#FFB020',
  resolved: '#2BB6A3',
  ignored: '#6A8A82',
};
const SOURCE_ICONS = { frontend: '🖥️', backend: '⚙️', unhandled: '❓' };

export default function ErrorTracker() {
  const [stats, setStats] = useState(null);
  const [errors, setErrors] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ source: '', status: '', search: '' });
  const [selectedError, setSelectedError] = useState(null);
  const [period, setPeriod] = useState(7);

  useEffect(() => { fetchStats(); }, [period]);
  useEffect(() => { fetchErrors(); }, [filters, pagination.page]);

  const fetchStats = async () => {
    try {
      const { data } = await api.get(`/errors/stats?days=${period}`);
      setStats(data);
    } catch { /* stats unavailable */ }
  };

  const fetchErrors = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: 30 };
      if (filters.source) params.source = filters.source;
      if (filters.status) params.status = filters.status;
      const { data } = await api.get('/errors', { params });
      setErrors(data.errors || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch {
      setErrors([]);
    }
    setLoading(false);
  };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/errors/${id}/status`, { status });
      toast.success(`Error marked as ${status}`);
      setSelectedError(null);
      fetchErrors();
      fetchStats();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const deleteError = async (id) => {
    if (!confirm('Delete this error permanently?')) return;
    try {
      await api.delete(`/errors/${id}`);
      toast.success('Error deleted');
      setSelectedError(null);
      fetchErrors();
      fetchStats();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const clearResolved = async () => {
    try {
      const { data } = await api.post('/errors/clear', { status: 'resolved' });
      toast.success(`Cleared ${data.deleted} resolved errors`);
      fetchErrors();
      fetchStats();
    } catch {
      toast.error('Failed to clear');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#081916', color: '#A9C4BE', fontFamily: "'Poppins', sans-serif" }}>
      <div style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 28, fontWeight: 700, color: '#FF3B3B', margin: 0 }}>
              🐛 Error Tracker
            </h1>
            <p style={{ fontSize: 13, color: '#6A8A82', margin: '4px 0 0' }}>
              Self-hosted error monitoring — frontend + backend
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={period} onChange={e => setPeriod(Number(e.target.value))}
              style={{ padding: '0.4rem 0.75rem', background: '#0B1F1B', color: '#E8F0EE', border: '1px solid rgba(36,74,68,0.4)', borderRadius: 4, fontSize: 12 }}>
              {[1, 3, 7, 14, 30].map(d => <option key={d} value={d}>{d} days</option>)}
            </select>
            <button onClick={clearResolved}
              style={{ padding: '0.4rem 1rem', borderRadius: 4, fontSize: 12, fontWeight: 700, background: 'rgba(106,138,130,0.2)', color: '#6A8A82', border: '1px solid rgba(36,74,68,0.4)', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>
              🗑️ Clear Resolved
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: '1.5rem' }}>
            {[
              { label: 'OPEN', value: stats.openCount, color: '#FF3B3B', icon: '🔴' },
              { label: 'LAST 24H', value: stats.recentCount, color: '#FFB020', icon: '📅' },
              { label: 'FRONTEND', value: stats.bySource.find(s => s._id === 'frontend')?.count || 0, color: '#A78BFA', icon: '🖥️' },
              { label: 'BACKEND', value: stats.bySource.find(s => s._id === 'backend')?.count || 0, color: '#2BB6A3', icon: '⚙️' },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: '#0B1F1B', border: `1px solid ${kpi.color}30`, borderRadius: 10, padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: '#6A8A82', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{kpi.label}</span>
                  <span style={{ fontSize: 14 }}>{kpi.icon}</span>
                </div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 24, fontWeight: 700, color: kpi.color, marginTop: 4 }}>{kpi.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Top Errors */}
        {stats?.topErrors?.length > 0 && (
          <div style={{ background: '#0B1F1B', border: '1px solid rgba(255,59,59,0.2)', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: '#FF3B3B', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.75rem' }}>
              🔥 Top Errors ({period}d)
            </h3>
            {stats.topErrors.map((err, i) => (
              <div key={err.fingerprint || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(36,74,68,0.15)', fontSize: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: SOURCE_ICONS[err.source] || '❓', marginRight: 6 }}>{SOURCE_ICONS[err.source]}</span>
                  <span style={{ color: '#E8F0EE', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500, display: 'inline-block' }}>{err.message}</span>
                  {err.name && <span style={{ color: '#6A8A82', marginLeft: 8 }}>({err.name})</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, marginLeft: 12 }}>
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", color: '#FFB020', fontWeight: 700, fontSize: 12 }}>×{err.count}</span>
                  <span style={{ fontSize: 9, color: STATUS_COLORS[err.status] || '#6A8A82', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{err.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
          {[
            { value: '', label: 'All Sources' },
            { value: 'frontend', label: '🖥️ Frontend' },
            { value: 'backend', label: '⚙️ Backend' },
          ].map(f => (
            <button key={f.value} onClick={() => setFilters(prev => ({ ...prev, source: f.value }))}
              style={{ padding: '0.4rem 0.75rem', borderRadius: 4, fontSize: 11, fontWeight: 600, background: filters.source === f.value ? 'rgba(255,59,59,0.15)' : 'transparent', color: filters.source === f.value ? '#FF3B3B' : '#6A8A82', border: `1px solid ${filters.source === f.value ? '#FF3B3B' : 'rgba(36,74,68,0.4)'}`, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>
              {f.label}
            </button>
          ))}
          <div style={{ width: 1, background: 'rgba(36,74,68,0.3)', margin: '0 4px' }} />
          {['', 'open', 'investigating', 'resolved', 'ignored'].map(s => (
            <button key={s} onClick={() => setFilters(prev => ({ ...prev, status: s }))}
              style={{ padding: '0.4rem 0.75rem', borderRadius: 4, fontSize: 11, fontWeight: 600, background: filters.status === s ? `${STATUS_COLORS[s] || '#2BB6A3'}20` : 'transparent', color: STATUS_COLORS[s] || '#A9C4BE', border: `1px solid ${filters.status === s ? (STATUS_COLORS[s] || '#2BB6A3') : 'rgba(36,74,68,0.4)'}`, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>
              {s || 'All Status'}
            </button>
          ))}
        </div>

        {/* Error List */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><Spinner /></div>
        ) : errors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6A8A82' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p>No errors found</p>
          </div>
        ) : (
          <div style={{ background: '#0B1F1B', border: '1px solid rgba(36,74,68,0.3)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(36,74,68,0.3)' }}>
                    {['', 'Message', 'Source', 'Count', 'Status', 'Last Seen', ''].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#6A8A82', fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {errors.map(err => (
                    <tr key={err._id} onClick={() => setSelectedError(err)}
                      style={{ borderBottom: '1px solid rgba(36,74,68,0.15)', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(36,74,68,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '10px 12px', fontSize: 14 }}>{SOURCE_ICONS[err.source] || '❓'}</td>
                      <td style={{ padding: '10px 12px', maxWidth: 400 }}>
                        <div style={{ color: '#E8F0EE', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{err.message}</div>
                        {err.path && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#6A8A82', marginTop: 2 }}>{err.method} {err.path}</div>}
                        {err.pagePath && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#6A8A82', marginTop: 2 }}>{err.pagePath}</div>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 10, color: '#6A8A82', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{err.source}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, color: err.count > 10 ? '#FF3B3B' : err.count > 1 ? '#FFB020' : '#A9C4BE' }}>
                        ×{err.count}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: `${STATUS_COLORS[err.status] || '#6A8A82'}20`, color: STATUS_COLORS[err.status] || '#6A8A82', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                          {err.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: '#6A8A82' }}>
                        {err.lastOccurrence ? new Date(err.lastOccurrence).toLocaleString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#6A8A82', fontSize: 10 }}>▸</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '1rem', borderTop: '1px solid rgba(36,74,68,0.2)' }}>
                {Array.from({ length: Math.min(pagination.pages, 10) }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPagination(prev => ({ ...prev, page: p }))}
                    style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, background: pagination.page === p ? '#EE6100' : 'transparent', color: pagination.page === p ? '#fff' : '#6A8A82', border: `1px solid ${pagination.page === p ? '#EE6100' : 'rgba(36,74,68,0.4)'}`, cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace" }}>
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error Detail Modal */}
        {selectedError && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedError(null); }}>
            <div style={{ background: '#0B1F1B', border: '1px solid rgba(36,74,68,0.4)', borderRadius: 10, padding: '1.5rem', maxWidth: 700, width: '100%', maxHeight: '80vh', overflow: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, color: '#FF3B3B', margin: 0 }}>Error Details</h3>
                <button onClick={() => setSelectedError(null)} style={{ background: 'none', border: 'none', color: '#6A8A82', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: 11, color: '#6A8A82', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Message</div>
                <div style={{ fontSize: 14, color: '#E8F0EE', fontWeight: 600 }}>{selectedError.message}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem', fontSize: 12 }}>
                <div><span style={{ color: '#6A8A82' }}>Source: </span><span style={{ color: '#E8F0EE' }}>{selectedError.source}</span></div>
                <div><span style={{ color: '#6A8A82' }}>Name: </span><span style={{ color: '#E8F0EE' }}>{selectedError.name || '—'}</span></div>
                <div><span style={{ color: '#6A8A82' }}>Count: </span><span style={{ color: '#FFB020', fontWeight: 700 }}>×{selectedError.count}</span></div>
                <div><span style={{ color: '#6A8A82' }}>Status: </span><span style={{ color: STATUS_COLORS[selectedError.status], fontWeight: 600 }}>{selectedError.status}</span></div>
                {selectedError.userEmail && <div><span style={{ color: '#6A8A82' }}>User: </span><span style={{ color: '#E8F0EE' }}>{selectedError.userEmail}</span></div>}
                {selectedError.ip && <div><span style={{ color: '#6A8A82' }}>IP: </span><span style={{ color: '#E8F0EE' }}>{selectedError.ip}</span></div>}
              </div>

              {selectedError.url && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: 11, color: '#6A8A82', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>URL</div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: '#A78BFA', wordBreak: 'break-all' }}>{selectedError.url}</div>
                </div>
              )}

              {selectedError.stack && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: 11, color: '#6A8A82', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Stack Trace</div>
                  <pre style={{ background: '#081916', border: '1px solid rgba(36,74,68,0.3)', borderRadius: 6, padding: '0.75rem', fontSize: 10, color: '#A9C4BE', fontFamily: "'Share Tech Mono', monospace", overflow: 'auto', maxHeight: 250, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
                    {selectedError.stack}
                  </pre>
                </div>
              )}

              {selectedError.componentStack && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: 11, color: '#6A8A82', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Component Stack</div>
                  <pre style={{ background: '#081916', border: '1px solid rgba(36,74,68,0.3)', borderRadius: 6, padding: '0.75rem', fontSize: 10, color: '#FFB020', fontFamily: "'Share Tech Mono', monospace", overflow: 'auto', maxHeight: 150, whiteSpace: 'pre-wrap', margin: 0 }}>
                    {selectedError.componentStack}
                  </pre>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: '1rem', borderTop: '1px solid rgba(36,74,68,0.2)', paddingTop: '1rem' }}>
                {selectedError.status !== 'investigating' && (
                  <button onClick={() => updateStatus(selectedError._id, 'investigating')}
                    style={{ padding: '0.4rem 1rem', borderRadius: 4, fontSize: 12, fontWeight: 700, background: 'rgba(255,176,32,0.15)', color: '#FFB020', border: '1px solid #FFB020', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>
                    🔍 Investigating
                  </button>
                )}
                {selectedError.status !== 'resolved' && (
                  <button onClick={() => updateStatus(selectedError._id, 'resolved')}
                    style={{ padding: '0.4rem 1rem', borderRadius: 4, fontSize: 12, fontWeight: 700, background: 'rgba(43,182,163,0.15)', color: '#2BB6A3', border: '1px solid #2BB6A3', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>
                    ✅ Resolve
                  </button>
                )}
                {selectedError.status !== 'ignored' && (
                  <button onClick={() => updateStatus(selectedError._id, 'ignored')}
                    style={{ padding: '0.4rem 1rem', borderRadius: 4, fontSize: 12, fontWeight: 700, background: 'rgba(106,138,130,0.15)', color: '#6A8A82', border: '1px solid rgba(36,74,68,0.4)', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>
                    👁️ Ignore
                  </button>
                )}
                <button onClick={() => deleteError(selectedError._id)}
                  style={{ padding: '0.4rem 1rem', borderRadius: 4, fontSize: 12, fontWeight: 700, background: 'rgba(255,59,59,0.1)', color: '#FF3B3B', border: '1px solid rgba(255,59,59,0.3)', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", marginLeft: 'auto' }}>
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
