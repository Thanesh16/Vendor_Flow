import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import dashboardService from '../../services/dashboardService';
import MetricCard from './MetricCard';
import Card, { CardBody, CardHeader } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMetrics = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await dashboardService.getAdminDashboard();
      setData(response.data);
    } catch (err) {
      setError(err.message || 'Failed to load administrator dashboard metrics');
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
        <p style={{ color: 'var(--color-text-muted)' }}>Loading real-time system metrics from MongoDB...</p>
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

  const { metrics, recentVendors = [], recentRequests = [] } = data || {};

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-8)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-primary)', marginBottom: 'var(--spacing-1)' }}>
            System Overview & Operations
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
            High-level administrative oversight of registered accounts, partner suppliers, product catalogs, and corporate requisitions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            🔄 Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/audit-logs')}>
            🛡️ Audit Logs
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/users')}>
            👥 Manage Users
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/reports')}>
            📈 View Reports
          </Button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-4" style={{ marginBottom: 'var(--spacing-8)' }}>
        <MetricCard
          title="Total Accounts"
          value={metrics?.totalUsers || 0}
          icon="👥"
          description="Registered system accounts"
          badge={<Badge variant="info">Active</Badge>}
        />
        <MetricCard
          title="Total Suppliers"
          value={metrics?.totalVendors || 0}
          icon="🏢"
          description="Onboarded supplier entities"
          badge={metrics?.approvedVendors ? <Badge variant="success">{metrics.approvedVendors} Approved</Badge> : null}
        />
        <MetricCard
          title="Catalog Products"
          value={metrics?.totalProducts || 0}
          icon="🛍️"
          description="Total active commercial listings"
          badge={metrics?.availableProducts ? <Badge variant="info">{metrics.availableProducts} Live</Badge> : null}
        />
        <MetricCard
          title="Requisitions"
          value={metrics?.totalPurchaseRequests || 0}
          icon="📝"
          description="Total employee purchase requests"
        />
      </div>

      {/* Main Content Sections */}
      <div className="grid grid-cols-2">
        {/* Vendors Overview */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Recent Suppliers</span>
              <Link to="/vendors" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-accent)' }}>
                View Directory →
              </Link>
            </div>
          </CardHeader>
          <CardBody>
            {recentVendors.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--spacing-8) var(--spacing-4)' }}>
                <span className="empty-state-icon">🏢</span>
                <h4 className="empty-state-title">No Suppliers Registered</h4>
                <p className="empty-state-desc">
                  Suppliers will appear here once registered through the supplier portal.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                {recentVendors.map((v) => (
                  <div
                    key={v._id}
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
                        {v.companyName}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>
                        {v.contactPerson} &bull; {v.email}
                      </div>
                    </div>
                    <Badge variant={v.onboardingStatus === 'APPROVED' ? 'success' : v.onboardingStatus === 'REJECTED' ? 'error' : 'warning'}>
                      {v.onboardingStatus}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Purchase Requests Overview */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Recent Purchase Requests</span>
              <Link to="/purchase-requests" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-accent)' }}>
                View Requisitions →
              </Link>
            </div>
          </CardHeader>
          <CardBody>
            {recentRequests.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--spacing-8) var(--spacing-4)' }}>
                <span className="empty-state-icon">📝</span>
                <h4 className="empty-state-title">No Requisitions Submitted</h4>
                <p className="empty-state-desc">
                  Purchase requests submitted by employees will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                {recentRequests.map((r) => (
                  <div
                    key={r._id}
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
                        {r.title}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>
                        {r.requestNumber}
                      </div>
                    </div>
                    <Badge variant={r.status === 'APPROVED' ? 'success' : r.status === 'SUBMITTED' ? 'info' : 'warning'}>
                      {r.status}
                    </Badge>
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

export default AdminDashboard;
