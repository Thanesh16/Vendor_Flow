import React, { useState, useEffect, useCallback } from 'react';
import Card, { CardHeader, CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import ReceiptModal from '../../components/receipt/ReceiptModal';
import purchaseOrderService from '../../services/purchaseOrderService';

export const VendorOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

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

  // Detail Modal & Action states
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingOrderId, setRejectingOrderId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchOrders = useCallback(
    async (currentPage = page, currentLimit = limit, currentSearch = searchQuery, currentStatus = filterStatus, currentSort = sortBy, currentSortOrder = sortOrder) => {
      setLoading(true);
      setError('');
      try {
        const params = {
          page: currentPage,
          limit: currentLimit,
        };
        if (currentStatus !== 'ALL') {
          params.status = currentStatus;
        }
        if (currentSearch.trim()) {
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
    [page, limit, searchQuery, filterStatus, sortBy, sortOrder]
  );

  useEffect(() => {
    fetchOrders(page, limit, searchQuery, filterStatus, sortBy, sortOrder);
  }, [page, limit, filterStatus, sortBy, sortOrder]);

  // Debounced search and reset to page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchOrders(1, limit, searchQuery, filterStatus, sortBy, sortOrder);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleStatusChange = (st) => {
    setFilterStatus(st);
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
    }
    setPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('ALL');
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

  const handleAcceptOrder = async (orderId) => {
    if (!window.confirm('Accept this Purchase Order and commit to delivery SLA?')) return;
    setActionLoading(true);
    setError('');
    try {
      const response = await purchaseOrderService.acceptPurchaseOrder(orderId, 'Order accepted by supplier');
      if (response.data?.purchaseOrder) {
        setOrders((prev) =>
          prev.map((o) => (o._id === orderId ? response.data.purchaseOrder : o))
        );
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder(response.data.purchaseOrder);
        }
        setSuccessMessage(`Order ${response.data.purchaseOrder.poNumber} accepted! The customer has been notified.`);
      }
    } catch (err) {
      setError(err.message || 'Failed to accept order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenRejectModal = (orderId) => {
    setRejectingOrderId(orderId);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please specify a valid reason for declining this order.');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      const response = await purchaseOrderService.rejectPurchaseOrder(rejectingOrderId, rejectionReason.trim());
      if (response.data?.purchaseOrder) {
        setOrders((prev) =>
          prev.map((o) => (o._id === rejectingOrderId ? response.data.purchaseOrder : o))
        );
        if (selectedOrder && selectedOrder._id === rejectingOrderId) {
          setSelectedOrder(response.data.purchaseOrder);
        }
        setShowRejectModal(false);
        setSuccessMessage(`Order ${response.data.purchaseOrder.poNumber} declined. The customer has been notified.`);
      }
    } catch (err) {
      setError(err.message || 'Failed to reject order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateFulfillment = async (orderId, targetStatus) => {
    setActionLoading(true);
    setError('');
    try {
      const response = await purchaseOrderService.updateFulfillmentStatus(
        orderId,
        targetStatus,
        `Status updated to ${targetStatus} by vendor`
      );
      if (response.data?.purchaseOrder) {
        setOrders((prev) =>
          prev.map((o) => (o._id === orderId ? response.data.purchaseOrder : o))
        );
        if (selectedOrder && selectedOrder._id === orderId) {
          setSelectedOrder(response.data.purchaseOrder);
        }
        setSuccessMessage(`Order status successfully updated to ${targetStatus}!`);
      }
    } catch (err) {
      setError(err.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'SENT_TO_VENDOR':
        return 'warning';
      case 'ACCEPTED':
        return 'info';
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

  // Filtered list
  const filteredOrders = orders.filter((o) => {
    if (filterStatus === 'ALL') return true;
    return o.status === filterStatus;
  });

  const pendingCount = orders.filter((o) => o.status === 'SENT_TO_VENDOR').length;
  const activeFulfillmentCount = orders.filter((o) =>
    ['ACCEPTED', 'PROCESSING', 'SHIPPED'].includes(o.status)
  ).length;
  const deliveredCount = orders.filter((o) =>
    ['DELIVERED', 'COMPLETED'].includes(o.status)
  ).length;

  return (
    <div style={{ padding: 'var(--spacing-6)', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-6)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-main)', letterSpacing: '-0.02em' }}>
            Incoming Purchase Orders
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Review customer purchase orders, accept or decline fulfillment, inspect delivery destinations, and track dispatch status.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
          🔄 Refresh Orders
        </Button>
      </div>

      {/* Notifications / Alerts */}
      {successMessage && (
        <div
          style={{
            padding: 'var(--spacing-3) var(--spacing-4)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: 'var(--color-success)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            marginBottom: 'var(--spacing-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-success)' }}
          >
            ✕
          </button>
        </div>
      )}

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

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-6)' }}>
        <Card>
          <CardBody style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Action Required
            </div>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-warning)', marginTop: '4px' }}>
              {pendingCount}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', marginTop: '2px' }}>
              Awaiting your acceptance
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              In Fulfillment
            </div>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
              {activeFulfillmentCount}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', marginTop: '2px' }}>
              Accepted, Processing or Shipped
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Delivered & Completed
            </div>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-success)', marginTop: '4px' }}>
              {deliveredCount}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', marginTop: '2px' }}>
              Fulfilled successfully
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Status Filter Tabs & Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', overflowX: 'auto', paddingBottom: '2px' }}>
          {[
            { key: 'ALL', label: `All Orders (${pagination.total || orders.length})` },
            { key: 'SENT_TO_VENDOR', label: `Pending Action (${pendingCount})` },
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
                padding: '0.45rem 0.9rem',
                borderRadius: 'var(--radius-full)',
                border: filterStatus === tab.key ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                backgroundColor: filterStatus === tab.key ? 'var(--color-primary)' : 'var(--color-surface)',
                color: filterStatus === tab.key ? '#fff' : 'var(--color-text-main)',
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
            <option value="val_desc">Amount: High to Low</option>
            <option value="val_asc">Amount: Low to High</option>
          </select>

          {/* Search Input */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Search PO#, product name..."
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

          {(searchQuery || filterStatus !== 'ALL' || sortBy !== 'createdAt' || sortOrder !== 'desc') && (
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
              Loading incoming purchase orders...
            </div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-16) var(--spacing-4)' }}>
              <div style={{ fontSize: '42px', marginBottom: 'var(--spacing-2)' }}>📋</div>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-main)' }}>
                No Purchase Orders Found
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {searchQuery || filterStatus !== 'ALL'
                  ? 'No incoming purchase orders match your current search keywords or status filter.'
                  : 'Incoming purchase orders issued by corporate procurement will appear here in real time.'}
              </p>
              {(searchQuery || filterStatus !== 'ALL') && (
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
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', width: '16%' }}>
                      PO Number
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', width: '12%' }}>
                      Date Issued
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', width: '24%' }}>
                      Line Items
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right', width: '14%' }}>
                      Total Amount
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', width: '14%' }}>
                      Fulfillment Status
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'center', width: '10%' }}>
                      Delivery Info
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right', width: '10%' }}>
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
                        </td>
                        <td style={{ padding: 'var(--spacing-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: 'var(--spacing-4)' }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>
                            {order.items?.[0]?.name || 'Purchased Item'}
                            {order.items?.length > 1 && ` + ${order.items.length - 1} more`}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            Qty: <strong>{order.items?.[0]?.quantity || 1}</strong> unit(s)
                          </div>
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
                              ✓ Submitted
                            </span>
                          ) : (
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', fontStyle: 'italic' }}>
                              Pending Requester
                            </span>
                          )}
                        </td>
                        <td style={{ padding: 'var(--spacing-4)', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedOrder(order)}
                            >
                              Details
                            </Button>

                            {order.status === 'SENT_TO_VENDOR' && (
                              <>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleAcceptOrder(order._id)}
                                  disabled={actionLoading}
                                  style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                                >
                                  ✓ Accept
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenRejectModal(order._id)}
                                  disabled={actionLoading}
                                  style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                                >
                                  ✕ Decline
                                </Button>
                              </>
                            )}

                            {order.status === 'ACCEPTED' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleUpdateFulfillment(order._id, 'PROCESSING')}
                                disabled={actionLoading}
                              >
                                Start Processing
                              </Button>
                            )}

                            {order.status === 'PROCESSING' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleUpdateFulfillment(order._id, 'SHIPPED')}
                                disabled={actionLoading}
                                style={{ backgroundColor: 'var(--color-primary)' }}
                              >
                                Mark Shipped
                              </Button>
                            )}

                            {order.status === 'SHIPPED' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleUpdateFulfillment(order._id, 'DELIVERED')}
                                disabled={actionLoading}
                                style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                              >
                                Mark Delivered
                              </Button>
                            )}

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
        </CardBody>
      </Card>

      {/* Detail & Delivery Modal */}
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
            {/* Header */}
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
                  Purchase Order Specifications & Delivery Info
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

            {/* Modal Body */}
            <div style={{ padding: 'var(--spacing-6)', overflowY: 'auto', flex: 1 }}>
              {/* Order Status Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--spacing-3) var(--spacing-4)',
                  backgroundColor: 'var(--color-bg)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-5)',
                }}
              >
                <div>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Status: </span>
                  <Badge variant={getStatusBadgeVariant(selectedOrder.status)} size="md">
                    {selectedOrder.status}
                  </Badge>
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Issued: {new Date(selectedOrder.createdAt).toLocaleString()}
                </div>
              </div>

              {/* Rejection notice if REJECTED */}
              {selectedOrder.status === 'REJECTED' && (
                <div
                  style={{
                    padding: 'var(--spacing-3) var(--spacing-4)',
                    backgroundColor: 'var(--color-error-bg)',
                    border: '1px solid var(--color-error-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-error)',
                    fontSize: 'var(--font-size-sm)',
                    marginBottom: 'var(--spacing-5)',
                  }}
                >
                  <strong>Order Declined: </strong> {selectedOrder.rejectionReason}
                </div>
              )}

              {/* Line Items */}
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 'var(--spacing-2)' }}>
                Ordered Products
              </h3>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 'var(--spacing-5)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--color-text-muted)' }}>Product</th>
                      <th style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--color-text-muted)', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--color-text-muted)', textAlign: 'right' }}>Unit Price</th>
                      <th style={{ padding: 'var(--spacing-2) var(--spacing-3)', color: 'var(--color-text-muted)', textAlign: 'right' }}>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedOrder.items || []).map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: 'var(--spacing-3)' }}>
                          <div style={{ fontWeight: 600 }}>{it.name}</div>
                          {it.description && (
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{it.description}</div>
                          )}
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
                        Total PO Amount:
                      </td>
                      <td style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: 800, color: 'var(--color-primary)' }}>
                        ₹{Number(selectedOrder.totalAmount).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Delivery Details Section */}
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 'var(--spacing-2)' }}>
                📍 Customer Delivery Destination
              </h3>
              {selectedOrder.deliveryDetails?.address ? (
                <div
                  style={{
                    padding: 'var(--spacing-4)',
                    backgroundColor: 'rgba(16, 185, 129, 0.06)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: 'var(--radius-md)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 'var(--spacing-3)',
                    marginBottom: 'var(--spacing-5)',
                  }}
                >
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Street Address</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-main)' }}>
                      {selectedOrder.deliveryDetails.address}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>City, State, Postal Code</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                      {[selectedOrder.deliveryDetails.city, selectedOrder.deliveryDetails.state, selectedOrder.deliveryDetails.postalCode]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Recipient Contact</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                      👤 {selectedOrder.deliveryDetails.contactName} ({selectedOrder.deliveryDetails.contactPhone})
                    </div>
                  </div>

                  {selectedOrder.deliveryDetails.deliveryInstructions && (
                    <div style={{ gridColumn: 'span 2', borderTop: '1px dashed var(--color-border)', paddingTop: 'var(--spacing-2)', marginTop: 'var(--spacing-1)' }}>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Special Instructions</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-main)', fontStyle: 'italic' }}>
                        "{selectedOrder.deliveryDetails.deliveryInstructions}"
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    padding: 'var(--spacing-4)',
                    backgroundColor: 'var(--color-bg)',
                    border: '1px dashed var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text-muted)',
                    fontSize: 'var(--font-size-sm)',
                    marginBottom: 'var(--spacing-5)',
                  }}
                >
                  ⏳ Destination delivery information has not yet been submitted by the customer. Delivery details will be displayed here as soon as the requester submits them.
                </div>
              )}

              {/* Smart Availability Check (Part 2, Part 7) */}
              {(() => {
                const requestedQty = (selectedOrder.items || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
                const allItemsAvailable = (selectedOrder.items || []).every((it) => {
                  const stock = it.product?.availableQuantity !== undefined ? it.product.availableQuantity : 999;
                  const isAvail = it.product?.isAvailable !== false && it.product?.isActive !== false;
                  return stock >= it.quantity && isAvail;
                });
                const minStockAvailable = (selectedOrder.items || []).reduce((min, it) => {
                  const stock = it.product?.availableQuantity ?? 0;
                  return stock < min ? stock : min;
                }, 999999);

                return (
                  <div style={{ marginBottom: 'var(--spacing-5)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 'var(--spacing-2)' }}>
                      ⚡ Smart Availability Check
                    </h3>
                    {allItemsAvailable ? (
                      <div
                        style={{
                          padding: 'var(--spacing-4)',
                          backgroundColor: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#065f46', fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: '8px' }}>
                          <span>✓</span> <span>Available — Ready for Acceptance</span>
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: '#047857', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div>✓ Product is active & catalog listed</div>
                          <div>✓ Product is marked available</div>
                          <div>✓ Requested quantity: {requestedQty} units (Current available stock: {minStockAvailable} units)</div>
                          <div>✓ Vendor can fulfill this quantity</div>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: 'var(--spacing-4)',
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontWeight: 700, fontSize: 'var(--font-size-sm)', marginBottom: '8px' }}>
                          <span>✕</span> <span>Insufficient Stock — Cannot Fulfill Order</span>
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: '#991b1b', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div>✕ Requested quantity ({requestedQty} units) exceeds available catalog stock ({minStockAvailable} units available).</div>
                          <div>✕ You cannot accept this order due to inventory shortage. Please decline this order.</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Status History */}
              {selectedOrder.statusHistory?.length > 0 && (
                <div>
                  <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 'var(--spacing-2)' }}>
                    Fulfillment History & Log
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                    {selectedOrder.statusHistory.map((hist, hIdx) => (
                      <div
                        key={hIdx}
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          padding: 'var(--spacing-2) var(--spacing-3)',
                          backgroundColor: 'var(--color-bg)',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <strong>{hist.status}</strong>: {hist.notes || 'Status updated'}
                        </div>
                        <span style={{ color: 'var(--color-text-light)' }}>
                          {hist.changedAt ? new Date(hist.changedAt).toLocaleString() : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {(() => {
              const requestedQty = (selectedOrder.items || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
              const allItemsAvailable = (selectedOrder.items || []).every((it) => {
                const stock = it.product?.availableQuantity !== undefined ? it.product.availableQuantity : 999;
                const isAvail = it.product?.isAvailable !== false && it.product?.isActive !== false;
                return stock >= it.quantity && isAvail;
              });
              const minStockAvailable = (selectedOrder.items || []).reduce((min, it) => {
                const stock = it.product?.availableQuantity ?? 0;
                return stock < min ? stock : min;
              }, 999999);

              return (
                <div
                  style={{
                    padding: 'var(--spacing-4) var(--spacing-6)',
                    borderTop: '1px solid var(--color-border)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 'var(--spacing-2)',
                    backgroundColor: 'var(--color-surface)',
                  }}
                >
                  <Button variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>
                    Close
                  </Button>

                  {selectedOrder.status === 'SENT_TO_VENDOR' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const id = selectedOrder._id;
                          if (!allItemsAvailable) {
                            setRejectionReason(`Insufficient stock: only ${minStockAvailable} units available (Requested: ${requestedQty})`);
                          }
                          setSelectedOrder(null);
                          handleOpenRejectModal(id);
                        }}
                        style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                      >
                        ✕ Decline Order
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleAcceptOrder(selectedOrder._id)}
                        disabled={actionLoading || !allItemsAvailable}
                        style={{
                          backgroundColor: allItemsAvailable ? 'var(--color-success)' : '#9ca3af',
                          borderColor: allItemsAvailable ? 'var(--color-success)' : '#9ca3af',
                          cursor: allItemsAvailable ? 'pointer' : 'not-allowed',
                        }}
                      >
                        {actionLoading ? 'Processing...' : '✓ Accept Order'}
                      </Button>
                    </>
                  )}

                  {selectedOrder.status === 'PENDING_CONFIRMATION' && (
                    <div
                      style={{
                        padding: '0.4rem 0.8rem',
                        backgroundColor: '#fef3c7',
                        border: '1px solid #fde68a',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)',
                        color: '#92400e',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>⏳</span>
                      <span>Preliminary acceptance sent. Awaiting customer confirmation.</span>
                    </div>
                  )}

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
              );
            })()}
          </div>
        </div>
      )}

      {/* Decline Reason Modal */}
      {showRejectModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--spacing-4)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '480px',
              padding: 'var(--spacing-6)',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--color-border)',
            }}
          >
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-error)', marginBottom: 'var(--spacing-2)' }}>
              Decline Purchase Order
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-4)' }}>
              Please state the reason for declining this order (e.g. stock limitation, production backorder, delivery date infeasibility). The corporate buyer will be notified immediately.
            </p>

            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter mandatory reason for declining..."
              required
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-error-border)',
                fontSize: 'var(--font-size-sm)',
                outline: 'none',
                backgroundColor: 'var(--color-bg)',
                fontFamily: 'inherit',
                marginBottom: 'var(--spacing-4)',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-2)' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRejectModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmReject}
                disabled={actionLoading || !rejectionReason.trim()}
                style={{ backgroundColor: 'var(--color-error)', borderColor: 'var(--color-error)' }}
              >
                {actionLoading ? 'Declining...' : 'Confirm Decline'}
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

export default VendorOrdersPage;
