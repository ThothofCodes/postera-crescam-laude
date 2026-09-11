// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — Circuit Canopy Login with boot sequence aesthetic
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import analytics from '../utils/analytics';
import { useAuth } from '../context/AuthContext';
import { useAdminAuth } from '../admin/context/AdminAuthContext';
import PCLLogo from '../components/Logo';
import toast from 'react-hot-toast';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { login: adminLogin } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Detect admin login route — /admin/login uses admin auth store
  const isAdminLogin = location.pathname.startsWith('/admin/login');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isAdminLogin) {
        // Admin login: stores token as 'adminToken', fetches admin user
        const result = await adminLogin(form.email, form.password);
        const role = result?.user?.role;
        const deptSlug = result?.user?.departmentSlug;
        if (role === 'SUPER_ADMIN' || role === 'SITE_MANAGER') {
          navigate('/admin/super', { replace: true });
        } else if (deptSlug) {
          navigate(`/admin/${deptSlug}`, { replace: true });
        } else {
          navigate('/admin/super', { replace: true });
        }
      } else {
        // Regular user login: stores token as 'token'
        await login(form.email, form.password);
        analytics.login(form.email);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      console.error('[Login] Error:', err.message, err.response?.data);
      toast.error(err.message || 'Invalid credentials');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#081916',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      position: 'relative',
    }}>
      {/* Scanline overlay */}
      <div className="scanline-overlay" />

      {/* Radial glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(238,97,0,0.06) 0%, transparent 60%)',
      }} />

      <div style={{
        background: '#0F2620',
        border: '1px solid rgba(36,74,68,0.4)',
        borderRadius: 10,
        padding: '2.5rem',
        width: '100%',
        maxWidth: 400,
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        position: 'relative',
        zIndex: 2,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <PCLLogo size={48} showText={true} textSize="16px" />
        </div>

        {/* Title — changes based on admin vs regular login */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{
            margin: '0 0 6px', fontSize: 22, fontWeight: 700,
            fontFamily: "'Rajdhani', sans-serif",
            color: '#F4F1EA',
            letterSpacing: '0.02em',
          }}>{isAdminLogin ? 'Admin Portal' : 'Welcome Back'}</h2>
          <p style={{ margin: 0, fontSize: 11, color: '#6A8A82', fontFamily: "'Share Tech Mono',monospace", letterSpacing: '0.1em' }}>
            {isAdminLogin ? 'POSTERA CRESCAM LAUDE' : 'POSTERA CRESCAM LAUDE'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', alignItems: 'center' }}>
          {[['email', 'Email Address', 'email'], ['password', 'Password', 'password']].map(([field, label, type]) => (
            <div key={field} style={{ width: '100%' }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 11, color: '#6A8A82', fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Share Tech Mono', monospace" }}>
                {label}
              </label>
              <input
                type={type}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                required
                className="input-field"
                style={{ fontSize: 14, width: '100%' }}
              />
            </div>
          ))}

          <button type="submit" disabled={loading} style={{
            marginTop: 8,
            padding: '0.8rem',
            background: loading ? 'rgba(36,74,68,0.3)' : '#EE6100',
            color: loading ? '#6A8A82' : '#FFFFFF',
            border: 'none',
            borderRadius: 4,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "'Poppins', sans-serif",
            letterSpacing: '0.04em',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            width: '100%',
          }}>
            {loading ? 'INITIALIZING...' : isAdminLogin ? 'Sign In to Admin' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: 11, color: '#6A8A82', fontFamily: "'Share Tech Mono',monospace" }}>
          © 2026 PCL · MIT License
        </p>
      </div>
    </div>
  );
}
