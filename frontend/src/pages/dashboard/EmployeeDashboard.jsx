import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import dashboardService from '../../services/dashboardService';
import MetricCard from './MetricCard';
import Card, { CardBody, CardHeader } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';

export const EmployeeDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchMetrics = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await dashboardService.getEmployeeDashboard();
      setData(response.data);
    } catch (err) {
      setError(err.message || 'Failed to load employee requisition metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success">APPROVED</Badge>;
      case 'SUBMITTED':
        return <Badge variant="info">SUBMITTED (PENDING)</Badge>;
      case 'REJECTED':
        return <Badge variant="error">REJECTED</Badge>;
      case 'CANCELLED':
        return <Badge variant="neutral">CANCELLED</Badge>;
      default:
        return <Badge variant="warning">DRAFT</Badge>;
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'URGENT':
        return <Badge variant="error">URGENT</Badge>;
      case 'HIGH':
        return <Badge variant="warning">HIGH</Badge>;
      case 'LOW':
        return <Badge variant="neutral">LOW</Badge>;
      default:
        return <Badge variant="info">MEDIUM</Badge>;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--spacing-16) 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading your purchase requests from MongoDB...</p>
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

  const { metrics, recentRequests = [] } = data || {};

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-8)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-primary)', marginBottom: 'var(--spacing-1)' }}>
            Employee Requisition Portal
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Submit company purchase requests, track procurement approvals, and monitor required-by timelines.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            🔄 Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/employee/orders')}>
            📦 My Orders
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/purchase-requests?action=create')}>
            + New Purchase Request
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-4" style={{ marginBottom: 'var(--spacing-8)' }}>
        <MetricCard
          title="Total Requests"
          value={metrics?.totalRequests || 0}
          icon="📝"
          description="Total requisitions created"
        />
        <MetricCard
          title="Pending Approvals"
          value={metrics?.pendingRequests || 0}
          icon="⏳"
          description="Awaiting procurement review"
          badge={metrics?.pendingRequests > 0 ? <Badge variant="info">Active</Badge> : <Badge variant="neutral">None</Badge>}
        />
        <MetricCard
          title="Approved Requests"
          value={metrics?.approvedRequests || 0}
          icon="✅"
          description="Approved by procurement"
          badge={metrics?.approvedRequests > 0 ? <Badge variant="success">Approved</Badge> : null}
        />
        <MetricCard
          title="Rejected / Cancelled"
          value={(metrics?.rejectedRequests || 0) + (metrics?.cancelledRequests || 0)}
          icon="❌"
          description={`${metrics?.rejectedRequests || 0} rejected, ${metrics?.cancelledRequests || 0} cancelled`}
        />
      </div>

      {/* Recent Requests Section */}
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>My Recent Purchase Requests</span>
            <Link to="/purchase-requests" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-accent)' }}>
              View All Requests →
            </Link>
          </div>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          {recentRequests.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--spacing-12) var(--spacing-6)' }}>
              <span className="empty-state-icon">📝</span>
              <h4 className="empty-state-title">No Purchase Requests Yet</h4>
              <p className="empty-state-desc">
                You haven't created any purchase requests yet. Click below to request equipment, materials, or services.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/purchase-requests?action=create')}
                style={{ marginTop: 'var(--spacing-4)' }}
              >
                Create Purchase Request
              </Button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Request ID</th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Title & Items</th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Priority</th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Required Date</th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Status</th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Created</th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRequests.map((req) => (
                    <tr key={req._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: 'var(--spacing-4)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {req.requestNumber}
                      </td>
                      <td style={{ padding: 'var(--spacing-4)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{req.title}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                          {req.items?.length || 0} item(s): {req.items?.map((i) => `${i.name} (x${i.quantity})`).join(', ')}
                        </div>
                      </td>
                      <td style={{ padding: 'var(--spacing-4)' }}>
                        {getPriorityBadge(req.priority)}
                      </td>
                      <td style={{ padding: 'var(--spacing-4)', color: 'var(--color-text-muted)' }}>
                        {req.requiredDate ? new Date(req.requiredDate).toLocaleDateString() : 'Flexible'}
                      </td>
                      <td style={{ padding: 'var(--spacing-4)' }}>
                        {getStatusBadge(req.status)}
                      </td>
                      <td style={{ padding: 'var(--spacing-4)', color: 'var(--color-text-light)', fontSize: 'var(--font-size-xs)' }}>
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: 'var(--spacing-4)', textAlign: 'right' }}>
                        <Link to={`/purchase-requests?id=${req._id}`}>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default EmployeeDashboard;
