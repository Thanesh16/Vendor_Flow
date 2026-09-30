import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import dashboardService from '../../services/dashboardService';
import MetricCard from './MetricCard';
import Card, { CardBody, CardHeader } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';

export const ProcurementDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchMetrics = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await dashboardService.getProcurementDashboard();
      setData(response.data);
    } catch (err) {
      setError(err.message || 'Failed to load procurement dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 'var(--spacing-16) 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading procurement operations metrics from MongoDB...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 'var(--spacing-8) 0' }}>
        <Card>
          <CardBody style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
            <p style={{ color: 'var(--color-error)', marginBottom: 'var(--spacing-4)' }}>{error}</p>
            <Button variant="primary" size="sm" onClick={fetchMetrics}>
              Retry Connection
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  const { metrics, recentRequests = [], recentProducts = [] } = data || {};

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-8)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-primary)', marginBottom: 'var(--spacing-1)' }}>
            Procurement Operations
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Evaluate requisitions, browse approved vendor catalog products, and monitor compliance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            🔄 Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/procurement/orders')}>
            📑 Purchase Orders
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/reports')}>
            📈 Analytics
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/procurement/products')}>
            Browse Catalog
          </Button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-4" style={{ marginBottom: 'var(--spacing-8)' }}>
        <MetricCard
          title="Approved Suppliers"
          value={metrics?.approvedVendors || 0}
          icon="🏢"
          description="Verified partner suppliers"
          badge={<Badge variant="success">Active</Badge>}
        />
        <MetricCard
          title="Pending PRs"
          value={metrics?.pendingRequests || 0}
          icon="⏳"
          description="Requisitions awaiting approval"
          badge={metrics?.pendingRequests > 0 ? <Badge variant="warning">Action Needed</Badge> : <Badge variant="neutral">Clear</Badge>}
        />
        <MetricCard
          title="Catalog Products"
          value={metrics?.availableProducts || 0}
          icon="🛍️"
          description="Available approved products"
          badge={metrics?.availableProducts > 0 ? <Badge variant="info">In Stock</Badge> : <Badge variant="neutral">0</Badge>}
        />
        <MetricCard
          title="Supplier Reviews"
          value={metrics?.pendingReviews || 0}
          icon="📋"
          description="Vendors pending compliance"
          badge={metrics?.pendingReviews > 0 ? <Badge variant="warning">Pending</Badge> : <Badge variant="neutral">None</Badge>}
        />
      </div>

      {/* Requisitions & Products Grid */}
      <div className="grid grid-cols-2">
        {/* Requisitions Queue Card */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Requisitions Queue</span>
              <Link to="/purchase-requests" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-accent)' }}>
                View All PRs →
              </Link>
            </div>
          </CardHeader>
          <CardBody>
            {recentRequests.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--spacing-8) var(--spacing-4)' }}>
                <span className="empty-state-icon">📝</span>
                <h4 className="empty-state-title">No Active Requisitions</h4>
                <p className="empty-state-desc">
                  Employee purchase requests will appear here for procurement review and approval.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                {recentRequests.map((req) => (
                  <div
                    key={req._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--spacing-3)',
                      backgroundColor: 'var(--color-surface-hover)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)' }}>
                        {req.title}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>
                        {req.requestNumber}
                      </div>
                    </div>
                    <Badge variant={req.status === 'APPROVED' ? 'success' : req.status === 'SUBMITTED' ? 'info' : 'warning'}>
                      {req.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Available Products Card */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Approved Vendor Catalog</span>
              <Link to="/procurement/products" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-accent)' }}>
                Explore Products →
              </Link>
            </div>
          </CardHeader>
          <CardBody>
            {recentProducts.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--spacing-8) var(--spacing-4)' }}>
                <span className="empty-state-icon">🛍️</span>
                <h4 className="empty-state-title">No Catalog Products Yet</h4>
                <p className="empty-state-desc">
                  When approved suppliers publish products, they will appear here for commercial evaluation.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                {recentProducts.map((p) => (
                  <div
                    key={p._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--spacing-3)',
                      backgroundColor: 'var(--color-surface-hover)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)' }}>
                        {p.productName}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        {p.vendor?.companyName} &bull; ₹{Number(p.price).toLocaleString()}
                      </div>
                    </div>
                    <Badge variant="success">Approved</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default ProcurementDashboard;
