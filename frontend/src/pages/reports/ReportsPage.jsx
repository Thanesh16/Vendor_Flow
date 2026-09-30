import React, { useState, useEffect, useCallback } from 'react';
import Card, { CardBody, CardHeader } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import reportService from '../../services/reportService';

export const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'orders' | 'requests' | 'vendors' | 'inventory'
  const [timeframe, setTimeframe] = useState('all'); // '7d' | '30d' | '3m' | '6m' | '1y' | 'all'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  // Data states
  const [overviewData, setOverviewData] = useState(null);
  const [poData, setPoData] = useState(null);
  const [prData, setPrData] = useState(null);
  const [vendorData, setVendorData] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);

  // Format currency in Indian numbering system
  const formatINR = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0';
    return `₹${Number(val).toLocaleString('en-IN')}`;
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewRes, poRes, prRes, vendorRes, invRes] = await Promise.all([
        reportService.getOverview({ range: timeframe }),
        reportService.getPurchaseOrders({ range: timeframe }),
        reportService.getPurchaseRequests({ range: timeframe }),
        reportService.getVendors(),
        reportService.getInventory(),
      ]);

      setOverviewData(overviewRes.data);
      setPoData(poRes.data);
      setPrData(prRes.data);
      setVendorData(vendorRes.data);
      setInventoryData(invRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load report analytics');
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleExport = async (type) => {
    setExporting(true);
    try {
      const blobData = await reportService.exportCSV(type, { range: timeframe });
      const url = window.URL.createObjectURL(new Blob([blobData]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `vendorflow-${type}-report-${timeframe}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      alert('Failed to export CSV: ' + (err.message || 'Error'));
    } finally {
      setExporting(false);
    }
  };

  const kpis = overviewData?.kpis || {};
  const insights = overviewData?.insights || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)', paddingBottom: 'var(--spacing-12)' }}>
      {/* Header & Global Filter Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--spacing-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>
            Reports & Analytics
          </h1>
          <p style={{ margin: 'var(--spacing-1) 0 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Real-time procurement intelligence, financial spend, requisition lifecycles, and supplier performance.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}>
          {/* Timeframe Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Period:</span>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: 'var(--color-text-main)',
                cursor: 'pointer',
              }}
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="3m">Last 3 Months</option>
              <option value="6m">Last 6 Months</option>
              <option value="1y">This Year</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <Button variant="outline" size="sm" onClick={fetchReports} disabled={loading}>
            🔄 Refresh
          </Button>

          {/* Export CSV Dropdown */}
          <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={exporting}
              onClick={() => handleExport('orders')}
              title="Export purchase orders to CSV"
            >
              📥 Export Orders CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => handleExport('requests')}
              title="Export requisitions to CSV"
            >
              Requisitions
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => handleExport('vendors')}
              title="Export vendors to CSV"
            >
              Suppliers
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: 'var(--spacing-4)', backgroundColor: '#FEF2F2', border: '1px solid #F87171', borderRadius: 'var(--radius-md)', color: '#991B1B', fontSize: 'var(--font-size-sm)' }}>
          {error}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--color-border)', gap: 'var(--spacing-2)', overflowX: 'auto' }}>
        {[
          { key: 'overview', label: 'Executive Overview', icon: '📊' },
          { key: 'orders', label: 'Procurement & Orders', icon: '📑' },
          { key: 'requests', label: 'Purchase Requests', icon: '📝' },
          { key: 'vendors', label: 'Vendors & Performance', icon: '🏢' },
          { key: 'inventory', label: 'Inventory & Catalog', icon: '🛍️' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: 'var(--spacing-3) var(--spacing-4)',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: '-2px',
              backgroundColor: 'transparent',
              fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 'var(--spacing-16) 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Aggregating real-time procurement data from MongoDB...
        </div>
      ) : (
        <>
          {/* ============================================================ */}
          {/* TAB 1: EXECUTIVE OVERVIEW */}
          {/* ============================================================ */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
              {/* Executive KPI Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 'var(--spacing-4)',
                }}
              >
                <Card>
                  <CardBody style={{ padding: 'var(--spacing-4)' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Total Spend
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
                      {formatINR(kpis.totalProcurementValue)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '4px' }}>
                      Avg Order: {formatINR(kpis.averageOrderValue)}
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardBody style={{ padding: 'var(--spacing-4)' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Completed Spend
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                      {formatINR(kpis.completedSpend)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '4px' }}>
                      Committed: {formatINR(kpis.committedSpend)}
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardBody style={{ padding: 'var(--spacing-4)' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Purchase Orders
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-main)', marginTop: '4px' }}>
                      {kpis.totalPurchaseOrders || 0}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '4px' }}>
                      {kpis.completedOrders || 0} Completed • {kpis.rejectedOrders || 0} Declined
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardBody style={{ padding: 'var(--spacing-4)' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Purchase Requests
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-main)', marginTop: '4px' }}>
                      {kpis.totalPurchaseRequests || 0}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '4px' }}>
                      {kpis.approvedRequests || 0} Approved • {kpis.submittedRequests || 0} Pending
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardBody style={{ padding: 'var(--spacing-4)' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Registered Suppliers
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-main)', marginTop: '4px' }}>
                      {kpis.totalVendors || 0}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '4px' }}>
                      {kpis.approvedVendors || 0} Approved • {kpis.pendingVendors || 0} Pending
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardBody style={{ padding: 'var(--spacing-4)' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Catalog Products
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-main)', marginTop: '4px' }}>
                      {kpis.totalProducts || 0}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '4px' }}>
                      {kpis.availableProducts || 0} In Stock • {kpis.lowStockProducts || 0} Low Stock
                    </div>
                  </CardBody>
                </Card>
              </div>

              {/* Intelligent Insights Bar */}
              <Card>
                <CardHeader>
                  <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>💡 Live Procurement Insights</span>
                </CardHeader>
                <CardBody>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
                    <div style={{ padding: 'var(--spacing-3)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>MOST ACTIVE SUPPLIER</div>
                      <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-main)', marginTop: '2px' }}>
                        {insights.mostActiveVendor}
                      </div>
                    </div>
                    <div style={{ padding: 'var(--spacing-3)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>TOP ORDERED CATEGORY</div>
                      <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-main)', marginTop: '2px' }}>
                        {insights.topCategory}
                      </div>
                    </div>
                    <div style={{ padding: 'var(--spacing-3)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>ORDERS IN DELIVERY</div>
                      <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-primary)', marginTop: '2px' }}>
                        {insights.activeDeliveries} active
                      </div>
                    </div>
                    <div style={{ padding: 'var(--spacing-3)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>PENDING APPROVAL QUEUE</div>
                      <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: '#D97706', marginTop: '2px' }}>
                        {insights.pendingRequests} requisitions
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Order Status Distribution Pills */}
              <Card>
                <CardHeader>
                  <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>Purchase Order Status Distribution</span>
                </CardHeader>
                <CardBody>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-3)' }}>
                    {[
                      { label: 'Completed', count: kpis.completedOrders, color: '#059669', bg: '#ECFDF5' },
                      { label: 'Accepted', count: kpis.acceptedOrders, color: '#2563EB', bg: '#EFF6FF' },
                      { label: 'Delivered', count: kpis.deliveredOrders, color: '#0D9488', bg: '#F0FDFA' },
                      { label: 'Shipped', count: kpis.shippedOrders, color: '#0284C7', bg: '#F0F9FF' },
                      { label: 'Processing', count: kpis.processingOrders, color: '#7C3AED', bg: '#F5F3FF' },
                      { label: 'Sent to Vendor', count: kpis.sentOrders, color: '#D97706', bg: '#FFFBEB' },
                      { label: 'Declined', count: kpis.rejectedOrders, color: '#DC2626', bg: '#FEF2F2' },
                    ].map((st) => (
                      <div
                        key={st.label}
                        style={{
                          flex: '1 1 140px',
                          padding: 'var(--spacing-3)',
                          backgroundColor: st.bg,
                          border: `1px solid ${st.color}30`,
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}
                      >
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{st.label}</span>
                        <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: st.color }}>{st.count || 0}</span>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: PROCUREMENT & ORDERS */}
          {/* ============================================================ */}
          {activeTab === 'orders' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
              {/* Monthly Spend Trend Visualization */}
              <Card>
                <CardHeader>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>Monthly Procurement Spend Trend</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Real PO creation values</span>
                  </div>
                </CardHeader>
                <CardBody>
                  {poData?.monthlyTrend?.length === 0 ? (
                    <div style={{ padding: 'var(--spacing-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No procurement orders placed in the selected timeframe.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', height: '180px', gap: 'var(--spacing-4)', paddingTop: 'var(--spacing-6)', paddingBottom: 'var(--spacing-2)', borderBottom: '1px solid var(--color-border)' }}>
                        {(() => {
                          const maxSpend = Math.max(...poData.monthlyTrend.map((m) => m.totalSpend), 1);
                          return poData.monthlyTrend.map((item, idx) => {
                            const barHeight = Math.max(12, Math.round((item.totalSpend / maxSpend) * 140));
                            return (
                              <div
                                key={idx}
                                style={{
                                  flex: 1,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  height: '100%',
                                  justifyContent: 'flex-end',
                                }}
                              >
                                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '4px' }}>
                                  {formatINR(item.totalSpend)}
                                </span>
                                <div
                                  style={{
                                    width: '100%',
                                    maxWidth: '48px',
                                    height: `${barHeight}px`,
                                    backgroundColor: 'var(--color-primary)',
                                    borderRadius: '4px 4px 0 0',
                                    transition: 'height 0.3s ease',
                                  }}
                                  title={`${item.label}: ${formatINR(item.totalSpend)} (${item.orderCount} orders)`}
                                />
                                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '6px', whiteSpace: 'nowrap' }}>
                                  {item.label}
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Recent Orders Detailed Table */}
              <Card>
                <CardHeader>
                  <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>Recent Purchase Orders</span>
                </CardHeader>
                <CardBody style={{ padding: 0 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                          <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>PO Number</th>
                          <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Supplier</th>
                          <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Requester</th>
                          <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Amount</th>
                          <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Status</th>
                          <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {poData?.recentOrders?.length === 0 ? (
                          <tr>
                            <td colSpan="6" style={{ padding: 'var(--spacing-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                              No purchase orders found for this timeframe.
                            </td>
                          </tr>
                        ) : (
                          poData.recentOrders.map((o) => (
                            <tr key={o._id} style={{ borderBottom: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 700 }}>{o.poNumber}</td>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>{o.vendor?.companyName || 'N/A'}</td>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>{o.requestedBy?.name || 'N/A'}</td>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 700, color: 'var(--color-primary)' }}>
                                {formatINR(o.totalAmount)}
                              </td>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
                                <Badge variant={o.status === 'COMPLETED' ? 'success' : o.status === 'REJECTED' ? 'error' : 'info'}>
                                  {o.status}
                                </Badge>
                              </td>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', color: 'var(--color-text-light)', fontSize: '12px' }}>
                                {new Date(o.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: PURCHASE REQUESTS */}
          {/* ============================================================ */}
          {activeTab === 'requests' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
              {/* Status & Priority Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--spacing-6)' }}>
                {/* Status Breakdown Card */}
                <Card>
                  <CardHeader>
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>Requisitions by Status</span>
                  </CardHeader>
                  <CardBody>
                    {prData?.total === 0 ? (
                      <div style={{ padding: 'var(--spacing-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        No purchase requests found.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                        {Object.entries(prData?.statusBreakdown || {}).map(([st, info]) => (
                          <div key={st} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                              <span style={{ fontWeight: 600 }}>{st}</span>
                              <span style={{ color: 'var(--color-text-muted)' }}>
                                {info.count} ({info.percentage}%)
                              </span>
                            </div>
                            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${info.percentage}%`,
                                  height: '100%',
                                  backgroundColor:
                                    st === 'APPROVED' ? '#059669' : st === 'SUBMITTED' ? '#D97706' : st === 'REJECTED' ? '#DC2626' : 'var(--color-primary)',
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardBody>
                </Card>

                {/* Priority Breakdown Card */}
                <Card>
                  <CardHeader>
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>Requisitions by Priority</span>
                  </CardHeader>
                  <CardBody>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
                      {Object.entries(prData?.priorityBreakdown || {}).map(([prio, count]) => (
                        <div
                          key={prio}
                          style={{
                            padding: 'var(--spacing-4)',
                            backgroundColor: 'var(--color-bg)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{prio} PRIORITY</div>
                          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: prio === 'URGENT' ? '#DC2626' : 'var(--color-text-main)', marginTop: '4px' }}>
                            {count}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              </div>

              {/* Monthly Requisition Trend */}
              <Card>
                <CardHeader>
                  <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>Requisition Volume Over Time</span>
                </CardHeader>
                <CardBody>
                  {prData?.trend?.length === 0 ? (
                    <div style={{ padding: 'var(--spacing-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No requisitions submitted in this timeframe.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-end', height: '140px', gap: 'var(--spacing-4)', paddingTop: 'var(--spacing-4)' }}>
                      {(() => {
                        const maxCount = Math.max(...prData.trend.map((t) => t.count), 1);
                        return prData.trend.map((t, idx) => (
                          <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>{t.count}</span>
                            <div
                              style={{
                                width: '100%',
                                maxWidth: '40px',
                                height: `${Math.max(10, Math.round((t.count / maxCount) * 90))}px`,
                                backgroundColor: '#2563EB',
                                borderRadius: '4px 4px 0 0',
                              }}
                            />
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{t.label}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 4: VENDORS & PERFORMANCE */}
          {/* ============================================================ */}
          {activeTab === 'vendors' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
              {/* Status Overview Banner */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--spacing-4)' }}>
                <Card>
                  <CardBody style={{ padding: 'var(--spacing-3)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>APPROVED SUPPLIERS</div>
                    <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                      {vendorData?.statusBreakdown?.APPROVED || 0}
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody style={{ padding: 'var(--spacing-3)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>PENDING ONBOARDING</div>
                    <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: '#D97706', marginTop: '2px' }}>
                      {vendorData?.statusBreakdown?.PENDING || 0}
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody style={{ padding: 'var(--spacing-3)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>UNDER REVIEW</div>
                    <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: '#2563EB', marginTop: '2px' }}>
                      {vendorData?.statusBreakdown?.UNDER_REVIEW || 0}
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody style={{ padding: 'var(--spacing-3)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>DECLINED / REJECTED</div>
                    <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: '#DC2626', marginTop: '2px' }}>
                      {vendorData?.statusBreakdown?.REJECTED || 0}
                    </div>
                  </CardBody>
                </Card>
              </div>

              {/* Organization Performance Card if evaluations exist */}
              {vendorData?.orgPerformance ? (
                <Card>
                  <CardHeader>
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>Organization Supplier Evaluation Summary</span>
                  </CardHeader>
                  <CardBody>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--spacing-4)' }}>
                      <div style={{ padding: 'var(--spacing-3)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Overall Rating</span>
                        <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-primary)' }}>
                          {vendorData.orgPerformance.avgOverall}/100
                        </div>
                      </div>
                      <div style={{ padding: 'var(--spacing-3)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Quality</span>
                        <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800 }}>{vendorData.orgPerformance.avgQuality}/100</div>
                      </div>
                      <div style={{ padding: 'var(--spacing-3)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Delivery SLA</span>
                        <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800 }}>{vendorData.orgPerformance.avgDelivery}/100</div>
                      </div>
                      <div style={{ padding: 'var(--spacing-3)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Pricing</span>
                        <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800 }}>{vendorData.orgPerformance.avgPricing}/100</div>
                      </div>
                      <div style={{ padding: 'var(--spacing-3)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Support</span>
                        <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800 }}>{vendorData.orgPerformance.avgSupport}/100</div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ) : (
                <Card>
                  <CardBody style={{ textAlign: 'center', padding: 'var(--spacing-6)' }}>
                    <div style={{ fontSize: '24px', marginBottom: 'var(--spacing-2)' }}>📋</div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>No Formal Supplier Evaluations Recorded</div>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                      Vendor performance scores reflect formal quality, delivery, and pricing evaluations. Unrated suppliers display "Not evaluated".
                    </p>
                  </CardBody>
                </Card>
              )}

              {/* Top Suppliers Table */}
              <Card>
                <CardHeader>
                  <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>Top Suppliers by Procurement Volume</span>
                </CardHeader>
                <CardBody style={{ padding: 0 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '760px' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                          <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Rank</th>
                          <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Supplier Company</th>
                          <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Location</th>
                          <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Status</th>
                          <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Completed POs</th>
                          <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Total Spend</th>
                          <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Performance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendorData?.topVendors?.length === 0 ? (
                          <tr>
                            <td colSpan="7" style={{ padding: 'var(--spacing-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                              No supplier order history available.
                            </td>
                          </tr>
                        ) : (
                          vendorData.topVendors.map((v) => (
                            <tr key={v.vendorId} style={{ borderBottom: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 800, color: 'var(--color-text-muted)' }}>
                                #{v.rank}
                              </td>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600 }}>{v.companyName}</td>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', color: 'var(--color-text-light)' }}>
                                {v.city ? `${v.city}, ${v.state}` : 'N/A'}
                              </td>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
                                <Badge variant={v.onboardingStatus === 'APPROVED' ? 'success' : 'warning'}>
                                  {v.onboardingStatus}
                                </Badge>
                              </td>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 700 }}>{v.completedOrders}</td>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 700, color: 'var(--color-primary)' }}>
                                {formatINR(v.totalSpend)}
                              </td>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
                                {v.performance.isEvaluated ? (
                                  <Badge variant="success" dot={false}>
                                    {v.performance.ratingLabel}
                                  </Badge>
                                ) : (
                                  <span style={{ fontSize: '11px', color: 'var(--color-text-light)', fontStyle: 'italic' }}>
                                    Not evaluated
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 5: INVENTORY & CATALOG */}
          {/* ============================================================ */}
          {activeTab === 'inventory' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
              {/* Catalog Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
                <Card>
                  <CardBody style={{ padding: 'var(--spacing-3)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>COMMERCIAL LISTINGS</div>
                    <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, marginTop: '2px' }}>
                      {inventoryData?.summary?.totalProducts || 0}
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody style={{ padding: 'var(--spacing-3)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>AVAILABLE / LIVE</div>
                    <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                      {inventoryData?.summary?.availableProducts || 0}
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody style={{ padding: 'var(--spacing-3)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>LOW STOCK ALERTS (&le;5)</div>
                    <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: '#D97706', marginTop: '2px' }}>
                      {inventoryData?.summary?.lowStockCount || 0}
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody style={{ padding: 'var(--spacing-3)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>OUT OF STOCK / INACTIVE</div>
                    <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: '#DC2626', marginTop: '2px' }}>
                      {inventoryData?.summary?.outOfStockCount || 0}
                    </div>
                  </CardBody>
                </Card>
              </div>

              {/* Product Categories Table */}
              <Card>
                <CardHeader>
                  <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>Product Categories Distribution</span>
                </CardHeader>
                <CardBody style={{ padding: 0 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                          <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Category</th>
                          <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Listings Count</th>
                          <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Total Inventory Available</th>
                          <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Average Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryData?.categories?.length === 0 ? (
                          <tr>
                            <td colSpan="4" style={{ padding: 'var(--spacing-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                              No product categories found.
                            </td>
                          </tr>
                        ) : (
                          inventoryData.categories.map((cat) => (
                            <tr key={cat.categoryName} style={{ borderBottom: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600 }}>{cat.categoryName}</td>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>{cat.productCount}</td>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 700 }}>{cat.totalUnits} units</td>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', color: 'var(--color-primary)', fontWeight: 600 }}>
                                {formatINR(cat.avgPrice)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>

              {/* Low Stock Alerts Table */}
              {inventoryData?.lowStockAlerts?.length > 0 && (
                <Card>
                  <CardHeader>
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: '#D97706' }}>
                      ⚠️ Low Stock Alerts (Stock &le; 5 units)
                    </span>
                  </CardHeader>
                  <CardBody style={{ padding: 0 }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                            <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Product Name</th>
                            <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Supplier</th>
                            <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Category</th>
                            <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Price</th>
                            <th style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>Stock Left</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryData.lowStockAlerts.map((prod) => (
                            <tr key={prod._id} style={{ borderBottom: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600 }}>{prod.productName}</td>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>{prod.vendor?.companyName || 'N/A'}</td>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>{prod.category}</td>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600 }}>{formatINR(prod.price)}</td>
                              <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
                                <Badge variant="error" dot={true}>
                                  {prod.availableQuantity} units left
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardBody>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReportsPage;
