// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — Local Tech Hub: Live content from Sanity CMS with fallback
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';

const CATEGORY_COLORS = {
  networking: '#2BB6A3',
  cybersecurity: '#ff3366',
  ai: '#00ff88',
  webdev: '#EE6100',
  hardware: '#ffd700',
  software: '#a78bfa',
  general: '#4a6a8a',
};

const DIFFICULTY_COLORS = {
  Beginner: '#2BB6A3',
  Intermediate: '#ffd700',
  Advanced: '#ff3366',
};

// ── Fallback data when Sanity isn't configured ──────────────────────────────
const FALLBACK_ARTICLES = [
  { _id: '1', title: "Understanding Kenya's Digital Infrastructure Growth", category: 'networking', excerpt: 'How fiber optic expansion is transforming internet access across Nairobi and beyond.', readTime: '5 min', date: 'Aug 24, 2026', featured: true },
  { _id: '2', title: 'Cybersecurity Best Practices for Small Businesses', category: 'cybersecurity', excerpt: 'Essential security measures every Kenyan SME should implement today.', readTime: '8 min', date: 'Aug 22, 2026' },
  { _id: '3', title: 'The Rise of AI in East African Tech', category: 'ai', excerpt: 'Local startups are leveraging machine learning to solve uniquely African challenges.', readTime: '6 min', date: 'Aug 20, 2026' },
  { _id: '4', title: 'Building Your First Web Application in 2026', category: 'webdev', excerpt: "A beginner's guide to modern web development with React and Node.js.", readTime: '12 min', date: 'Aug 18, 2026' },
  { _id: '5', title: 'Hardware Maintenance Tips for Longevity', category: 'hardware', excerpt: 'Keep your devices running smoothly with these professional maintenance tips.', readTime: '4 min', date: 'Aug 15, 2026' },
  { _id: '6', title: 'Linux Commands Every Developer Should Know', category: 'software', excerpt: 'Master the terminal with these essential Linux commands.', readTime: '7 min', date: 'Aug 12, 2026' },
];

const FALLBACK_TIPS = [
  { _id: '1', tip: 'Speed up your Windows PC by disabling startup programs', difficulty: 'Beginner', category: 'Windows' },
  { _id: '2', tip: 'Use keyboard shortcuts to boost your productivity by 50%', difficulty: 'Beginner', category: 'General' },
  { _id: '3', tip: 'Secure your home Wi-Fi with these 5 essential settings', difficulty: 'Intermediate', category: 'Networking' },
  { _id: '4', tip: 'Recover accidentally deleted files from any device', difficulty: 'Intermediate', category: 'General' },
  { _id: '5', tip: 'Optimize your browser for faster browsing speeds', difficulty: 'Beginner', category: 'Browser' },
  { _id: '6', tip: 'Set up a VPN for secure public Wi-Fi usage', difficulty: 'Advanced', category: 'Security' },
];

const FALLBACK_FACTS = [
  { _id: '1', fact: 'The first computer bug was an actual bug — a moth found in a Harvard Mark II computer in 1947.', category: 'History' },
  { _id: '2', fact: 'The entire Apollo 11 guidance computer had less processing power than a modern pocket calculator.', category: 'Space Tech' },
  { _id: '3', fact: 'The first text message ever sent was "Merry Christmas" in 1992.', category: 'Innovation' },
];

const FALLBACK_NEWS = [
  { _id: '1', title: 'Kenya Launches New Fiber Optic Network', summary: 'Government announces nationwide fiber expansion.', source: 'TechCrunch', publishedAt: '2026-08-24' },
  { _id: '2', title: 'AI Startups Raise Record Funding in East Africa', summary: 'Local AI companies secure $50M in Series A funding.', source: 'Ventures Africa', publishedAt: '2026-08-22' },
];

// ── Skeleton Loader ─────────────────────────────────────────────────────────
const SkeletonCard = ({ span = false }) => (
  <div style={{
    background: '#050d0a',
    border: '1px solid rgba(43,182,163,0.1)',
    borderRadius: 12,
    padding: '1.25rem',
    gridColumn: span ? 'span 2' : 'auto',
    minHeight: 180,
  }}>
    <div style={{ height: 12, width: 60, background: '#0a1a15', borderRadius: 4, marginBottom: 12 }} />
    <div style={{ height: 16, width: '80%', background: '#0a1a15', borderRadius: 4, marginBottom: 8 }} />
    <div style={{ height: 12, width: '100%', background: '#0a1a15', borderRadius: 4, marginBottom: 6 }} />
    <div style={{ height: 12, width: '60%', background: '#0a1a15', borderRadius: 4, marginBottom: 12 }} />
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <div style={{ height: 10, width: 40, background: '#0a1a15', borderRadius: 4 }} />
      <div style={{ height: 10, width: 60, background: '#0a1a15', borderRadius: 4 }} />
    </div>
  </div>
);

