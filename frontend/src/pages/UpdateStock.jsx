// src/pages/UpdateStock.jsx
import { useLocation } from 'react-router-dom';
import UpdateAdjust from './UpdateAdjust.jsx';

export default function UpdateStock() {
  const location = useLocation();
  return <UpdateAdjust defaultTab="stock" initialSearch={location.state?.prefillName || ''} />;
}
