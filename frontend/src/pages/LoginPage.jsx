import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Card, { CardBody } from '../components/common/Card';
import Button from '../components/common/Button';

// Official accounts seeded in MongoDB
const DEMO_ROLES = [
  {
    key: 'ADMIN',
    label: 'System Admin',
    icon: '🛡️',
    email: 'thaneshselvam4@gmail.com',
    password: '123456',
    description: 'System supervision, vendors & audit',
    isSeeded: true,
  },
  {
    key: 'PROCUREMENT_MANAGER',
    label: 'Procurement Manager',
    icon: '💼',
    email: 'sanjai12@gmail.com',
    password: '123456',
    description: 'Requisitions queue & product catalog',
    isSeeded: true,
  },
  {
    key: 'EMPLOYEE',
    label: 'Employee / Requester',
    icon: '👤',
    email: '',
    password: '',
    description: 'Sign in with your registered employee account',
    isSeeded: false,
  },
  {
    key: 'VENDOR',
    label: 'Supplier / Vendor',
    icon: '🏢',
    email: '',
    password: '',
    description: 'Sign in with your registered vendor account',
    isSeeded: false,
  },
];

// Helper to check if a route is legitimately permitted for a given user role
const isPathAllowedForRole = (path, role) => {
  if (!path || path === '/' || path === '/login' || path === '/register') return false;
  if (path === '/dashboard' || path === '/profile' || path.startsWith('/notifications')) return true;

  switch (role) {
    case 'ADMIN':
      return [
        '/dashboard',
        '/admin',
        '/reports',
        '/vendors',
        '/purchase-requests',
        '/procurement/products',
        '/procurement/orders',
        '/procurement/matching',
        '/profile',
      ].some((prefix) => path.startsWith(prefix));

    case 'PROCUREMENT_MANAGER':
      return [
        '/dashboard',
        '/reports',
        '/vendors',
        '/purchase-requests',
        '/procurement/products',
        '/procurement/orders',
        '/procurement/matching',
        '/profile',
      ].some((prefix) => path.startsWith(prefix));

    case 'EMPLOYEE':
      return [
        '/dashboard',
        '/purchase-requests',
        '/employee/orders',
        '/profile',
      ].some((prefix) => path.startsWith(prefix));

    case 'VENDOR':
      return [
        '/dashboard',
        '/vendor/products',
        '/vendor/orders',
        '/profile',
      ].some((prefix) => path.startsWith(prefix));

    default:
      return false;
  }
};

export const LoginPage = () => {
  const [selectedRoleKey, setSelectedRoleKey] = useState('ADMIN');
  const [email, setEmail] = useState('thaneshselvam4@gmail.com');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSelectRole = (roleItem) => {
    setSelectedRoleKey(roleItem.key);
    setEmail(roleItem.email || '');
    setPassword(roleItem.password || '');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setSubmitting(true);
    try {
      // Backend authentication determines the actual database role from JWT
      const authUser = await login(email.trim(), password);

      // Determine redirect destination strictly verified against the actual authenticated role
      const intendedPath = location.state?.from?.pathname;
      const targetRoute =
        intendedPath && isPathAllowedForRole(intendedPath, authUser?.role)
          ? intendedPath
          : '/dashboard';

      navigate(targetRoute, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 'var(--spacing-10) 0', flex: 1, display: 'flex', alignItems: 'center' }}>
      <div className="container" style={{ maxWidth: '520px' }}>
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-6)' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '3.25rem',
              height: '3.25rem',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
              color: 'var(--color-text-inverted)',
              fontWeight: 800,
              fontSize: 'var(--font-size-xl)',
              marginBottom: 'var(--spacing-3)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            VF
          </div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-primary)', fontWeight: 800 }}>
            VENDORFLOW
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--spacing-1)' }}>
            Vendor Management & Procurement Platform
          </p>
        </div>

        {/* Role Preset Selector Grid */}
        <div style={{ marginBottom: 'var(--spacing-5)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--spacing-2)', textAlign: 'center' }}>
            Quick Sign-In / Role Selection:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-2)' }}>
            {DEMO_ROLES.map((r) => {
              const isSelected = selectedRoleKey === r.key && (r.isSeeded ? email === r.email : true);
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => handleSelectRole(r)}
                  style={{
                    padding: 'var(--spacing-3)',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    backgroundColor: isSelected ? 'rgba(30, 58, 138, 0.06)' : 'var(--color-surface)',
                    color: isSelected ? 'var(--color-primary)' : 'var(--color-text-main)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                      <span>{r.icon}</span>
                      <span>{r.label}</span>
                    </div>
                    {r.isSeeded ? (
                      <span style={{ fontSize: '9px', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', color: '#059669', padding: '1px 5px', borderRadius: '4px' }}>SEEDED</span>
                    ) : (
                      <span style={{ fontSize: '9px', fontWeight: 600, background: 'rgba(107, 114, 128, 0.12)', color: '#4b5563', padding: '1px 5px', borderRadius: '4px' }}>CUSTOM</span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', lineHeight: 1.2 }}>
                    {r.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Login Form Card */}
        <Card>
          <CardBody style={{ padding: 'var(--spacing-6) var(--spacing-8)' }}>
            {error && (
              <div
                style={{
                  backgroundColor: 'var(--color-error-bg)',
                  border: '1px solid var(--color-error-border)',
                  color: 'var(--color-error)',
                  padding: 'var(--spacing-3) var(--spacing-4)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-sm)',
                  marginBottom: 'var(--spacing-4)',
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 'var(--spacing-4)' }}>
                <label
                  htmlFor="login-email"
                  style={{
                    display: 'block',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    marginBottom: 'var(--spacing-1)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  Account Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSelectedRoleKey('');
                  }}
                  placeholder="name@company.com"
                  required
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.875rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-sm)',
                    outline: 'none',
                    backgroundColor: 'var(--color-bg)',
                  }}
                />
              </div>

              <div style={{ marginBottom: 'var(--spacing-6)' }}>
                <label
                  htmlFor="login-password"
                  style={{
                    display: 'block',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    marginBottom: 'var(--spacing-1)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.875rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-sm)',
                    outline: 'none',
                    backgroundColor: 'var(--color-bg)',
                  }}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
                style={{ width: '100%', padding: '0.75rem', fontSize: 'var(--font-size-base)', fontWeight: 700 }}
              >
                {submitting ? 'Verifying & Signing in...' : 'Sign In to Portal'}
              </Button>
            </form>
          </CardBody>
        </Card>

        {/* Registration Links */}
        <div style={{ textAlign: 'center', marginTop: 'var(--spacing-4)', fontSize: 'var(--font-size-sm)' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Need a new account? </span>
          <Link to="/register" style={{ fontWeight: 600, color: 'var(--color-accent)' }}>
            Register as Supplier or Employee
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
