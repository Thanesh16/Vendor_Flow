import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import MainLayout from './layouts/MainLayout';
import AppLayout from './layouts/AppLayout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardRouter from './pages/dashboard/DashboardRouter';
import VendorManagementPage from './pages/vendor/VendorManagementPage';
import VendorProfilePage from './pages/vendor/VendorProfilePage';
import VendorProductsPage from './pages/vendor/VendorProductsPage';
import ProcurementProductsPage from './pages/procurement/ProcurementProductsPage';
import ProcurementMatchingPage from './pages/procurement/ProcurementMatchingPage';
import PurchaseRequestPage from './pages/purchaseRequest/PurchaseRequestPage';
import VendorOrdersPage from './pages/vendor/VendorOrdersPage';
import EmployeeOrdersPage from './pages/employee/EmployeeOrdersPage';
import ProcurementOrdersPage from './pages/procurement/ProcurementOrdersPage';
import NotificationCenterPage from './pages/notification/NotificationCenterPage';
import ReportsPage from './pages/reports/ReportsPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import AdminUserManagementPage from './pages/admin/AdminUserManagementPage';
import AdminMasterCatalogPage from './pages/admin/AdminMasterCatalogPage';
import NotFoundPage from './pages/NotFoundPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';

export function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
          {/* Public Routes with MainLayout (Navbar + Footer) */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Authenticated Application Routes with AppLayout (Sidebar + Topbar) */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardRouter />} />
            <Route
              path="/vendors"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'PROCUREMENT_MANAGER']}>
                  <VendorManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchase-requests"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'PROCUREMENT_MANAGER', 'EMPLOYEE']}>
                  <PurchaseRequestPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vendor/products"
              element={
                <ProtectedRoute allowedRoles={['VENDOR', 'ADMIN']}>
                  <VendorProductsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vendor/orders"
              element={
                <ProtectedRoute allowedRoles={['VENDOR', 'ADMIN']}>
                  <VendorOrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/orders"
              element={
                <ProtectedRoute allowedRoles={['EMPLOYEE', 'ADMIN']}>
                  <EmployeeOrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/procurement/orders"
              element={
                <ProtectedRoute allowedRoles={['PROCUREMENT_MANAGER', 'ADMIN']}>
                  <ProcurementOrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/procurement/products"
              element={
                <ProtectedRoute allowedRoles={['PROCUREMENT_MANAGER', 'ADMIN']}>
                  <ProcurementProductsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/procurement/matching/:purchaseRequestId"
              element={
                <ProtectedRoute allowedRoles={['PROCUREMENT_MANAGER', 'ADMIN']}>
                  <ProcurementMatchingPage />
                </ProtectedRoute>
              }
            />
            <Route path="/profile" element={<VendorProfilePage />} />
            <Route path="/notifications" element={<NotificationCenterPage />} />
            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'PROCUREMENT_MANAGER']}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AuditLogsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminUserManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/master-catalog"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminMasterCatalogPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
      </ErrorBoundary>
    </AuthProvider>
  );
}

export default App;
