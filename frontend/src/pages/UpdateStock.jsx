import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';
import '../styles/updates.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

const computeStatus = (qty) => {
  const stock = Number(qty) || 0;
  if (stock <= 0) return 'No Stock';
  if (stock <= 5) return 'Low in Stock';
  return 'Available';
};

export default function UpdateStock() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  const token = localStorage.getItem('token');

  const [search, setSearch] = useState(() => {
    const stateQuery = location.state?.prefillName;
    return stateQuery || '';
  });
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [stock, setStock] = useState('');
  const [status, setStatus] = useState(computeStatus(0));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [saving, setSaving] = useState(false);

  const canUpdate = ['staff', 'manager', 'admin'].includes(role);

  useEffect(() => {
    setStatus(computeStatus(stock));
  }, [stock]);

  const handleSearch = async (term) => {
    setSearch(term);
    setMessage('');
    setError('');

    if (!term || term.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoadingSearch(true);
    try {
      const res = await fetch(`${API_BASE}/api/products/search?name=${encodeURIComponent(term.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        navigate('/', { replace: true });
        return;
      }
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Unable to search products.');
    } finally {
      setLoadingSearch(false);
    }
  };

  useEffect(() => {
    if (search && search.trim().length > 1) {
      handleSearch(search);
    }
    // We intentionally run this only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canUpdate) {
      setError('You are not allowed to update stock.');
      return;
    }
    if (!selected) {
      setError('Select a product first.');
      return;
    }
    const parsedStock = parseInt(stock, 10);
    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      setError('Stock must be a non-negative integer.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/products/${selected.id}/stock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stock: parsedStock }),
      });
      if (res.status === 401) {
        navigate('/', { replace: true });
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Failed to update stock.');
      }
      const updated = await res.json();
      setSelected(updated);
      setStock(updated.stock);
      setStatus(updated.status);
      setMessage('Stock updated and logged successfully.');
    } catch (err) {
      setError(err.message || 'Failed to update stock.');
    } finally {
      setSaving(false);
    }
  };

  const handlePick = (product) => {
    setSelected(product);
    setStock(product.stock ?? '');
    setStatus(computeStatus(product.stock));
    setMessage('');
    setError('');
  };

  return (
    <div className="app-container">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main className="app-content">
          <div className="update-card">
            <div className="update-card__header">
              <div>
                <p className="pill pill-warn">Stock only</p>
                <h1>Update Stock</h1>
                <p className="muted">Search by product name, pick an item, then set its stock. Action is logged.</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
              </div>
            </div>

            {!canUpdate && (
              <div className="error-box">
                You need to be staff, manager, or admin to adjust stock.
              </div>
            )}

            <div className="update-grid">
              <div className="update-panel">
                <label className="form-label">Search product name</label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Start typing a product name..."
                  className="form-input"
                  disabled={!canUpdate}
                />
                {loadingSearch && <p className="muted small">Searching...</p>}
                {results.length > 0 && (
                  <div className="search-results">
                    {results.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`search-row ${selected?.id === item.id ? 'active' : ''}`}
                        onClick={() => handlePick(item)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handlePick(item);
                          }
                        }}
                      >
                        <div>
                          <p className="search-title">{item.name}</p>
                          <p className="muted small">{item.brand || 'Unknown brand'} · {item.category || 'Uncategorized'}</p>
                        </div>
                        <span className="pill pill-neutral">{item.stock} in stock</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="update-panel">
                <form onSubmit={handleSubmit} className="stacked">
                  <div className="form-group">
                    <label className="form-label">Selected product</label>
                    <input
                      type="text"
                      value={selected ? selected.name : 'Pick a product from search'}
                      disabled
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">New stock quantity</label>
                    <input
                      type="number"
                      min="0"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      className="form-input"
                      disabled={!canUpdate}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Status (auto)</label>
                    <input type="text" value={status} className="form-input" disabled />
                  </div>

                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary" disabled={!canUpdate || saving}>
                      {saving ? 'Updating...' : 'Update Stock'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => navigate('/inventory')}>
                      Cancel
                    </button>
                  </div>

                  {message && <div className="success-box">{message}</div>}
                  {error && <div className="error-box">{error}</div>}
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
