import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import purchaseRequestService from '../../services/purchaseRequestService';
import purchaseOrderService from '../../services/purchaseOrderService';
import Card, { CardBody, CardHeader } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';

export const ProcurementMatchingPage = () => {
  const { purchaseRequestId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const [purchaseRequest, setPurchaseRequest] = useState(null);
  const [matchingData, setMatchingData] = useState(null);
  const [selectedItemIdx, setSelectedItemIdx] = useState(0);

  // Filters & Sorting
  const [filterAvailability, setFilterAvailability] = useState('ALL');
  const [filterVendor, setFilterVendor] = useState('ALL');
  const [filterBudget, setFilterBudget] = useState('ALL');
  const [sortBy, setSortBy] = useState('MATCH_SCORE');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

  // Modals
  const [inspectCandidate, setInspectCandidate] = useState(null);
  const [selectCandidate, setSelectCandidate] = useState(null);
  const [selectionNotes, setSelectionNotes] = useState('');
  const [submittingSelection, setSubmittingSelection] = useState(false);

  // Create Purchase Order Modal state
  const [createPoCandidate, setCreatePoCandidate] = useState(null);
  const [poDeliveryDate, setPoDeliveryDate] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [creatingPo, setCreatingPo] = useState(false);
  const [poError, setPoError] = useState('');
  const [poSuccess, setPoSuccess] = useState(null);

  // Load requisition and run smart matching
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      // 1. Fetch Purchase Request
      const prRes = await purchaseRequestService.getById(purchaseRequestId);
      const pr = prRes.data?.purchaseRequest || prRes.data;
      setPurchaseRequest(pr);

      // 2. Fetch Live Availability & Smart Matches
      const matchRes = await purchaseRequestService.checkAvailability(purchaseRequestId);
      setMatchingData(matchRes.data || matchRes);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Failed to load matching candidates');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [purchaseRequestId]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Current item being compared
  const items = matchingData?.items || [];
  const currentItemMatch = items[selectedItemIdx] || items[0] || null;
  const candidates = currentItemMatch?.candidates || [];
  const bestMatch = currentItemMatch?.bestMatch || null;

  // Extract unique vendors for filter dropdown
  const uniqueVendors = Array.from(
    new Map(
      candidates.map((c) => [c.vendor?._id, c.vendor?.companyName])
    ).entries()
  ).filter(([id]) => Boolean(id));

  // Filter and sort candidates
  const filteredCandidates = candidates
    .filter((cand) => {
      if (filterAvailability !== 'ALL' && cand.availabilityStatus !== filterAvailability) {
        return false;
      }
      if (filterVendor !== 'ALL' && cand.vendor?._id !== filterVendor) {
        return false;
      }
      if (filterBudget !== 'ALL' && cand.priceStatus !== filterBudget) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'MATCH_SCORE') {
        return (b.matchScore || 0) - (a.matchScore || 0);
      }
      if (sortBy === 'PRICE_LOW') {
        return (a.unitPrice || 0) - (b.unitPrice || 0);
      }
      if (sortBy === 'PRICE_HIGH') {
        return (b.unitPrice || 0) - (a.unitPrice || 0);
      }
      if (sortBy === 'DELIVERY') {
        return (a.deliveryDays || 999) - (b.deliveryDays || 999);
      }
      if (sortBy === 'STOCK') {
        return (b.availableQuantity || 0) - (a.availableQuantity || 0);
      }
      return 0;
    });

  const getScoreBadgeColor = (score) => {
    if (score >= 80) return '#10b981'; // Green
    if (score >= 60) return '#3b82f6'; // Blue
    if (score >= 40) return '#f59e0b'; // Yellow
    return '#94a3b8'; // Neutral
  };

  const getAvailabilityBadgeVariant = (status) => {
    switch (status) {
      case 'AVAILABLE':
        return 'success';
      case 'PARTIAL':
        return 'warning';
      case 'UNAVAILABLE':
      default:
        return 'error';
    }
  };

  // Open Selection Confirmation Modal
  const handleInitiateSelection = (candidate) => {
    setSelectCandidate(candidate);
    setSelectionNotes(`Selected based on smart matching comparison for PR ${purchaseRequest?.requestNumber || ''}.`);
  };

  // Submit Supplier Selection
  const handleConfirmSelection = async () => {
    if (!selectCandidate || !purchaseRequest) return;
    setSubmittingSelection(true);
    setError('');
    setSuccessMsg('');

    try {
      const payload = {
        productId: selectCandidate.product?._id,
        vendorId: selectCandidate.vendor?._id,
        productName: selectCandidate.product?.productName,
        vendorName: selectCandidate.vendor?.companyName,
        quantity: currentItemMatch?.requestedQuantity || 1,
        unitPrice: selectCandidate.unitPrice,
        totalPrice: selectCandidate.unitPrice * (currentItemMatch?.requestedQuantity || 1),
        deliveryDays: selectCandidate.deliveryDays,
        matchScore: selectCandidate.matchScore,
        notes: selectionNotes,
      };

      const res = await purchaseRequestService.selectProduct(purchaseRequest._id, payload);
      const updatedPR = res.data?.purchaseRequest || res.purchaseRequest;
      setPurchaseRequest(updatedPR);
      setSuccessMsg(
        `Supplier successfully selected: ${selectCandidate.vendor?.companyName} - ${selectCandidate.product?.productName}`
      );
      setSelectCandidate(null);
    } catch (err) {
      setError(err.message || 'Failed to record supplier selection');
    } finally {
      setSubmittingSelection(false);
    }
  };

  // Open Create Purchase Order Modal
  const handleOpenCreatePo = (candidate) => {
    setCreatePoCandidate(candidate);
    setPoError('');
    setPoSuccess(null);
    setPoNotes(`Purchase Order issued from requisition ${purchaseRequest?.requestNumber || ''}.`);
    if (candidate?.deliveryDays) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + candidate.deliveryDays);
      setPoDeliveryDate(targetDate.toISOString().split('T')[0]);
    } else if (purchaseRequest?.requiredByDate) {
      setPoDeliveryDate(new Date(purchaseRequest.requiredByDate).toISOString().split('T')[0]);
    } else {
      setPoDeliveryDate('');
    }
  };

  // Confirm and issue Purchase Order
  const handleConfirmCreatePo = async () => {
    if (!createPoCandidate || !purchaseRequest) return;
    setCreatingPo(true);
    setPoError('');

    try {
      const payload = {
        purchaseRequestId: purchaseRequest._id,
        vendorId: createPoCandidate.vendor?._id,
        productId: createPoCandidate.product?._id,
        expectedDeliveryDate: poDeliveryDate || undefined,
        notes: poNotes,
      };

      const res = await purchaseOrderService.createPurchaseOrder(payload);
      const createdPo = res.data?.purchaseOrder || res.purchaseOrder;
      setPoSuccess(createdPo);
      setSuccessMsg(`Purchase Order ${createdPo.poNumber} created and dispatched to vendor!`);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create purchase order';
      setPoError(msg);
    } finally {
      setCreatingPo(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔄</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>Analyzing Catalog & Calculating Smart Matches...</div>
        <p style={{ marginTop: '0.5rem' }}>Evaluating live inventory, pricing, specifications, and vendor ratings.</p>
      </div>
    );
  }

  if (!purchaseRequest) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ color: 'var(--color-error)', fontSize: '1.25rem', marginBottom: '1rem' }}>
          Purchase Request not found.
        </div>
        <Button onClick={() => navigate('/purchase-requests')}>Back to Requests</Button>
      </div>
    );
  }

  const isSelectedCandidate = (candidate) => {
    return (
      purchaseRequest.selectedProduct === candidate.product?._id ||
      purchaseRequest.selectedProduct?._id === candidate.product?._id ||
      purchaseRequest.selectionDetails?.productId?.toString() === candidate.product?._id?.toString()
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      {/* Top Header & Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link
              to="/purchase-requests"
              style={{ color: 'var(--color-primary)', textDecoration: 'none', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}
            >
              ← Back to Purchase Requests
            </Link>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            Smart Supplier Matching & Live Comparison
            <Badge variant="info">{purchaseRequest.requestNumber}</Badge>
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
            Deterministic matching engine comparing approved vendors, live stock, lead times, and budget compliance.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {lastUpdated && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing}
          >
            {refreshing ? '🔄 Refreshing...' : '🔄 Refresh Live Availability'}
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{ padding: '0.875rem 1.25rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: 'var(--radius-md)', color: '#b91c1c', fontSize: '0.875rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      {successMsg && (
        <div style={{ padding: '0.875rem 1.25rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: 'var(--radius-md)', color: '#065f46', fontSize: '0.875rem' }}>
          <strong>Success:</strong> {successMsg}
        </div>
      )}

      {/* Selected Supplier Banner (If Already Selected) */}
      {purchaseRequest.selectionDetails?.productId && (
        <Card style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid #10b981' }}>
          <CardBody style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '2rem' }}>✅</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700, color: '#065f46', fontSize: '1rem' }}>
                    Selected Supplier & Product
                  </span>
                  <Badge variant="success">Confirmed</Badge>
                  {purchaseRequest.selectionDetails.matchScore && (
                    <Badge variant="neutral">{purchaseRequest.selectionDetails.matchScore}% Match</Badge>
                  )}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-main)' }}>
                  <strong>{purchaseRequest.selectionDetails.vendorName}</strong> — {purchaseRequest.selectionDetails.productName}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                  Qty: <strong>{purchaseRequest.selectionDetails.quantity}</strong> | Unit Price: <strong>₹{purchaseRequest.selectionDetails.unitPrice?.toLocaleString()}</strong> | Total: <strong>₹{purchaseRequest.selectionDetails.totalPrice?.toLocaleString()}</strong> | Est. Lead Time: <strong>{purchaseRequest.selectionDetails.deliveryDays} days</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const selProdId = purchaseRequest.selectionDetails?.productId;
                  const matchedCand = candidates.find(
                    (c) => c.product?._id?.toString() === selProdId?.toString()
                  ) || {
                    product: { _id: selProdId, productName: purchaseRequest.selectionDetails?.productName },
                    vendor: { _id: purchaseRequest.selectionDetails?.vendorId, companyName: purchaseRequest.selectionDetails?.vendorName },
                    unitPrice: purchaseRequest.selectionDetails?.unitPrice,
                    deliveryDays: purchaseRequest.selectionDetails?.deliveryDays,
                    availableQuantity: currentItemMatch?.candidates?.find(c => c.product?._id?.toString() === selProdId?.toString())?.availableQuantity ?? 999,
                  };
                  handleOpenCreatePo(matchedCand);
                }}
              >
                📋 Create Purchase Order
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/procurement/orders')}
              >
                Go to Orders ➔
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Requisition Details Summary Bar */}
      <Card>
        <CardBody style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Requisition Subject
            </div>
            <div style={{ fontWeight: 600, fontSize: '1rem' }}>{purchaseRequest.title}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Requested by: {purchaseRequest.requestedBy?.name || 'Employee'} ({purchaseRequest.department || 'General'})
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Required By Date
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
              {purchaseRequest.requiredByDate ? new Date(purchaseRequest.requiredByDate).toLocaleDateString() : 'Immediate'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Priority: <Badge variant={purchaseRequest.priority === 'URGENT' ? 'error' : 'warning'} dot={false}>{purchaseRequest.priority}</Badge>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Estimated Budget
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--color-primary)' }}>
              ₹{(purchaseRequest.estimatedBudget || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Status: <Badge variant="success" dot={true}>{purchaseRequest.status}</Badge>
            </div>
          </div>

          {/* Item Selector Tabs if multiple items */}
          {items.length > 1 && (
            <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.375rem' }}>
                Requisition Items ({items.length})
              </div>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                {items.map((it, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedItemIdx(idx)}
                    style={{
                      padding: '0.25rem 0.625rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: selectedItemIdx === idx ? 'var(--color-primary)' : 'var(--color-surface)',
                      color: selectedItemIdx === idx ? '#fff' : 'var(--color-text-main)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Item #{idx + 1}: {it.itemName} ({it.requestedQuantity}x)
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Active Requested Item Spec Banner */}
      {currentItemMatch && (
        <div style={{ backgroundColor: 'var(--color-surface-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
              Target Item: <span style={{ color: 'var(--color-primary)' }}>{currentItemMatch.itemName}</span> (Qty: {currentItemMatch.requestedQuantity})
            </div>
            {currentItemMatch.specifications && (
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                <strong>Specifications:</strong> {currentItemMatch.specifications}
              </div>
            )}
            {currentItemMatch.description && (
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
                <strong>Notes:</strong> {currentItemMatch.description}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Item Budget: </span>
            <strong style={{ fontSize: '0.875rem' }}>
              ₹{(currentItemMatch.estimatedBudget || 0).toLocaleString()} (₹{(currentItemMatch.estimatedPrice || 0).toLocaleString()} / unit)
            </strong>
          </div>
        </div>
      )}

      {/* Best Match Recommendation Hero Banner */}
      {bestMatch ? (
        <Card style={{ border: '2px solid #f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.04)', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.1)' }}>
          <CardBody>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>⭐</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                    <span style={{ backgroundColor: '#f59e0b', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '1rem', textTransform: 'uppercase' }}>
                      Recommended Best Match
                    </span>
                    <span
                      style={{
                        backgroundColor: getScoreBadgeColor(bestMatch.matchScore),
                        color: '#fff',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '1rem',
                      }}
                    >
                      {bestMatch.matchScore}% Compatibility
                    </span>
                    <Badge variant={getAvailabilityBadgeVariant(bestMatch.availabilityStatus)}>
                      {bestMatch.availabilityStatus} ({bestMatch.availableQuantity} in stock)
                    </Badge>
                  </div>

                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
                    {bestMatch.product?.productName}
                  </h3>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    Supplier: <strong style={{ color: 'var(--color-text-main)' }}>{bestMatch.vendor?.companyName}</strong> ({bestMatch.vendor?.category || 'Vendor'})
                  </div>

                  {/* Highlights Grid */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
                    <div style={{ backgroundColor: '#fff', padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                      💰 <strong>₹{bestMatch.unitPrice?.toLocaleString()}</strong> / unit
                      <span style={{ color: bestMatch.priceStatus === 'WITHIN_BUDGET' ? '#10b981' : '#f59e0b', marginLeft: '0.375rem', fontWeight: 600 }}>
                        ({bestMatch.priceStatus === 'WITHIN_BUDGET' ? 'Within Budget' : 'Above Budget'})
                      </span>
                    </div>

                    <div style={{ backgroundColor: '#fff', padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                      🚚 Lead Time: <strong>{bestMatch.deliveryDays} days</strong>
                      <span style={{ color: bestMatch.deliveryStatus === 'MEETS_REQUIREMENT' ? '#10b981' : '#ef4444', marginLeft: '0.375rem', fontWeight: 600 }}>
                        ({bestMatch.deliveryStatus === 'MEETS_REQUIREMENT' ? 'Meets Deadline' : 'Exceeds Required Date'})
                      </span>
                    </div>

                    <div style={{ backgroundColor: '#fff', padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                      📦 Total for {currentItemMatch?.requestedQuantity} units: <strong>₹{(bestMatch.unitPrice * (currentItemMatch?.requestedQuantity || 1)).toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '180px' }}>
                {isSelectedCandidate(bestMatch) ? (
                  <Button variant="success" size="md" disabled style={{ width: '100%' }}>
                    ✓ Currently Selected
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => handleInitiateSelection(bestMatch)}
                    style={{ width: '100%' }}
                  >
                    Select Best Match
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInspectCandidate(bestMatch)}
                  style={{ width: '100%' }}
                >
                  View Full Specs & Scores
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card style={{ backgroundColor: 'var(--color-surface-hover)', textAlign: 'center', padding: '1.5rem' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>ℹ️</div>
          <div style={{ fontWeight: 600 }}>No exact match meeting all criteria found in catalog.</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            Check the candidate options below for alternative suppliers and partial matches.
          </div>
        </Card>
      )}

      {/* Filter and Comparison Control Bar */}
      <Card>
        <CardBody style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            {/* Availability Filter */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Availability
              </label>
              <select
                value={filterAvailability}
                onChange={(e) => setFilterAvailability(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: '0.8125rem' }}
              >
                <option value="ALL">All Stock Statuses</option>
                <option value="AVAILABLE">Fully Available</option>
                <option value="PARTIAL">Partial Stock</option>
                <option value="UNAVAILABLE">Out of Stock</option>
              </select>
            </div>

            {/* Vendor Filter */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Vendor
              </label>
              <select
                value={filterVendor}
                onChange={(e) => setFilterVendor(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: '0.8125rem' }}
              >
                <option value="ALL">All Approved Vendors ({uniqueVendors.length})</option>
                {uniqueVendors.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Budget Filter */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Budget
              </label>
              <select
                value={filterBudget}
                onChange={(e) => setFilterBudget(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: '0.8125rem' }}
              >
                <option value="ALL">All Price Ranges</option>
                <option value="WITHIN_BUDGET">Within Budget</option>
                <option value="ABOVE_BUDGET">Above Budget</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Sort Options
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: '0.8125rem' }}
              >
                <option value="MATCH_SCORE">Highest Match Score</option>
                <option value="PRICE_LOW">Lowest Unit Price</option>
                <option value="PRICE_HIGH">Highest Unit Price</option>
                <option value="DELIVERY">Fastest Delivery Lead Time</option>
                <option value="STOCK">Highest In-Stock Quantity</option>
              </select>
            </div>
          </div>

          {/* View Toggle */}
          <div style={{ display: 'flex', gap: '0.375rem', alignSelf: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: viewMode === 'table' ? 'var(--color-primary)' : 'var(--color-surface)',
                color: viewMode === 'table' ? '#fff' : 'var(--color-text-main)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              📊 Comparison Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: viewMode === 'cards' ? 'var(--color-primary)' : 'var(--color-surface)',
                color: viewMode === 'cards' ? '#fff' : 'var(--color-text-main)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🗂️ Product Cards
            </button>
          </div>
        </CardBody>
      </Card>

      {/* Comparison Results */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
            Matching Approved Suppliers ({filteredCandidates.length})
          </h2>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            Showing items matching criteria for: <strong>{currentItemMatch?.itemName}</strong>
          </span>
        </div>

        {filteredCandidates.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>No matching products found.</div>
            <p style={{ marginTop: '0.25rem', fontSize: '0.875rem' }}>
              Try adjusting your stock or budget filters to view more options.
            </p>
          </Card>
        ) : viewMode === 'table' ? (
          /* Side-by-side Comparison Matrix Table */
          <div style={{ overflowX: 'auto', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-hover)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Supplier</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Catalog Product</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'center' }}>Match Score</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Live Stock</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Unit Price / Total</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Lead Time</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCandidates.map((cand, idx) => {
                  const selected = isSelectedCandidate(cand);
                  const isBest = bestMatch?.product?._id === cand.product?._id;
                  const reqQty = currentItemMatch?.requestedQuantity || 1;
                  const total = (cand.unitPrice || 0) * reqQty;

                  return (
                    <tr
                      key={cand.product?._id || idx}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        backgroundColor: selected
                          ? 'rgba(16, 185, 129, 0.05)'
                          : isBest
                          ? 'rgba(245, 158, 11, 0.03)'
                          : 'transparent',
                      }}
                    >
                      {/* Supplier Column */}
                      <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>
                          {cand.vendor?.companyName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Rating: ⭐ {cand.vendor?.rating ? cand.vendor.rating.toFixed(1) : '4.5'} / 5.0
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
                          Status: <Badge variant="success" dot={false} size="sm">APPROVED</Badge>
                        </div>
                      </td>

                      {/* Product Column */}
                      <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>
                            {cand.product?.productName}
                          </span>
                          {isBest && (
                            <span style={{ fontSize: '0.6875rem', backgroundColor: '#f59e0b', color: '#fff', padding: '0.1rem 0.4rem', borderRadius: '1rem', fontWeight: 700 }}>
                              BEST MATCH
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          SKU: {cand.product?.sku} | Category: {cand.product?.category}
                        </div>
                        {cand.product?.specifications && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Specs: {cand.product.specifications}
                          </div>
                        )}
                      </td>

                      {/* Match Score Column */}
                      <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top', textAlign: 'center' }}>
                        <div
                          style={{
                            display: 'inline-block',
                            backgroundColor: getScoreBadgeColor(cand.matchScore),
                            color: '#fff',
                            fontWeight: 700,
                            padding: '0.25rem 0.625rem',
                            borderRadius: '1rem',
                            fontSize: '0.8125rem',
                          }}
                        >
                          {cand.matchScore}%
                        </div>
                        {cand.scoreBreakdown && (
                          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                            Text: {cand.scoreBreakdown.nameMatch + cand.scoreBreakdown.categoryMatch + cand.scoreBreakdown.specMatch}/50 | Stock: {cand.scoreBreakdown.stockAdequacy}/20
                          </div>
                        )}
                      </td>

                      {/* Stock Column */}
                      <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top' }}>
                        <Badge variant={getAvailabilityBadgeVariant(cand.availabilityStatus)}>
                          {cand.availabilityStatus}
                        </Badge>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                          Available: <strong>{cand.availableQuantity}</strong> (Req: {reqQty})
                        </div>
                      </td>

                      {/* Price Column */}
                      <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600 }}>₹{cand.unitPrice?.toLocaleString()}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Total: ₹{total.toLocaleString()}
                        </div>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            color: cand.priceStatus === 'WITHIN_BUDGET' ? '#10b981' : '#f59e0b',
                          }}
                        >
                          {cand.priceStatus === 'WITHIN_BUDGET' ? '✓ Within Budget' : '⚠ Above Budget'}
                        </span>
                      </td>

                      {/* Delivery Column */}
                      <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600 }}>{cand.deliveryDays} Days</div>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            color: cand.deliveryStatus === 'MEETS_REQUIREMENT' ? '#10b981' : '#ef4444',
                          }}
                        >
                          {cand.deliveryStatus === 'MEETS_REQUIREMENT' ? '✓ Meets Date' : '⚠ Exceeds Date'}
                        </span>
                      </td>

                      {/* Action Column */}
                      <td style={{ padding: '0.875rem 1rem', verticalAlign: 'top', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', alignItems: 'center' }}>
                          <Button
                            variant={selected ? 'primary' : 'outline'}
                            size="sm"
                            onClick={() => handleOpenCreatePo(cand)}
                            style={{ width: '100%', whiteSpace: 'nowrap', fontWeight: 600 }}
                          >
                            📋 Create PO
                          </Button>
                          {selected ? (
                            <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.75rem', padding: '0.2rem 0.4rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-sm)' }}>
                              ✓ Selected
                            </span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleInitiateSelection(cand)}
                              style={{ width: '100%', fontSize: '0.75rem' }}
                            >
                              Select Supplier
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setInspectCandidate(cand)}
                            style={{ width: '100%', fontSize: '0.75rem' }}
                          >
                            Details
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid Cards View */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {filteredCandidates.map((cand, idx) => {
              const selected = isSelectedCandidate(cand);
              const isBest = bestMatch?.product?._id === cand.product?._id;
              const reqQty = currentItemMatch?.requestedQuantity || 1;
              const total = (cand.unitPrice || 0) * reqQty;

              return (
                <Card
                  key={cand.product?._id || idx}
                  style={{
                    border: selected
                      ? '2px solid #10b981'
                      : isBest
                      ? '2px solid #f59e0b'
                      : '1px solid var(--color-border)',
                  }}
                >
                  <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.875rem 1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {cand.vendor?.companyName}
                      </div>
                      <h4 style={{ margin: '0.125rem 0 0 0', fontSize: '1rem', fontWeight: 700 }}>
                        {cand.product?.productName}
                      </h4>
                    </div>
                    <div
                      style={{
                        backgroundColor: getScoreBadgeColor(cand.matchScore),
                        color: '#fff',
                        fontWeight: 700,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '1rem',
                        fontSize: '0.75rem',
                      }}
                    >
                      {cand.matchScore}%
                    </div>
                  </CardHeader>

                  <CardBody style={{ padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Live Inventory:</span>
                      <Badge variant={getAvailabilityBadgeVariant(cand.availabilityStatus)}>
                        {cand.availableQuantity} in stock ({cand.availabilityStatus})
                      </Badge>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Unit Price:</span>
                      <strong style={{ color: cand.priceStatus === 'WITHIN_BUDGET' ? '#10b981' : '#f59e0b' }}>
                        ₹{cand.unitPrice?.toLocaleString()} ({cand.priceStatus === 'WITHIN_BUDGET' ? 'In Budget' : 'Above Budget'})
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Total Cost ({reqQty}x):</span>
                      <strong>₹{total.toLocaleString()}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Delivery Lead Time:</span>
                      <span style={{ color: cand.deliveryStatus === 'MEETS_REQUIREMENT' ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                        {cand.deliveryDays} Days
                      </span>
                    </div>

                    {cand.product?.specifications && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface-hover)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        <strong>Specs:</strong> {cand.product.specifications}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.75rem' }}>
                      <Button
                        variant={selected ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => handleOpenCreatePo(cand)}
                        style={{ width: '100%', fontWeight: 600 }}
                      >
                        📋 Create Purchase Order
                      </Button>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {selected ? (
                          <Button variant="success" size="sm" disabled style={{ flex: 1 }}>
                            ✓ Selected
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleInitiateSelection(cand)}
                            style={{ flex: 1, border: '1px solid var(--color-border)' }}
                          >
                            Select Supplier
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInspectCandidate(cand)}
                          style={{ border: '1px solid var(--color-border)' }}
                        >
                          Inspect
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Inspect Candidate Specs & Score Breakdown Modal */}
      {inspectCandidate && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '1rem' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                Candidate Evaluation & Spec Sheet
              </h3>
              <button
                type="button"
                onClick={() => setInspectCandidate(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Product & Supplier Header */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>
                    {inspectCandidate.product?.productName}
                  </h4>
                  <div
                    style={{
                      backgroundColor: getScoreBadgeColor(inspectCandidate.matchScore),
                      color: '#fff',
                      fontWeight: 700,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '1rem',
                      fontSize: '0.75rem',
                    }}
                  >
                    {inspectCandidate.matchScore}% Overall Match
                  </div>
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                  Offered by: <strong>{inspectCandidate.vendor?.companyName}</strong> | SKU: {inspectCandidate.product?.sku}
                </div>
              </div>

              {/* Match Score Breakdown Table */}
              {inspectCandidate.scoreBreakdown && (
                <div>
                  <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    Score Breakdown (0 - 100%)
                  </h5>
                  <div style={{ backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.8125rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Category Match:</span>
                      <strong>{inspectCandidate.scoreBreakdown.categoryMatch} / 15 pts</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Product Name Match:</span>
                      <strong>{inspectCandidate.scoreBreakdown.nameMatch} / 20 pts</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Specifications Match:</span>
                      <strong>{inspectCandidate.scoreBreakdown.specMatch} / 15 pts</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Live Stock Adequacy:</span>
                      <strong>{inspectCandidate.scoreBreakdown.stockAdequacy} / 20 pts ({inspectCandidate.availabilityStatus})</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Budget Compliance:</span>
                      <strong>{inspectCandidate.scoreBreakdown.priceAffordability} / 15 pts ({inspectCandidate.priceStatus})</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Delivery Lead Time:</span>
                      <strong>{inspectCandidate.scoreBreakdown.leadTimeCompliance} / 15 pts ({inspectCandidate.deliveryStatus})</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Full Specs & Details */}
              <div>
                <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Technical Specifications & Description
                </h5>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.75rem', fontSize: '0.875rem' }}>
                  <p style={{ margin: '0 0 0.5rem 0' }}>
                    <strong>Description:</strong> {inspectCandidate.product?.description || 'N/A'}
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>Full Specs:</strong> {inspectCandidate.product?.specifications || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Supplier Verification Info */}
              <div>
                <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Supplier Credentials
                </h5>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.75rem', fontSize: '0.8125rem' }}>
                  <div>Email: <strong>{inspectCandidate.vendor?.contactEmail || 'N/A'}</strong></div>
                  <div style={{ marginTop: '0.25rem' }}>Phone: <strong>{inspectCandidate.vendor?.contactPhone || 'N/A'}</strong></div>
                  <div style={{ marginTop: '0.25rem' }}>Onboarding Status: <Badge variant="success" dot={false}>APPROVED</Badge></div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Button variant="outline" onClick={() => setInspectCandidate(null)}>
                Close
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  const c = inspectCandidate;
                  setInspectCandidate(null);
                  handleInitiateSelection(c);
                }}
              >
                Select Supplier
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const c = inspectCandidate;
                  setInspectCandidate(null);
                  handleOpenCreatePo(c);
                }}
              >
                📋 Create PO
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Selection Confirmation Modal */}
      {selectCandidate && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1060, padding: '1rem' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '520px', padding: '1.5rem', boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                Confirm Supplier Selection
              </h3>
              <button
                type="button"
                onClick={() => setSelectCandidate(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid #3b82f6', borderRadius: 'var(--radius-md)', padding: '0.875rem', fontSize: '0.8125rem', color: '#1e40af' }}>
                ℹ️ <strong>Stock Protection Notice:</strong> Selecting this supplier associates them with Purchase Request <strong>{purchaseRequest.requestNumber}</strong>. Product inventory will <strong>NOT</strong> be deducted until a formal Purchase Order is issued.
              </div>

              {(() => {
                const reqPrice = Number(currentItemMatch?.estimatedPrice ?? currentItemMatch?.requesterRequestedPrice ?? purchaseRequest?.items?.[0]?.requesterRequestedPrice ?? purchaseRequest?.items?.[0]?.estimatedPrice) || 0;
                const vendorPrice = Number(selectCandidate.unitPrice || 0);
                const qty = Number(currentItemMatch?.requestedQuantity || 1);
                const diff = vendorPrice - reqPrice;
                const totalDiff = diff * qty;
                const reqTotal = reqPrice * qty;
                const vendorTotal = vendorPrice * qty;

                return (
                  <>
                    <div style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: diff > 0 ? 'rgba(245, 158, 11, 0.1)' : diff < 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                      border: `1px solid ${diff > 0 ? '#f59e0b' : diff < 0 ? '#10b981' : '#3b82f6'}`,
                      fontSize: '0.8125rem',
                      color: diff > 0 ? '#b45309' : diff < 0 ? '#047857' : '#1d4ed8',
                      fontWeight: 700,
                    }}>
                      {diff > 0 && `⚠️ Vendor price is higher than requester price (+₹${diff.toLocaleString('en-IN')}/unit, Total additional: +₹${totalDiff.toLocaleString('en-IN')})`}
                      {diff < 0 && `🎉 Vendor price is lower than requester price (Saving: ₹${Math.abs(diff).toLocaleString('en-IN')}/unit, Total savings: ₹${Math.abs(totalDiff).toLocaleString('en-IN')})`}
                      {diff === 0 && '✓ Vendor price matches requester target price (₹0 difference)'}
                    </div>

                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', fontSize: '0.875rem' }}>
                      <div style={{ marginBottom: '0.5rem' }}>
                        Supplier: <strong>{selectCandidate.vendor?.companyName}</strong>
                      </div>
                      <div style={{ marginBottom: '0.5rem' }}>
                        Product: <strong>{selectCandidate.product?.productName}</strong>
                      </div>
                      <div style={{ marginBottom: '0.5rem' }}>
                        Quantity: <strong>{qty} units</strong>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', margin: '0.75rem 0', backgroundColor: 'var(--color-bg)', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Requester Target Price:</span>
                          <strong>₹{reqPrice.toLocaleString('en-IN')}/unit</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Expected: ₹{reqTotal.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Vendor Unit Price:</span>
                          <strong>₹{vendorPrice.toLocaleString('en-IN')}/unit</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Total: ₹{vendorTotal.toLocaleString('en-IN')}</span>
                        </div>
                        <div style={{ gridColumn: 'span 2', borderTop: '1px dashed var(--color-border)', paddingTop: '0.35rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Price Difference: </span>
                          <strong style={{ color: diff > 0 ? '#b45309' : diff < 0 ? '#047857' : 'inherit' }}>
                            {diff > 0 ? `+₹${diff.toLocaleString('en-IN')}/unit (+₹${totalDiff.toLocaleString('en-IN')} total additional)` : diff < 0 ? `-₹${Math.abs(diff).toLocaleString('en-IN')}/unit (Save ₹${Math.abs(totalDiff).toLocaleString('en-IN')})` : '₹0 (Exact match)'}
                          </strong>
                        </div>
                      </div>

                      <div>
                        Lead Time: <strong>{selectCandidate.deliveryDays} Days</strong>
                      </div>
                    </div>
                  </>
                );
              })()}

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Procurement Notes (Optional)
                </label>
                <textarea
                  value={selectionNotes}
                  onChange={(e) => setSelectionNotes(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: '0.875rem', resize: 'vertical' }}
                  placeholder="Reason for supplier selection, delivery conditions, or special instructions..."
                />
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Button
                variant="outline"
                onClick={() => setSelectCandidate(null)}
                disabled={submittingSelection}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmSelection}
                disabled={submittingSelection}
              >
                {submittingSelection ? 'Recording Selection...' : 'Confirm Selection'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Purchase Order Modal (Phase 10) */}
      {createPoCandidate && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1070, padding: '1rem' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📋</span> Issue Purchase Order
              </h3>
              <button
                type="button"
                onClick={() => {
                  setCreatePoCandidate(null);
                  setPoSuccess(null);
                  setPoError('');
                }}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {poSuccess ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: '3rem' }}>🎉</div>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#065f46' }}>
                    Purchase Order Issued Successfully!
                  </h4>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {poSuccess.poNumber}
                  </div>
                  <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                    <Badge variant="warning">Status: SENT_TO_VENDOR</Badge>
                    <Badge variant="neutral">Total: ₹{(poSuccess.totalAmount || 0).toLocaleString()}</Badge>
                  </div>
                </div>

                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  The vendor (<strong>{createPoCandidate.vendor?.companyName}</strong>) has been notified and must accept the order. You (the requester) will then be asked to confirm the price — inventory is committed only after your final confirmation.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCreatePoCandidate(null);
                      setPoSuccess(null);
                    }}
                  >
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => navigate('/procurement/orders')}
                  >
                    View in Purchase Orders Tracker ➔
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {poError && (
                  <div style={{ padding: '0.875rem 1.25rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: 'var(--radius-md)', color: '#b91c1c', fontSize: '0.875rem' }}>
                    <strong>Validation Error:</strong> {poError}
                  </div>
                )}

                <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid #3b82f6', borderRadius: 'var(--radius-md)', padding: '0.875rem', fontSize: '0.8125rem', color: '#1e40af' }}>
                  ℹ️ <strong>Two-Stage Confirmation:</strong> Issuing this PO assigns status <strong>SENT_TO_VENDOR</strong>. The vendor must accept first (stock is verified), then the requester confirms the price — inventory is atomically deducted only after requester confirmation.
                </div>

                {/* Requisition & Order Specs */}
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Requisition Number</span>
                    <strong>{purchaseRequest.requestNumber}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Selected Supplier</span>
                    <strong>{createPoCandidate.vendor?.companyName}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Catalog Product</span>
                    <strong>{createPoCandidate.product?.productName}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Order Quantity</span>
                    <strong>{currentItemMatch?.requestedQuantity || 1} units</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Unit Price</span>
                    <strong>₹{(createPoCandidate.unitPrice || 0).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Total PO Value</span>
                    <strong style={{ color: 'var(--color-primary)', fontSize: '1rem' }}>
                      ₹{((createPoCandidate.unitPrice || 0) * (currentItemMatch?.requestedQuantity || 1)).toLocaleString()}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Live Stock Available</span>
                    <Badge variant={(createPoCandidate.availableQuantity ?? 0) >= (currentItemMatch?.requestedQuantity || 1) ? 'success' : 'error'} dot={false}>
                      {createPoCandidate.availableQuantity !== undefined ? `${createPoCandidate.availableQuantity} units available` : 'In Stock'}
                    </Badge>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Requisition Required Date</span>
                    <span>{purchaseRequest.requiredByDate ? new Date(purchaseRequest.requiredByDate).toLocaleDateString() : 'Not Specified'}</span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={poDeliveryDate}
                    onChange={(e) => setPoDeliveryDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                    PO Instructions / Terms (Optional)
                  </label>
                  <textarea
                    value={poNotes}
                    onChange={(e) => setPoNotes(e.target.value)}
                    rows={3}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: '0.875rem', resize: 'vertical' }}
                    placeholder="Provide delivery instructions, packaging standards, or invoice requirements..."
                  />
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCreatePoCandidate(null);
                      setPoError('');
                    }}
                    disabled={creatingPo}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleConfirmCreatePo}
                    disabled={creatingPo}
                  >
                    {creatingPo ? 'Issuing PO...' : 'Issue Purchase Order (SENT_TO_VENDOR)'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcurementMatchingPage;
