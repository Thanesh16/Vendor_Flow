import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import purchaseRequestService from '../../services/purchaseRequestService';
import purchaseOrderService from '../../services/purchaseOrderService';
import { getImageUrl } from '../../utils/imageUrl';

export const PurchaseRequestDetailModal = ({
  isOpen,
  onClose,
  request,
  currentUser,
  onRequestUpdated,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Availability & PO Creation state
  const [showAvailability, setShowAvailability] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityResult, setAvailabilityResult] = useState(null);
  const [issuingPO, setIssuingPO] = useState(false);
  const [poSuccess, setPoSuccess] = useState('');

  if (!isOpen || !request) return null;

  const isEmployee = currentUser?.role === 'EMPLOYEE';
  const isProcurementOrAdmin = ['ADMIN', 'PROCUREMENT_MANAGER'].includes(currentUser?.role);
  const isOwner =
    request.requestedBy?._id === currentUser?.id ||
    request.requestedBy === currentUser?.id;

  const totalCost = (request.items || []).reduce(
    (acc, it) => acc + (it.quantity || 0) * (it.estimatedPrice || 0),
    0
  );

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'SUBMITTED':
        return 'info';
      case 'REJECTED':
        return 'error';
      case 'CANCELLED':
        return 'neutral';
      case 'DRAFT':
      default:
        return 'warning';
    }
  };

  const getPriorityBadgeVariant = (priority) => {
    switch (priority) {
      case 'URGENT':
        return 'error';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'info';
      default:
        return 'neutral';
    }
  };

  const handleSubmitDraft = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await purchaseRequestService.submit(request._id);
      if (response.data?.purchaseRequest) {
        onRequestUpdated(response.data.purchaseRequest);
      }
    } catch (err) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!window.confirm('Are you sure you want to approve this purchase request?')) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await purchaseRequestService.approve(request._id);
      if (response.data?.purchaseRequest) {
        onRequestUpdated(response.data.purchaseRequest);
      }
    } catch (err) {
      setError(err.message || 'Failed to approve request');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await purchaseRequestService.reject(request._id, rejectionReason);
      if (response.data?.purchaseRequest) {
        onRequestUpdated(response.data.purchaseRequest);
        setShowRejectInput(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to reject request');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this purchase request?')) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await purchaseRequestService.cancel(request._id);
      if (response.data?.purchaseRequest) {
        onRequestUpdated(response.data.purchaseRequest);
      }
    } catch (err) {
      setError(err.message || 'Failed to cancel request');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAvailability = async () => {
    setAvailabilityLoading(true);
    setError('');
    setPoSuccess('');
    setShowAvailability(true);
    try {
      const response = await purchaseRequestService.checkAvailability(request._id);
      if (response.data) {
        setAvailabilityResult(response.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to check catalog availability');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleSelectCandidateAndIssuePO = async (candidate, reqItem) => {
    const vendorName = candidate.vendor?.companyName || 'Supplier';
    const prodName = candidate.product?.productName || reqItem.name;
    const qty = reqItem.quantity || candidate.requestedQuantity || 1;
    const totalAmount = candidate.unitPrice * qty;

    if (
      !window.confirm(
        `Are you sure you want to issue a Purchase Order to '${vendorName}' for ${qty}x ${prodName} (Total: ₹${totalAmount.toLocaleString()})?`
      )
    ) {
      return;
    }

    setIssuingPO(true);
    setError('');
    try {
      const poPayload = {
        purchaseRequestId: request._id,
        vendorId: candidate.vendor._id,
        productId: candidate.product._id,
        items: [
          {
            name: prodName,
            quantity: qty,
            unitPrice: candidate.unitPrice,
            totalPrice: totalAmount,
            product: candidate.product._id,
            description: candidate.product.description || reqItem.description,
          },
        ],
        notes: `Generated from Approved Requisition ${request.requestNumber}`,
      };

      const response = await purchaseOrderService.createPurchaseOrder(poPayload);
      if (response.data?.purchaseOrder) {
        setPoSuccess(
          `✓ Purchase Order ${response.data.purchaseOrder.poNumber} has been successfully issued to ${vendorName}!`
        );
      }
    } catch (err) {
      setError(err.message || 'Failed to issue purchase order');
    } finally {
      setIssuingPO(false);
    }
  };

  return (
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
          maxWidth: '780px',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: '4px' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.05em' }}>
                {request.requestNumber}
              </span>
              <Badge variant={getStatusBadgeVariant(request.status)}>
                {request.status}
              </Badge>
              <Badge variant={getPriorityBadgeVariant(request.priority)}>
                {request.priority} PRIORITY
              </Badge>
            </div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-main)' }}>
              {request.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 'var(--font-size-xl)',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 'var(--spacing-6)', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                backgroundColor: 'var(--color-error-bg)',
                border: '1px solid var(--color-error-border)',
                color: 'var(--color-error)',
                padding: 'var(--spacing-3) var(--spacing-4)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
                marginBottom: 'var(--spacing-4)',
              }}
            >
              {error}
            </div>
          )}

          {showAvailability ? (
            <div>
              {/* Availability Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-4)' }}>
                <div>
                  <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-primary)' }}>
                    Live Supplier Availability & Smart Matching Engine
                  </h3>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Comparing requested items against real-time catalog stock from verified approved suppliers.
                  </p>
                </div>
                {availabilityResult && (
                  <Badge
                    variant={
                      availabilityResult.overallAvailability === 'AVAILABLE'
                        ? 'success'
                        : availabilityResult.overallAvailability === 'PARTIALLY AVAILABLE'
                        ? 'warning'
                        : 'error'
                    }
                    size="md"
                  >
                    ● OVERALL: {availabilityResult.overallAvailability}
                  </Badge>
                )}
              </div>

              {poSuccess && (
                <div
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: 'var(--color-success)',
                    padding: 'var(--spacing-3) var(--spacing-4)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    marginBottom: 'var(--spacing-4)',
                  }}
                >
                  {poSuccess}
                </div>
              )}

              {availabilityLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-12) 0', color: 'var(--color-text-muted)' }}>
                  <div style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--spacing-2)' }}>🔄</div>
                  <div>Querying approved supplier catalogs and computing match scores...</div>
                </div>
              ) : availabilityResult?.items ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
                  {availabilityResult.items.map((it, idx) => (
                    <div
                      key={idx}
                      style={{
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Item header */}
                      <div
                        style={{
                          backgroundColor: 'var(--color-bg)',
                          padding: 'var(--spacing-3) var(--spacing-4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: '1px solid var(--color-border)',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-main)' }}>
                            Item #{idx + 1}: {it.item.name}
                          </span>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginLeft: 'var(--spacing-2)' }}>
                            (Requested Qty: <strong>{it.requestedQuantity}</strong> {it.item.category ? `| Category: ${it.item.category}` : ''})
                          </span>
                        </div>
                        <Badge variant={it.hasSufficientStock ? 'success' : 'warning'} size="sm">
                          {it.hasSufficientStock ? 'Sufficient In-Stock' : 'Limited In-Stock'}
                        </Badge>
                      </div>

                      {/* Candidates */}
                      <div style={{ padding: 'var(--spacing-4)' }}>
                        {it.candidates.length === 0 ? (
                          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: 'var(--spacing-2) 0' }}>
                            No matching approved vendor catalog items found for this requisition specification.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                            {it.candidates.map((cand, cIdx) => (
                              <div
                                key={cIdx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: 'var(--spacing-3) var(--spacing-4)',
                                  backgroundColor: 'var(--color-surface)',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--color-border)',
                                  gap: 'var(--spacing-4)',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', flex: 1 }}>
                                  {/* Product image thumbnail */}
                                  <div
                                    style={{
                                      width: '48px',
                                      height: '48px',
                                      borderRadius: 'var(--radius-sm)',
                                      backgroundColor: 'var(--color-bg)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      overflow: 'hidden',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {cand.product.images?.[0]?.url ? (
                                      <img
                                        src={getImageUrl(cand.product.images[0].url)}
                                        alt={cand.product.productName}
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: '2px', backgroundColor: '#ffffff' }}
                                        onError={(e) => {
                                          e.target.onerror = null;
                                          e.target.src = 'https://placehold.co/100x100?text=Item';
                                        }}
                                      />
                                    ) : (
                                      <span style={{ fontSize: '20px' }}>📦</span>
                                    )}
                                  </div>

                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-main)' }}>
                                        {cand.product.productName}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: '10px',
                                          fontWeight: 800,
                                          padding: '2px 6px',
                                          borderRadius: 'var(--radius-full)',
                                          backgroundColor: cand.matchScore >= 80 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                          color: cand.matchScore >= 80 ? 'var(--color-success)' : 'var(--color-primary)',
                                        }}
                                      >
                                        🎯 {cand.matchScore}% Match
                                      </span>
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                      Supplier: <strong>{cand.vendor?.companyName}</strong> ({cand.vendor?.city || 'Verified'}) | SLA: <strong>{cand.deliveryDays} days</strong>
                                    </div>
                                  </div>
                                </div>

                                {/* Stock & Price */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)' }}>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                                      Available Stock
                                    </div>
                                    <span
                                      style={{
                                        fontSize: 'var(--font-size-xs)',
                                        fontWeight: 700,
                                        color: cand.stockStatus === 'AVAILABLE' ? 'var(--color-success)' : 'var(--color-warning)',
                                      }}
                                    >
                                      {cand.availableQuantity} in stock
                                    </span>
                                  </div>

                                  <div style={{ textAlign: 'right', minWidth: '90px' }}>
                                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                                      Unit Price
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-primary)' }}>
                                      ₹{Number(cand.unitPrice).toLocaleString()}
                                    </div>
                                  </div>

                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleSelectCandidateAndIssuePO(cand, it.item)}
                                    disabled={issuingPO || cand.stockStatus === 'NOT AVAILABLE'}
                                  >
                                    {issuingPO ? 'Issuing...' : 'Select & Issue PO'}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {/* Metadata Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--spacing-4)',
              backgroundColor: 'var(--color-bg)',
              padding: 'var(--spacing-4)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-5)',
            }}
          >
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
                Requested By
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-main)' }}>
                {request.requestedBy?.name || 'Unknown Requester'}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>
                {request.requestedBy?.email || ''}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
                Date Created
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-main)' }}>
                {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'N/A'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
                Required By Date
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-main)' }}>
                {request.requiredDate ? new Date(request.requiredDate).toLocaleDateString() : 'Immediate'}
              </div>
            </div>

            {request.description && (
              <div style={{ gridColumn: 'span 3', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-3)', marginTop: 'var(--spacing-1)' }}>
                <div style={{ fontSize: 'var(--size-xs, 0.75rem)', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
                  Business Justification & Need
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)' }}>
                  {request.description}
                </div>
              </div>
            )}
          </div>

          {/* Selected Supplier Banner (If Already Selected) */}
          {request.selectionDetails?.productId && (
            <div
              style={{
                marginBottom: 'var(--spacing-5)',
                padding: 'var(--spacing-3) var(--spacing-4)',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid #10b981',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700, color: '#065f46', fontSize: '0.9375rem' }}>
                    ✓ Selected Supplier: {request.selectionDetails.vendorName}
                  </span>
                  <Badge variant="success" dot={false} size="sm">Confirmed Selection</Badge>
                  {request.selectionDetails.matchScore && (
                    <Badge variant="neutral" dot={false} size="sm">{request.selectionDetails.matchScore}% Score</Badge>
                  )}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-main)' }}>
                  Product: <strong>{request.selectionDetails.productName}</strong> | Rate: ₹{request.selectionDetails.unitPrice?.toLocaleString()} | Total: ₹{request.selectionDetails.totalPrice?.toLocaleString()} | Lead Time: {request.selectionDetails.deliveryDays}d
                </div>
              </div>
              {isProcurementOrAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    navigate(`/procurement/matching/${request._id}`);
                  }}
                >
                  View Smart Comparison ➔
                </Button>
              )}
            </div>
          )}

          {/* Line Items Table */}
          <div style={{ marginBottom: 'var(--spacing-5)' }}>
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', marginBottom: 'var(--spacing-2)' }}>
              Requisition Line Items ({request.items?.length || 0})
            </h3>
            <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)' }}>#</th>
                    <th style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Item Name & Spec</th>
                    <th style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Est. Unit Price</th>
                    <th style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Est. Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(request.items || []).map((item, idx) => {
                    const lineTotal = (item.quantity || 0) * (item.estimatedPrice || 0);
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: 'var(--spacing-3)', color: 'var(--color-text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: 'var(--spacing-3)' }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{item.name}</div>
                          {item.description && (
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: 'var(--spacing-3)', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                        <td style={{ padding: 'var(--spacing-3)', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                          ₹{(item.estimatedPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-main)' }}>
                          ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: 'rgba(30, 58, 138, 0.04)' }}>
                    <td colSpan={4} style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                      Total Estimated Budget:
                    </td>
                    <td style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: 800, fontSize: 'var(--font-size-base)', color: 'var(--color-primary)' }}>
                      ₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Audit / Review Information Section */}
          {(request.reviewedBy || request.status === 'APPROVED' || request.status === 'REJECTED') && (
            <div
              style={{
                padding: 'var(--spacing-4)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: request.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                border: `1px solid ${request.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                marginBottom: 'var(--spacing-4)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-2)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: request.status === 'APPROVED' ? 'var(--color-success)' : 'var(--color-error)' }}>
                  {request.status === 'APPROVED' ? '✓ Approval Record' : '✕ Rejection Record'}
                </span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : ''}
                </span>
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)' }}>
                Reviewed by: <strong>{request.reviewedBy?.name || 'Procurement Management'}</strong> ({request.reviewedBy?.email || 'procurement@vendorflow.local'})
              </div>
              {request.rejectionReason && (
                <div style={{ marginTop: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-error)' }}>
                  <strong>Reason: </strong> {request.rejectionReason}
                </div>
              )}
            </div>
          )}

          {/* Inline Rejection Input Form (Procurement Manager / Admin) */}
          {showRejectInput && (
            <div
              style={{
                padding: 'var(--spacing-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-error-border)',
                backgroundColor: 'var(--color-error-bg)',
                marginBottom: 'var(--spacing-4)',
              }}
            >
              <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-error)', marginBottom: 'var(--spacing-1)' }}>
                Reason for Rejection *
              </label>
              <textarea
                rows={2}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Specify reason for rejecting this requisition (e.g. over budget, missing specifications)..."
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-error-border)',
                  fontSize: 'var(--font-size-sm)',
                  outline: 'none',
                  backgroundColor: 'var(--color-surface)',
                  fontFamily: 'inherit',
                  marginBottom: 'var(--spacing-2)',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-2)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRejectInput(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleReject}
                  disabled={loading}
                  style={{ backgroundColor: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                >
                  {loading ? 'Rejecting...' : 'Confirm Rejection'}
                </Button>
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: 'var(--spacing-4) var(--spacing-6)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Close
          </Button>

          <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
            {/* Employee Actions */}
            {isEmployee && isOwner && request.status === 'DRAFT' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={loading}
                  style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                >
                  Cancel Requisition
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSubmitDraft}
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : 'Submit Requisition'}
                </Button>
              </>
            )}

            {isEmployee && isOwner && request.status === 'SUBMITTED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={loading}
                style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
              >
                Cancel Requisition
              </Button>
            )}

            {/* Procurement Manager / Admin Review Actions */}
            {isProcurementOrAdmin && request.status === 'SUBMITTED' && !showRejectInput && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRejectInput(true)}
                  disabled={loading}
                  style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                >
                  ✕ Reject Requisition
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApprove}
                  disabled={loading}
                  style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                >
                  {loading ? 'Approving...' : '✓ Approve Requisition'}
                </Button>
              </>
            )}

            {/* Procurement Manager / Admin: Check Live Availability for APPROVED Requisitions */}
            {isProcurementOrAdmin && request.status === 'APPROVED' && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    onClose();
                    navigate(`/procurement/matching/${request._id}`);
                  }}
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  🎯 Smart Supplier Matching & Comparison ➔
                </Button>
                {!showAvailability && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCheckAvailability}
                    disabled={loading || availabilityLoading}
                  >
                    {availabilityLoading ? 'Checking...' : 'Quick Check'}
                  </Button>
                )}
              </>
            )}

            {showAvailability && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAvailability(false)}
              >
                ← Back to Requisition
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseRequestDetailModal;
