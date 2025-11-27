// src/components/Sidebar.jsx
import { NavLink, useNavigate } from 'react-router-dom';

export default function Sidebar() {
  const navigate = useNavigate();
  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  const canStockUpdate = ['staff', 'manager', 'admin'].includes(role);
  const canPriceUpdate = role === 'manager' || role === 'admin';
  
  const handleLogout = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    localStorage.removeItem('token');
    navigate('/');
    closeSidebar();
  };

  const navItems = [
    { label: 'Home', route: '/dashboard' },
    { label: 'Records', route: '/inventory' },
    ...(canStockUpdate ? [{ label: 'Update Stock', route: '/update-stock' }] : []),
    ...(canPriceUpdate ? [{ label: 'Update Price', route: '/update-price' }] : []),
    ...(role === 'admin' ? [{ label: 'Create User', route: '/users/new' }] : []),
    { label: 'About', route: '/about' },
    { label: 'Account', route: '/account' },
  ];

  const closeSidebar = () => {
    document.body.classList.remove('sidebar-open');
  };

  return (
    <>
      <div className="sidebar-overlay" onClick={closeSidebar} />
      <aside className="sidebar" aria-hidden={false}>
        <div className="sidebar-logo-container">
          <div className="sidebar-logo">PP</div>
          <h3 className="sidebar-logo-text">PLAY & PALM</h3>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.route}
              to={item.route}
              className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
              onClick={closeSidebar}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-logout">
          <button onClick={handleLogout} className="sidebar-logout-button">
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
