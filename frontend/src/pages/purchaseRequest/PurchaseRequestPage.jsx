import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import purchaseRequestService from '../../services/purchaseRequestService';
import Card, { CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import CreatePurchaseRequestModal from './CreatePurchaseRequestModal';
import PurchaseRequestDetailModal from './PurchaseRequestDetailModal';

export const PurchaseRequestPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
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

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const isEmployee = user?.role === 'EMPLOYEE';
  const isProcurementOrAdmin = ['ADMIN', 'PROCUREMENT_MANAGER'].includes(user?.role);

  const fetchRequests = useCallback(
    async (currentPage = page, currentLimit = limit, currentStatus = statusFilter, currentPriority = priorityFilter, currentSearch = searchQuery, currentSortBy = sortBy, currentSortOrder = sortOrder) => {
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
        if (currentPriority && currentPriority !== 'ALL') {
          params.priority = currentPriority;
        }
        if (currentSearch && currentSearch.trim()) {
          params.search = currentSearch.trim();
        }
        if (currentSortBy) {
          params.sortBy = currentSortBy;
          params.sortOrder = currentSortOrder;
        }

        const response = await purchaseRequestService.getAll(params);
        const fetchedRequests = response.data?.purchaseRequests || response.data?.items || [];
        setRequests(fetchedRequests);
        if (response.data?.pagination) {
          setPagination(response.data.pagination);
        }

        // Deep link to request by id
        const targetId = searchParams.get('id');
        if (targetId) {
          const found = fetchedRequests.find((r) => r._id === targetId);
          if (found) {
            setSelectedRequest(found);
          } else {
            try {
              const detailRes = await purchaseRequestService.getById(targetId);
              if (detailRes.data?.purchaseRequest) {
                setSelectedRequest(detailRes.data.purchaseRequest);
              }
            } catch {
              // Ignore if not accessible
            }
          }
        }
      } catch (err) {
        setError(err.message || 'Failed to load purchase requests from database');
      } finally {
        setLoading(false);
      }
    },
    [page, limit, statusFilter, priorityFilter, searchQuery, sortBy, sortOrder, searchParams]
  );

  useEffect(() => {
    fetchRequests(page, limit, statusFilter, priorityFilter, searchQuery, sortBy, sortOrder);
  }, [page, limit, statusFilter, priorityFilter, sortBy, sortOrder]);

  // Handle action=create query param
  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setCreateModalOpen(true);
    }
  }, [searchParams]);

  // Debounced search and reset to page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchRequests(1, limit, statusFilter, priorityFilter, searchQuery, sortBy, sortOrder);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
    setPage(1);
  };

  const handlePriorityFilterChange = (priority) => {
    setPriorityFilter(priority);
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
    } else if (val === 'req_num') {
      setSortBy('requestNumber');
      setSortOrder('asc');
    } else if (val === 'date_req') {
      setSortBy('requiredDate');
      setSortOrder('asc');
    }
    setPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
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

  const handleRequestCreated = (newReq) => {
    setRequests((prev) => [newReq, ...prev]);
  };

  const handleRequestUpdated = (updatedReq) => {
    setRequests((prev) =>
      prev.map((r) => (r._id === updatedReq._id ? updatedReq : r))
    );
    setSelectedRequest(updatedReq);
  };

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

  // Quick stats calculation
  const stats = {
    total: requests.length,
    draft: requests.filter((r) => r.status === 'DRAFT').length,
    pending: requests.filter((r) => r.status === 'SUBMITTED').length,
    approved: requests.filter((r) => r.status === 'APPROVED').length,
    rejected: requests.filter((r) => r.status === 'REJECTED').length,
  };

  return (
    <div>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--spacing-4)',
          marginBottom: 'var(--spacing-6)',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-primary)', marginBottom: 'var(--spacing-1)' }}>
            {isEmployee ? 'My Purchase Requests' : 'Purchase Requisitions Queue'}
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            {isEmployee
              ? 'Create, submit, and track equipment and procurement requests.'
              : 'Review, evaluate, and approve or reject requisitions submitted by company staff.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
          <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh List'}
          </Button>

          {isEmployee && (
            <Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
              + New Requisition
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-6)' }}>
        <Card>
          <CardBody style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total In View
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-primary)', marginTop: 'var(--spacing-1)' }}>
              {stats.total}
            </div>
          </CardBody>
        </Card>

        {isEmployee && (
          <Card>
            <CardBody style={{ padding: 'var(--spacing-4)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Drafts
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-warning)', marginTop: 'var(--spacing-1)' }}>
                {stats.draft}
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isEmployee ? 'Pending Approval' : 'Awaiting Review'}
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-info)', marginTop: 'var(--spacing-1)' }}>
              {stats.pending}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Approved
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-success)', marginTop: 'var(--spacing-1)' }}>
              {stats.approved}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Rejected
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-error)', marginTop: 'var(--spacing-1)' }}>
              {stats.rejected}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card style={{ marginBottom: 'var(--spacing-6)' }}>
        <CardBody style={{ padding: 'var(--spacing-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--spacing-4)' }}>
            {/* Status Tabs */}
            <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
              {[
                { key: 'ALL', label: 'All' },
                { key: 'SUBMITTED', label: 'Submitted' },
                { key: 'APPROVED', label: 'Approved' },
                { key: 'REJECTED', label: 'Rejected' },
                { key: 'DRAFT', label: 'Draft' },
                { key: 'CANCELLED', label: 'Cancelled' },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => handleStatusFilterChange(st.key)}
                  className={`btn btn-sm ${statusFilter === st.key ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: 'var(--font-size-xs)' }}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Search, Priority, and Sort Controls */}
            <div style={{ display: 'flex', gap: 'var(--spacing-3)', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={priorityFilter}
                onChange={(e) => handlePriorityFilterChange(e.target.value)}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                  outline: 'none',
                  backgroundColor: 'var(--color-bg)',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>

              <select
                value={
                  sortBy === 'requestNumber'
                    ? 'req_num'
                    : sortBy === 'requiredDate'
                    ? 'date_req'
                    : sortOrder === 'asc'
                    ? 'oldest'
                    : 'newest'
                }
                onChange={handleSortChange}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                  outline: 'none',
                  backgroundColor: 'var(--color-bg)',
                  cursor: 'pointer',
                }}
              >
                <option value="newest">Newest Requisitions</option>
                <option value="oldest">Oldest Requisitions</option>
                <option value="date_req">Required Date</option>
                <option value="req_num">Requisition Number</option>
              </select>

              <div style={{ position: 'relative', minWidth: '220px' }}>
                <input
                  type="text"
                  placeholder="Search PR #, title, item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.375rem 2rem 0.375rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-xs)',
                    outline: 'none',
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

              {(searchQuery || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || sortBy !== 'createdAt' || sortOrder !== 'desc') && (
                <Button variant="outline" size="sm" onClick={clearFilters} style={{ fontSize: 'var(--font-size-xs)' }}>
                  Reset Filters
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Main Table */}
      <Card>
        {error && (
          <div
            style={{
              padding: 'var(--spacing-4)',
              backgroundColor: 'var(--color-error-bg)',
              color: 'var(--color-error)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ width: isProcurementOrAdmin ? '22%' : '28%', minWidth: '170px', padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Requisition
                </th>
                {isProcurementOrAdmin && (
                  <th style={{ width: '18%', minWidth: '150px', padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                    Requester
                  </th>
                )}
                <th style={{ width: isProcurementOrAdmin ? '25%' : '32%', minWidth: '200px', padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Items Breakdown
                </th>
                <th style={{ width: isProcurementOrAdmin ? '11%' : '14%', minWidth: '110px', padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>
                  Est. Total
                </th>
                <th style={{ width: isProcurementOrAdmin ? '8%' : '10%', minWidth: '90px', padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  Priority
                </th>
                <th style={{ width: isProcurementOrAdmin ? '12%' : '12%', minWidth: '120px', padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  Status
                </th>
                <th style={{ width: '10%', minWidth: '100px', padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isProcurementOrAdmin ? 7 : 6} style={{ padding: 'var(--spacing-10)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Loading purchase requisitions from database...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={isProcurementOrAdmin ? 7 : 6} style={{ padding: 'var(--spacing-12)', textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: 'var(--spacing-1)' }}>
                      No Purchase Requests Found
                    </div>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-4)' }}>
                      {searchQuery || statusFilter !== 'ALL' || priorityFilter !== 'ALL'
                        ? 'Try adjusting your search criteria or status filter.'
                        : isEmployee
                        ? 'You have not created any purchase requisitions yet.'
                        : 'No employee purchase requests currently match this filter.'}
                    </p>
                    {isEmployee && (
                      <Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
                        Create Your First Request
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                requests.map((req) => {
                  const total = (req.items || []).reduce(
                    (acc, it) => acc + (it.quantity || 0) * (it.estimatedPrice || 0),
                    0
                  );
                  const itemsPreview = (req.items || [])
                    .map((it) => `${it.name} (${it.quantity}x)`)
                    .join(', ');

                  return (
                    <tr
                      key={req._id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: 'var(--font-size-xs)' }}>
                          {req.requestNumber}
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-main)', marginTop: '2px' }}>
                          {req.title}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', marginTop: '2px' }}>
                          {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : ''}
                        </div>
                      </td>

                      {isProcurementOrAdmin && (
                        <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>
                            {req.requestedBy?.name || 'Requester'}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                            {req.requestedBy?.email || ''}
                          </div>
                        </td>
                      )}

                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-main)' }}>
                          {req.items?.length || 0} item(s)
                        </div>
                        <div
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-muted)',
                            whiteSpace: 'normal',
                            lineHeight: 1.4,
                            marginTop: '2px',
                          }}
                          title={itemsPreview}
                        >
                          {itemsPreview}
                        </div>
                      </td>

                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-main)', whiteSpace: 'nowrap' }}>
                        ₹{total.toLocaleString()}
                      </td>

                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <Badge variant={getPriorityBadgeVariant(req.priority)}>
                          {req.priority}
                        </Badge>
                      </td>

                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <Badge variant={getStatusBadgeVariant(req.status)}>
                          {req.status}
                        </Badge>
                      </td>

                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedRequest(req)}
                        >
                          {isProcurementOrAdmin && req.status === 'SUBMITTED' ? 'Review PR' : 'View Details'}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>

        {/* Server-Side Pagination Bar */}
        {!loading && pagination.total > 0 && (
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            itemLabel="purchase requests"
          />
        )}
      </Card>

      {/* Modals */}
      {createModalOpen && (
        <CreatePurchaseRequestModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onRequestCreated={handleRequestCreated}
        />
      )}

      {selectedRequest && (
        <PurchaseRequestDetailModal
          isOpen={Boolean(selectedRequest)}
          onClose={() => setSelectedRequest(null)}
          request={selectedRequest}
          currentUser={user}
          onRequestUpdated={handleRequestUpdated}
        />
      )}
    </div>
  );
};

export default PurchaseRequestPage;
