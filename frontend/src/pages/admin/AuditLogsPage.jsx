import React, { useState, useEffect, useCallback } from 'react';
import Card, { CardBody, CardHeader } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import auditLogService from '../../services/auditLogService';

export const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Search
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [entityTypeFilter, setEntityTypeFilter] = useState('ALL');
  const [userIdFilter, setUserIdFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Options from server
  const [availableActions, setAvailableActions] = useState([]);
  const [availableEntityTypes, setAvailableEntityTypes] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  });

  // Selected Log for JSON/Metadata modal
  const [inspectedLog, setInspectedLog] = useState(null);

  // Fetch filter options on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const res = await auditLogService.getFilterOptions();
        if (res.success && res.data) {
          setAvailableActions(res.data.actions || []);
          setAvailableEntityTypes(res.data.entityTypes || []);
          setAvailableUsers(res.data.users || []);
        }
      } catch (err) {
        console.error('Failed to load audit filters:', err);
      }
    };
    loadFilters();
  }, []);

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit,
        search: search.trim() || undefined,
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
        entityType: entityTypeFilter !== 'ALL' ? entityTypeFilter : undefined,
        userId: userIdFilter !== 'ALL' ? userIdFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };

      const res = await auditLogService.getAuditLogs(params);
      if (res.success && res.data) {
        setLogs(res.data.logs || []);
        setPagination(
          res.data.pagination || {
            page: 1,
            limit: 15,
            total: res.data.total || 0,
            totalPages: Math.ceil((res.data.total || 0) / limit) || 1,
            hasPrevPage: false,
            hasNextPage: false,
          }
        );
      } else {
        setError(res.message || 'Failed to fetch audit logs');
      }
    } catch (err) {
      console.error('Audit logs error:', err);
      setError(err.response?.data?.message || 'Error loading audit logs.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, actionFilter, entityTypeFilter, userIdFilter, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleResetFilters = () => {
    setSearch('');
    setActionFilter('ALL');
    setEntityTypeFilter('ALL');
    setUserIdFilter('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const getActionBadgeVariant = (action) => {
    if (!action) return 'neutral';
    if (action.includes('REJECT') || action.includes('CANCEL') || action.includes('FAILED') || action.includes('DELETE')) {
      return 'error';
    }
    if (action.includes('APPROVED') || action.includes('ACCEPTED') || action.includes('COMPLETED') || action.includes('SUCCESS')) {
      return 'success';
    }
    if (action.includes('RECEIPT') || action.includes('INVENTORY')) {
      return 'secondary';
    }
    if (action.includes('CREATED') || action.includes('SUBMITTED') || action.includes('LOGIN')) {
      return 'primary';
    }
    return 'warning';
  };

  const hasActiveFilters = Boolean(
    search.trim() ||
    actionFilter !== 'ALL' ||
    entityTypeFilter !== 'ALL' ||
    userIdFilter !== 'ALL' ||
    startDate ||
    endDate
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--spacing-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>
            System Audit Logs
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 'var(--spacing-1) 0 0 0' }}>
            Complete immutable ledger of business events, security logins, requisitions, orders, and receipts.
          </p>
        </div>
        <div>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            Refresh Logs
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card>
        <CardBody style={{ padding: 'var(--spacing-4)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 'var(--spacing-3)',
                alignItems: 'flex-end',
              }}
            >
              {/* Search Input */}
              <div style={{ minWidth: '220px' }}>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  Search Keywords
                </label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="PO #, PR #, user, action..."
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem',
                    fontSize: 'var(--font-size-sm)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-main)',
                  }}
                />
              </div>

              {/* Action Type Filter */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  Action Event
                </label>
                <select
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem',
                    fontSize: 'var(--font-size-sm)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  <option value="ALL">All Actions</option>
                  {availableActions.map((act) => (
                    <option key={act} value={act}>
                      {act}
                    </option>
                  ))}
                </select>
              </div>

              {/* Entity Type Filter */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  Target Entity
                </label>
                <select
                  value={entityTypeFilter}
                  onChange={(e) => {
                    setEntityTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem',
                    fontSize: 'var(--font-size-sm)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  <option value="ALL">All Entities</option>
                  {availableEntityTypes.map((ent) => (
                    <option key={ent} value={ent}>
                      {ent}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actor / User Filter */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  Actor / User
                </label>
                <select
                  value={userIdFilter}
                  onChange={(e) => {
                    setUserIdFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem',
                    fontSize: 'var(--font-size-sm)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  <option value="ALL">All Users</option>
                  {availableUsers.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  From Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.5rem',
                    fontSize: 'var(--font-size-xs)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-main)',
                  }}
                />
              </div>

              {/* Date To */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  To Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.5rem',
                    fontSize: 'var(--font-size-xs)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-main)',
                  }}
                />
              </div>

              {/* Search Button */}
              <div>
                <Button variant="primary" size="sm" type="submit" style={{ width: '100%' }}>
                  Filter Logs
                </Button>
              </div>
            </div>
          </form>

          {/* Sub-bar: Counter & Reset */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 'var(--spacing-2)',
              borderTop: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-muted)',
            }}
          >
            <div>
              Showing <strong>{logs.length}</strong> of <strong>{pagination.total}</strong> audit records
            </div>
            {(search || actionFilter !== 'ALL' || entityTypeFilter !== 'ALL' || userIdFilter !== 'ALL' || startDate || endDate) && (
              <button
                type="button"
                onClick={handleResetFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-accent)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Clear all filters
              </button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            padding: 'var(--spacing-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-error-bg)',
            border: '1px solid var(--color-error-border)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-error)',
          }}
        >
          {error}
        </div>
      )}

      {/* Audit Logs Table Card */}
      <Card>
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--color-bg)',
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <th style={{ padding: '0.75rem 1rem', width: '150px' }}>Timestamp</th>
                <th style={{ padding: '0.75rem 1rem', width: '180px' }}>Actor / User</th>
                <th style={{ padding: '0.75rem 1rem', width: '180px' }}>Action</th>
                <th style={{ padding: '0.75rem 1rem', width: '140px' }}>Entity</th>
                <th style={{ padding: '0.75rem 1rem', minWidth: '220px' }}>Activity Description</th>
                <th style={{ padding: '0.75rem 1rem', width: '90px', textAlign: 'center' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <p style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>Loading audit trail...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <div style={{ fontSize: '36px', marginBottom: 'var(--spacing-2)' }}>🛡️</div>
                    <p style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text-main)', margin: '0 0 0.5rem 0' }}>
                      {hasActiveFilters ? 'No audit logs match current filters' : 'No audit activity recorded yet'}
                    </p>
                    <p style={{ fontSize: 'var(--font-size-xs)', margin: 0, color: 'var(--color-text-muted)' }}>
                      {hasActiveFilters
                        ? 'Try relaxing search terms or date filters to view entries.'
                        : 'System operations, logins, approvals, and mutations will be captured in this tamper-evident audit trail.'}
                    </p>
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" onClick={handleResetFilters} style={{ marginTop: 'var(--spacing-3)' }}>
                        Clear Filters
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log._id}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      transition: 'background-color var(--transition-fast)',
                    }}
                  >
                    {/* Timestamp */}
                    <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-main)' }}>
                        {new Date(log.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(log.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </td>

                    {/* User */}
                    <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                      {log.user ? (
                        <div>
                          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-main)' }}>
                            {log.user.name}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                            {log.user.email}
                          </div>
                          <span
                            style={{
                              display: 'inline-block',
                              marginTop: '2px',
                              fontSize: '10px',
                              textTransform: 'uppercase',
                              fontWeight: 700,
                              letterSpacing: '0.05em',
                              padding: '1px 6px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--color-bg)',
                              color: 'var(--color-text-muted)',
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            {log.user.role}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', fontStyle: 'italic' }}>
                          System Event
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                      <Badge variant={getActionBadgeVariant(log.action)}>
                        {log.action}
                      </Badge>
                    </td>

                    {/* Entity */}
                    <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-main)' }}>
                        {log.entityType}
                      </div>
                      {log.entityName && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {log.entityName}
                        </div>
                      )}
                    </td>

                    {/* Description */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-main)', wordBreak: 'break-word', lineHeight: 1.4 }}>
                        {log.description}
                      </div>
                      {log.ipAddress && log.ipAddress !== '127.0.0.1' && (
                        <div style={{ fontSize: '10px', color: 'var(--color-text-light)', marginTop: '2px' }}>
                          IP: {log.ipAddress}
                        </div>
                      )}
                    </td>

                    {/* Details Inspector Button */}
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInspectedLog(log)}
                        style={{ padding: '0.25rem 0.6rem', fontSize: 'var(--font-size-xs)' }}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={(newPage) => setPage(newPage)}
          onLimitChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
          itemLabel="audit logs"
        />
      </Card>

      {/* Audit Log Inspection Modal */}
      {inspectedLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
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
              maxWidth: '680px',
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
              border: '1px solid var(--color-border)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: 'var(--spacing-4) var(--spacing-6)',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-inverted)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 700 }}>
                  Audit Record Inspection
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: 'var(--font-size-xs)', opacity: 0.85, fontFamily: 'var(--font-mono)' }}>
                  ID: {inspectedLog._id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedLog(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-inverted)',
                  fontSize: 'var(--font-size-xl)',
                  cursor: 'pointer',
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div
              style={{
                padding: 'var(--spacing-6)',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-4)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              {/* Summary Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 'var(--spacing-3)',
                  backgroundColor: 'var(--color-bg)',
                  padding: 'var(--spacing-4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Action:</span>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-main)', marginTop: '2px' }}>
                    {inspectedLog.action}
                  </div>
                </div>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Timestamp:</span>
                  <div style={{ color: 'var(--color-text-main)', marginTop: '2px' }}>
                    {new Date(inspectedLog.createdAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Target Entity:</span>
                  <div style={{ color: 'var(--color-text-main)', marginTop: '2px' }}>
                    {inspectedLog.entityType} ({inspectedLog.entityName || inspectedLog.entityId || 'N/A'})
                  </div>
                </div>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Actor / User:</span>
                  <div style={{ color: 'var(--color-text-main)', marginTop: '2px' }}>
                    {inspectedLog.user?.name || 'System'} ({inspectedLog.user?.email || 'N/A'})
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <span
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-text-muted)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Activity Description
                </span>
                <p
                  style={{
                    padding: 'var(--spacing-3)',
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-main)',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {inspectedLog.description}
                </p>
              </div>

              {/* Structured Metadata */}
              {inspectedLog.metadata && Object.keys(inspectedLog.metadata).length > 0 && (
                <div>
                  <span
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--color-text-muted)',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Event Metadata
                  </span>
                  <pre
                    style={{
                      padding: 'var(--spacing-4)',
                      backgroundColor: '#0f172a',
                      color: '#34d399',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-xs)',
                      fontFamily: 'var(--font-mono)',
                      overflowX: 'auto',
                      maxHeight: '200px',
                      margin: 0,
                    }}
                  >
                    {JSON.stringify(inspectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: 'var(--spacing-3) var(--spacing-6)',
                backgroundColor: 'var(--color-bg)',
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <Button variant="outline" size="sm" onClick={() => setInspectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;
