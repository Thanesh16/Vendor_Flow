import React, { useState, useEffect, useCallback } from 'react';
import vendorService from '../../services/vendorService';
import Card, { CardBody, CardHeader } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import VendorDetailModal from './VendorDetailModal';
import { getImageUrl } from '../../utils/imageUrl';

export const VendorManagementPage = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
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

  // Fetch vendors from MongoDB via backend API
  const fetchVendors = useCallback(
    async (currentPage = page, currentLimit = limit, currentSearch = searchQuery, currentStatus = statusFilter, currentSortBy = sortBy, currentSortOrder = sortOrder) => {
      setLoading(true);
      setError('');
      try {
        const params = {
          page: currentPage,
          limit: currentLimit,
        };
        if (currentSearch && currentSearch.trim()) {
          params.search = currentSearch.trim();
        }
        if (currentStatus && currentStatus !== 'ALL') {
          params.status = currentStatus;
        }
        if (currentSortBy) {
          params.sortBy = currentSortBy;
          params.sortOrder = currentSortOrder;
        }

        const response = await vendorService.getAllVendors(params);
        setVendors(response.data?.vendors || response.data?.items || []);
        if (response.data?.pagination) {
          setPagination(response.data.pagination);
        }
      } catch (err) {
        setError(err.message || 'Failed to load vendors from database');
      } finally {
        setLoading(false);
      }
    },
    [page, limit, searchQuery, statusFilter, sortBy, sortOrder]
  );

  // Trigger fetch when pagination or sorting or status changes
  useEffect(() => {
    fetchVendors(page, limit, searchQuery, statusFilter, sortBy, sortOrder);
  }, [page, limit, statusFilter, sortBy, sortOrder]);

  // Debounce search input changes and reset to page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchVendors(1, limit, searchQuery, statusFilter, sortBy, sortOrder);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
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
    } else if (val === 'name_asc') {
      setSortBy('companyName');
      setSortOrder('asc');
    } else if (val === 'name_desc') {
      setSortBy('companyName');
      setSortOrder('desc');
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

  const handleVendorUpdated = (updatedVendor) => {
    setVendors((prev) =>
      prev.map((v) => (v._id === updatedVendor._id ? updatedVendor : v))
    );
    setSelectedVendor(updatedVendor);
  };

  const getBadgeVariant = (status) => {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'UNDER_REVIEW':
        return 'info';
      case 'REJECTED':
        return 'error';
      default:
        return 'warning';
    }
  };

  const currentSortValue =
    sortBy === 'companyName'
      ? sortOrder === 'asc'
        ? 'name_asc'
        : 'name_desc'
      : sortOrder === 'asc'
      ? 'oldest'
      : 'newest';

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
          marginBottom: 'var(--spacing-8)',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 'var(--font-size-2xl)',
              color: 'var(--color-primary)',
              marginBottom: 'var(--spacing-1)',
            }}
          >
            Vendor Management
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Review registered suppliers, verify onboarding compliance, update partner profiles, and manage status transitions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          {(searchQuery || statusFilter !== 'ALL' || sortBy !== 'createdAt' || sortOrder !== 'desc') && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Reset Filters
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchVendors(page, limit, searchQuery, statusFilter, sortBy, sortOrder)}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh Directory'}
          </Button>
        </div>
      </div>

      {/* Filter, Search and Sort Bar */}
      <Card style={{ marginBottom: 'var(--spacing-6)' }}>
        <CardBody style={{ padding: 'var(--spacing-4)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--spacing-4)',
            }}
          >
            {/* Status Filter Buttons */}
            <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
              {[
                { key: 'ALL', label: 'All' },
                { key: 'PENDING', label: 'Pending' },
                { key: 'UNDER_REVIEW', label: 'Under Review' },
                { key: 'APPROVED', label: 'Approved' },
                { key: 'REJECTED', label: 'Rejected' },
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

            {/* Right side: Sort Dropdown & Search Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Sort:</span>
                <select
                  value={currentSortValue}
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
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name_asc">Company (A-Z)</option>
                  <option value="name_desc">Company (Z-A)</option>
                </select>
              </div>

              {/* Search Input with Clear Button */}
              <div style={{ position: 'relative', minWidth: '240px', maxWidth: '360px', flex: 1 }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search company, contact, email, city..."
                  style={{
                    width: '100%',
                    padding: '0.45rem 2rem 0.45rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-sm)',
                    backgroundColor: 'var(--color-bg)',
                    outline: 'none',
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
                      fontSize: '0.9rem',
                    }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Error Message */}
      {error && (
        <div
          style={{
            backgroundColor: 'var(--color-error-bg)',
            border: '1px solid var(--color-error-border)',
            color: 'var(--color-error)',
            padding: 'var(--spacing-4)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--spacing-6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => fetchVendors(searchQuery, statusFilter)}>
            Retry
          </Button>
        </div>
      )}

      {/* Vendors Table */}
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>
              Registered Vendors ({pagination.total > 0 ? pagination.total : vendors.length})
            </span>
            {statusFilter !== 'ALL' && <Badge variant="neutral">Status: {statusFilter.replace('_', ' ')}</Badge>}
          </div>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 'var(--spacing-16) 0', textAlign: 'center' }}>
              <p style={{ color: 'var(--color-text-muted)' }}>Querying MongoDB vendor directory...</p>
            </div>
          ) : vendors.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--spacing-12) var(--spacing-6)' }}>
              <span className="empty-state-icon">🏢</span>
              <h4 className="empty-state-title">No Vendors Found</h4>
              <p className="empty-state-desc">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'No vendors match your search keywords or status filter criteria.'
                  : 'No vendor applications have been registered in the database yet.'}
              </p>
              {(searchQuery || statusFilter !== 'ALL') && (
                <Button variant="outline" size="sm" onClick={clearFilters} style={{ marginTop: 'var(--spacing-3)' }}>
                  Reset All Filters
                </Button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', width: '20%' }}>Company Name</th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', width: '15%' }}>Contact Person</th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', width: '18%' }}>Email</th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', width: '12%' }}>Phone</th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', width: '15%' }}>City, State</th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', width: '10%' }}>Status</th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', width: '10%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr
                      key={v._id}
                      style={{ borderBottom: '1px solid var(--color-border)', transition: 'background-color var(--transition-fast)' }}
                    >
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-main)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                          {/* Compact Shop Photo Thumbnail */}
                          <div
                            style={{
                              width: '42px',
                              height: '42px',
                              minWidth: '42px',
                              borderRadius: 'var(--radius-md)',
                              overflow: 'hidden',
                              backgroundColor: 'var(--color-surface-hover)',
                              border: '1px solid var(--color-border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {v.shopImage ? (
                              <img
                                src={getImageUrl(v.shopImage)}
                                alt={v.companyName}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'inline';
                                }}
                              />
                            ) : null}
                            <span
                              style={{
                                display: v.shopImage ? 'none' : 'inline',
                                fontSize: '18px',
                                color: 'var(--color-text-muted)',
                              }}
                              title="No shop photo"
                            >
                              🏢
                            </span>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{v.companyName}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', fontWeight: 400 }}>
                              Added {new Date(v.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: 'var(--spacing-4)', color: 'var(--color-text-main)' }}>
                        {v.contactPerson}
                      </td>
                      <td style={{ padding: 'var(--spacing-4)', color: 'var(--color-text-muted)' }}>
                        {v.email}
                      </td>
                      <td style={{ padding: 'var(--spacing-4)', color: 'var(--color-text-muted)' }}>
                        {v.phone}
                      </td>
                      <td style={{ padding: 'var(--spacing-4)', color: 'var(--color-text-muted)' }}>
                        {v.city}{v.state ? `, ${v.state}` : ''}
                      </td>
                      <td style={{ padding: 'var(--spacing-4)' }}>
                        <Badge variant={getBadgeVariant(v.onboardingStatus)}>
                          {v.onboardingStatus}
                        </Badge>
                      </td>
                      <td style={{ padding: 'var(--spacing-4)', textAlign: 'right' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedVendor(v)}
                        >
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
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
            itemLabel="vendors"
          />
        )}
      </Card>

      {/* Vendor Detail & Review Modal */}
      {selectedVendor && (
        <VendorDetailModal
          vendor={selectedVendor}
          onClose={() => setSelectedVendor(null)}
          onVendorUpdated={handleVendorUpdated}
        />
      )}
    </div>
  );
};

export default VendorManagementPage;