// ── Main Component ───────────────────────────────────────────────────────────
export default function TechHubLocal() {
  const [activeTab, setActiveTab] = useState('articles');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sanityConfigured, setSanityConfigured] = useState(false);

  // Live data from Sanity
  const [articles, setArticles] = useState([]);
  const [tips, setTips] = useState([]);
  const [facts, setFacts] = useState([]);
  const [news, setNews] = useState([]);
  const [categories, setCategories] = useState([]);

  // Fetch all content
  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      // Check Sanity status first
      const statusRes = await api.get('/tech-hub/public/status');
      const configured = statusRes.data.configured;
      setSanityConfigured(configured);

      if (!configured) {
        // Use fallback data
        setArticles(FALLBACK_ARTICLES);
        setTips(FALLBACK_TIPS);
        setFacts(FALLBACK_FACTS);
        setNews(FALLBACK_NEWS);
        return;
      }

      // Fetch live data in parallel
      const [articlesRes, tipsRes, factsRes, newsRes, catsRes] = await Promise.allSettled([
        api.get('/tech-hub/public/articles?limit=20'),
        api.get('/tech-hub/public/tips?limit=20'),
        api.get('/tech-hub/public/facts?limit=10'),
        api.get('/tech-hub/public/news?limit=10'),
        api.get('/tech-hub/public/categories'),
      ]);

      if (articlesRes.status === 'fulfilled') {
        setArticles(articlesRes.value.data.articles || []);
      }
      if (tipsRes.status === 'fulfilled') {
        setTips(tipsRes.value.data.tips || []);
      }
      if (factsRes.status === 'fulfilled') {
        setFacts(factsRes.value.data.facts || []);
      }
      if (newsRes.status === 'fulfilled') {
        setNews(newsRes.value.data.news || []);
      }
      if (catsRes.status === 'fulfilled') {
        setCategories(catsRes.value.data.categories || []);
      }
    } catch (err) {
      console.error('Failed to load Tech Hub content:', err);
      // Fallback on error
      setArticles(FALLBACK_ARTICLES);
      setTips(FALLBACK_TIPS);
      setFacts(FALLBACK_FACTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  // Dynamically set favicon to PCL logo when on Tech Hub page
  useEffect(() => {
    const prevFavicon = document.querySelector('link[rel="icon"]')?.href || '';
    document.title = '📡 Tech Hub | Postera Crescam Laude';
    // Set favicon to the PCL logo SVG
    const links = document.querySelectorAll('link[rel="icon"]');
    links.forEach((l) => { l.href = '/logo.svg'; l.type = 'image/svg+xml'; });
    return () => {
      document.title = 'Postera Crescam Laude | Nairobi\'s Tech Hub';
      links.forEach((l) => { l.href = prevFavicon; });
    };
  }, []);

  // Filtered articles based on search
  const filteredArticles = articles.filter((a) =>
    a.title?.toLowerCase().includes(searchQuery.toLowerCase())
    || a.category?.toLowerCase().includes(searchQuery.toLowerCase())
    || a.excerpt?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Get featured article
  const featuredArticle = articles.find((a) => a.featured) || articles[0];
  const regularArticles = articles.filter((a) => a._id !== featuredArticle?._id);

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Calculate read time from body text
  const getReadTime = (body) => {
    if (!body) return '3 min';
    const words = Array.isArray(body)
      ? body.reduce((acc, block) => {
        if (block.children) {
          return acc + block.children.reduce((a, child) => a + (child.text?.split(/\s+/).length || 0), 0);
        }
        return acc;
      }, 0)
      : body.split(/\s+/).length;
    return `${Math.max(1, Math.ceil(words / 200))} min`;
  };

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", color: '#c0d8f0', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0B1F1B 0%, #0a2a24 50%, #0F2620 100%)',
        padding: '2rem',
        borderBottom: '2px solid #EE6100',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#F4F1EA' }}>
              📡 Tech Hub
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#4a6a8a' }}>
              Empowering Kenya&apos;s Digital Future
              {sanityConfigured && (
                <span style={{ marginLeft: 8, color: '#00ff88', fontSize: 10 }}>● LIVE</span>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                background: '#0F2620',
                border: '1px solid rgba(36,74,68,0.4)',
                borderRadius: 6,
                color: '#F4F1EA',
                fontSize: 12,
                width: 200,
              }}
            />
            <a
              href="https://benevolent-tulumba-e97633.netlify.app"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '0.5rem 1rem',
                background: 'transparent',
                color: '#2BB6A3',
                border: '1px solid #2BB6A3',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Full Site →
            </a>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem 2rem 0' }}>
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(36,74,68,0.4)', marginBottom: '1.5rem', overflowX: 'auto' }}>
          {[
            { key: 'articles', label: '📚 Articles', count: articles.length },
            { key: 'tips', label: '💡 Tips', count: tips.length },
            { key: 'facts', label: '🧠 Facts', count: facts.length },
            ...(news.length > 0 ? [{ key: 'news', label: '📰 News', count: news.length }] : []),
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'transparent',
                color: activeTab === key ? '#EE6100' : '#4a6a8a',
                border: 'none',
                borderBottom: activeTab === key ? '2px solid #EE6100' : '2px solid transparent',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 2rem 2rem' }}>
        {/* ── Articles Tab ── */}
        {activeTab === 'articles' && (
          <>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} span={i === 0} />
                ))}
              </div>
            ) : filteredArticles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#4a6a8a' }}>
                <p style={{ fontSize: 24 }}>📭</p>
                <p>No articles found. {searchQuery ? 'Try a different search.' : 'Check back soon!'}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {/* Featured Article */}
                {featuredArticle && !searchQuery && (
                  <Link
                    to={`/tech-hub/${featuredArticle.slug?.current || featuredArticle._id}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={{
                      background: '#050d0a',
                      border: '1px solid rgba(238,97,0,0.4)',
                      borderRadius: 12,
                      padding: '1.25rem',
                      gridColumn: 'span 2',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      display: 'grid',
                      gridTemplateColumns: featuredArticle.imageUrl ? '1fr 1fr' : '1fr',
                      gap: '1.5rem',
                      alignItems: 'center',
                    }}
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = '#EE6100'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(238,97,0,0.4)'; e.currentTarget.style.transform = 'none'; }}
                    >
                      {featuredArticle.imageUrl && (
                        <img src={featuredArticle.imageUrl} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 8 }} />
                      )}
                      <div>
                        <span style={{ display: 'inline-block', padding: '2px 8px', background: '#EE6100', color: '#000', borderRadius: 4, fontSize: 10, fontWeight: 700, marginBottom: '0.75rem' }}>
                          ★ FEATURED
                        </span>
                        <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, color: CATEGORY_COLORS[featuredArticle.category] || '#4a6a8a', textTransform: 'uppercase', marginLeft: 8 }}>
                          {featuredArticle.category}
                        </span>
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#F4F1EA' }}>{featuredArticle.title}</h3>
                        <p style={{ fontSize: '0.9rem', color: '#A9C4BE', marginBottom: '0.75rem', lineHeight: 1.5 }}>{featuredArticle.excerpt}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#4a6a8a' }}>
                          <span>{featuredArticle.author?.name || 'PCL Tech Team'}</span>
                          <span>{formatDate(featuredArticle.publishedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )}

                {/* Regular Articles */}
                {regularArticles.map((article, i) => (
                  <Link
                    key={article._id}
                    to={`/tech-hub/${article.slug?.current || article._id}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div
                      style={{
                        background: '#050d0a',
                        border: '1px solid rgba(43,182,163,0.2)',
                        borderRadius: 12,
                        padding: '1.25rem',
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = '#EE6100'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(43,182,163,0.2)'; e.currentTarget.style.transform = 'none'; }}
                    >
                      {article.imageUrl && (
                        <img src={article.imageUrl} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginBottom: '0.75rem' }} />
                      )}
                      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, color: CATEGORY_COLORS[article.category] || '#4a6a8a', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                        {article.category}
                      </span>
                      <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#F4F1EA' }}>{article.title}</h3>
                      <p style={{ fontSize: '0.85rem', color: '#A9C4BE', marginBottom: '0.75rem', lineHeight: 1.5 }}>{article.excerpt}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#4a6a8a' }}>
                        <span>{getReadTime(article.body)} read</span>
                        <span>{formatDate(article.publishedAt)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Tips Tab ── */}
        {activeTab === 'tips' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            ) : tips.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#4a6a8a', gridColumn: '1 / -1' }}>
                <p style={{ fontSize: 24 }}>💡</p>
                <p>No tips available yet.</p>
              </div>
            ) : (
              tips.map((tip) => (
                <div key={tip._id} style={{
                  background: 'rgba(43,182,163,0.08)',
                  border: '1px solid rgba(43,182,163,0.3)',
                  borderRadius: 8,
                  padding: '1rem',
                }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '2px 8px',
                      background: DIFFICULTY_COLORS[tip.difficulty] || '#4a6a8a',
                      color: '#000',
                      borderRadius: 99,
                      fontSize: 10,
                      fontWeight: 700,
                    }}>
                      {tip.difficulty}
                    </span>
                    <span style={{ fontSize: 11, color: '#4a6a8a' }}>{tip.category}</span>
                  </div>
                  {tip.title && (
                    <h4 style={{ margin: '0 0 6px', fontSize: 13, color: '#F4F1EA' }}>{tip.title}</h4>
                  )}
                  <p style={{ fontSize: '0.9rem', color: '#c0d8f0', lineHeight: 1.5, margin: 0 }}>{tip.tip}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Facts Tab ── */}
        {activeTab === 'facts' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
            ) : facts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#4a6a8a', gridColumn: '1 / -1' }}>
                <p style={{ fontSize: 24 }}>🧠</p>
                <p>No facts available yet.</p>
              </div>
            ) : (
              facts.map((fact) => (
                <div key={fact._id} style={{
                  background: 'rgba(238,97,0,0.08)',
                  border: '1px solid rgba(238,97,0,0.3)',
                  borderRadius: 8,
                  padding: '1.5rem',
                }}>
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
                    {fact.category || 'Tech Fact'}
                  </span>
                  {fact.title && (
                    <h4 style={{ margin: '0 0 6px', fontSize: 13, color: '#F4F1EA' }}>{fact.title}</h4>
                  )}
                  <p style={{ fontSize: '1rem', color: '#F4F1EA', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
                    &ldquo;{fact.fact}&rdquo;
                  </p>
                  {fact.source && (
                    <p style={{ fontSize: 11, color: '#4a6a8a', marginTop: 8, margin: '8px 0 0' }}>— {fact.source}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── News Tab ── */}
        {activeTab === 'news' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
            ) : news.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#4a6a8a', gridColumn: '1 / -1' }}>
                <p style={{ fontSize: 24 }}>📰</p>
                <p>No news available yet.</p>
              </div>
            ) : (
              news.map((item) => (
                <div key={item._id} style={{
                  background: '#050d0a',
                  border: '1px solid rgba(167,139,250,0.3)',
                  borderRadius: 8,
                  padding: '1rem',
                }}>
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6, marginBottom: '0.75rem' }} />
                  )}
                  <h4 style={{ margin: '0 0 6px', fontSize: 14, color: '#F4F1EA' }}>{item.title}</h4>
                  <p style={{ fontSize: '0.85rem', color: '#A9C4BE', lineHeight: 1.5, margin: '0 0 8px' }}>{item.summary}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4a6a8a' }}>
                    <span>{item.source || 'PCL Tech'}</span>
                    <span>{formatDate(item.publishedAt)}</span>
                  </div>
                  {item.sourceUrl && (
                    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8, color: '#2BB6A3', fontSize: 11 }}>
                      Read more →
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div style={{
        background: 'linear-gradient(135deg, #0a2a24, #0B1F1B)',
        padding: '2rem',
        textAlign: 'center',
        borderTop: '1px solid rgba(43,182,163,0.2)',
      }}>
        <p style={{ color: '#A9C4BE', marginBottom: '1rem' }}>
          Want more in-depth content? Visit our full Tech Hub.
        </p>
        <a
          href="https://benevolent-tulumba-e97633.netlify.app"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            padding: '0.7rem 1.5rem',
            background: '#EE6100',
            color: '#000',
            borderRadius: 6,
            fontWeight: 700,
            fontSize: '0.9rem',
            textDecoration: 'none',
          }}
        >
          🔗 Visit PCL Tech Hub
        </a>
      </div>
    </div>
  );
}
