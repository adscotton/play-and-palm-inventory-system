// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import Sidebar from '../components/Sidebar.jsx';
import '../styles/dashboard.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const DASH_WIDGETS_KEY = 'dashboard_widgets_v1';

// Sample data so the dashboard still renders when the backend or Supabase is offline.
const SAMPLE_PRODUCTS = [
  { id: 1, name: 'DualSense Controller', category: 'Accessories', stock: 42, status: 'Available' },
  { id: 2, name: 'PS5 Console', category: 'Consoles', stock: 8, status: 'Available' },
  { id: 3, name: 'Xbox Series X', category: 'Consoles', stock: 4, status: 'Low Stock' },
  { id: 4, name: 'Nintendo Switch OLED', category: 'Consoles', stock: 0, status: 'Out of Stock' },
  { id: 5, name: 'Zelda: TOTK', category: 'Games', stock: 16, status: 'Available' },
  { id: 6, name: 'EA FC 25', category: 'Games', stock: 6, status: 'Available' },
  { id: 7, name: 'Logitech G Pro Headset', category: 'Accessories', stock: 3, status: 'Low Stock' },
  { id: 8, name: '8BitDo Ultimate', category: 'Accessories', stock: 0, status: 'Out of Stock' },
];

const widgetList = [
  { id: 'status', label: 'Inventory Status' },
  { id: 'category', label: 'Stock by Category' },
  { id: 'restock', label: 'Restock Watch' },
  { id: 'recent', label: 'Recent Items' },
];

function computeMetrics(products) {
  const totalProducts = products.length;
  const totalUnits = products.reduce((sum, p) => sum + (Number.isFinite(p.stock) ? Number(p.stock) : 0), 0);
  const lowStock = products.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= 5).length;
  const outOfStock = products.filter((p) => !Number(p.stock) || Number(p.stock) <= 0).length;

  const categoryTotals = products.reduce((acc, p) => {
    const key = p.category || 'Uncategorized';
    acc[key] = (acc[key] || 0) + (Number.isFinite(p.stock) ? Number(p.stock) : 0);
    return acc;
  }, {});

  const statusTotals = {
    Available: products.filter((p) => (p.status || '').toLowerCase() === 'available' && Number(p.stock) > 0).length,
    'Low Stock': lowStock,
    'Out of Stock': outOfStock,
  };

  const recent = [...products]
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
    .slice(0, 5);

  return { totalProducts, totalUnits, lowStock, outOfStock, categoryTotals, statusTotals, recent };
}

