import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import dashboardService from '../../services/dashboardService';
import MetricCard from './MetricCard';
import Card, { CardBody, CardHeader } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';

export const VendorDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchMetrics = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await dashboardService.getVendorDashboard();
      setData(response.data);
    } catch (err) {
      setError(err.message || 'Failed to load supplier dashboard');
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
        <p style={{ color: 'var(--color-text-muted)' }}>Loading your supplier portal information...</p>
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

  const { hasProfile, vendor, metrics, recentProducts = [] } = data || {};

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-8)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-primary)', marginBottom: 'var(--spacing-1)' }}>
              Supplier Dashboard
            </h1>
            {hasProfile && vendor && (
              <Badge variant={vendor.onboardingStatus === 'APPROVED' ? 'success' : vendor.onboardingStatus === 'REJECTED' ? 'error' : 'warning'}>
                {vendor.onboardingStatus}
              </Badge>
            )}
          </div>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Manage your company profile, maintain your product inventory, and monitor commercial catalog listings.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            🔄 Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/vendor/orders')}>
            📥 Incoming Orders
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/vendor/products')}>
            Manage Products
          </Button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-4" style={{ marginBottom: 'var(--spacing-8)' }}>
        <MetricCard
          title="Onboarding Status"
          value={hasProfile ? vendor?.onboardingStatus : 'Pending'}
          icon="🏢"
          description="Compliance verification status"
          badge={hasProfile && vendor?.onboardingStatus === 'APPROVED' ? <Badge variant="success">Approved</Badge> : <Badge variant="warning">Under Review</Badge>}
        />
        <MetricCard
          title="Total Products"
          value={metrics?.totalProducts || 0}
          icon="📦"
          description="Items listed in your catalog"
        />
        <MetricCard
          title="Active Listings"
          value={metrics?.availableProducts || 0}
          icon="✅"
          description="Available for corporate procurement"
          badge={metrics?.availableProducts > 0 ? <Badge variant="success">Live</Badge> : <Badge variant="neutral">None</Badge>}
        />
        <MetricCard
          title="Low Stock Items"
          value={metrics?.lowStockProducts || 0}
          icon="⚠️"
          description="Stock quantity 5 or fewer"
          badge={metrics?.lowStockProducts > 0 ? <Badge variant="warning">Restock</Badge> : <Badge variant="neutral">Healthy</Badge>}
        />
      </div>

      {/* Main Content Areas */}
      <div className="grid grid-cols-2">
        {/* Onboarding Profile Status */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>My Company Profile</span>
              <Link to="/profile" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-accent)' }}>
                View & Edit Profile →
              </Link>
            </div>
          </CardHeader>
          <CardBody>
            {!hasProfile ? (
              <div className="empty-state" style={{ padding: 'var(--spacing-8) var(--spacing-4)' }}>
                <span className="empty-state-icon">📋</span>
                <h4 className="empty-state-title">Supplier Profile Pending Setup</h4>
                <p className="empty-state-desc">
                  Complete your business registration, address, and tax identification to get approved for procurement.
                </p>
                <Button variant="primary" size="sm" onClick={() => navigate('/profile')} style={{ marginTop: 'var(--spacing-3)' }}>
                  Complete Profile
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Company Legal Name</span>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{vendor?.companyName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Verification Status</span>
                  <Badge variant={vendor?.onboardingStatus === 'APPROVED' ? 'success' : 'warning'}>
                    {vendor?.onboardingStatus}
                  </Badge>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-2) 0' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Catalog Readiness</span>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: vendor?.onboardingStatus === 'APPROVED' ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                    {vendor?.onboardingStatus === 'APPROVED' ? '✓ Ready for Orders' : '⏳ Awaiting Review'}
                  </span>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Recent Product Catalog Listings */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Recent Catalog Products</span>
              <Link to="/vendor/products" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-accent)' }}>
                Manage All ({metrics?.totalProducts || 0}) →
              </Link>
            </div>
          </CardHeader>
          <CardBody>
            {recentProducts.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--spacing-8) var(--spacing-4)' }}>
                <span className="empty-state-icon">📦</span>
                <h4 className="empty-state-title">No Products Added Yet</h4>
                <p className="empty-state-desc">
                  Add your first product to make it available to corporate procurement officers.
                </p>
                <Button variant="primary" size="sm" onClick={() => navigate('/vendor/products')} style={{ marginTop: 'var(--spacing-3)' }}>
                  + Add First Product
                </Button>
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
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        {p.category} &bull; ₹{Number(p.price).toLocaleString()} &bull; {p.availableQuantity} in stock
                      </div>
                    </div>
                    <Badge variant={p.isAvailable ? 'success' : 'neutral'}>
                      {p.isAvailable ? 'Active' : 'Hidden'}
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

export default VendorDashboard;
