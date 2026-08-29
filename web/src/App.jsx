import { Navigate, Route, Routes, useParams } from 'react-router-dom';

import AdminLayout from './admin/layout/AdminLayout';
import ConfigErrorScreen from './components/ConfigErrorScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { configError } from './firebase';
import LoginPage from './pages/LoginPage';

import DashboardPage from './admin/pages/DashboardPage';
import UsersPage from './admin/pages/UsersPage';
import SellersPage from './admin/pages/SellersPage';
import ProductsPage from './admin/pages/ProductsPage';
import ReservationsPage from './admin/pages/ReservationsPage';
import DisputesPage from './admin/pages/DisputesPage';
import ReviewsPage from './admin/pages/ReviewsPage';
import SellerPlansPage from './admin/pages/SellerPlansPage';
import BannerPlansPage from './admin/pages/BannerPlansPage';
import WalletsPage from './admin/pages/WalletsPage';
import WalletTransactionsPage from './admin/pages/WalletTransactionsPage';
import WithdrawalsPage from './admin/pages/WithdrawalsPage';
import FinancePage from './admin/pages/FinancePage';
import NotificationsPage from './admin/pages/NotificationsPage';
import CategoriesPage from './admin/pages/CategoriesPage';
import AnalyticsPage from './admin/pages/AnalyticsPage';
import SettingsPage from './admin/pages/SettingsPage';
import AuditLogsPage from './admin/pages/AuditLogsPage';
import SellerDetailPage from './admin/pages/SellerDetailPage';

import AccountDetailPage from './pages/AccountDetailPage';
import ShopDetailPage from './pages/ShopDetailPage';
import ProductDetailPage from './pages/ProductDetailPage';
import ReservationDetailPage from './pages/ReservationDetailPage';
import BanksPage from './pages/BanksPage';

function RedirectLegacyAccount() {
  const { accountId } = useParams();
  return <Navigate to={`/users/${accountId}`} replace />;
}

function RedirectLegacyShop() {
  const { shopId } = useParams();
  return <Navigate to={`/sellers/shops/${shopId}`} replace />;
}

function ProtectedRoutes() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center' }}>Đang kiểm tra phiên đăng nhập...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        Tài khoản không có quyền admin (Role = 3).
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />

        <Route path="users" element={<UsersPage />} />
        <Route path="users/:accountId" element={<AccountDetailPage />} />

        <Route path="sellers" element={<SellersPage />} />
        <Route path="sellers/shops/:shopId" element={<ShopDetailPage />} />
        <Route path="sellers/:verificationId" element={<SellerDetailPage />} />

        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:productId" element={<ProductDetailPage />} />

        <Route path="reservations" element={<ReservationsPage />} />
        <Route path="reservations/:reservationId" element={<ReservationDetailPage />} />

        <Route path="disputes" element={<DisputesPage />} />

        <Route path="reviews" element={<ReviewsPage />} />

        <Route path="seller-plans" element={<SellerPlansPage />} />
        <Route path="seller-subscriptions" element={<Navigate to="/seller-plans?tab=history" replace />} />
        <Route path="banner-plans" element={<BannerPlansPage />} />
        <Route path="seller-banners" element={<Navigate to="/banner-plans?tab=history" replace />} />

        <Route path="wallets" element={<WalletsPage />} />
        <Route path="wallet-transactions" element={<WalletTransactionsPage />} />
        <Route path="withdrawals" element={<WithdrawalsPage />} />
        <Route path="system-wallet" element={<Navigate to="/finance" replace />} />
        <Route path="finance" element={<FinancePage />} />

        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="reports" element={<Navigate to="/disputes" replace />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />

        {/* Legacy redirects */}
        <Route path="accounts" element={<Navigate to="/users" replace />} />
        <Route path="accounts/:accountId" element={<RedirectLegacyAccount />} />
        <Route path="verifications" element={<Navigate to="/sellers" replace />} />
        <Route path="shops" element={<Navigate to="/sellers" replace />} />
        <Route path="shops/:shopId" element={<RedirectLegacyShop />} />
        <Route path="banner-purchases" element={<Navigate to="/banner-plans?tab=history" replace />} />
        <Route path="banks" element={<BanksPage />} />
        <Route path="banners" element={<Navigate to="/banner-plans?tab=history" replace />} />
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
