// src/pages/UpdateAdjust.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';
import '../styles/updates.css';

// Prefer explicit backend base; fall back to current origin so calls never become invalid URLs
const API_BASE = ((import.meta.env.VITE_API_BASE || '').trim() || window.location.origin).replace(/\/$/, '');

// === Shared Utilities ===
const STORAGE_PILL = (item) => (
  <span className="pill pill-neutral">{Number(item.stock ?? 0)} in stock</span>
);

const PRICE_PILL = (item) => (
  <span className="pill pill-neutral">{formatPrice(item.price)}</span>
);

const formatPrice = (val) => {
  const num = Number(val);
  if (!Number.isFinite(num)) return 'N/A';
  return `₱${num.toFixed(2)}`;
};

const computeStatus = (qty) => {
  const stock = Number(qty) || 0;
  if (stock <= 0) return 'No Stock';
  if (stock <= 5) return 'Low in Stock';
  return 'Available';
};

// === Reusable Product Search Component ===
function ProductSearch({ token, onPick, initialSearch = '', disabled, setError }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState(initialSearch);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(
    async (term) => {
      setSearch(term);
      setError('');

      if (!term || term.trim().length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
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
      } catch (_) {
        setError('Unable to search products.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [token, navigate, setError]
  );

  useEffect(() => {
    if (initialSearch?.trim().length > 1) {
      handleSearch(initialSearch);
    }
  }, [initialSearch, handleSearch]);

  return (
    <div className="update-panel">
      <label className="form-label">Search product name</label>
      <input
        type="text"
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Start typing a product name..."
        className="form-input"
        disabled={disabled}
        aria-label="Search product by name"
      />
      {loading && <p className="muted small">Searching...</p>}
      {results.length > 0 && (
        <div className="search-results" role="listbox">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              className="search-row"
              onClick={() => onPick(item)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPick(item);
                }
              }}
              role="option"
              aria-selected={false}
            >
              <div>
                <p className="search-title">{item.name}</p>
                <p className="muted small">
                  {item.brand || 'Unknown brand'} • {item.category || 'Uncategorized'}
                </p>
                <p className="muted tiny">
                  {item.edition ? `Edition: ${item.edition}` : 'Edition: Standard'} • {item.storage || 'Storage: N/A'}
                </p>
              </div>
              <div className="search-meta">
                {PRICE_PILL(item)}
                {STORAGE_PILL(item)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// === Generic Update Form ===
function UpdateForm({
  mode, // 'add', 'reduce', 'price'
  selected,
  value,
  onChange,
  onSubmit,
  saving,
  message,
  error,
  canUpdate,
  role,
}) {
  const navigate = useNavigate();

  const isStockMode = mode === 'add' || mode === 'reduce';
  const isPriceMode = mode === 'price';

  const currentStock = selected ? Number(selected.stock) || 0 : 0;
  const delta = Number(value) || 0;
  const previewStock =
    isStockMode && selected
      ? mode === 'add'
        ? currentStock + delta
        : Math.max(0, currentStock - delta)
      : null;
  const previewStatus = previewStock !== null ? computeStatus(previewStock) : '';

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  let label, placeholder, helperText;
  if (mode === 'add') {
    label = 'Add quantity to stock';
    placeholder = 'e.g., 5';
    helperText = selected && (
      <p className="muted small">
        Current: {currentStock} • New total: {previewStock} ({previewStatus})
      </p>
    );
  } else if (mode === 'reduce') {
    label = 'Reduce quantity (sold)';
    placeholder = 'e.g., 2';
    helperText = selected && (
      <p className="muted small">
        Current: {currentStock} • New total: {previewStock} ({previewStatus})
      </p>
    );
  } else if (mode === 'price') {
    label = 'New price (PHP)';
    placeholder = 'e.g., 29.99';
    helperText = null;
  }

  return (
    <div className="update-panel">
      <form onSubmit={handleSubmit} className="stacked">
        <div className="form-group">
          <label className="form-label">Selected product</label>
          <input
            type="text"
            value={selected ? selected.name : 'Pick a product from search'}
            disabled
            className="form-input"
            aria-readonly="true"
          />
        </div>

        <div className="form-group">
          <label className="form-label">{label}</label>
          <input
            type={isPriceMode ? 'number' : 'number'}
            min={isPriceMode ? '0' : '1'}
            step={isPriceMode ? '0.01' : '1'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="form-input"
            disabled={!canUpdate}
            placeholder={placeholder}
            aria-describedby={error ? 'update-error' : undefined}
          />
          {helperText}
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!canUpdate || saving || !selected}
            aria-busy={saving}
          >
            {saving ? 'Updating...' : isPriceMode ? 'Update Price' : mode === 'add' ? 'Add Stock' : 'Reduce Stock'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/inventory')}
          >
            Cancel
          </button>
        </div>

        {message && <div className="success-box" role="alert">{message}</div>}
        {error && (
          <div id="update-error" className="error-box" role="alert">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}

// === Controlled Tab Logic ===
function UpdateAdjust({ defaultTab = 'stock', initialSearch = '' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  const token = localStorage.getItem('token');

  const requestedTab = location.state?.tab || defaultTab;
  const prefillSearch = location.state?.prefillName || initialSearch;

  const canStock = ['staff', 'manager', 'admin'].includes(role);
  const canPrice = role === 'admin' || role === 'manager';

  const firstAllowedTab = useMemo(() => {
    if (canStock) return 'stock';
    if (canPrice) return 'price';
    return 'stock';
  }, [canStock, canPrice]);

  const [activeTab, setActiveTab] = useState(requestedTab);
  const [selected, setSelected] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Redirect to allowed tab if current one is forbidden
  useEffect(() => {
    if (
      (activeTab === 'stock' || activeTab === 'reduce') && !canStock ||
      activeTab === 'price' && !canPrice
    ) {
      setActiveTab(firstAllowedTab);
    }
  }, [activeTab, canStock, canPrice, firstAllowedTab]);

  const handleSubmit = useCallback(async () => {
    if (!token || !selected) return;

    let parsedValue;
    if (activeTab === 'price') {
      parsedValue = parseFloat(inputValue);
      if (!Number.isFinite(parsedValue) || parsedValue < 0) {
        setError('Price must be a non-negative number.');
        return;
      }
    } else {
      parsedValue = parseInt(inputValue, 10);
      if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        setError(`${activeTab === 'stock' ? 'Add' : 'Reduce'} quantity must be a positive integer.`);
        return;
      }
    }

    const endpointMap = {
      stock: `/api/products/${selected.id}/stock`,
      reduce: `/api/products/${selected.id}/stock/reduce`,
      price: `/api/products/${selected.id}/price`,
    };

    const bodyMap = {
      stock: { delta: parsedValue },
      reduce: { delta: parsedValue },
      price: { price: parsedValue },
    };

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}${endpointMap[activeTab]}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bodyMap[activeTab]),
      });

      if (res.status === 401) {
        navigate('/', { replace: true });
        return;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Operation failed.');
      }

      const updated = await res.json();
      setSelected(updated);
      setInputValue(activeTab === 'price' ? updated.price : '');
      setMessage(
        activeTab === 'price'
          ? 'Price updated and logged successfully.'
          : activeTab === 'stock'
            ? 'Stock added and logged successfully.'
            : 'Stock reduced and logged successfully.'
      );
    } catch (err) {
      setError(err.message || 'Failed to complete action.');
    } finally {
      setSaving(false);
    }
  }, [activeTab, inputValue, selected, token, navigate]);

  const handlePick = (product) => {
    setSelected(product);
    setInputValue(activeTab === 'price' ? product.price ?? '' : '');
    setMessage('');
    setError('');
  };

  const tabs = [
    { id: 'stock', label: 'Add Stock', enabled: canStock, helper: 'Receive units into inventory.' },
    { id: 'reduce', label: 'Reduce Stock', enabled: canStock, helper: 'Reduce units when sold.' },
    { id: 'price', label: 'Update Price', enabled: canPrice, helper: 'Change selling prices (manager/admin).' },
  ];

  const modeMap = { stock: 'add', reduce: 'reduce', price: 'price' };

  return (
    <div className="app-container">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main className="app-content updates-content">
          <div className="update-card">
            <div className="update-card__header">
              <div>
                <p className="pill pill-info">Inventory controls</p>
                <h1>Update Stock &amp; Price</h1>
                <p className="muted">Use tabs to add or reduce stock, or change price. Actions are logged.</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
                  Back to Dashboard
                </button>
              </div>
            </div>

            <div className="update-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`update-tab ${tab.id} ${activeTab === tab.id ? 'active' : ''} ${
                    !tab.enabled ? 'disabled' : ''
                  }`}
                  onClick={() => tab.enabled && setActiveTab(tab.id)}
                  disabled={!tab.enabled}
                  aria-selected={activeTab === tab.id}
                >
                  <span>{tab.label}</span>
                  <small>{tab.helper}</small>
                </button>
              ))}
            </div>

            {(!canStock && !canPrice) && (
              <div className="error-box" role="alert">
                You do not have permission to update stock or price.
              </div>
            )}

            {canStock || canPrice ? (
              <div className="update-grid">
                <ProductSearch
                  token={token}
                  onPick={handlePick}
                  initialSearch={prefillSearch}
                  disabled={!canStock && !canPrice}
                  setError={setError}
                />
                <UpdateForm
                  mode={modeMap[activeTab]}
                  selected={selected}
                  value={inputValue}
                  onChange={setInputValue}
                  onSubmit={handleSubmit}
                  saving={saving}
                  message={message}
                  error={error}
                  canUpdate={activeTab === 'price' ? canPrice : canStock}
                  role={role}
                />
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

export default UpdateAdjust;
