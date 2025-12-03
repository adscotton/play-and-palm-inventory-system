// src/pages/AddProduct.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import '../styles/add-product.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const CATEGORY_OPTIONS = ['Console', 'Handheld', 'Games', 'Accessories', 'VR', 'Other'];
const STORAGE_UNITS = ['TB', 'GB', 'MB'];

function deriveStatus(stock) {
  const qty = Number(stock) || 0;
  if (qty <= 0) return 'No Stock';
  if (qty <= 5) return 'Low in Stock';
  return 'Available';
}

export default function AddProduct() {
  const navigate = useNavigate();
  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  const isStaff = role === 'staff';
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category: CATEGORY_OPTIONS[0],
    storageValue: '',
    storageUnit: 'GB',
    price: '',
    stock: '',
    description: '',
    manufacturer: '',
    releaseDate: '',
    tags: '',
    image: '',
  });
  const [existingNames, setExistingNames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/products`)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        const names = Array.isArray(data) ? data.map((p) => (p.name || '').trim().toLowerCase()) : [];
        setExistingNames(names);
      })
      .catch(() => {});
  }, []);

  const derivedStatus = useMemo(
    () => (formData.stock === '' ? 'Auto' : deriveStatus(formData.stock)),
    [formData.stock]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const issues = [];
    if (!formData.name.trim()) issues.push('Product name is required.');
    if (!formData.brand.trim()) issues.push('Brand is required.');

    const parsedPrice = parseFloat(formData.price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      issues.push('Price must be a non-negative number.');
    }

    const parsedStock = formData.stock === '' ? null : parseInt(formData.stock, 10);
    if (parsedStock !== null && (!Number.isFinite(parsedStock) || parsedStock < 0)) {
      issues.push('Stock must be 0 or greater.');
    }

    const normalized = (formData.name || '').trim().toLowerCase();
    if (existingNames.includes(normalized)) {
      issues.push('Product name already exists.');
    }

    if (issues.length) {
      setError(issues[0]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const computedStatus = deriveStatus(parsedStock ?? 0);
      const payload = {
        name: formData.name,
        brand: formData.brand,
        category: formData.category,
        price: parsedPrice,
        stock: parsedStock === null ? undefined : parsedStock,
        status: computedStatus,
        description: formData.description,
        manufacturer: formData.manufacturer || undefined,
        edition: formData.edition || undefined,
        storage: formData.storageValue ? `${formData.storageValue}${formData.storageUnit}` : undefined,
        releaseDate: formData.releaseDate || undefined,
        tags: formData.tags || undefined,
        image: formData.image || undefined,
      };

      const res = await fetch(`${API_BASE}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => null);
        throw new Error(text || 'Failed to create product on backend');
      }

      const created = await res.json();
      navigate(`/product/${created.id}`);
    } catch (err) {
      setError(err.message || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main className="app-content">
          <div className="add-product-container">
            <div className="add-product-card">
              <h1 className="add-product-title">Add New Product</h1>
              <p className="add-product-subtitle">Capture consistent details so pricing, stock, and product data stay synchronized.</p>
              <div className="info-banner">
                <span className="pill pill-info">Tip</span>
                <span>Fields marked * are required. Status updates automatically from stock quantity.</span>
              </div>

              {isStaff && (
                <div className="error-message">
                  Staff can only update stock from product detail. Please contact a manager/admin to add products.
                </div>
              )}

              {error && <div className="error-message">{error}</div>}

              <form onSubmit={handleSubmit} className="add-product-form">
                <div className="form-group">
                  <label htmlFor="name">Product Name *</label>
                  <input
                    id="name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="e.g., PlayStation 5"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="brand">Brand *</label>
                  <input
                    id="brand"
                    type="text"
                    name="brand"
                    value={formData.brand}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="e.g., Sony"
                  />
                </div>

                <div className="form-row">
                <div className="form-field">
                  <label htmlFor="category">Category *</label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="form-input"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                  <div className="form-field">
                    <label htmlFor="price">Price ($) *</label>
                    <input
                      id="price"
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      className="form-input"
                    step="0.01"
                    placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="storage">Storage</label>
                    <div className="storage-inputs">
                      <input
                        id="storage"
                        type="number"
                        name="storageValue"
                        value={formData.storageValue}
                        onChange={handleChange}
                        className="form-input"
                        placeholder="e.g., 1"
                        min="0"
                        step="0.01"
                      />
                      <select
                        name="storageUnit"
                        value={formData.storageUnit}
                        onChange={handleChange}
                        className="form-input storage-unit"
                      >
                        {STORAGE_UNITS.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="edition">Edition / Color</label>
                    <input
                      id="edition"
                      type="text"
                      name="edition"
                      value={formData.edition || ''}
                      onChange={handleChange}
                      className="form-input"
                      placeholder="e.g., Midnight Black"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="manufacturer">Manufacturer</label>
                    <input
                      id="manufacturer"
                      type="text"
                      name="manufacturer"
                      value={formData.manufacturer}
                      onChange={handleChange}
                      className="form-input"
                      placeholder="e.g., Sony Interactive Entertainment"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="releaseDate">Release Date</label>
                    <input
                      id="releaseDate"
                      type="date"
                      name="releaseDate"
                      value={formData.releaseDate}
                      onChange={handleChange}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="stock">Stock Quantity</label>
                    <input
                      id="stock"
                      type="number"
                      name="stock"
                      value={formData.stock}
                      onChange={handleChange}
                      className="form-input"
                      min="0"
                      placeholder="0"
                    />
                  </div>

                  <div className="form-field">
                    <label>Status (auto)</label>
                    <input
                      type="text"
                      value={derivedStatus}
                      className="form-input"
                      disabled
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="tags">Tags (comma-separated)</label>
                  <input
                    id="tags"
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="console, ps5, bundle"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Product description..."
                    rows="4"
                  />
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    onClick={() => navigate('/inventory')}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading || isStaff}
                  >
                    {loading ? 'Adding...' : 'Add Product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
