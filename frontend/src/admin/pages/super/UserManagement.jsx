// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
import { useEffect, useState } from 'react';
import { api } from '../../../utils/api';
import { formatDate } from '../../../utils/helpers';
import { Spinner, EmptyState } from '../../../components/UI';
import toast from 'react-hot-toast';

const ROLES = ['SITE_MANAGER', 'DEPT_HEAD_OWNER', 'STAFF'];
const EMPTY = { name:'', email:'', password:'', role:'STAFF', departmentSlug:'', isOwner:false, mustChangePassword:false };
const FALLBACK_DEPTS = ['internet', 'webdev', 'playstation', 'repair', 'cybersecurity', 'govadmin'];

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [pwModal, setPwModal] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [createdUser, setCreatedUser] = useState(null);
  const [depts, setDepts] = useState(FALLBACK_DEPTS);

  useEffect(() => {
    api.get('/departments').then(({ data }) => {
      const slugs = data.filter(d => d.isActive !== false).map(d => d.slug);
      if (slugs.length > 0) setDepts(slugs);
    }).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/users');
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (modal === 'create') {
        const { data } = await api.post('/users', form);
        setCreatedUser({ ...data, tempPassword: form.password });
        toast.success('User created');
      } else {
        await api.put(`/users/${modal._id}`, form);
        toast.success('Updated');
      }
      setModal(null); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  const resetPw = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const { data } = await api.post(`/users/${pwModal._id}/reset-password`, { 
        password: newPw,
        mustChangePassword: pwModal.mustChangePassword 
      });
      toast.success(data.message || 'Password reset'); 
      setPwModal(null); setNewPw('');
      load(); // Reload to show updated status
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    setSaving(false);
  };

  const deactivate = async (id) => {
    if (!window.confirm('Deactivate this user?')) return;
    await api.delete(`/users/${id}`); toast.success('Deactivated'); load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 16, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#EE6100' }}>◉ User Management ({users.length})</h2>
        <button onClick={() => { setForm(EMPTY); setModal('create'); }} style={btn('#EE6100')}>+ New User</button>
      </div>

      {loading ? <Spinner /> : users.length === 0 ? <EmptyState icon="◉" message="No users found" /> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tbl}>
            <thead><tr style={{ background: 'rgba(238,97,0,0.04)', borderBottom: '1px solid rgba(238,97,0,0.15)' }}>
              {['Name','Email','Role','Department','Owner','Active','Last Login','Actions'].map((h) => <th key={h} style={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} style={{ borderBottom: '1px solid rgba(26,58,92,0.4)', opacity: u.isActive ? 1 : 0.4 }}>
                  <td style={td}><span style={{ fontWeight: 700, color: '#F4F1EA' }}>{u.name}</span></td>
                  <td style={td}>{u.email}</td>
                  <td style={td}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: 'rgba(238,97,0,0.08)', border: '1px solid rgba(238,97,0,0.2)', color: '#EE6100', fontWeight: 700, letterSpacing: '0.08em' }}>{u.role}</span>
                    {u.mustChangePassword && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)', color: '#ffd700', fontWeight: 700, marginLeft: 4 }}>TEMP PW</span>}
                  </td>
                  <td style={td}>{u.departmentSlug || '—'}</td>
                  <td style={td}>{u.isOwner ? '✅' : '—'}</td>
                  <td style={td}>{u.isActive ? '✅' : '❌'}</td>
                  <td style={td}>{u.lastLogin ? formatDate(u.lastLogin) : '—'}</td>
                  <td style={td}>
                    {!u.superAdminLocked && (
                      <>
                        <button onClick={() => { setForm({ name:u.name, email:u.email, password:'', role:u.role, departmentSlug:u.departmentSlug||'', isOwner:u.isOwner||false }); setModal(u); }} style={btnSm('#EE6100')}>Edit</button>
                        <button onClick={() => setPwModal(u)} style={btnSm('#ffd700')}>PW</button>
                        {u.role === 'SITE_MANAGER' && (
                          <button onClick={() => setPwModal({...u, changeEmail: true})} style={btnSm('#2BB6A3')}>Email</button>
                        )}
                        {u.isActive && <button onClick={() => deactivate(u._id)} style={btnSm('#ff3366')}>Deactivate</button>}
                      </>
                    )}
                    {u.superAdminLocked && <span style={{ fontSize: 10, color: '#6A8A82' }}>🔒 Locked</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div style={overlay}>
          <div style={box}>
            <h3 style={{ margin: '0 0 1rem', color: '#EE6100' }}>{modal === 'create' ? 'New User' : `Edit — ${modal.name}`}</h3>
            <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label style={lbl}>Name</label><input value={form.name} onChange={(e) => setForm({...form,name:e.target.value})} required style={inp} /></div>
              <div><label style={lbl}>Email</label><input type="email" value={form.email} onChange={(e) => setForm({...form,email:e.target.value})} required={modal==='create'} disabled={modal!=='create'} style={{...inp,opacity:modal!=='create'?0.5:1}} /></div>
              {modal === 'create' && <>
                <div><label style={lbl}>Password</label><input type="password" value={form.password} onChange={(e) => setForm({...form,password:e.target.value})} required minLength={6} style={inp} /></div>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12, color:'#A9C4BE' }}>
                  <input type="checkbox" checked={form.mustChangePassword} onChange={(e) => setForm({...form,mustChangePassword:e.target.checked})} />
                  Require password change on first login
                </label>
              </>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><label style={lbl}>Role</label>
                  <select value={form.role} onChange={(e) => setForm({...form,role:e.target.value})} style={inp}>
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Department</label>
                  <select value={form.departmentSlug} onChange={(e) => setForm({...form,departmentSlug:e.target.value})} style={inp}>
                    <option value="">— None —</option>
                    {depts.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12, color:'#A9C4BE' }}>
                <input type="checkbox" checked={form.isOwner} onChange={(e) => setForm({...form,isOwner:e.target.checked})} />
                Department Co-Owner (DEPT_HEAD_OWNER)
              </label>
              {modal === 'create' && (
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12, color:'#ffd700' }}>
                  <input type="checkbox" checked={form.mustChangePassword} onChange={(e) => setForm({...form,mustChangePassword:e.target.checked})} />
                  Force password change on first login
                </label>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModal(null)} style={btn('#6A8A82')}>Cancel</button>
                <button type="submit" disabled={saving} style={btn('#EE6100')}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pwModal && (
        <div style={overlay}>
          <div style={{ ...box, maxWidth: 360 }}>
            {pwModal.changeEmail ? (
              <>
                <h3 style={{ margin: '0 0 1rem', color: '#2BB6A3' }}>Change Email — {pwModal.name}</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault(); setSaving(true);
                  try {
                    await api.put(`/users/${pwModal._id}/change-email`, { email: newPw });
                    toast.success('Email updated successfully');
                    setPwModal(null); setNewPw('');
                    load();
                  } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
                  setSaving(false);
                }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div><label style={lbl}>New Email</label><input type="email" value={newPw} onChange={(e) => setNewPw(e.target.value)} required style={inp} /></div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => { setPwModal(null); setNewPw(''); }} style={btn('#6A8A82')}>Cancel</button>
                    <button type="submit" disabled={saving} style={btn('#2BB6A3')}>{saving ? 'Updating...' : 'Update Email'}</button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h3 style={{ margin: '0 0 1rem', color: '#ffd700' }}>Reset Password — {pwModal.name}</h3>
                <form onSubmit={resetPw} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div><label style={lbl}>New Password</label><input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={6} style={inp} /></div>
                  <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12, color:'#ffd700' }}>
                    <input type="checkbox" checked={pwModal.mustChangePassword || false} onChange={(e) => setPwModal({...pwModal, mustChangePassword: e.target.checked})} />
                    Force password change on next login
                  </label>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setPwModal(null)} style={btn('#6A8A82')}>Cancel</button>
                    <button type="submit" disabled={saving} style={btn('#ffd700')}>{saving ? 'Resetting...' : 'Reset'}</button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {createdUser && (
        <div style={overlay}>
          <div style={{ ...box, maxWidth: 480 }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: 48 }}>✅</span>
              <h3 style={{ margin: '0.5rem 0', color: '#00ff88' }}>User Created Successfully!</h3>
            </div>
            
            <div style={{ background: 'rgba(0, 255, 136, 0.05)', border: '1px solid rgba(0, 255, 136, 0.2)', borderRadius: 6, padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: 12, color: '#A9C4BE' }}><strong>Name:</strong> {createdUser.name}</p>
              <p style={{ margin: '0 0 0.5rem', fontSize: 12, color: '#A9C4BE' }}><strong>Email:</strong> {createdUser.email}</p>
              <p style={{ margin: '0 0 0.5rem', fontSize: 12, color: '#A9C4BE' }}><strong>Role:</strong> {createdUser.role}</p>
              
              {createdUser.mustChangePassword && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(255, 215, 0, 0.1)', border: '1px solid rgba(255, 215, 0, 0.3)', borderRadius: 4 }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: 11, color: '#ffd700', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    🔐 Temporary Password
                  </p>
                  <p style={{ margin: 0, fontSize: 16, fontFamily: 'monospace', color: '#F4F1EA', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: 4, wordBreak: 'break-all' }}>
                    {createdUser.tempPassword}
                  </p>
                  <p style={{ margin: '0.5rem 0 0', fontSize: 11, color: '#A9C4BE' }}>
                    User must change this password on first login.
                  </p>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => { navigator.clipboard.writeText(createdUser.tempPassword || ''); toast.success('Password copied!'); }} style={btn('#00ff88')}>📋 Copy Password</button>
              <button onClick={() => setCreatedUser(null)} style={btn('#EE6100')}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btn  = (c) => ({ padding:'0.45rem 1rem', background:`${c}18`, color:c, border:`1px solid ${c}44`, borderRadius:4, cursor:'pointer', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' });
const btnSm= (c) => ({ ...btn(c), padding:'2px 8px', marginRight:4 });
const tbl  = { width:'100%', borderCollapse:'collapse', background:'linear-gradient(160deg,#0F2620,#0F2620)', borderRadius:8, overflow:'hidden' };
const th   = { padding:'0.6rem 0.8rem', textAlign:'left', fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'#EE6100' };
const td   = { padding:'0.6rem 0.8rem', fontSize:13, color:'#a8c0d8' };
const overlay = { position:'fixed', inset:0, background:'rgba(2,4,8,0.88)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 };
const box  = { background:'linear-gradient(160deg,#0F2620,#0F2620)', border:'1px solid rgba(238,97,0,0.25)', borderRadius:8, padding:'1.5rem', width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto' };
const inp  = { width:'100%', padding:'0.5rem 0.7rem', background:'rgba(6,13,20,0.8)', border:'1px solid rgba(238,97,0,0.15)', borderRadius:4, color:'#F4F1EA', fontSize:13, outline:'none', boxSizing:'border-box' };
const lbl  = { display:'block', marginBottom:4, fontSize:10, color:'#EE6100', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase' };
