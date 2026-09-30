import React, { useState, useEffect, useCallback } from 'react';
import Card, { CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import ReceiptModal from '../../components/receipt/ReceiptModal';
import EvaluationModal from '../../components/evaluation/EvaluationModal';
import purchaseOrderService from '../../services/purchaseOrderService';
import receiptService from '../../services/receiptService';
import { getImageUrl } from '../../utils/imageUrl';

export const EmployeeOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [evaluatingOrder, setEvaluatingOrder] = useState(null);
  const [confirmingOrderId, setConfirmingOrderId] = useState(null);

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

  // Delivery Modal State
  const [activeOrderForDelivery, setActiveOrderForDelivery] = useState(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [savingDelivery, setSavingDelivery] = useState(false);

  const fetchOrders = useCallback(
    async (currentPage = page, currentLimit = limit, currentSearch = searchQuery, currentStatus = statusFilter, currentSort = sortBy, currentSortOrder = sortOrder) => {
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
        setError(err.message || 'Failed to load your purchase orders');
      } finally {
        setLoading(false);
      }
    },
    [page, limit, searchQuery, statusFilter, sortBy, sortOrder]
  );

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

  const openDeliveryModal = (order) => {
    setActiveOrderForDelivery(order);
    if (order.deliveryDetails) {
      setAddress(order.deliveryDetails.address || '');
      setCity(order.deliveryDetails.city || '');
      setState(order.deliveryDetails.state || '');
      setPostalCode(order.deliveryDetails.postalCode || '');
      setContactName(order.deliveryDetails.contactName || '');
      setContactPhone(order.deliveryDetails.contactPhone || '');
      setDeliveryInstructions(order.deliveryDetails.deliveryInstructions || '');
    } else {
      setAddress('');
      setCity('');
      setState('');
      setPostalCode('');
      setContactName('');
      setContactPhone('');
      setDeliveryInstructions('');
    }
  };

  const handleSaveDeliveryDetails = async (e) => {
    e.preventDefault();
    if (!address.trim() || !contactName.trim() || !contactPhone.trim()) {
      alert('Please provide street address, contact person name, and phone number.');
      return;
    }

    setSavingDelivery(true);
    setError('');
    try {
      const response = await purchaseOrderService.updateDeliveryDetails(
        activeOrderForDelivery._id,
        {
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          postalCode: postalCode.trim(),
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          deliveryInstructions: deliveryInstructions.trim(),
        }
      );

      if (response.data?.purchaseOrder) {
        setOrders((prev) =>
          prev.map((o) => (o._id === activeOrderForDelivery._id ? response.data.purchaseOrder : o))
        );
        setActiveOrderForDelivery(null);
        setSuccessMsg(`✓ Delivery information submitted for order ${response.data.purchaseOrder.poNumber}! The supplier has received your destination address.`);
      }
    } catch (err) {
      setError(err.message || 'Failed to submit delivery details');
    } finally {
      setSavingDelivery(false);
    }
  };

  const handleDownloadReceipt = async (order) => {
    setDownloadingId(order._id);
    setError('');
    try {
      await receiptService.downloadReceiptForOrder(order._id, order.poNumber);
    } catch (err) {
      console.error('Failed to download receipt PDF:', err);
      setError('Unable to generate receipt. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleEvaluationSuccess = (newEvaluation) => {
    if (!evaluatingOrder) return;
    setOrders((prev) =>
      prev.map((o) =>
        o._id === evaluatingOrder._id
          ? { ...o, evaluation: newEvaluation, isEvaluated: true }
          : o
      )
    );
    setSuccessMsg(
      `✓ Evaluation submitted successfully for order ${evaluatingOrder.poNumber}! Thank you for rating your purchase.`
    );
    setEvaluatingOrder(null);
  };

  const handleRequesterConfirmOrder = async (orderId) => {
    setConfirmingOrderId(orderId);
    setError('');
    setSuccessMsg('');
    try {
      const res = await purchaseOrderService.confirmPurchaseOrder(orderId);
      if (res.success) {
        setSuccessMsg('✓ Order offer confirmed and officially issued! Supplier inventory has been committed.');
        await fetchOrders();
      } else {
        setError(res.message || 'Failed to confirm purchase order');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to confirm purchase order');
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const handleRequesterRejectOrder = async (orderId) => {
    const reason = window.prompt('Please enter a reason for declining this order offer (optional):', 'Price variation exceeds budget');
    if (reason === null) return;
    setConfirmingOrderId(orderId);
    setError('');
    setSuccessMsg('');
    try {
      const res = await purchaseOrderService.requesterRejectPurchaseOrder(orderId, reason);
      if (res.success) {
        setSuccessMsg('Order offer declined. No inventory was deducted.');
        await fetchOrders();
      } else {
        setError(res.message || 'Failed to decline order offer');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to decline order offer');
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'SENT_TO_VENDOR':
        return 'warning';
      case 'PENDING_CONFIRMATION':
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

  const stepOrder = ['SENT_TO_VENDOR', 'PENDING_CONFIRMATION', 'ACCEPTED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

  const getStepIndex = (status) => {
    const idx = stepOrder.indexOf(status);
    return idx >= 0 ? idx : -1;
  };

  return (
    <div style={{ padding: 'var(--spacing-6)', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-6)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-main)', letterSpacing: '-0.02em' }}>
            My Orders & Delivery Tracking
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Track order fulfillment for your approved requisitions, submit destination shipping details, and follow real-time supplier dispatch.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
          🔄 Refresh
        </Button>
      </div>

      {successMsg && (
        <div
          style={{
            padding: 'var(--spacing-3) var(--spacing-4)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: 'var(--color-success)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            marginBottom: 'var(--spacing-4)',
          }}
        >
          {successMsg}
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

      {/* Status Filter Tabs & Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-5)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', overflowX: 'auto', paddingBottom: '2px' }}>
          {[
            { key: 'ALL', label: `All Orders (${pagination.total || orders.length})` },
            { key: 'SENT_TO_VENDOR', label: 'Pending Supplier' },
            { key: 'PENDING_CONFIRMATION', label: 'Requires Your Approval' },
            { key: 'ACCEPTED', label: 'Accepted / Issued' },
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
                border: statusFilter === tab.key ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                backgroundColor: statusFilter === tab.key ? 'var(--color-primary)' : 'var(--color-surface)',
                color: statusFilter === tab.key ? '#fff' : 'var(--color-text-main)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
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
              placeholder="Search PO#, product..."
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
                  fontSize: '12px',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {(searchQuery || statusFilter !== 'ALL' || sortBy !== 'createdAt' || sortOrder !== 'desc') && (
            <button
              type="button"
              onClick={clearFilters}
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-16) 0', color: 'var(--color-text-muted)' }}>
          Loading your purchase orders...
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardBody style={{ textAlign: 'center', padding: 'var(--spacing-16) var(--spacing-4)' }}>
            <div style={{ fontSize: '42px', marginBottom: 'var(--spacing-2)' }}>📦</div>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-main)' }}>
              No Active Purchase Orders Yet
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Once your Purchase Requests are approved and procurement issues orders to suppliers, they will appear here with live tracking.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-5)' }}>
          {orders.map((order) => {
            const hasAddress = Boolean(order.deliveryDetails?.address);
            const currentStep = getStepIndex(order.status);
            const isRejected = order.status === 'REJECTED';
            const isDelivered = order.status === 'DELIVERED' || order.status === 'COMPLETED';

            return (
              <Card key={order._id} style={{ border: '1px solid var(--color-border)' }}>
                <CardBody style={{ padding: 'var(--spacing-6)' }}>
                  {/* Top Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-4)', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                      <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '0.04em' }}>
                        {order.poNumber}
                      </span>
                      <Badge variant={getStatusBadgeVariant(order.status)} size="md">
                        {order.status}
                      </Badge>
                      {order.purchaseRequest?.requestNumber && (
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                          Requisition: <strong>{order.purchaseRequest.requestNumber}</strong>
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-main)' }}>
                        Total: ₹{Number(order.totalAmount).toLocaleString()}
                      </span>

                      {/* Before Delivery: Provide or Edit Address */}
                      {!isDelivered && order.status === 'ACCEPTED' && !hasAddress && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => openDeliveryModal(order)}
                          style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                        >
                          📍 Provide Delivery Address
                        </Button>
                      )}
                      {!isDelivered && hasAddress && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeliveryModal(order)}
                        >
                          Edit Delivery Address
                        </Button>
                      )}

                      {/* After Delivery: View / Download Receipt & Rate Order / Evaluation Submitted */}
                      {isDelivered && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedOrderForReceipt(order._id)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          >
                            👁 View Receipt
                          </Button>

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleDownloadReceipt(order)}
                            disabled={downloadingId === order._id}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          >
                            {downloadingId === order._id ? '⏳ Downloading...' : '📄 Download PDF'}
                          </Button>

                          {!order.isEvaluated ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setEvaluatingOrder(order)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                backgroundColor: '#fef3c7',
                                color: '#92400e',
                                borderColor: '#fde68a',
                                fontWeight: 700,
                              }}
                            >
                              ⭐ Rate Order
                            </Button>
                          ) : (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '0.35rem 0.75rem',
                                backgroundColor: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                color: '#166534',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 700,
                              }}
                            >
                              <span>✓ Evaluation Submitted</span>
                              {order.evaluation?.overallScore ? (
                                <span style={{ color: '#ca8a04', marginLeft: '2px' }}>
                                  ★ {Math.round(order.evaluation.overallScore / 20)}/5
                                </span>
                              ) : null}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price Variation & Mandatory Requester Confirmation Banner (Part 1, 3, 4, 6) */}
                  {order.status === 'PENDING_CONFIRMATION' && (
                    <div
                      style={{
                        margin: 'var(--spacing-4) 0',
                        padding: 'var(--spacing-4)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: (order.priceDifference > 0) ? 'rgba(245, 158, 11, 0.08)' : (order.priceDifference < 0) ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                        border: `1px solid ${order.priceDifference > 0 ? '#f59e0b' : order.priceDifference < 0 ? '#10b981' : '#3b82f6'}`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--spacing-3)' }}>
                        <div style={{ flex: 1, minWidth: '280px' }}>
                          <div style={{ fontWeight: 800, fontSize: 'var(--font-size-sm)', color: order.priceDifference > 0 ? '#b45309' : order.priceDifference < 0 ? '#047857' : '#1d4ed8' }}>
                            {order.priceDifference > 0
                              ? '⚠️ Vendor price is higher than your requested price.'
                              : order.priceDifference < 0
                              ? '🎉 Good news! The vendor price is lower than your requested price.'
                              : '✓ Vendor Price Matches Your Target Price'}
                          </div>
                          <p style={{ margin: '4px 0 8px 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-main)' }}>
                            {order.priceDifference > 0
                              ? 'The supplier has verified stock and offered this product with an additional amount. Your approval is required before the order can be officially issued and inventory committed.'
                              : order.priceDifference < 0
                              ? 'The supplier offered a lower catalog price than you requested. Confirm this offer to officially issue the order.'
                              : 'The supplier verified availability and accepted the order at your requested price. Confirm to officially issue.'}
                          </p>

                          {/* 4-Box Price Metric Comparison */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', fontSize: 'var(--font-size-xs)' }}>
                            <div style={{ backgroundColor: 'var(--color-bg)', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                              <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Requester Requested Price:</span>
                              <strong>₹{Number(order.requesterRequestedPrice || order.items?.[0]?.requesterRequestedPrice || 0).toLocaleString('en-IN')}/unit</strong>
                            </div>
                            <div style={{ backgroundColor: 'var(--color-bg)', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                              <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Vendor Price:</span>
                              <strong>₹{Number(order.vendorUnitPrice || order.items?.[0]?.unitPrice || 0).toLocaleString('en-IN')}/unit</strong>
                            </div>
                            <div style={{ backgroundColor: 'var(--color-bg)', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                              <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>
                                {order.priceDifference > 0 ? 'Additional Amount:' : order.priceDifference < 0 ? 'You Save:' : 'Difference:'}
                              </span>
                              <strong style={{ color: order.priceDifference > 0 ? '#b45309' : order.priceDifference < 0 ? '#047857' : 'inherit' }}>
                                {order.priceDifference > 0 ? `+₹${order.priceDifference.toLocaleString('en-IN')}/unit` : order.priceDifference < 0 ? `-₹${Math.abs(order.priceDifference).toLocaleString('en-IN')}/unit` : '₹0'}
                              </strong>
                            </div>
                            <div style={{ backgroundColor: 'var(--color-bg)', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                              <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Total Order Commitment:</span>
                              <strong style={{ color: 'var(--color-primary)' }}>₹{Number(order.totalAmount).toLocaleString('en-IN')}</strong>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', alignSelf: 'center', flexWrap: 'wrap' }}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRequesterRejectOrder(order._id)}
                            disabled={confirmingOrderId === order._id}
                            style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                          >
                            ✕ Reject / Decline
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleRequesterConfirmOrder(order._id)}
                            disabled={confirmingOrderId === order._id}
                            style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                          >
                            {confirmingOrderId === order._id ? 'Confirming...' : '✓ Accept / Approve Offer'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Supplier & Items Banner */}
                  <div
                    style={{
                      padding: 'var(--spacing-3) var(--spacing-4)',
                      backgroundColor: 'var(--color-bg)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 'var(--spacing-4)',
                      flexWrap: 'wrap',
                      gap: 'var(--spacing-2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Assigned Supplier: </span>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          minWidth: '28px',
                          borderRadius: 'var(--radius-sm)',
                          overflow: 'hidden',
                          backgroundColor: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {order.vendor?.shopImage ? (
                          <img
                            src={getImageUrl(order.vendor.shopImage)}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              if (e.target.nextSibling) e.target.nextSibling.style.display = 'inline';
                            }}
                          />
                        ) : null}
                        <span style={{ display: order.vendor?.shopImage ? 'none' : 'inline', fontSize: '14px' }}>🏢</span>
                      </div>
                      <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)' }}>
                        {order.vendor?.companyName || 'Verified Supplier'}
                      </strong>
                      {order.vendor?.contactPerson && (
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', marginLeft: 'var(--spacing-1)' }}>
                          (Contact: {order.vendor.contactPerson}, {order.vendor.phone})
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      Ordered Items: <strong>{order.items?.map((i) => `${i.quantity}x ${i.name}`).join(', ')}</strong>
                    </div>
                  </div>

                  {/* Visual Progress Stepper (if not rejected) */}
                  {!isRejected ? (
                    <div style={{ margin: 'var(--spacing-4) 0 var(--spacing-2) 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                        {stepOrder.map((step, idx) => {
                          const isDone = currentStep >= idx;
                          const isCurrent = currentStep === idx;
                          return (
                            <div
                              key={step}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                flex: 1,
                                position: 'relative',
                                zIndex: 2,
                              }}
                            >
                              <div
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: 'var(--radius-full)',
                                  backgroundColor: isDone ? 'var(--color-primary)' : 'var(--color-surface)',
                                  border: isDone ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                                  color: isDone ? '#fff' : 'var(--color-text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  boxShadow: isCurrent ? '0 0 0 4px rgba(30, 58, 138, 0.15)' : 'none',
                                }}
                              >
                                {isDone ? '✓' : idx + 1}
                              </div>
                              <span
                                style={{
                                  fontSize: '11px',
                                  marginTop: '6px',
                                  fontWeight: isCurrent ? 700 : 500,
                                  color: isDone ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                                  textAlign: 'center',
                                }}
                              >
                                {step.replace(/_/g, ' ')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: 'var(--spacing-3) var(--spacing-4)',
                        backgroundColor: 'var(--color-error-bg)',
                        border: '1px solid var(--color-error-border)',
                        color: 'var(--color-error)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-sm)',
                      }}
                    >
                      <strong>Declined by Supplier: </strong> {order.rejectionReason}
                    </div>
                  )}

                  {/* Delivery Details Card if submitted */}
                  {hasAddress && (
                    <div
                      style={{
                        marginTop: 'var(--spacing-4)',
                        padding: 'var(--spacing-3) var(--spacing-4)',
                        backgroundColor: isDelivered ? 'rgba(59, 130, 246, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                        border: isDelivered ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 'var(--spacing-2)',
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>📍 Delivery Address: </span>
                        <strong>{order.deliveryDetails.address}, {order.deliveryDetails.city}</strong> | Recipient: <strong>{order.deliveryDetails.contactName} ({order.deliveryDetails.contactPhone})</strong>
                        {order.deliveryDetails.deliveryInstructions && (
                          <div style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            Instructions: <em>{order.deliveryDetails.deliveryInstructions}</em>
                          </div>
                        )}
                      </div>
                      <span style={{ color: isDelivered ? '#2563eb' : 'var(--color-success)', fontWeight: 600 }}>
                        {isDelivered ? `✓ Delivered ${order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString() : ''}` : '✓ Ready for Dispatch'}
                      </span>
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {orders.length > 0 && (
        <div style={{ marginTop: 'var(--spacing-6)' }}>
          <Pagination
            page={pagination.page || page}
            limit={pagination.limit || limit}
            total={pagination.total || 0}
            totalPages={pagination.totalPages || 1}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
          />
        </div>
      )}

      {/* Destination Delivery Address Modal */}
      {activeOrderForDelivery && (
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
              maxWidth: '560px',
              padding: 'var(--spacing-6)',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-2)' }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-main)' }}>
                Destination Delivery Details
              </h3>
              <button
                type="button"
                onClick={() => setActiveOrderForDelivery(null)}
                style={{ background: 'none', border: 'none', fontSize: 'var(--font-size-xl)', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-4)' }}>
              Provide the exact office address, floor, and receiving personnel contact so the supplier ({activeOrderForDelivery.vendor?.companyName}) can dispatch order {activeOrderForDelivery.poNumber}.
            </p>

            <form onSubmit={handleSaveDeliveryDetails}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-4)' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px' }}>
                    Delivery Street Address *
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Tower B, 4th Floor, Tech Hub Facility"
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px' }}>
                    City *
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Bengaluru"
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px' }}>
                    State / Region
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Karnataka"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px' }}>
                    Postal Code / PIN
                  </label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="e.g. 560100"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px' }}>
                    Recipient Person Name *
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Alex Henderson"
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px' }}>
                    Recipient Contact Phone *
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '4px' }}>
                    Gate / Reception Delivery Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={deliveryInstructions}
                    onChange={(e) => setDeliveryInstructions(e.target.value)}
                    placeholder="e.g. Handover at 4th floor IT front desk; security gate pass required"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-sm)',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-2)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setActiveOrderForDelivery(null)}
                  disabled={savingDelivery}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={savingDelivery}
                  style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                >
                  {savingDelivery ? 'Submitting Address...' : 'Confirm Delivery Address'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Purchase Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(selectedOrderForReceipt)}
        onClose={() => setSelectedOrderForReceipt(null)}
        orderId={selectedOrderForReceipt}
      />

      {/* Post-Delivery Evaluation Modal */}
      <EvaluationModal
        isOpen={Boolean(evaluatingOrder)}
        onClose={() => setEvaluatingOrder(null)}
        order={evaluatingOrder}
        onSuccess={handleEvaluationSuccess}
      />
    </div>
  );
};

export default EmployeeOrdersPage;
