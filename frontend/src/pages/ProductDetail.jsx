// src/pages/ProductDetail.jsx
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Header from '../components/Header.jsx';
import Sidebar from '../components/Sidebar.jsx';
import '../styles/product-detail.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  const isAdminOrManager = role === 'admin' || role === 'manager';
  const isStaff = role === 'staff';

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        // Fetch from backend
        const response = await fetch(`${API_BASE}/api/products/${id}`);
        if (!response.ok) {
          setProduct(null);
          return;
        }
        const data = await response.json();
        setProduct(data);
      } catch (err) {
        console.error('Failed to load product', err);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const getStatusBadge = (status) => {
    const statusMap = {
      'Available': 'status-available',
      'Low in Stock': 'status-low',
      'No Stock': 'status-out',
    };
    return statusMap[status] || '';
  };

  if (loading) {
    return (
      <div className="app-container">
        <Sidebar />
        <div className="app-main">
          <Header />
          <main className="app-content">
            <div className="product-error">
              <h2>Loading...</h2>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="app-container">
        <Sidebar />
        <div className="app-main">
          <Header />
          <main className="app-content">
            <div className="product-error">
              <h2>Product Not Found</h2>
              <button onClick={() => navigate('/inventory')} className="btn btn-primary">
                Back to Inventory
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main className="app-content">
          <button onClick={() => navigate('/inventory')} className="product-back-button">
            Back to Inventory
          </button>

          <div className="product-detail-card">
            <div className="product-header">
              <h1 className="product-title">{product.name}</h1>
              <span className={`status-badge ${getStatusBadge(product.status)}`}>
                {product.status}
              </span>
            </div>

            <div className="product-grid">
              <div className="product-info-section">
                <div className="product-info-group">
                  <label className="product-label">Brand</label>
                  <p className="product-value">{product.brand}</p>
                </div>

                <div className="product-info-group">
                  <label className="product-label">Category</label>
                  <p className="product-value">{product.category || 'N/A'}</p>
                </div>

                <div className="product-info-group">
                  <label className="product-label">Price (₱)</label>
                  <p className="product-value">₱{Number.isFinite(Number(product.price)) ? Number(product.price).toFixed(2) : 'N/A'}</p>
                </div>

                <div className="product-info-group">
                  <label className="product-label">Stock Available</label>
                  <p className="product-value">{product.stock ?? '0'} units</p>
                </div>

                <div className="product-info-group">
                  <label className="product-label">Storage</label>
                  <p className="product-value">{product.storage || 'N/A'}</p>
                </div>

                <div className="product-info-group">
                  <label className="product-label">Edition / Color</label>
                  <p className="product-value">{product.edition || 'N/A'}</p>
                </div>

                <div className="product-info-group">
                  <label className="product-label">Manufacturer</label>
                  <p className="product-value">{product.manufacturer || 'N/A'}</p>
                </div>

                <div className="product-info-group">
                  <label className="product-label">Release Date</label>
                  <p className="product-value">{product.release_date || product.releaseDate || 'N/A'}</p>
                </div>

                <div className="product-info-group">
                  <label className="product-label">Tags</label>
                  {Array.isArray(product.tags) && product.tags.length ? (
                    <div className="tag-list">
                      {product.tags.map((tag) => (
                        <span key={tag} className="tag-pill">{tag}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="product-value">{product.tags || 'None'}</p>
                  )}
                </div>

                <div className="product-info-group">
                  <label className="product-label">Description</label>
                  <p className="product-value">{product.description || 'No description available'}</p>
                </div>
              </div>

              <div className="product-actions">
                {isAdminOrManager && (
                  <>
                    <button onClick={() => navigate(`/product/${product.id}/edit`)} className="btn btn-secondary">Edit Details</button>
                    <button onClick={() => navigate('/updates', { state: { prefillName: product.name, tab: 'stock' } })} className="btn btn-secondary">Update Stock</button>
                    <button onClick={() => navigate('/updates', { state: { prefillName: product.name, tab: 'reduce' } })} className="btn btn-secondary">Reduce Stock</button>
                    <button onClick={() => navigate('/updates', { state: { prefillName: product.name, tab: 'price' } })} className="btn btn-secondary">Update Price</button>
                    <button className="btn btn-danger" onClick={async () => {
                      if (!confirm('Delete this product?')) return;
                      try {
                        const token = localStorage.getItem('token');
                        const res = await fetch(`${API_BASE}/api/products/${product.id}`, {
                          method: 'DELETE',
                          headers: {
                            ...(token ? { Authorization: `Bearer ${token}` } : {})
                          }
                        });
                        if (!res.ok) throw new Error('Failed to delete');
                        await res.json();
                        navigate('/inventory');
                      } catch (err) {
                        console.error('Delete failed', err);
                        alert('Failed to delete product. See console for details.');
                      }
                    }}>Delete</button>
                  </>
                )}
                {isStaff && (
                  <button onClick={() => navigate('/updates', { state: { prefillName: product.name, tab: 'stock' } })} className="btn btn-secondary">
                    Update Stock
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

                        
