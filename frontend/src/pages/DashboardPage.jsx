import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import Card, { CardBody, CardHeader } from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';

export const DashboardPage = () => {
  const { user, logout } = useAuth();
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  // Role navigation configuration mapping
  const roleNavItems = {
    ADMIN: [
      { name: 'Dashboard', active: true },
      { name: 'User Management', planned: true },
      { name: 'Vendor Directory', planned: true },
      { name: 'Purchase Requests', planned: true },
      { name: 'Purchase Orders', planned: true },
      { name: 'Vendor Evaluations', planned: true },
      { name: 'Audit Logs & Settings', planned: true },
    ],
    PROCUREMENT_MANAGER: [
      { name: 'Dashboard', active: true },
      { name: 'Vendor Approvals', planned: true },
      { name: 'Purchase Requests', planned: true },
      { name: 'Purchase Orders', planned: true },
      { name: 'Performance Scoring', planned: true },
    ],
    VENDOR: [
      { name: 'Dashboard', active: true },
      { name: 'My Profile & Documents', planned: true },
      { name: 'My Purchase Orders', planned: true },
      { name: 'My Performance Scorecard', planned: true },
    ],
  };

  const navList = (user && roleNavItems[user.role]) || [];

  // Function to test backend RBAC enforcement
  const handleTestEndpoint = async (endpointKey, label) => {
    setTesting(true);
    setTestResult(null);
    try {
      const data = await authService.testRbac(endpointKey);
      setTestResult({
        success: true,
        endpoint: label,
        status: 200,
        message: data.message || 'Access granted by backend RBAC',
      });
    } catch (err) {
      setTestResult({
        success: false,
        endpoint: label,
        status: err.status || 403,
        message: err.message || 'Access rejected by backend RBAC',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ padding: 'var(--spacing-8) 0' }}>
      <div className="container">
        {/* Welcome Banner */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-4)',
            marginBottom: 'var(--spacing-8)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--spacing-4)',
              paddingBottom: 'var(--spacing-6)',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                <h1 style={{ fontSize: 'var(--font-size-3xl)' }}>
                  Welcome, {user?.name}
                </h1>
                <Badge variant={user?.role === 'ADMIN' ? 'error' : user?.role === 'PROCUREMENT_MANAGER' ? 'warning' : 'info'}>
                  {user?.role}
                </Badge>
              </div>
              <p style={{ marginTop: 'var(--spacing-1)' }}>
                Authenticated as <strong>{user?.email}</strong> &bull; Phase 3 RBAC Session Active
              </p>
            </div>

            <Button variant="outline" size="sm" onClick={logout}>
              Sign Out
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3" style={{ alignItems: 'start' }}>
          {/* Navigation Architecture Preview */}
          <div style={{ gridColumn: 'span 1' }}>
            <Card>
              <CardHeader>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Role-Based Navigation</span>
                  <Badge variant="neutral">{user?.role}</Badge>
                </div>
              </CardHeader>
              <CardBody style={{ padding: 'var(--spacing-3)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                  {navList.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 'var(--spacing-2) var(--spacing-3)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: item.active ? 'var(--color-primary-light)' : 'transparent',
                        color: item.active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        fontWeight: item.active ? 600 : 400,
                        fontSize: 'var(--font-size-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{item.name}</span>
                      {item.planned && (
                        <span style={{ fontSize: '10px', color: 'var(--color-text-light)' }}>
                          Phase 4+
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>

          {/* RBAC Verification Box */}
          <div style={{ gridColumn: 'span 2' }}>
            <Card>
              <CardHeader>
                <h3>Backend Authorization Verification</h3>
              </CardHeader>
              <CardBody>
                <p style={{ marginBottom: 'var(--spacing-4)' }}>
                  Test real-time backend role enforcement. In accordance with security requirements, the backend enforces authorization independently of UI controls:
                </p>

                <div style={{ display: 'flex', gap: 'var(--spacing-3)', flexWrap: 'wrap', marginBottom: 'var(--spacing-6)' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={testing}
                    onClick={() => handleTestEndpoint('admin-only', 'Admin-Only Endpoint')}
                  >
                    Test Admin-Only API
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={testing}
                    onClick={() => handleTestEndpoint('procurement-only', 'Procurement Endpoint')}
                  >
                    Test Procurement API
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={testing}
                    onClick={() => handleTestEndpoint('vendor-only', 'Vendor-Only Endpoint')}
                  >
                    Test Vendor-Only API
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={testing}
                    onClick={() => handleTestEndpoint('protected', 'General Protected API')}
                  >
                    Test General Protected API
                  </Button>
                </div>

                {testResult && (
                  <div
                    style={{
                      padding: 'var(--spacing-4)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: testResult.success ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
                      border: `1px solid ${testResult.success ? 'var(--color-success-border)' : 'var(--color-error-border)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-1)' }}>
                      <Badge variant={testResult.success ? 'success' : 'error'}>
                        HTTP {testResult.status} {testResult.success ? 'Access Granted' : 'Forbidden'}
                      </Badge>
                      <strong style={{ fontSize: 'var(--font-size-sm)' }}>{testResult.endpoint}</strong>
                    </div>
                    <p style={{ fontSize: 'var(--font-size-sm)', margin: 0, color: testResult.success ? 'var(--color-success)' : 'var(--color-error)' }}>
                      {testResult.message}
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
