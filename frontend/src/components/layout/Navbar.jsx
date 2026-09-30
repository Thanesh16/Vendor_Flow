import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Badge from '../common/Badge';
import Button from '../common/Button';

export const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand">
          <div className="navbar-logo-icon">VF</div>
          <span>VENDORFLOW</span>
        </Link>

        <div className="navbar-actions">
          <Badge variant="info">Enterprise Procurement</Badge>

          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
              <Link to="/dashboard" className="btn btn-outline btn-sm">
                Dashboard
              </Link>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                {user?.name}
              </span>
              <Badge variant={user?.role === 'ADMIN' ? 'error' : user?.role === 'PROCUREMENT_MANAGER' ? 'warning' : user?.role === 'EMPLOYEE' ? 'primary' : 'info'}>
                {user?.role}
              </Badge>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
              <Link to="/login" className="btn btn-primary btn-sm">
                Sign In
              </Link>
              <Link to="/register" className="btn btn-outline btn-sm">
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
