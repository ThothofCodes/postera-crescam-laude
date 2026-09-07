// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — Tech Insights: Public gateway to the independent Tech Content Hub
import { useState } from 'react';
import { Link } from 'react-router-dom';

const FEATURED_ARTICLES = [
  {
    id: 1,
    title: 'Understanding Kenya\'s Digital Infrastructure Growth',
    category: 'Networking',
    excerpt: 'How fiber optic expansion is transforming internet access across Nairobi and beyond.',
    readTime: '5 min read',
    date: 'Aug 24, 2026',
    featured: true,
  },
  {
    id: 2,
    title: 'Cybersecurity Best Practices for Small Businesses',
    category: 'Cybersecurity',
    excerpt: 'Essential security measures every Kenyan SME should implement today.',
    readTime: '8 min read',
    date: 'Aug 22, 2026',
  },
  {
    id: 3,
    title: 'The Rise of AI in East African Tech',
    category: 'AI & ML',
    excerpt: 'Local startups are leveraging machine learning to solve uniquely African challenges.',
    readTime: '6 min read',
    date: 'Aug 20, 2026',
  },
  {
    id: 4,
    title: 'Building Your First Web Application in 2026',
    category: 'Web Development',
    excerpt: 'A beginner\'s guide to modern web development with React and Node.js.',
    readTime: '12 min read',
    date: 'Aug 18, 2026',
  },
  {
    id: 5,
    title: 'Hardware Maintenance Tips for Longevity',
    category: 'Hardware',
    excerpt: 'Keep your devices running smoothly with these professional maintenance tips.',
    readTime: '4 min read',
    date: 'Aug 15, 2026',
  },
];

const TECH_TIPS = [
  { id: 1, tip: 'Speed up your Windows PC by disabling startup programs', difficulty: 'Beginner', category: 'Windows' },
  { id: 2, tip: 'Use keyboard shortcuts to boost your productivity by 50%', difficulty: 'Beginner', category: 'General' },
  { id: 3, tip: 'Secure your home Wi-Fi with these 5 essential settings', difficulty: 'Intermediate', category: 'Networking' },
  { id: 4, tip: 'Recover accidentally deleted files from any device', difficulty: 'Intermediate', category: 'General' },
  { id: 5, tip: 'Optimize your browser for faster browsing speeds', difficulty: 'Beginner', category: 'Browser' },
];

const TECH_NEWS = [
  { id: 1, title: 'Safaricom Launches 5G Expansion in Major Cities', source: 'TechWeez', time: '2h ago' },
  { id: 2, title: 'Kenya\'s Digital Economy Hits Ksh 1 Trillion Milestone', source: 'Business Daily', time: '5h ago' },
  { id: 3, title: 'New Cybersecurity Regulations Take Effect', source: 'Nation', time: '1d ago' },
  { id: 4, title: 'Local Startup Raises $2M for EdTech Platform', source: 'Disrupt Africa', time: '2d ago' },
];

const DAILY_FACTS = [
  { id: 1, fact: 'The first computer bug was an actual bug — a moth found in a Harvard Mark II computer in 1947.', category: 'History' },
  { id: 2, fact: 'The entire Apollo 11 guidance computer had less processing power than a modern pocket calculator.', category: 'Space Tech' },
  { id: 3, fact: 'The first text message ever sent was "Merry Christmas" in 1992.', category: 'Innovation' },
];

