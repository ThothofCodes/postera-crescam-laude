// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — Ad Banner component for Tech Hub and public pages.
// Fetches active ad campaigns from the monetization API and displays them.
// Tracks impressions and clicks for campaign analytics.

import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

// ── Ad styles ──────────────────────────────────────────────────────────────

const S = {
  banner: (position) => ({
    background: 'linear-gradient(135deg, rgba(15,38,32,0.9) 0%, rgba(8,25,22,0.95) 100%)',
    border: '1px solid rgba(43,182,163,0.15)',
    borderRadius: 10,
    padding: position === 'sidebar' ? '16px' : '20px 24px',
    display: 'flex',
    alignItems: position === 'sidebar' ? 'flex-start' : 'center',
    gap: 16,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    position: 'relative',
    overflow: 'hidden',
  }),
  sponsored: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 9,
    letterSpacing: '0.1em',
    color: '#6A8A82',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontFamily: "'Rajdhani', 'Poppins', sans-serif",
    fontSize: 16,
    fontWeight: 700,
    color: '#F4F1EA',
    marginBottom: 4,
    lineHeight: 1.3,
  },
  body: {
    fontSize: 13,
    color: '#A9C4BE',
    lineHeight: 1.5,
    marginBottom: 8,
  },
  cta: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: '#EE6100',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  image: (position) => ({
    width: position === 'sidebar' ? '100%' : 120,
    height: position === 'sidebar' ? 100 : 80,
    borderRadius: 8,
    objectFit: 'cover',
    flexShrink: 0,
  }),
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 8,
    letterSpacing: '0.1em',
    color: '#6A8A82',
    background: 'rgba(36,74,68,0.3)',
    borderRadius: 3,
    padding: '2px 6px',
  },
};

/**
 * Fetch and display active ads for a page position.
 *
 * @param {string} page - Page identifier (e.g. 'tech-hub', 'store')
 * @param {string} position - Ad position ('sidebar', 'top', 'bottom', 'inline')
 * @param {number} limit - Max ads to show (default 3)
 */
export default function AdBanner({ page = 'all', position = 'sidebar', limit = 3 }) {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get('/monetization/ads/active', { params: { page, position } })
      .then(({ data }) => {
        if (!cancelled) {
          setAds((data.ads || []).slice(0, limit));
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, position, limit]);

  const trackImpression = useCallback((campaignId) => {
    api.post('/monetization/ads/impression', { campaignId }).catch(() => {});
  }, []);

  const trackClick = useCallback(async (campaignId, linkUrl) => {
    try {
      const { data } = await api.post('/monetization/ads/click', { campaignId });
      if (data.linkUrl) window.open(data.linkUrl, '_blank', 'noopener,noreferrer');
      else if (linkUrl) window.open(linkUrl, '_blank', 'noopener,noreferrer');
    } catch {
      if (linkUrl) window.open(linkUrl, '_blank', 'noopener,noreferrer');
    }
  }, []);

  useEffect(() => {
    ads.forEach((ad) => trackImpression(ad._id));
  }, [ads, trackImpression]);

  if (loading || ads.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {ads.map((ad) => (
        <div
          key={ad._id}
          style={S.banner(position)}
          onClick={() => trackClick(ad._id, ad.linkUrl)}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') trackClick(ad._id, ad.linkUrl); }}
        >
          <span style={S.badge}>Sponsored</span>
          {ad.imageUrl && <img src={ad.imageUrl} alt={ad.title} style={S.image(position)} />}
          <div style={{ flex: 1 }}>
            <div style={S.sponsored}>Ad · {ad.advertiser || 'Sponsored'}</div>
            <div style={S.title}>{ad.title}</div>
            {ad.body && <div style={S.body}>{ad.body.substring(0, 120)}{ad.body.length > 120 ? '...' : ''}</div>}
            <span style={S.cta}>{ad.ctaText || 'Learn More'} →</span>
          </div>
        </div>
      ))}
    </div>
  );
}
