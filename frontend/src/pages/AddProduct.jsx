// src/pages/AddProduct.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import '../styles/add-product.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const CATEGORY_OPTIONS = ['Console', 'Handheld', 'Games', 'Accessories', 'VR', 'Other'];

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
    price: '',
    stock: '',
    description: '',
    sku: '',
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

  const derivedStatus = useMemo(() => deriveStatus(formData.stock), [formData.stock]);

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
    if (!formData.price && formData.price !== 0) issues.push('Price is required.');
    if (formData.price < 0) issues.push('Price cannot be negative.');
    if (formData.stock === '' || formData.stock === null) issues.push('Stock is required.');
    if (formData.stock < 0) issues.push('Stock cannot be negative.');

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
      const payload = {
        name: formData.name,
        brand: formData.brand,
        category: formData.category,
        price: parseFloat(formData.price || 0),
        stock: parseInt(formData.stock || 0),
        status: derivedStatus,
        description: formData.description,
        sku: formData.sku || undefined,
        manufacturer: formData.manufacturer || undefined,
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
                    <label htmlFor="stock">Stock Quantity *</label>
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
