// src/pages/EditProduct.jsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

export default function EditProduct() {
  const { id } = useParams();
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
    tags: [],
    image: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [existingNames, setExistingNames] = useState([]);

  const derivedStatus = useMemo(() => deriveStatus(formData.stock), [formData.stock]);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/products/${id}`);
        if (res.ok) {
          const data = await res.json();
          setFormData({
            name: data.name || '',
            brand: data.brand || '',
            category: data.category || CATEGORY_OPTIONS[0],
            price: data.price || '',
            stock: data.stock || '',
            description: data.description || '',
            sku: data.sku || '',
            manufacturer: data.manufacturer || '',
            releaseDate: data.release_date || data.releaseDate || '',
            tags: data.tags || [],
            image: data.image || '',
          });
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Failed to load product for edit', err);
        setLoading(false);
      }
    };

    const fetchNames = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/products`);
        if (res.ok) {
          const data = await res.json();
          const names = Array.isArray(data)
            ? data.filter((p) => String(p.id) !== String(id)).map((p) => (p.name || '').trim().toLowerCase())
            : [];
          setExistingNames(names);
        }
      } catch (err) {
        console.error('Failed to load names', err);
      }
    };

    fetchProduct();
    fetchNames();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const token = localStorage.getItem('token');

    const issues = [];
    if (!formData.name.trim()) issues.push('Product name is required.');
    if (!formData.brand.trim()) issues.push('Brand is required.');
    if (formData.price === '' || formData.price === null) issues.push('Price is required.');
    if (formData.price < 0) issues.push('Price cannot be negative.');
    if (formData.stock === '' || formData.stock === null) issues.push('Stock is required.');
    if (formData.stock < 0) issues.push('Stock cannot be negative.');

    const normalized = (formData.name || '').trim().toLowerCase();
    if (!isStaff && existingNames.includes(normalized)) {
      issues.push('Product name already exists.');
    }

    if (issues.length) {
      setSaving(false);
      setError(issues[0]);
      return;
    }

    const basePayload = {
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
      tags: Array.isArray(formData.tags) ? formData.tags : (formData.tags ? [formData.tags] : []),
      image: formData.image || undefined,
    };

    // Staff can only adjust stock (status auto derived)
    const payload = isStaff
      ? { stock: basePayload.stock, status: derivedStatus }
      : basePayload;

    try {
      const res = await fetch(`${API_BASE}/api/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => null);
        throw new Error(text || 'Failed to update product on backend');
      }

      const updated = await res.json();
      navigate(`/product/${updated.id}`);
    } catch (err) {
      setError(err.message || 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="app-container">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main className="app-content">
          <p>Loading product...</p>
        </main>
      </div>
    </div>
  );

  return (
    <div className="app-container">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main className="app-content">
          <div className="add-product-container">
            <div className="add-product-card">
              <h1 className="add-product-title">Edit Product</h1>

              {error && <div className="error-message">{error}</div>}

              <form onSubmit={handleSubmit} className="add-product-form">
                <div className="form-group">
                  <label htmlFor="name">Product Name *</label>
                  <input id="name" name="name" value={formData.name} onChange={handleChange} className="form-input" disabled={isStaff} />
                </div>

                <div className="form-group">
                  <label htmlFor="brand">Brand *</label>
                  <input id="brand" name="brand" value={formData.brand} onChange={handleChange} className="form-input" disabled={isStaff} />
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="category">Category *</label>
                    <select id="category" name="category" value={formData.category} onChange={handleChange} className="form-input" disabled={isStaff}>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="price">Price ($) *</label>
                    <input id="price" name="price" type="number" step="0.01" value={formData.price} onChange={handleChange} className="form-input" disabled={isStaff} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="stock">Stock Quantity *</label>
                    <input id="stock" name="stock" type="number" min="0" value={formData.stock} onChange={handleChange} className="form-input" />
                  </div>

                  <div className="form-field">
                    <label>Status (auto)</label>
                    <input type="text" value={derivedStatus} className="form-input" disabled />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea id="description" name="description" value={formData.description} onChange={handleChange} className="form-input" rows="4" disabled={isStaff} />
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="sku">SKU</label>
                    <input id="sku" name="sku" value={formData.sku} onChange={handleChange} className="form-input" disabled={isStaff} />
                  </div>

                  <div className="form-field">
                    <label htmlFor="manufacturer">Manufacturer</label>
                    <input id="manufacturer" name="manufacturer" value={formData.manufacturer} onChange={handleChange} className="form-input" disabled={isStaff} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="releaseDate">Release Date</label>
                    <input id="releaseDate" name="releaseDate" type="date" value={formData.releaseDate} onChange={handleChange} className="form-input" disabled={isStaff} />
                  </div>

                  <div className="form-field">
                    <label htmlFor="tags">Tags (comma separated)</label>
                    <input id="tags" name="tags" value={Array.isArray(formData.tags) ? formData.tags.join(',') : formData.tags} onChange={(e) => setFormData((p) => ({ ...p, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} className="form-input" disabled={isStaff} />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
