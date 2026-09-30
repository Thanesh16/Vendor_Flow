import React, { useState, useEffect, useCallback } from 'react';
import Card, { CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import ReceiptModal from '../../components/receipt/ReceiptModal';
import purchaseOrderService from '../../services/purchaseOrderService';

export const ProcurementOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  });

  // KPI Metrics state
  const [metrics, setMetrics] = useState({
    totalValue: 0,
    sentCount: 0,
    inProgressCount: 0,
    completedCount: 0,
    totalOrders: 0,
  });

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await purchaseOrderService.getPurchaseOrders({ all: 'true' });
      const allOrders = res.data?.purchaseOrders || res.data?.items || [];
      const totalVal = allOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
      const sent = allOrders.filter((o) => o.status === 'SENT_TO_VENDOR').length;
      const inProg = allOrders.filter((o) => ['ACCEPTED', 'PROCESSING', 'SHIPPED'].includes(o.status)).length;
      const comp = allOrders.filter((o) => ['DELIVERED', 'COMPLETED'].includes(o.status)).length;
      setMetrics({
        totalValue: totalVal,
        sentCount: sent,
        inProgressCount: inProg,
        completedCount: comp,
        totalOrders: allOrders.length,
      });
    } catch {
      // Graceful fallback
    }
  }, []);

  const fetchOrders = useCallback(
    async (currentPage = page, currentLimit = limit, currentSearch = searchQuery, currentStatus = statusFilter, currentSort = sortBy, currentSortOrder = sortOrder) => {
      setLoading(true);
      setError('');
      try {
        const params = {
          page: currentPage,
          limit: currentLimit,
        };
        if (currentStatus && currentStatus !== 'ALL') {
          params.status = currentStatus;
        }
        if (currentSearch && currentSearch.trim()) {
          params.search = currentSearch.trim();
        }
        if (currentSort) {
          params.sortBy = currentSort;
          params.sortOrder = currentSortOrder;
        }

        const response = await purchaseOrderService.getPurchaseOrders(params);
        setOrders(response.data?.purchaseOrders || response.data?.items || []);
        if (response.data?.pagination) {
          setPagination(response.data.pagination);
        }
      } catch (err) {
        setError(err.message || 'Failed to load purchase orders');
      } finally {
        setLoading(false);
      }
    },
    [page, limit, searchQuery, statusFilter, sortBy, sortOrder]
  );

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    fetchOrders(page, limit, searchQuery, statusFilter, sortBy, sortOrder);
  }, [page, limit, statusFilter, sortBy, sortOrder]);

  // Debounced search and reset to page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchOrders(1, limit, searchQuery, statusFilter, sortBy, sortOrder);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleStatusChange = (st) => {
    setStatusFilter(st);
    setPage(1);
  };

  const handleSortChange = (e) => {
    const val = e.target.value;
    if (val === 'newest') {
      setSortBy('createdAt');
      setSortOrder('desc');
    } else if (val === 'oldest') {
      setSortBy('createdAt');
      setSortOrder('asc');
    } else if (val === 'val_desc') {
      setSortBy('totalAmount');
      setSortOrder('desc');
    } else if (val === 'val_asc') {
      setSortBy('totalAmount');
      setSortOrder('asc');
    } else if (val === 'po_num') {
      setSortBy('poNumber');
      setSortOrder('asc');
    }
    setPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setPage(1);
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'SENT_TO_VENDOR':
        return 'warning';
      case 'ACCEPTED':
      case 'PROCESSING':
        return 'info';
      case 'SHIPPED':
        return 'primary';
      case 'DELIVERED':
      case 'COMPLETED':
        return 'success';
      case 'REJECTED':
      case 'CANCELLED':
        return 'error';
      default:
        return 'neutral';
    }
  };

  return (
    <div style={{ padding: 'var(--spacing-6)', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-6)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-main)', letterSpacing: '-0.02em' }}>
            Purchase Orders Tracker
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Monitor corporate purchase orders, supplier fulfillment milestones, and delivery completion across all departments.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
          🔄 Refresh
        </Button>
      </div>

      {error && (
        <div
          style={{
            padding: 'var(--spacing-3) var(--spacing-4)',
            backgroundColor: 'var(--color-error-bg)',
            border: '1px solid var(--color-error-border)',
            color: 'var(--color-error)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            marginBottom: 'var(--spacing-4)',
          }}
        >
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-6)' }}>
        <Card>
          <CardBody style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total Orders Value
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
              ₹{metrics.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', marginTop: '2px' }}>
              {metrics.totalOrders} total orders issued
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Pending Supplier Confirmation
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-warning)', marginTop: '4px' }}>
              {metrics.sentCount}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', marginTop: '2px' }}>
              Dispatched to suppliers
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              In Fulfillment
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
              {metrics.inProgressCount}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', marginTop: '2px' }}>
              Accepted or in transit
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Delivered
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-success)', marginTop: '4px' }}>
              {metrics.completedCount}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', marginTop: '2px' }}>
              Successfully received
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filter & Search Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', overflowX: 'auto', paddingBottom: '2px' }}>
          {[
            { key: 'ALL', label: `All (${pagination.total || orders.length})` },
            { key: 'SENT_TO_VENDOR', label: 'Sent to Vendor' },
            { key: 'ACCEPTED', label: 'Accepted' },
            { key: 'PROCESSING', label: 'Processing' },
            { key: 'SHIPPED', label: 'Shipped' },
            { key: 'DELIVERED', label: 'Delivered' },
            { key: 'REJECTED', label: 'Declined' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleStatusChange(tab.key)}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: 'var(--radius-full)',
                border: statusFilter === tab.key ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                backgroundColor: statusFilter === tab.key ? 'var(--color-primary)' : 'var(--color-surface)',
                color: statusFilter === tab.key ? '#fff' : 'var(--color-text-main)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Sort Dropdown */}
          <select
            value={
              sortBy === 'totalAmount'
                ? sortOrder === 'asc'
                  ? 'val_asc'
                  : 'val_desc'
                : sortBy === 'poNumber'
                ? 'po_num'
                : sortOrder === 'asc'
                ? 'oldest'
                : 'newest'
            }
            onChange={handleSortChange}
            style={{
              padding: '0.45rem 0.6rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)',
              backgroundColor: 'var(--color-bg)',
              cursor: 'pointer',
            }}
          >
            <option value="newest">Newest Orders</option>
            <option value="oldest">Oldest Orders</option>
            <option value="val_desc">Value: High to Low</option>
            <option value="val_asc">Value: Low to High</option>
            <option value="po_num">PO Number</option>
          </select>

          {/* Search Input with Clear Button */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Search PO#, supplier, product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 2rem 0.45rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-xs)',
                backgroundColor: 'var(--color-bg)',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {(searchQuery || statusFilter !== 'ALL' || sortBy !== 'createdAt' || sortOrder !== 'desc') && (
            <Button variant="outline" size="sm" onClick={clearFilters} style={{ fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <Card>
        <CardBody style={{ padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-16) 0', color: 'var(--color-text-muted)' }}>
              Loading purchase orders...
            </div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-16) var(--spacing-4)' }}>
              <div style={{ fontSize: '42px', marginBottom: 'var(--spacing-2)' }}>📋</div>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-main)' }}>
                No Purchase Orders Found
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {searchQuery || statusFilter !== 'ALL'
                  ? 'No purchase orders match your current search query or status filter.'
                  : 'Purchase orders created from approved requisitions will appear here.'}
              </p>
              {(searchQuery || statusFilter !== 'ALL') && (
                <Button variant="outline" size="sm" onClick={clearFilters} style={{ marginTop: 'var(--spacing-3)' }}>
                  Reset Filters
                </Button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', width: '18%' }}>
                      PO Number
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', width: '20%' }}>
                      Supplier
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', width: '18%' }}>
                      Requested By
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right', width: '14%' }}>
                      Amount
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', width: '12%' }}>
                      Status
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'center', width: '10%' }}>
                      Delivery Info
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right', width: '8%' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const hasDeliveryDetails = Boolean(order.deliveryDetails?.address);
                    return (
                      <tr key={order._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: 'var(--spacing-4)' }}>
                          <span style={{ fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '0.04em' }}>
                            {order.poNumber}
                          </span>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            {new Date(order.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td style={{ padding: 'var(--spacing-4)' }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>
                            {order.vendor?.companyName || 'Supplier'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {order.vendor?.city ? `📍 ${order.vendor.city}` : ''}
                          </div>
                        </td>
                        <td style={{ padding: 'var(--spacing-4)' }}>
                          <div style={{ fontWeight: 600 }}>{order.requestedBy?.name || 'Employee'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{order.requestedBy?.email}</div>
                        </td>
                        <td style={{ padding: 'var(--spacing-4)', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-main)' }}>
                          ₹{Number(order.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: 'var(--spacing-4)' }}>
                          <Badge variant={getStatusBadgeVariant(order.status)} size="sm">
                            {order.status}
                          </Badge>
                        </td>
                        <td style={{ padding: 'var(--spacing-4)', textAlign: 'center' }}>
                          {hasDeliveryDetails ? (
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success)', fontWeight: 600 }}>
                              ✓ Provided
                            </span>
                          ) : (
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', fontStyle: 'italic' }}>
                              Pending
                            </span>
                          )}
                        </td>
                        <td style={{ padding: 'var(--spacing-4)', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 'var(--spacing-2)' }}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedOrder(order)}
                            >
                              Inspect
                            </Button>
                            {(order.status === 'DELIVERED' || order.status === 'COMPLETED') && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setSelectedOrderForReceipt(order._id)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                📄 Receipt
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>

        {/* Server-Side Pagination Bar */}
        {!loading && pagination.total > 0 && (
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            itemLabel="purchase orders"
          />
        )}
      </Card>

      {/* Detail Modal */}
      {selectedOrder && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--spacing-4)',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div
              style={{
                padding: 'var(--spacing-4) var(--spacing-6)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-primary)' }}>
                  {selectedOrder.poNumber}
                </span>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-main)', marginTop: '2px' }}>
                  Purchase Order Full Audit
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                style={{ background: 'none', border: 'none', fontSize: 'var(--font-size-xl)', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 'var(--spacing-6)', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-4)', backgroundColor: 'var(--color-bg)', padding: 'var(--spacing-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--spacing-5)' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Supplier</div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>{selectedOrder.vendor?.companyName}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>{selectedOrder.vendor?.phone}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Requested By</div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>{selectedOrder.requestedBy?.name}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>{selectedOrder.requestedBy?.email}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Status</div>
                  <div style={{ marginTop: '4px' }}>
                    <Badge variant={getStatusBadgeVariant(selectedOrder.status)} size="sm">
                      {selectedOrder.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {selectedOrder.status === 'REJECTED' && (
                <div style={{ padding: 'var(--spacing-3) var(--spacing-4)', backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--spacing-5)', fontSize: 'var(--font-size-sm)' }}>
                  <strong>Declined by Supplier:</strong> {selectedOrder.rejectionReason}
                </div>
              )}

              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 'var(--spacing-2)' }}>
                Line Items
              </h3>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 'var(--spacing-5)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--color-text-muted)' }}>Item</th>
                      <th style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--color-text-muted)', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--color-text-muted)', textAlign: 'right' }}>Unit Price</th>
                      <th style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--color-text-muted)', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedOrder.items || []).map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: 'var(--spacing-3)' }}>
                          <div style={{ fontWeight: 600 }}>{it.name}</div>
                        </td>
                        <td style={{ padding: 'var(--spacing-3)', textAlign: 'center', fontWeight: 600 }}>{it.quantity}</td>
                        <td style={{ padding: 'var(--spacing-3)', textAlign: 'right' }}>₹{Number(it.unitPrice).toLocaleString()}</td>
                        <td style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: 700 }}>₹{Number(it.totalPrice).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: 'rgba(30, 58, 138, 0.04)' }}>
                      <td colSpan={3} style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: 700 }}>
                        Total:
                      </td>
                      <td style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: 800, color: 'var(--color-primary)' }}>
                        ₹{Number(selectedOrder.totalAmount).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {selectedOrder.deliveryDetails?.address && (
                <div style={{ marginBottom: 'var(--spacing-5)' }}>
                  <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 'var(--spacing-2)' }}>
                    📍 Destination Delivery Information
                  </h3>
                  <div style={{ padding: 'var(--spacing-3) var(--spacing-4)', backgroundColor: 'rgba(16, 185, 129, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: 'var(--font-size-sm)' }}>
                    <div><strong>Address:</strong> {selectedOrder.deliveryDetails.address}, {selectedOrder.deliveryDetails.city}</div>
                    <div><strong>Contact:</strong> {selectedOrder.deliveryDetails.contactName} ({selectedOrder.deliveryDetails.contactPhone})</div>
                    {selectedOrder.deliveryDetails.deliveryInstructions && (
                      <div style={{ marginTop: '4px', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                        "{selectedOrder.deliveryDetails.deliveryInstructions}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: 'var(--spacing-4) var(--spacing-6)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-surface)' }}>
              <div>
                {(selectedOrder.status === 'DELIVERED' || selectedOrder.status === 'COMPLETED') && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      const id = selectedOrder._id;
                      setSelectedOrder(null);
                      setSelectedOrderForReceipt(id);
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    📄 View Official Receipt
                  </Button>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Official Purchase Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(selectedOrderForReceipt)}
        onClose={() => setSelectedOrderForReceipt(null)}
        orderId={selectedOrderForReceipt}
      />
    </div>
  );
};

export default ProcurementOrdersPage;
