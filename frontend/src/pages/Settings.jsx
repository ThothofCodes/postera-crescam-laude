// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
import { useEffect, useState, useCallback } from 'react';
import { api } from '../utils/api';
import { formatKES } from '../utils/helpers';
import { Spinner } from '../components/UI';
import toast from 'react-hot-toast';
import { T, btn, tabPill } from '../utils/theme';
import { getConsent, hasConsent } from '../components/CookieConsent';

export default function Settings() {
  const [rules, setRules] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editRule, setEditRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({ price: '', rushMultiplier: '' });
  const [slotForm, setSlotForm] = useState({ date: '', startTime: '09:00', endTime: '10:00' });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('pricing');
  const [consent, setConsent] = useState(() => getConsent() || { essential: true, functional: false, analytics: false });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        api.get('/calculator/pricing-rules'),
        api.get('/consultations/availability', { params: { date: new Date().toISOString().slice(0, 10) } }),
      ]);
      setRules(r.data); setSlots(s.data);
    } catch { toast.error('Failed to load settings'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveRule = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.put(`/calculator/pricing-rules/${editRule._id}`, { price: Number(ruleForm.price), rushMultiplier: Number(ruleForm.rushMultiplier) });
      toast.success('Rule updated'); setEditRule(null); load();
    } catch { toast.error('Failed to update rule'); }
    setSaving(false);
  };

  const seedRules = async () => {
    if (!window.confirm('Replace all pricing rules with defaults?')) return;
    try { await api.post('/calculator/seed'); toast.success('Pricing rules seeded'); load(); }
    catch { toast.error('Seed failed'); }
  };

  const addSlot = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/consultations/availability', slotForm);
      toast.success('Slot added'); setSlotForm({ date: '', startTime: '09:00', endTime: '10:00' }); load();
    } catch { toast.error('Failed to add slot'); }
    setSaving(false);
  };

  const grouped = rules.reduce((acc, r) => { if (!acc[r.service]) acc[r.service] = []; acc[r.service].push(r); return acc; }, {});

  return (
    <div style={T.page}>
      <h2 style={T.h2}>Settings</h2>

      <div style={{ display: 'flex', gap: 8 }}>
        {[{ id: 'pricing', label: '💰 Pricing Rules' }, { id: 'availability', label: '📅 Availability Slots' }, { id: 'privacy', label: '🍪 Privacy' }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={tabPill(tab === t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : tab === 'privacy' ? (
        <CookiePreferences consent={consent} setConsent={setConsent} />
      ) : tab === 'pricing' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={seedRules} style={btn('ghost')}>Seed Default Rules</button>
          </div>
          {Object.keys(grouped).length === 0 && (
            <p style={{ color: '#6A8A82', fontFamily: "'Inter',sans-serif" }}>No pricing rules found. Click "Seed Default Rules" to populate.</p>
          )}
          {Object.entries(grouped).map(([service, serviceRules]) => (
            <div key={service} style={T.card}>
              <h4 style={{ margin: '0 0 1rem', color: '#F4F1EA', fontFamily: "'Poppins',sans-serif", fontSize: 15 }}>{service}</h4>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {serviceRules.map((r) => (
                  <div key={r._id} style={{ background: 'rgba(14,10,20,0.5)', border: '1px solid rgba(244,241,234,0.08)', borderRadius: 10, padding: '0.85rem 1rem', minWidth: 150 }}>
                    <div style={{ fontSize: 10, color: '#6A8A82', textTransform: 'capitalize', letterSpacing: '0.1em', marginBottom: 6, fontFamily: "'Inter',sans-serif" }}>{r.tier}</div>
                    <div style={{ fontWeight: 800, fontSize: 20, color: '#F4F1EA', fontFamily: "'Poppins',sans-serif" }}>{formatKES(r.price)}</div>
                    <div style={{ fontSize: 11, color: '#6A8A82', marginTop: 3, fontFamily: "'Inter',sans-serif" }}>Rush: ×{r.rushMultiplier}</div>
                    <button onClick={() => { setEditRule(r); setRuleForm({ price: r.price, rushMultiplier: r.rushMultiplier }); }}
                      style={{ ...btn('blue'), padding: '3px 12px', fontSize: 11, marginTop: 10 }}>Edit</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={T.card}>
            <h4 style={{ margin: '0 0 1rem', color: '#F4F1EA', fontFamily: "'Poppins',sans-serif" }}>Add Availability Slot</h4>
            <form onSubmit={addSlot} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div><label style={T.label}>Date</label><input type="date" value={slotForm.date} onChange={(e) => setSlotForm({ ...slotForm, date: e.target.value })} required style={{ ...T.input, width: 160 }} /></div>
              <div><label style={T.label}>Start</label><input type="time" value={slotForm.startTime} onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })} required style={{ ...T.input, width: 120 }} /></div>
              <div><label style={T.label}>End</label><input type="time" value={slotForm.endTime} onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })} required style={{ ...T.input, width: 120 }} /></div>
              <button type="submit" disabled={saving} style={btn('primary')}>{saving ? 'Adding...' : 'Add Slot'}</button>
            </form>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {slots.length === 0
              ? <p style={{ color: '#6A8A82', fontFamily: "'Inter',sans-serif" }}>No upcoming slots. Add some above.</p>
              : slots.map((s) => (
                <div key={s._id} style={{ ...T.card, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem' }}>
                  <span style={{ fontSize: 14, color: '#A9C4BE', fontFamily: "'Inter',sans-serif" }}>{new Date(s.date).toDateString()} · {s.startTime} – {s.endTime}</span>
                  <span style={{ fontSize: 12, color: s.isBooked ? '#FF8A3D' : '#2ecc71', fontWeight: 700, fontFamily: "'Inter',sans-serif" }}>{s.isBooked ? 'Booked' : 'Available'}</span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {editRule && (
        <div style={T.overlay}>
          <div style={{ ...T.modal, maxWidth: 380 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#EE6100,#2BB6A3)', borderRadius: '14px 14px 0 0' }} />
            <h3 style={T.modalH3}>Edit: {editRule.service} — {editRule.tier}</h3>
            <form onSubmit={saveRule} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={T.label}>Price (KES)</label><input type="number" value={ruleForm.price} onChange={(e) => setRuleForm({ ...ruleForm, price: e.target.value })} required min={0} style={T.input} /></div>
              <div><label style={T.label}>Rush Multiplier (e.g. 1.30)</label><input type="number" step="0.01" value={ruleForm.rushMultiplier} onChange={(e) => setRuleForm({ ...ruleForm, rushMultiplier: e.target.value })} required min={1} style={T.input} /></div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEditRule(null)} style={btn('ghost')}>Cancel</button>
                <button type="submit" disabled={saving} style={btn('primary')}>{saving ? 'Saving...' : 'Update'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Cookie Preferences Component ───────────────────────────────────────────

function CookiePreferences({ consent, setConsent }) {
  const [saving, setSaving] = useState(false);

  const toggleCategory = (id) => {
    if (id === 'essential') return; // Can't disable essential
    setConsent((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const savePreferences = () => {
    setSaving(true);
    const toSave = { ...consent, essential: true };
    localStorage.setItem('pcl_cookie_consent', JSON.stringify({
      categories: toSave,
      timestamp: new Date().toISOString(),
      version: '1.0',
    }));
    window.dispatchEvent(new CustomEvent('cookie-consent-updated', { detail: { categories: toSave } }));
    toast.success('Cookie preferences saved');
    setSaving(false);
  };

  const acceptAll = () => {
    const all = { essential: true, functional: true, analytics: true };
    setConsent(all);
    localStorage.setItem('pcl_cookie_consent', JSON.stringify({
      categories: all,
      timestamp: new Date().toISOString(),
      version: '1.0',
    }));
    window.dispatchEvent(new CustomEvent('cookie-consent-updated', { detail: { categories: all } }));
    toast.success('All cookies accepted');
  };

  const rejectOptional = () => {
    const minimal = { essential: true, functional: false, analytics: false };
    setConsent(minimal);
    localStorage.setItem('pcl_cookie_consent', JSON.stringify({
      categories: minimal,
      timestamp: new Date().toISOString(),
      version: '1.0',
    }));
    window.dispatchEvent(new CustomEvent('cookie-consent-updated', { detail: { categories: minimal } }));
    toast.success('Optional cookies disabled');
  };

  const categories = [
    {
      id: 'essential',
      label: 'Essential Cookies',
      color: '#39FF88',
      required: true,
      description: 'Required for login, security (CSRF), and core functionality. Cannot be disabled.',
      details: ['pcl_token — Auth session (httpOnly)', '_csrf — CSRF protection', 'pcl_cookie_consent — Your consent record'],
    },
    {
      id: 'functional',
      label: 'Functional Cookies',
      color: '#2BB6A3',
      required: false,
      description: 'Remember your preferences (sidebar state, theme, language).',
      details: ['pcl_sidebar_state — Sidebar collapsed/expanded', 'pcl_theme — Dark/light mode', 'pcl_language — Interface language'],
    },
    {
      id: 'analytics',
      label: 'Analytics Cookies',
      color: '#EE6100',
      required: false,
      description: 'Help us understand how you use the app so we can improve it.',
      details: ['pcl_session_id — Anonymous session tracking', 'pcl_feature_flags — A/B test enrollment'],
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={T.card}>
        <h4 style={{ margin: '0 0 0.5rem', color: '#F4F1EA', fontFamily: "'Poppins',sans-serif", fontSize: 15 }}>Cookie Preferences</h4>
        <p style={{ color: '#6A8A82', fontSize: 13, margin: '0 0 1rem', fontFamily: "'Inter',sans-serif" }}>
          Choose which cookies are active. Essential cookies are always on for security.
          {' '}
          <a href="/cookie-policy" style={{ color: '#EE6100', textDecoration: 'underline', textUnderlineOffset: 2 }}>Learn more in our Cookie Policy</a>
        </p>

        {categories.map((cat) => (
          <div key={cat.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '14px 0', borderBottom: '1px solid rgba(36,74,68,0.2)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                <span style={{ fontFamily: "'Rajdhani','Poppins',sans-serif", fontSize: 14, fontWeight: 700, color: '#F4F1EA' }}>{cat.label}</span>
                {cat.required && (
                  <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: '0.08em', color: '#39FF88', background: 'rgba(57,255,136,0.1)', border: '1px solid rgba(57,255,136,0.2)', borderRadius: 3, padding: '1px 6px' }}>ALWAYS ON</span>
                )}
              </div>
              <p style={{ color: '#A9C4BE', fontSize: 12, margin: '0 0 6px', lineHeight: 1.5, fontFamily: "'Inter',sans-serif" }}>{cat.description}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {cat.details.map((d) => (
                  <span key={d} style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: '#6A8A82', background: 'rgba(36,74,68,0.2)', borderRadius: 3, padding: '2px 6px' }}>{d}</span>
                ))}
              </div>
            </div>
            <button
              onClick={() => toggleCategory(cat.id)}
              disabled={cat.required}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: cat.required ? 'default' : 'pointer', flexShrink: 0, marginTop: 4,
                background: cat.required ? 'rgba(57,255,136,0.3)' : consent[cat.id] ? cat.color : 'rgba(36,74,68,0.6)',
                position: 'relative', transition: 'background 0.2s ease', opacity: cat.required ? 0.6 : 1,
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: consent[cat.id] ? 22 : 2,
                width: 20, height: 20, borderRadius: '50%', background: consent[cat.id] ? '#fff' : '#6A8A82',
                transition: 'left 0.2s ease',
              }} />
            </button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button onClick={savePreferences} disabled={saving} style={{ ...btn('primary'), padding: '6px 16px', fontSize: 12 }}>
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
          <button onClick={acceptAll} style={{ ...btn('blue'), padding: '6px 16px', fontSize: 12 }}>Accept All</button>
          <button onClick={rejectOptional} style={{ ...btn('ghost'), padding: '6px 16px', fontSize: 12 }}>Reject Optional</button>
        </div>
      </div>
    </div>
  );
}
