import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Card, { CardBody } from '../common/Card';
import Button from '../common/Button';

/**
 * Route protection wrapper enforcing authentication and role authorization
 * @param {Array<string>} allowedRoles - Optional list of permitted roles
 */
export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="container" style={{ padding: 'var(--spacing-16) 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Verifying credentials...</p>
      </div>
    );
  }

  // If not authenticated, redirect to login remembering the intended route
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If role restriction is configured, ensure user has permitted role
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="container" style={{ padding: 'var(--spacing-16) 0', textAlign: 'center' }}>
        <Card style={{ maxWidth: '540px', margin: '0 auto' }}>
          <CardBody style={{ padding: 'var(--spacing-8)' }}>
            <h2 style={{ color: 'var(--color-error)', marginBottom: 'var(--spacing-2)' }}>
              403 — Access Denied
            </h2>
            <p style={{ marginBottom: 'var(--spacing-4)', color: 'var(--color-text-main)' }}>
              Your current role does not have permission to view this page.
            </p>
            <Link to="/dashboard">
              <Button variant="primary">Return to My Dashboard</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
