// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — Circuit Canopy ProductDetail
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useCart } from '../context/CartContext';
import analytics from '../utils/analytics';
import { formatKES, noImagePlaceholder } from '../utils/helpers';
import { Spinner } from '../components/UI';
import toast from 'react-hot-toast';

export default function ProductDetail() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const { addItem } = useCart();

  useEffect(() => {
    api.get(`/products/${slug}`).then((r) => {
      setProduct(r.data);
      analytics.productViewed(r.data._id, r.data.name, r.data.price);
    }).finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <Spinner />;
  if (!product) return <div style={{ padding: '2rem', textAlign: 'center', color: '#A9C4BE', background: '#081916' }}>Product not found. <Link to="/store" style={{ color: '#EE6100', textDecoration: 'none' }}>Back to store</Link></div>;

  const images = product.images?.length ? product.images : [noImagePlaceholder(500, 400)];
  const outOfStock = !product.isDigital && product.stock === 0;

  const handleAdd = () => {
    addItem(product, qty);
    analytics.addToCart(product._id, product.name, qty, product.price);
    toast.success(`${product.name} added to cart`);
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem', background: '#081916', color: '#A9C4BE' }}>
      <Link to="/store" style={{ color: '#6A8A82', fontSize: 14, textDecoration: 'none', fontFamily: "'Poppins', sans-serif" }}>← Back to Store</Link>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1.5rem' }}>
        <div>
          <img src={images[imgIdx]} alt={product.name} style={{ width: '100%', borderRadius: 10, objectFit: 'cover', maxHeight: 400, background: '#0F2620' }} />
          {images.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {images.map((img, i) => (
                <img key={i} src={img} alt="" onClick={() => setImgIdx(i)} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4, cursor: 'pointer', border: imgIdx === i ? '2px solid #EE6100' : '2px solid rgba(36,74,68,0.4)' }} />
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#0F2620', padding: '1.5rem', borderRadius: 10, border: '1px solid rgba(36,74,68,0.4)' }}>
          <span style={{ fontSize: 11, background: 'rgba(36,74,68,0.3)', color: '#2BB6A3', padding: '2px 10px', borderRadius: 20, width: 'fit-content', textTransform: 'capitalize', fontFamily: "'Share Tech Mono',monospace" }}>{product.category}</span>
          <h1 style={{ margin: 0, fontSize: 24, color: '#F4F1EA', fontFamily: "'Rajdhani','Poppins', sans-serif" }}>{product.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#F4F1EA', fontFamily: "'Rajdhani','Poppins', sans-serif" }}>{formatKES(product.price)}</span>
            {product.comparePrice && <span style={{ textDecoration: 'line-through', color: '#6A8A82', fontSize: 18, fontFamily: "'Share Tech Mono',monospace" }}>{formatKES(product.comparePrice)}</span>}
          </div>
          <p style={{ color: '#A9C4BE', lineHeight: 1.6, margin: 0, fontFamily: "'Poppins', sans-serif" }}>{product.description}</p>
          {product.warranty !== 'No warranty' && <p style={{ fontSize: 13, color: '#6A8A82', margin: 0, fontFamily: "'Share Tech Mono',monospace" }}>🛡 Warranty: {product.warranty}</p>}
          {!product.isDigital && <p style={{ fontSize: 13, color: product.stock > 0 ? '#39FF88' : '#FF3B3B', margin: 0, fontWeight: 600, fontFamily: "'Share Tech Mono',monospace" }}>{product.stock > 0 ? `✓ ${product.stock} in stock` : '✗ Out of stock'}</p>}
          {!outOfStock && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(36,74,68,0.4)', borderRadius: 4, overflow: 'hidden', background: '#081916' }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ padding: '0.5rem 0.75rem', border: 'none', background: '#0F2620', color: '#A9C4BE', cursor: 'pointer', fontSize: 16 }}>−</button>
                <span style={{ padding: '0.5rem 1rem', fontWeight: 600, color: '#F4F1EA', fontFamily: "'Share Tech Mono',monospace" }}>{qty}</span>
                <button onClick={() => setQty(q => q + 1)} style={{ padding: '0.5rem 0.75rem', border: 'none', background: '#0F2620', color: '#A9C4BE', cursor: 'pointer', fontSize: 16 }}>+</button>
              </div>
              <button onClick={handleAdd} style={{ flex: 1, padding: '0.75rem', background: '#EE6100', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 15, fontFamily: "'Poppins', sans-serif", transition: 'all 0.2s ease' }}
                onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(238,97,0,0.3)'; }}
                onMouseOut={(e) => { e.currentTarget.style.boxShadow = 'none'; }}>
                Add to Cart
              </button>
            </div>
          )}
          {product.tags?.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {product.tags.map((t) => <span key={t} style={{ background: 'rgba(36,74,68,0.3)', color: '#A9C4BE', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontFamily: "'Share Tech Mono',monospace" }}>{t}</span>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
