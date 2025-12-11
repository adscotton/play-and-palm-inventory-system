// src/pages/Account.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/account.css';
import Sidebar from '../components/Sidebar.jsx';
import Header from '../components/Header.jsx';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export default function Account() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const normalizeUser = (data) => ({
    id: data.id,
    username: data.username,
    email: data.email,
    role: data.role || 'staff',
    firstName: data.first_name || data.firstName || '',
    lastName: data.last_name || data.lastName || '',
    contactNumber: data.contact_number || data.contactNumber || '',
    location: data.location || '',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const userRole = localStorage.getItem('userRole') || 'staff';

    if (!token) {
      if (username) {
        setUser(
          normalizeUser({
            id: 1,
            username,
            email: `${username}@play-palm.local`,
            role: userRole,
            first_name: username.charAt(0).toUpperCase() + username.slice(1),
            last_name: 'User',
            contact_number: '',
            location: '',
          })
        );
        setLoading(false);
        return;
      }
      setError('You must be logged in to view this page.');
      setLoading(false);
      setTimeout(() => navigate('/'), 1000);
      return;
    }

    fetch(`${API_BASE}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw res;
        return res.json();
      })
      .then((data) => setUser(normalizeUser(data)))
      .then(() => {})
      .catch(async (err) => {
        if (username) {
          setUser(
            normalizeUser({
              id: 1,
              username,
              email: `${username}@play-palm.local`,
              role: userRole,
              first_name: username.charAt(0).toUpperCase() + username.slice(1),
              last_name: 'User',
              contact_number: '',
              location: '',
            })
          );
          setError('Unable to reach backend - loaded local profile.');
        } else {
          try {
            const json = await err.json();
            setError(json?.error || 'Session expired. Please log in again.');
          } catch (_) {
            setError('Session expired. Please log in again.');
          }
          localStorage.removeItem('token');
          localStorage.removeItem('userRole');
          localStorage.removeItem('username');
          setTimeout(() => navigate('/'), 1500);
        }
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUser((u) => ({ ...u, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editMode) return;
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    setError('');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE}/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: user.firstName,
          lastName: user.lastName,
          first_name: user.firstName,
          last_name: user.lastName,
          username: user.username,
          email: user.email,
          role: user.role,
          contactNumber: user.contactNumber,
          contact_number: user.contactNumber,
          location: user.location,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error || 'Failed to save changes.');
      }

      const updated = await res.json();
      setUser(normalizeUser(updated));
      setEditMode(false);
      setConfirmOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="app-container">
        <Sidebar isMobileMenuOpen={isMobileMenuOpen} toggleMobileMenu={toggleMobileMenu} />
        <div className="app-main">
          <Header />
          <main className="app-content">
            <p>Loading your account...</p>
          </main>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="app-container">
      <Sidebar isMobileMenuOpen={isMobileMenuOpen} toggleMobileMenu={toggleMobileMenu} />

      <div className="app-main">
        <Header />
        <main className="app-content">
          <div className="account-main">
            <h1 className="account-title">My Account</h1>

            {error && <div className="form-error">{error}</div>}

            <form className="account-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-field">
                  <label>*</label>
                  <input
                    name="firstName"
                    value={user.firstName || ''}
                    onChange={handleChange}
                    required
                    disabled={!editMode}
                  />
                </div>
                <div className="form-field">
                  <label>Last name*</label>
                  <input
                    name="lastName"
                    value={user.lastName || ''}
                    onChange={handleChange}
                    required
                    disabled={!editMode}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Username*</label>
                  <input
                    name="username"
                    value={user.username || ''}
                    onChange={handleChange}
                    required
                    disabled={!editMode}
                  />
                </div>
                <div className="form-field">
                  <label>Email*</label>
                  <input
                    name="email"
                    type="email"
                    value={user.email || ''}
                    onChange={handleChange}
                    required
                    disabled={!editMode}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Role*</label>
                  <select name="role" value={user.role || 'staff'} onChange={handleChange} disabled={!editMode}>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Contact Number*</label>
                  <input
                    name="contactNumber"
                    value={user.contactNumber || ''}
                    onChange={handleChange}
                    disabled={!editMode}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field full">
                  <label>Location*</label>
                  <input name="location" value={user.location || ''} onChange={handleChange} disabled={!editMode} />
                </div>
              </div>

              <div className="form-actions">
                {!editMode && (
                  <button type="button" className="btn btn-primary" onClick={() => setEditMode(true)}>
                    Edit Profile
                  </button>
                )}
                {editMode && (
                  <>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? 'Saving...' : 'Save changes'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setEditMode(false);
                        setError('');
                      }}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </main>
      </div>

      {confirmOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Confirm update</h3>
            <p>Save your profile changes?</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleConfirmSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