export default function TechInsights() {
  const [activeTab, setActiveTab] = useState('articles');

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: '#c0d8f0', minHeight: '100vh' }}>
      {/* Hero Section */}
      <section style={{
        background: 'linear-gradient(135deg, #0B1F1B 0%, #0a2a24 50%, #0F2620 100%)',
        padding: '3rem 2rem',
        textAlign: 'center',
        borderBottom: '2px solid #EE6100',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Circuit pattern background */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(238,97,0,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(43,182,163,0.1) 0%, transparent 50%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', maxWidth: 800, margin: '0 auto' }}>
          <div style={{ fontSize: 48, marginBottom: '1rem' }}>📡</div>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #EE6100, #2BB6A3)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '0.75rem',
          }}>
            Tech Insights
          </h1>
          <p style={{
            fontSize: '1.1rem',
            color: '#2BB6A3',
            fontWeight: 600,
            marginBottom: '0.5rem',
          }}>
            Empowering Kenya's Digital Future
          </p>
          <p style={{
            fontSize: '0.95rem',
            color: '#A9C4BE',
            maxWidth: 600,
            margin: '0 auto 1.5rem',
          }}>
            Explore our collection of tech articles, tips, and news. Stay informed with the latest in hardware, software, networking, and cybersecurity.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://benevolent-tulumba-e97633.netlify.app"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '0.7rem 1.5rem',
                background: '#EE6100',
                color: '#000',
                borderRadius: 6,
                fontWeight: 700,
                fontSize: '0.9rem',
                textDecoration: 'none',
                transition: 'all 0.2s',
                boxShadow: '0 0 20px rgba(238,97,0,0.3)',
              }}
            >
              Visit Tech Hub →
            </a>
            <Link
              to="/help"
              style={{
                padding: '0.7rem 1.5rem',
                background: 'transparent',
                color: '#2BB6A3',
                border: '1px solid #2BB6A3',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: '0.9rem',
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
            >
              Get Support
            </Link>
          </div>
        </div>
      </section>

      {/* Content Tabs */}
      <section style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {[
            { key: 'articles', label: '📚 Articles', count: FEATURED_ARTICLES.length },
            { key: 'tips', label: '💡 Tech Tips', count: TECH_TIPS.length },
            { key: 'news', label: '📰 News', count: TECH_NEWS.length },
            { key: 'facts', label: '🧠 Daily Facts', count: DAILY_FACTS.length },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: '0.5rem 1rem',
                background: activeTab === key ? '#EE6100' : 'rgba(43,182,163,0.1)',
                color: activeTab === key ? '#000' : '#A9C4BE',
                border: `1px solid ${activeTab === key ? '#EE6100' : 'rgba(43,182,163,0.3)'}`,
                borderRadius: 99,
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        {/* Articles Tab */}
        {activeTab === 'articles' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {FEATURED_ARTICLES.map((article, i) => (
                <div
                  key={article.id}
                  style={{
                    background: '#050d0a',
                    border: `1px solid ${i === 0 ? 'rgba(238,97,0,0.4)' : 'rgba(43,182,163,0.2)'}`,
                    borderRadius: 12,
                    padding: '1.25rem',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    gridColumn: i === 0 ? 'span 2' : 'auto',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = '#EE6100'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = i === 0 ? 'rgba(238,97,0,0.4)' : 'rgba(43,182,163,0.2)'; e.currentTarget.style.transform = 'none'; }}
                >
                  {i === 0 && (
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      background: '#EE6100',
                      color: '#000',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      marginBottom: '0.75rem',
                    }}>
                      ★ FEATURED
                    </span>
                  )}
                  <span style={{
                    display: 'inline-block',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#2BB6A3',
                    textTransform: 'uppercase',
                    marginBottom: '0.5rem',
                  }}>
                    {article.category}
                  </span>
                  <h3 style={{ fontSize: i === 0 ? '1.25rem' : '1rem', marginBottom: '0.5rem', color: '#F4F1EA' }}>
                    {article.title}
                  </h3>
                  <p style={{ fontSize: '0.9rem', color: '#A9C4BE', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                    {article.excerpt}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#4a6a8a' }}>
                    <span>{article.readTime}</span>
                    <span>{article.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips Tab */}
        {activeTab === 'tips' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {TECH_TIPS.map((tip) => (
              <div
                key={tip.id}
                style={{
                  background: 'rgba(43,182,163,0.08)',
                  border: '1px solid rgba(43,182,163,0.3)',
                  borderRadius: 8,
                  padding: '1rem',
                }}
              >
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{
                    padding: '2px 8px',
                    background: tip.difficulty === 'Beginner' ? '#2BB6A3' : tip.difficulty === 'Intermediate' ? '#ffd700' : '#ff3366',
                    color: tip.difficulty === 'Beginner' ? '#000' : '#000',
                    borderRadius: 99,
                    fontSize: 10,
                    fontWeight: 700,
                  }}>
                    {tip.difficulty}
                  </span>
                  <span style={{ fontSize: 11, color: '#4a6a8a' }}>{tip.category}</span>
                </div>
                <p style={{ fontSize: '0.9rem', color: '#F4F1EA', lineHeight: 1.5 }}>
                  {tip.tip}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* News Tab */}
        {activeTab === 'news' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {TECH_NEWS.map((item) => (
              <div
                key={item.id}
                style={{
                  background: '#050d0a',
                  border: '1px solid rgba(238,97,0,0.2)',
                  borderRadius: 8,
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{item.title}</h3>
                  <span style={{ fontSize: 12, color: '#EE6100' }}>{item.source}</span>
                </div>
                <span style={{ fontSize: 11, color: '#4a6a8a', whiteSpace: 'nowrap' }}>{item.time}</span>
              </div>
            ))}
          </div>
        )}

        {/* Facts Tab */}
        {activeTab === 'facts' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {DAILY_FACTS.map((fact) => (
              <div
                key={fact.id}
                style={{
                  background: 'rgba(238,97,0,0.08)',
                  border: '1px solid rgba(238,97,0,0.3)',
                  borderRadius: 8,
                  padding: '1.5rem',
                }}
              >
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  background: 'rgba(238,97,0,0.2)',
                  color: '#EE6100',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  marginBottom: '0.75rem',
                }}>
                  {fact.category}
                </span>
                <p style={{ fontSize: '1rem', color: '#F4F1EA', lineHeight: 1.6, fontStyle: 'italic' }}>
                  "{fact.fact}"
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CTA Section */}
      <section style={{
        background: 'linear-gradient(135deg, #0a2a24, #0B1F1B)',
        padding: '3rem 2rem',
        textAlign: 'center',
        borderTop: '1px solid rgba(43,182,163,0.2)',
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Want More Tech Content?</h2>
        <p style={{ color: '#A9C4BE', marginBottom: '1.5rem', maxWidth: 500, margin: '0 auto 1.5rem' }}>
          Visit our full Tech Hub for in-depth articles, tutorials, and the latest tech news.
        </p>
        <a
          href="https://benevolent-tulumba-e97633.netlify.app"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            padding: '0.8rem 2rem',
            background: 'linear-gradient(135deg, #EE6100, #d45600)',
            color: '#000',
            borderRadius: 6,
            fontWeight: 700,
            fontSize: '1rem',
            textDecoration: 'none',
            boxShadow: '0 0 30px rgba(238,97,0,0.3)',
            transition: 'all 0.2s',
          }}
        >
          🔗 Explore PCL Tech Hub
        </a>
      </section>
    </div>
  );
}