function buildPieStops(statusTotals) {
  const total = Object.values(statusTotals).reduce((s, v) => s + v, 0) || 1;
  const segments = [
    { label: 'Available', color: '#0acffe', value: statusTotals['Available'] || 0 },
    { label: 'Low Stock', color: '#f5a524', value: statusTotals['Low Stock'] || 0 },
    { label: 'Out of Stock', color: '#ff6b6b', value: statusTotals['Out of Stock'] || 0 },
  ];

  let start = 0;
  return segments.map((seg) => {
    const angle = (seg.value / total) * 360;
    const stop = { ...seg, start, end: start + angle };
    start += angle;
    return stop;
  });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeWidgets, setActiveWidgets] = useState(() => {
    try {
      const saved = localStorage.getItem(DASH_WIDGETS_KEY);
      if (saved) return new Set(JSON.parse(saved));
    } catch (_) {
      /* ignore parse errors */
    }
    return new Set(widgetList.map((w) => w.id));
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE}/api/products`);
        if (!res.ok) throw new Error(`API responded ${res.status}`);
        const data = await res.json();
        if (!cancelled) setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        if (cancelled) return;
        setError('Backend offline - showing sample data.');
        setProducts(SAMPLE_PRODUCTS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleWidget = (id) => {
    setActiveWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(DASH_WIDGETS_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const metrics = useMemo(() => computeMetrics(products), [products]);
  const pieStops = useMemo(() => buildPieStops(metrics.statusTotals), [metrics.statusTotals]);

  const handleGoToInventory = () => {
    navigate('/inventory');
  };

  const pieStyle = {
    background: `conic-gradient(${pieStops
      .map((seg) => `${seg.color} ${seg.start}deg ${seg.end}deg`)
      .join(', ')})`,
  };

  const categoryMax = Math.max(...Object.values(metrics.categoryTotals || {}), 1);

  return (
    <div className="app-container">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main className="app-content">
          <section className="dashboard-header">
            <div>
              <h1 className="dashboard-title">Inventory Pulse</h1>
              <p className="dashboard-subtitle">
                Live overview of products, stock health, and categories. {error && <span className="pill pill-warn">{error}</span>}
              </p>
            </div>
            <div className="dashboard-actions">
              <button onClick={handleGoToInventory} className="btn btn-primary">
                Go to Inventory
              </button>
            </div>
          </section>

          <section className="widget-toggle-panel">
            <p className="toggle-label">Customize dashboard:</p>
            <div className="toggle-chips">
              {widgetList.map((w) => {
                const enabled = activeWidgets.has(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    className={`toggle-chip ${enabled ? 'on' : 'off'}`}
                    onClick={() => toggleWidget(w.id)}
                  >
                    {enabled ? 'On' : 'Add'} {w.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">TP</div>
              <div className="stat-meta">
                <p className="stat-label">Total Products</p>
                <p className="stat-value">{metrics.totalProducts}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">ST</div>
              <div className="stat-meta">
                <p className="stat-label">Units in Stock</p>
                <p className="stat-value">{metrics.totalUnits}</p>
              </div>
            </div>
            <div className="stat-card warning">
              <div className="stat-icon">LOW</div>
              <div className="stat-meta">
                <p className="stat-label">Low Stock</p>
                <p className="stat-value">{metrics.lowStock}</p>
              </div>
            </div>
            <div className="stat-card danger">
              <div className="stat-icon">OUT</div>
              <div className="stat-meta">
                <p className="stat-label">Out of Stock</p>
                <p className="stat-value">{metrics.outOfStock}</p>
              </div>
            </div>
          </section>

          <section className="dashboard-grid">
            {activeWidgets.has('status') && (
              <div className="card chart-card">
                <div className="card-header">
                  <h3>Inventory Status</h3>
                  <p className="card-subtitle">Distribution of available vs low/out-of-stock items</p>
                </div>
                <div className="chart-body">
                  <div className="pie" style={pieStyle}>
                    <div className="pie-center">
                      <p className="pie-value">{metrics.totalProducts}</p>
                      <p className="pie-label">SKUs</p>
                    </div>
                  </div>
                  <div className="legend">
                    {pieStops.map((seg) => (
                      <div key={seg.label} className="legend-row">
                        <span className="legend-dot" style={{ backgroundColor: seg.color }} />
                        <span className="legend-label">{seg.label}</span>
                        <span className="legend-value">
                          {metrics.statusTotals[seg.label] || 0} ({Math.round((seg.end - seg.start) / 3.6)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeWidgets.has('category') && (
              <div className="card chart-card">
                <div className="card-header">
                  <h3>Stock by Category</h3>
                  <p className="card-subtitle">Shows share of units per category</p>
                </div>
                <div className="chart-body">
                  <div className="bars">
                    {Object.entries(metrics.categoryTotals).map(([cat, val]) => {
                      const width = `${Math.max(6, (val / categoryMax) * 100)}%`;
                      return (
                        <div className="bar-row" key={cat}>
                          <div className="bar-label">{cat}</div>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width }} />
                          </div>
                          <div className="bar-value">{val} units</div>
                        </div>
                      );
                    })}
                    {!Object.keys(metrics.categoryTotals).length && <p>No categories yet.</p>}
                  </div>
                </div>
              </div>
            )}

            {activeWidgets.has('restock') && (
              <div className="card chart-card">
                <div className="card-header">
                  <h3>Restock Watch</h3>
                  <p className="card-subtitle">Items at or below threshold (&lt;= 5)</p>
                </div>
                <div className="chart-body">
                  <div className="low-stock-list">
                    {products
                      .filter((p) => Number(p.stock) <= 5)
                      .slice(0, 6)
                      .map((p) => (
                        <div key={p.id} className="low-stock-item">
                          <div>
                            <p className="item-name">{p.name}</p>
                            <p className="item-meta">{p.category || 'Uncategorized'}</p>
                          </div>
                          <span className="pill pill-warn">{Number(p.stock) || 0} left</span>
                        </div>
                      ))}
                    {!products.filter((p) => Number(p.stock) <= 5).length && (
                      <p className="muted">All items are healthy.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeWidgets.has('recent') && (
              <div className="card chart-card">
                <div className="card-header">
                  <h3>Recent Items</h3>
                  <p className="card-subtitle">Newest SKUs added</p>
                </div>
                <div className="recent-list">
                  {metrics.recent.map((p) => (
                    <div className="recent-row" key={p.id}>
                      <div>
                        <p className="item-name">{p.name}</p>
                        <p className="item-meta">{p.category || 'Uncategorized'}</p>
                      </div>
                      <div className="recent-right">
                        <span className={`pill ${Number(p.stock) <= 0 ? 'pill-danger' : 'pill-ok'}`}>
                          {Number(p.stock) <= 0 ? 'Out' : `${p.stock} in stock`}
                        </span>
                      </div>
                    </div>
                  ))}
                  {!metrics.recent.length && <p className="muted">No products available yet.</p>}
                </div>
              </div>
            )}
          </section>

          {loading && <div className="loading-overlay">Loading dashboard...</div>}
        </main>
      </div>
    </div>
  );
}
