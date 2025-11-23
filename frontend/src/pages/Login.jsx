// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/login.css';

const MOCK_CREDENTIALS = [
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'staff', password: 'staff123', role: 'staff' },
];

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
      // Try backend authentication
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data = await res.json();
        // store token and user info
        localStorage.setItem('token', data.token);
        localStorage.setItem('userRole', data.user.role);
        localStorage.setItem('username', data.user.username);
        navigate('/dashboard');
        return;
      }

      // If backend returns 4xx/5xx, fall through to fallback
    } catch (err) {
      // backend not reachable - fallback to local mock credentials
    }

    // Fallback: validate against demo credentials and create a mock token
    const user = MOCK_CREDENTIALS.find(
      (cred) => cred.username === username && cred.password === password
    );

    if (user) {
      // Create a simple mock token (not secure) so other pages can read that user is logged in
      const mockToken = btoa(JSON.stringify({ username: user.username, role: user.role, iat: Date.now() }));
      localStorage.setItem('token', mockToken);
      localStorage.setItem('userRole', user.role);
      localStorage.setItem('username', user.username);
      navigate('/dashboard');
    } else {
      setError('Invalid username or password.');
    }

    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">🔐 Play & Palm IMS</h1>
          <p className="login-subtitle">Inventory Management System</p>
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
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary login-button"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="login-credentials">
          <p className="credentials-title">Demo Credentials:</p>
          <div className="credential-item">
            <span>Admin:</span> <strong>admin / admin123</strong>
          </div>
          <div className="credential-item">
            <span>Staff:</span> <strong>staff / staff123</strong>
          </div>
        </div>
      </div>
    </div>
  );
}