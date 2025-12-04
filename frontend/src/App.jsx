// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import InventoryList from './pages/InventoryList.jsx';
import AddProduct from './pages/AddProduct.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import EditProduct from './pages/EditProduct.jsx';
import About from './pages/About.jsx';
import Account from './pages/Account.jsx';
import CreateUser from './pages/CreateUser.jsx';
import UpdateStock from './pages/UpdateStock.jsx';
import UpdatePrice from './pages/UpdatePrice.jsx';
import UpdateAdjust from './pages/UpdateAdjust.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/home" element={<Dashboard />} />
          <Route path="/inventory" element={<InventoryList />} />
          <Route path="/add" element={<AddProduct />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/product/:id/edit" element={<EditProduct />} />
          <Route path="/about" element={<About />} />
          <Route path="/account" element={<Account />} />
          <Route path="/users/new" element={<CreateUser />} />
          <Route path="/updates" element={<UpdateAdjust />} />
          <Route path="/update-stock" element={<UpdateStock />} />
          <Route path="/update-price" element={<UpdatePrice />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
