// src/pages/InventoryList.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import '../styles/inventory.css';

// Inventory is fetched from backend `/api/products` (which uses Supabase with local fallback)

const ITEMS_PER_PAGE = 8;
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

function formatPrice(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return 'N/A';
  return `₱${num.toFixed(2)}`;
}

export default function InventoryList() {
  const [inventory, setInventory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  const canAddItems = role === 'admin' || role === 'manager';
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/products`);
        if (!res.ok) throw new Error('Failed to fetch products from backend');
        const data = await res.json();
        setInventory(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load products from backend', err);
        setInventory([]);
      }
    };

    fetchProducts();
  }, []);

  const categories = useMemo(() => {
    const set = new Set();
    inventory.forEach((item) => {
      if (item?.category) set.add(item.category);
    });
    return Array.from(set);
  }, [inventory]);

  // Filter by category and search (case-insensitive)
  const filtered = inventory.filter((item) => {
    const cat = (item.category || '').toLowerCase();
    const activeCat = filter.toLowerCase();
    const matchesCategory = activeCat === 'all' || cat === activeCat;
    const needle = search.toLowerCase();
    const matchesSearch =
      (item.name || '').toLowerCase().includes(needle) ||
      (item.brand || '').toLowerCase().includes(needle) ||
      (item.edition || '').toLowerCase().includes(needle);
    return matchesCategory && matchesSearch;
  });

  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'Available': 'status-available',
      'Low in Stock': 'status-low',
      'Low Stock': 'status-low', // normalize alt label
      'No Stock': 'status-out',
      'Out of Stock': 'status-out', // normalize alt label
    };
    return statusMap[status] || '';
  };

  return (
    <div className="app-container">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main className="app-content">
          <div className="inventory-header">
            <h1 className="inventory-title">Inventory Records</h1>
            {canAddItems && (
              <button
                onClick={() => navigate('/add')}
                className="btn btn-primary inventory-add-button"
              >
                + Add New Item
              </button>
            )}
          </div>

          <div className="inventory-filters">
            <div className="filter-group">
              <button 
                className={`btn ${filter === 'all' ? 'btn-primary' : ''}`}
                onClick={() => { setFilter('all'); setCurrentPage(1); }}
              >
                All Items
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`btn ${filter.toLowerCase() === (cat || '').toLowerCase() ? 'btn-primary' : ''}`}
                  onClick={() => { setFilter(cat); setCurrentPage(1); }}
                >
                  {cat || 'Uncategorized'}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Search by name or brand..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="search-input"
            />
          </div>

          <div className="inventory-table-container">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Brand</th>
                  <th>Edition</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((item) => (
                  <tr key={item.id} className="inventory-row">
                    <td className="inventory-cell" data-label="ID">{item.id}</td>
                    <td className="inventory-cell" data-label="Name">{item.name}</td>
                    <td className="inventory-cell" data-label="Brand">{item.brand}</td>
                    <td className="inventory-cell" data-label="Edition">{item.edition || 'N/A'}</td>
                    <td className="inventory-cell" data-label="Category">{item.category}</td>
                    <td className="inventory-cell" data-label="Price">{formatPrice(item.price)}</td>
                    <td className="inventory-cell" data-label="Stock">{item.stock}</td>
                    <td className="inventory-cell" data-label="Status">
                      <span className={`status-badge ${getStatusBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="inventory-cell" data-label="Action">
                      <button
                        onClick={() => navigate(`/product/${item.id}`)}
                        className="inventory-action-button"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination-container">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="pagination-button"
            >
              Previous
            </button>

            <div className="pagination-numbers">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => handlePageChange(i + 1)}
                  className={`pagination-number ${currentPage === i + 1 ? 'active' : ''}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="pagination-button"
            >
              Next
            </button>
          </div>

          <div className="inventory-info">
            <p>Showing {filtered.length ? indexOfFirstItem + 1 : 0}-{Math.min(indexOfLastItem, filtered.length)} of {filtered.length} items</p>
          </div>
        </main>
      </div>
    </div>
  );
}
