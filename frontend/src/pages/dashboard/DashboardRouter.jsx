import React from 'react';
import { useAuth } from '../../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import ProcurementDashboard from './ProcurementDashboard';
import VendorDashboard from './VendorDashboard';
import EmployeeDashboard from './EmployeeDashboard';

/**
 * Routes to the appropriate role-specific dashboard based on authenticated user credentials
 */
export const DashboardRouter = () => {
  const { user } = useAuth();

  switch (user?.role) {
    case 'ADMIN':
      return <AdminDashboard />;
    case 'PROCUREMENT_MANAGER':
      return <ProcurementDashboard />;
    case 'EMPLOYEE':
      return <EmployeeDashboard />;
    case 'VENDOR':
      return <VendorDashboard />;
    default:
      return (
        <div style={{ padding: 'var(--spacing-16) 0', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-muted)' }}>Identifying your role...</p>
        </div>
      );
  }
};

export default DashboardRouter;
