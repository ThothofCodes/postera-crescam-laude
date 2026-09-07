// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — Circuit Canopy Footer
import PCLLogo from './Logo';

export default function Footer({ variant = 'public' }) {
  const isAdmin = variant === 'admin';

  return (
    <footer style={{
      background: 'linear-gradient(180deg, #0F2620 0%, #081916 100%)',
      borderTop: '1px solid rgba(36,74,68,0.3)',
      padding: isAdmin ? '0.65rem 1.5rem' : '3rem 1.5rem 1.5rem',
      marginTop: 'auto',
      position: 'relative',
    }}>
      {/* Circuit-trace top line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent, #2BB6A3, #EE6100, #2BB6A3, transparent)',
        opacity: 0.5,
        pointerEvents: 'none',
      }} />

      {!isAdmin && (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2.5rem', marginBottom: '2.5rem' }}>

            {/* Brand */}
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <PCLLogo size={28} showText={true} textSize="13px" />
              </div>
              <p style={{ fontSize: 13, color: '#6A8A82', lineHeight: 1.7, margin: 0 }}>
                Your one-stop technology &amp; digital services hub in Ruai Town, Nairobi County, Kenya.
              </p>
              <p style={{ fontSize: 11, color: '#6A8A82', marginTop: 8, fontFamily: "'Share Tech Mono',monospace", letterSpacing: '0.05em' }}>
                Empowering Kenya's Digital Future
              </p>
            </div>

            {/* Quick links */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#EE6100', marginBottom: '0.85rem', fontFamily: "'Share Tech Mono',monospace" }}>Quick Links</p>
              {[['/store','Tech Store'],['/calculator','Price Calculator'],['/consult','Consultations'],['/services','Services'],['/help','Help Desk'],['/contact','Contact Us']].map(([href, label]) => (
                <a key={href} href={href} style={{ display: 'block', color: '#6A8A82', fontSize: 13, marginBottom: 7, fontFamily: "'Poppins', sans-serif", transition: 'all 0.2s' }}
                  onMouseOver={(e) => { e.target.style.color = '#2BB6A3'; e.target.style.paddingLeft = '6px'; }}
                  onMouseOut={(e) => { e.target.style.color = '#6A8A82'; e.target.style.paddingLeft = '0'; }}>
                  › {label}
                </a>
              ))}
            </div>

            {/* Contact */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#EE6100', marginBottom: '0.85rem', fontFamily: "'Share Tech Mono',monospace" }}>Contact</p>
              {[['📍','Ruai Town, Nairobi'],['📞','IP Phone — coming soon'],['✉️','info@posteracrescamlaude.co.ke']].map(([icon, text]) => (
                <p key={text} style={{ fontSize: 13, color: '#6A8A82', marginBottom: 7, display: 'flex', gap: 8, fontFamily: "'Poppins', sans-serif" }}>
                  <span>{icon}</span><span>{text}</span>
                </p>
              ))}
              <a href="https://wa.me/254140918502" target="_blank" rel="noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
                padding: '6px 16px',
                background: 'transparent',
                border: '1px solid rgba(43,182,163,0.3)',
                borderRadius: 4, color: '#2BB6A3', fontSize: 13, fontWeight: 600,
                textDecoration: 'none', transition: 'all 0.2s', fontFamily: "'Poppins', sans-serif",
              }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(43,182,163,0.1)'; e.currentTarget.style.borderColor = '#2BB6A3'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(43,182,163,0.3)'; }}>
                💬 WhatsApp Us
              </a>
            </div>

            {/* Hours */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#EE6100', marginBottom: '0.85rem', fontFamily: "'Share Tech Mono',monospace" }}>Opening Hours</p>
              {[['Mon – Fri','8:00 AM – 8:00 PM'],['Saturday','9:00 AM – 7:00 PM'],['Sunday','10:00 AM – 5:00 PM']].map(([day, hours]) => (
                <div key={day} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 7, gap: 8, fontFamily: "'Poppins', sans-serif" }}>
                  <span style={{ color: '#6A8A82' }}>{day}</span>
                  <span style={{ color: '#A9C4BE', fontWeight: 500 }}>{hours}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="divider" />
        </div>
      )}

      {/* Copyright bar */}
      <div style={{
        maxWidth: isAdmin ? '100%' : 1200,
        margin: '0 auto',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        color: '#6A8A82',
        fontFamily: "'Share Tech Mono',monospace",
      }}>
        <span>
          © 2026{' '}
          <strong style={{ color: '#EE6100' }}>
            Postera Crescam Laude
          </strong>
          {' '}— All rights reserved.
        </span>
        <span>
          Licensed under the{' '}
          <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noreferrer"
            style={{ color: '#2BB6A3', textDecoration: 'none' }}>
            MIT License
          </a>
        </span>
        <span>MERN · M-Pesa · Made in Kenya 🇰🇪</span>
      </div>
    </footer>
  );
}
