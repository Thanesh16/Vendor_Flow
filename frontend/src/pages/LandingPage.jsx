import React, { useState, useEffect } from 'react';
import { checkApiHealth } from '../services/healthService';
import Card, { CardBody, CardHeader } from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';

export const LandingPage = () => {
  const [healthStatus, setHealthStatus] = useState({
    loading: true,
    connected: false,
    database: null,
    databaseName: null,
    message: '',
    timestamp: null,
    uptime: null,
  });

  const fetchHealth = async () => {
    setHealthStatus((prev) => ({ ...prev, loading: true }));
    try {
      const data = await checkApiHealth();
      setHealthStatus({
        loading: false,
        connected: data.success,
        database: data.data?.database || 'disconnected',
        databaseName: data.data?.databaseName || null,
        message: data.message,
        timestamp: data.data?.timestamp || null,
        uptime: data.data?.uptime ?? null,
      });
    } catch (err) {
      setHealthStatus({
        loading: false,
        connected: false,
        database: 'disconnected',
        databaseName: null,
        message: err.message || 'Unable to connect to backend server',
        timestamp: null,
        uptime: null,
      });
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div style={{ padding: 'var(--spacing-10) 0' }}>
      <div className="container">
        {/* Hero Section */}
        <section
          style={{
            textAlign: 'center',
            maxWidth: '840px',
            margin: '0 auto var(--spacing-12) auto',
          }}
        >
          <div style={{ marginBottom: 'var(--spacing-4)' }}>
            <Badge variant="info">Enterprise Procurement Portal</Badge>
          </div>
          <h1
            style={{
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              marginBottom: 'var(--spacing-4)',
              color: 'var(--color-primary)',
            }}
          >
            Vendor Management System
          </h1>
          <p
            style={{
              fontSize: 'var(--font-size-xl)',
              color: 'var(--color-text-muted)',
              marginBottom: 'var(--spacing-6)',
              lineHeight: 1.6,
            }}
          >
            Streamline vendor onboarding, procurement, purchase orders, and supplier performance.
          </p>

          {/* System Status Indicators */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 'var(--spacing-3)',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-full)',
              padding: 'var(--spacing-2) var(--spacing-4)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              System Status:
            </span>
            {healthStatus.loading ? (
              <Badge variant="neutral">Checking Services...</Badge>
            ) : (
              <>
                <Badge variant={healthStatus.connected ? 'success' : 'error'}>
                  {healthStatus.connected ? 'API Online' : 'API Offline'}
                </Badge>
                <Badge variant={healthStatus.database === 'connected' ? 'success' : 'error'}>
                  {healthStatus.database === 'connected' ? 'MongoDB Connected' : 'DB Disconnected'}
                </Badge>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchHealth}
              disabled={healthStatus.loading}
              style={{ fontSize: 'var(--font-size-xs)', padding: '0.25rem 0.5rem' }}
            >
              {healthStatus.loading ? '...' : 'Refresh'}
            </Button>
          </div>

          {healthStatus.connected && (
            <p
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-light)',
                marginTop: 'var(--spacing-2)',
              }}
            >
              API: &ldquo;{healthStatus.message}&rdquo; &bull; Database: {healthStatus.databaseName || 'vendor_management'} ({healthStatus.database}) &bull; Uptime: {healthStatus.uptime}s
            </p>
          )}
        </section>

        {/* System Foundation Overview */}
        <section style={{ marginBottom: 'var(--spacing-12)' }}>
          <div style={{ marginBottom: 'var(--spacing-6)', textAlign: 'center' }}>
            <h2>System Architecture & Data Foundation</h2>
            <p style={{ marginTop: 'var(--spacing-2)' }}>
              Phase 2 establishes MongoDB integration and Mongoose schemas, preparing the data layer for business modules.
            </p>
          </div>

          <div className="grid grid-cols-3">
            <Card>
              <CardHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                  <span style={{ fontSize: '1.25rem' }}>🏢</span>
                  <h3>Supplier Lifecycle</h3>
                </div>
              </CardHeader>
              <CardBody>
                <p>
                  Structured vendor onboarding, compliance document verification, multi-tiered approvals, and centralized profile management.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                  <span style={{ fontSize: '1.25rem' }}>📦</span>
                  <h3>Procurement & POs</h3>
                </div>
              </CardHeader>
              <CardBody>
                <p>
                  End-to-end purchase order generation, itemized tracking, fulfillment status, and delivery milestones.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                  <span style={{ fontSize: '1.25rem' }}>📊</span>
                  <h3>Performance Metrics</h3>
                </div>
              </CardHeader>
              <CardBody>
                <p>
                  Automated vendor scoring, on-time delivery rates, quality compliance auditing, and actionable procurement insights.
                </p>
              </CardBody>
            </Card>
          </div>
        </section>

        {/* Future Role Architecture (Informational overview) */}
        <section>
          <div style={{ marginBottom: 'var(--spacing-6)', textAlign: 'center' }}>
            <h2>Role-Based Ecosystem</h2>
            <p style={{ marginTop: 'var(--spacing-2)' }}>
              Designed to support enterprise role-based access control in upcoming phases.
            </p>
          </div>

          <div className="grid grid-cols-3">
            <Card>
              <CardBody>
                <Badge variant="info" style={{ marginBottom: 'var(--spacing-2)' }}>Role 1</Badge>
                <h4 style={{ marginBottom: 'var(--spacing-2)' }}>Administrator</h4>
                <p style={{ fontSize: 'var(--font-size-sm)' }}>
                  System-wide oversight, user access provisioning, compliance audits, and configuration settings.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <Badge variant="info" style={{ marginBottom: 'var(--spacing-2)' }}>Role 2</Badge>
                <h4 style={{ marginBottom: 'var(--spacing-2)' }}>Procurement Manager</h4>
                <p style={{ fontSize: 'var(--font-size-sm)' }}>
                  Vendor evaluations, RFQ reviews, purchase order lifecycles, and supplier relationships.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <Badge variant="info" style={{ marginBottom: 'var(--spacing-2)' }}>Role 3</Badge>
                <h4 style={{ marginBottom: 'var(--spacing-2)' }}>Vendor / Supplier</h4>
                <p style={{ fontSize: 'var(--font-size-sm)' }}>
                  Self-service portal for onboarding, updating business details, acknowledging POs, and tracking deliverables.
                </p>
              </CardBody>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LandingPage;
