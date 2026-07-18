import { Navigate, Route, Routes } from 'react-router-dom';

import AdminLayout from './components/AdminLayout';
import ConfigErrorScreen from './components/ConfigErrorScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { configError } from './firebase';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CategoriesPage from './pages/CategoriesPage';
import SellerVerificationsPage from './pages/SellerVerificationsPage';
import AccountsPage from './pages/AccountsPage';
import AccountDetailPage from './pages/AccountDetailPage';
import ReportManagement from './pages/ReportManagement';
import ReviewManagement from './pages/ReviewManagement';
import SystemNotification from './pages/SystemNotification';
import ShopsPage from './pages/ShopsPage';
import ShopDetailPage from './pages/ShopDetailPage';
import ProductsPage from './pages/ProductsPage';
import ReservationsPage from './pages/ReservationsPage';
import StatsPage from './pages/StatsPage';
import BannersPage from './pages/BannersPage';

function ProtectedRoutes() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Đang kiểm tra phiên đăng nhập...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="loading-screen">
        Tài khoản không có quyền admin (Role = 3).
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="accounts/:accountId" element={<AccountDetailPage />} />
        <Route path="verifications" element={<SellerVerificationsPage />} />
        <Route path="shops" element={<ShopsPage />} />
        <Route path="shops/:shopId" element={<ShopDetailPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="reservations" element={<ReservationsPage />} />
        <Route path="reports" element={<ReportManagement />} />
        <Route path="reviews" element={<ReviewManagement />} />
        <Route path="notifications" element={<SystemNotification />} />
        <Route path="banners" element={<BannersPage />} />
        <Route path="stats" element={<StatsPage />} />
      </Route>
    </Routes>
  );
}

function AppRoutes() {
  if (configError) {
    return <ConfigErrorScreen message={configError} />;
  }

  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </AuthProvider>
  );
}

export default function App() {
  return <AppRoutes />;
}
