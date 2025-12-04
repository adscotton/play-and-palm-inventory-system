// src/pages/UpdatePrice.jsx
import { useLocation } from 'react-router-dom';
import UpdateAdjust from './UpdateAdjust.jsx';

export default function UpdatePrice() {
  const location = useLocation();
  return <UpdateAdjust defaultTab="price" initialSearch={location.state?.prefillName || ''} />;
}
