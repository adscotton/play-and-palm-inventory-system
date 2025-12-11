// src/pages/CreateUser.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';
import '../styles/add-product.css';
import '../styles/account.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const ROLE_OPTIONS = ['admin', 'manager', 'staff'];

export default function CreateUser() {
  const navigate = useNavigate();
  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'staff',
    contactNumber: '',
    location: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (role !== 'admin') {
      setError('Only admins can create users.');
    }
  }, [role]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const issues = [];
    if (!form.username.trim()) issues.push('Username is required.');
    if (!form.email.trim()) issues.push('Email is required.');
    if (!form.password.trim()) issues.push('Password is required.');
    if (issues.length) {
      setError(issues[0]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => null);
        throw new Error(text || 'Failed to create user');
      }
      await res.json();
      navigate('/account');
    } catch (err) {
      setError(err.message || 'Failed to create user');
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
            <div className="account-main">
              <h1 className="account-title">Create User</h1>
              {error && <div className="form-error">{error}</div>}
              <form onSubmit={handleSubmit} className="account-form">
                <div className="form-row">
                  <div className="form-field">
                    <label>Username*</label>
                    <input name="username" value={form.username} onChange={handleChange} className="form-input" />
                  </div>
                  <div className="form-field">
                    <label>Email*</label>
                    <input name="email" type="email" value={form.email} onChange={handleChange} className="form-input" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label>Password*</label>
                    <input name="password" type="password" value={form.password} onChange={handleChange} className="form-input" />
                  </div>
                  <div className="form-field">
                    <label>Role*</label>
                    <select name="role" value={form.role} onChange={handleChange} className="form-input">
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label>First Name*</label>
                    <input name="firstName" value={form.firstName} onChange={handleChange} className="form-input" />
                  </div>
                  <div className="form-field">
                    <label>Last Name*</label>
                    <input name="lastName" value={form.lastName} onChange={handleChange} className="form-input" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label>Contact*</label>
                    <input name="contactNumber" value={form.contactNumber} onChange={handleChange} className="form-input" />
                  </div>
                  <div className="form-field">
                    <label>Location*</label>
                    <input name="location" value={form.location} onChange={handleChange} className="form-input" />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading || role !== 'admin'}>
                    {loading ? 'Creating...' : 'Create User'}
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
