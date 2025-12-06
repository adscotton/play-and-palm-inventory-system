// src/pages/EditProduct.jsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import '../styles/add-product.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const CATEGORY_OPTIONS = ['Console', 'Handheld', 'Games', 'Accessories', 'VR', 'Other'];
const STORAGE_UNITS = ['TB', 'GB', 'MB'];

function computeStatus(stock) {
  const qty = Number(stock) || 0;
  if (qty <= 0) return 'No Stock';
  if (qty <= 5) return 'Low in Stock';
  return 'Available';
}

function splitStorage(storage) {
  const match = /([\d.]+)\s*(TB|GB|MB)/i.exec(storage || '');
  if (!match) return { storageValue: '', storageUnit: 'GB' };
  return { storageValue: match[1], storageUnit: match[2].toUpperCase() };
}

export default function EditProduct() {
  const { id } = useParams();
  const navigate = useNavigate();
  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  const isStaff = role === 'staff';
  const isManagerOrAdmin = role === 'manager' || role === 'admin';
  const canEditAll = isManagerOrAdmin;
  const canEditStock = isStaff || isManagerOrAdmin;

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category: CATEGORY_OPTIONS[0],
    storageValue: '',
    storageUnit: 'GB',
    edition: '',
    price: '',
    stock: '',
    description: '',
    manufacturer: '',
    releaseDate: '',
    tags: '',
    image: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [existingVariants, setExistingVariants] = useState([]);

  const derivedStatus = useMemo(
    () => (formData.stock === '' ? '' : computeStatus(formData.stock)),
    [formData.stock]
  );

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/products/${id}`);
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        const parsedStorage = splitStorage(data.storage);
        setFormData({
          name: data.name || '',
          brand: data.brand || '',
          category: data.category || CATEGORY_OPTIONS[0],
          storageValue: parsedStorage.storageValue,
          storageUnit: parsedStorage.storageUnit,
          edition: data.edition || '',
          price: data.price ?? '',
          stock: data.stock ?? '',
          description: data.description || '',
          manufacturer: data.manufacturer || '',
          releaseDate: data.release_date || data.releaseDate || '',
          tags: Array.isArray(data.tags) ? data.tags.join(',') : (data.tags || ''),
          image: data.image || '',
        });
        setLoading(false);
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
          const variants = Array.isArray(data)
            ? data
                .filter((p) => String(p.id) !== String(id))
                .map((p) => {
                  const name = (p.name || '').trim().toLowerCase();
                  const edition = (p.edition || '').trim().toLowerCase();
                  return `${name}||${edition}`;
                })
            : [];
          setExistingVariants(variants);
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
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const token = localStorage.getItem('token');

    const issues = [];
    if (canEditAll) {
      if (!formData.name.trim()) issues.push('Product name is required.');
      if (!formData.brand.trim()) issues.push('Brand is required.');
    }

    if (canEditStock && formData.stock !== '') {
      const parsedStock = parseInt(formData.stock, 10);
      if (!Number.isFinite(parsedStock) || parsedStock < 0) issues.push('Stock must be 0 or greater.');
    }

    if (canEditAll && formData.price !== '') {
      const parsedPrice = parseFloat(formData.price);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) issues.push('Price must be 0 or greater.');
    }

    const normalizedName = (formData.name || '').trim().toLowerCase();
    const normalizedEdition = (formData.edition || '').trim().toLowerCase();
    const variantKey = `${normalizedName}||${normalizedEdition}`;
    if (canEditAll && existingVariants.includes(variantKey)) {
      issues.push('Product variant (name + edition) already exists.');
    }

    if (issues.length) {
      setSaving(false);
      setError(issues[0]);
      return;
    }

    const basePayload = {};

    if (canEditAll) {
      Object.assign(basePayload, {
        name: formData.name,
        brand: formData.brand,
        category: formData.category,
        price: formData.price === '' ? undefined : parseFloat(formData.price),
        description: formData.description,
        manufacturer: formData.manufacturer || undefined,
        releaseDate: formData.releaseDate || undefined,
        storage: formData.storageValue ? `${formData.storageValue}${formData.storageUnit}` : undefined,
        edition: formData.edition || undefined,
        tags: formData.tags ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        image: formData.image || undefined,
      });
    }

    if (canEditStock && formData.stock !== '') {
      const parsedStock = parseInt(formData.stock, 10);
      basePayload.stock = parsedStock;
      basePayload.status = computeStatus(parsedStock);
    }

    try {
      const res = await fetch(`${API_BASE}/api/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(basePayload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => null);
        let message = text || 'Failed to update product on backend';
        if (text) {
          try {
            const parsed = JSON.parse(text);
            message = parsed?.error || parsed?.message || message;
          } catch (_) {
            // keep default
          }
        }
        if (res.status === 409) {
          message = message || 'Product variant (name + edition) already exists.';
        }
        throw new Error(message);
      }

      const updated = await res.json();
      navigate(`/product/${updated.id}`);
    } catch (err) {
      setError(err.message || 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
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
  }

  return (
    <div className="app-container">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main className="app-content">
          <div className="add-product-container">
            <div className="add-product-card">
              <div className="add-product-title-row">
                <div>
                  <p className="eyebrow">Product</p>
                  <h1 className="add-product-title">Edit Product</h1>
                </div>
                <span className="pill pill-info subtle">ID #{id}</span>
              </div>

              {error && <div className={error ? 'error-message' : 'info-banner'}>{error}</div>}

              {!canEditAll && (
                <div className="info-banner">
                  You can only adjust stock. Ask a manager/admin to change other details.
                </div>
              )}

              <form onSubmit={handleSubmit} className="add-product-form">
                <div className="form-group">
                  <label htmlFor="name">Product Name *</label>
                  <input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="form-input"
                    disabled={!canEditAll}
                    placeholder="e.g., PlayStation 5 Disc"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="brand">Brand *</label>
                  <input
                    id="brand"
                    name="brand"
                    value={formData.brand}
                    onChange={handleChange}
                    className="form-input"
                    disabled={!canEditAll}
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
                      disabled={!canEditAll}
                    >
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="price">Price (₱)</label>
                    <input
                      id="price"
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={handleChange}
                      className="form-input"
                      disabled={!canEditAll}
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
                        disabled={!canEditAll}
                      />
                      <select
                        name="storageUnit"
                        value={formData.storageUnit}
                        onChange={handleChange}
                        className="form-input storage-unit"
                        disabled={!canEditAll}
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
                      value={formData.edition}
                      onChange={handleChange}
                      className="form-input"
                      disabled={!canEditAll}
                      placeholder="e.g., Midnight Black"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="manufacturer">Manufacturer</label>
                    <input
                      id="manufacturer"
                      name="manufacturer"
                      value={formData.manufacturer}
                      onChange={handleChange}
                      className="form-input"
                      disabled={!canEditAll}
                      placeholder="e.g., Sony Interactive Entertainment"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="releaseDate">Release Date</label>
                    <input
                      id="releaseDate"
                      name="releaseDate"
                      type="date"
                      value={formData.releaseDate}
                      onChange={handleChange}
                      className="form-input"
                      disabled={!canEditAll}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="stock">Stock Quantity</label>
                    <input
                      id="stock"
                      name="stock"
                      type="number"
                      min="0"
                      value={formData.stock}
                      onChange={handleChange}
                      className="form-input"
                      disabled={!canEditStock}
                      placeholder="Leave blank to keep current"
                    />
                  </div>

                  <div className="form-field">
                    <label>Status (auto)</label>
                    <input
                      type="text"
                      value={derivedStatus || 'Auto'}
                      className="form-input"
                      disabled
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="tags">Tags (comma separated)</label>
                  <input
                    id="tags"
                    name="tags"
                    value={formData.tags}
                    onChange={handleChange}
                    className="form-input"
                    disabled={!canEditAll}
                    placeholder="console, ps5, bundle"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="image">Image URL</label>
                  <input
                    id="image"
                    name="image"
                    value={formData.image}
                    onChange={handleChange}
                    className="form-input"
                    disabled={!canEditAll}
                    placeholder="https://..."
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
                    rows="4"
                    disabled={!canEditAll}
                    placeholder="Product description..."
                  />
                </div>

                <div className="form-actions">
                  <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving || (!canEditAll && formData.stock === '')}>
                    {saving ? 'Saving...' : 'Save Changes'}
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
