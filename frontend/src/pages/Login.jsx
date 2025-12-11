// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/login.css';
import logo from '../utils/logo.png';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data = await res.json();
        if (!data?.token || !data?.user) {
          throw new Error('Login response was missing data.');
        }
        const role = data.user.role || 'staff';
        localStorage.setItem('token', data.token);
        localStorage.setItem('userRole', role);
        localStorage.setItem('username', data.user.username || username);
        navigate('/dashboard');
      } else if (res.status === 401) {
        setError('Invalid username or password.');
      } else {
        const text = await res.text().catch(() => '');
        let message = 'Login failed. Please try again.';
        if (text) {
          try {
            const parsed = JSON.parse(text);
            message = parsed?.error || parsed?.message || message;
          } catch (_) {
            message = text;
          }
        }
        setError(message);
      }
    } catch (err) {
      setError(err?.message || 'Unable to reach server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-hero">
        <div className="hero-brand">
          <div className="hero-logo-placeholder">
            <img src={logo} alt="Play & Palm logo" className="hero-logo-img" />
          </div>
          <div>
            <h1 className="hero-title">Play &amp; Palm IMS</h1>
            <p className="hero-subtitle">Inventory Management System</p>
          </div>
        </div>
        <p className="hero-copy">
          Track every console with precise storage, edition, and color details. Built for real retail operations.
        </p>
      </div>

      <div className="login-card login-card-right">
        <div className="login-welcome">Welcome</div>
        <div className="login-header">
          <h2 className="login-title">Welcome back</h2>
          <p className="login-subtitle">Sign in to manage inventory</p>
        </div>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username" className="form-label">Username</label>
            <input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="form-input"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <div className="password-input-wrapper" style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                disabled={loading}
                style={{ paddingRight: '80px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle-btn"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <span aria-hidden="true" className="eye-icon">
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94a10.07 10.07 0 0 1-5.94 2.06C4.55 20 1 12 1 12a17.78 17.78 0 0 1 4.21-5.57m3.09-2A9.44 9.44 0 0 1 12 4c6.45 0 10 8 10 8a18.09 18.09 0 0 1-2.15 3.41" />
                      <path d="M9.9 9.9a3 3 0 1 1 4.2 4.2" />
                      <path d="m1 1 22 22" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary login-button"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
