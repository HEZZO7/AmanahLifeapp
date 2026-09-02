import { Navigate, Route, Routes } from 'react-router-dom';
import WealthIndexPage from './pages/wealth/WealthIndexPage';
import WealthPostPage from './pages/wealth/WealthPostPage';

const WealthRoutes = () => (
  <Routes>
    <Route index element={<WealthIndexPage />} />
    <Route path=":slug" element={<WealthPostPage />} />
    <Route path="ar/:slug" element={<WealthPostPage />} />
    <Route path="*" element={<Navigate to="/wealth/" replace />} />
  </Routes>
);

export default WealthRoutes;
