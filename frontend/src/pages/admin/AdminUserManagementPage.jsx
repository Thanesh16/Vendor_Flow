import React, { useState, useEffect, useCallback } from 'react';
import Card, { CardBody, CardHeader } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import userService from '../../services/userService';

export const AdminUserManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filtering & Pagination State
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Fetch users from backend API
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit,
        role: roleFilter,
      };
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const response = await userService.getUsers(params);
      setUsers(response.data?.users || []);
      if (response.data?.pagination) {
        setPagination(response.data.pagination);
      }
    } catch (err) {
      setError(err.message || 'Failed to load user accounts');
    } finally {
      setLoading(false);
    }
  }, [page, limit, roleFilter, searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Debounced search reset
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleRoleFilterChange = (role) => {
    setRoleFilter(role);
    setPage(1);
  };

  // Modal open / close handlers
  const handleOpenModal = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    if (!formSubmitting) {
      setModalOpen(false);
      setFormError('');
    }
  };

  // Submit Procurement Manager Creation
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim() || !formData.email.trim() || !formData.password) {
      setFormError('All fields are required.');
      return;
    }

    if (formData.password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setFormSubmitting(true);
    try {
      await userService.createProcurementManager({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });

      setSuccessMessage(`Procurement Manager account for '${formData.name.trim()}' created successfully.`);
      setModalOpen(false);
      fetchUsers();
      // Clear success notification after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setFormError(err.message || 'Failed to create Procurement Manager account.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN':
        return <Badge variant="error">ADMIN</Badge>;
      case 'PROCUREMENT_MANAGER':
        return <Badge variant="warning">PROCUREMENT MANAGER</Badge>;
      case 'EMPLOYEE':
        return <Badge variant="info">EMPLOYEE</Badge>;
      case 'VENDOR':
        return <Badge variant="neutral">VENDOR</Badge>;
      default:
        return <Badge variant="neutral">{role}</Badge>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--spacing-4)',
          marginBottom: 'var(--spacing-6)',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-primary)', marginBottom: 'var(--spacing-1)' }}>
            User Management & Staff Accounts
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
            System administrator provisioning of internal staff accounts, role oversight, and registered user directory.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
          <Button variant="outline" size="sm" onClick={fetchUsers}>
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={handleOpenModal}>
            ➕ Create Procurement Manager
          </Button>
        </div>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <div
          style={{
            backgroundColor: 'rgba(22, 163, 74, 0.1)',
            border: '1px solid #16a34a',
            color: '#16a34a',
            padding: 'var(--spacing-3) var(--spacing-4)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--spacing-4)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 500,
          }}
        >
          ✓ {successMessage}
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div
          style={{
            backgroundColor: 'var(--color-error-bg)',
            border: '1px solid var(--color-error-border)',
            color: 'var(--color-error)',
            padding: 'var(--spacing-3) var(--spacing-4)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--spacing-4)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card style={{ marginBottom: 'var(--spacing-6)' }}>
        <CardBody style={{ padding: 'var(--spacing-4)' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--spacing-4)',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {/* Search Input */}
            <div style={{ flex: '1 1 280px' }}>
              <input
                type="text"
                placeholder="Search by name or email address..."
                value={searchQuery}
                onChange={handleSearchChange}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-sm)',
                  outline: 'none',
                  backgroundColor: 'var(--color-bg)',
                }}
              />
            </div>

            {/* Role Filter Tabs */}
            <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
              {['ALL', 'PROCUREMENT_MANAGER', 'EMPLOYEE', 'VENDOR', 'ADMIN'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleFilterChange(r)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${roleFilter === r ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    backgroundColor: roleFilter === r ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: roleFilter === r ? '#ffffff' : 'var(--color-text-main)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {r === 'ALL'
                    ? 'All Roles'
                    : r === 'PROCUREMENT_MANAGER'
                    ? 'Procurement Managers'
                    : r === 'EMPLOYEE'
                    ? 'Employees'
                    : r === 'VENDOR'
                    ? 'Vendors'
                    : 'Admins'}
                </button>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* User Directory Table */}
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>System Accounts Directory</span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              {pagination.total} registered accounts
            </span>
          </div>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 'var(--spacing-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Loading user accounts from database...
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: 'var(--spacing-12)', textAlign: 'center' }}>
              <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
                No accounts match the selected criteria.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-surface-hover)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Account Name
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Email Address
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Assigned Role
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Account Status
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Registered Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u._id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-main)' }}>
                        {u.name}
                      </td>
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', color: 'var(--color-text-muted)', fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
                        {u.email}
                      </td>
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
                        {getRoleBadge(u.role)}
                      </td>
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
                        <Badge variant={u.isActive ? 'success' : 'error'}>
                          {u.isActive ? 'Active' : 'Deactivated'}
                        </Badge>
                      </td>
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                        {formatDate(u.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Toolbar */}
          {!loading && pagination.total > 0 && (
            <div style={{ padding: 'var(--spacing-3) var(--spacing-4)', borderTop: '1px solid var(--color-border)' }}>
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                limit={pagination.limit}
                onPageChange={(p) => setPage(p)}
                onLimitChange={(lim) => {
                  setLimit(lim);
                  setPage(1);
                }}
                itemLabel="accounts"
                pageSizeOptions={[10, 20, 50]}
              />
            </div>
          )}
        </CardBody>
      </Card>

      {/* Provision Procurement Manager Modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--spacing-4)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '520px',
              width: '100%',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
              border: '1px solid var(--color-border)',
            }}
          >
            <div
              style={{
                padding: 'var(--spacing-5) var(--spacing-6)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--color-primary)' }}>
                  Provision Procurement Manager
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Create an internal staff account with Procurement Manager privileges
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={formSubmitting}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ padding: 'var(--spacing-6)' }}>
              {/* Security Policy Banner */}
              <div
                style={{
                  backgroundColor: 'rgba(30, 58, 138, 0.06)',
                  border: '1px solid rgba(30, 58, 138, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-3) var(--spacing-4)',
                  marginBottom: 'var(--spacing-5)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-primary)',
                }}
              >
                <strong>Admin Security Policy:</strong> This account will be strictly assigned the{' '}
                <code>PROCUREMENT_MANAGER</code> role. Public self-registration for this role is blocked.
              </div>

              {formError && (
                <div
                  style={{
                    backgroundColor: 'var(--color-error-bg)',
                    border: '1px solid var(--color-error-border)',
                    color: 'var(--color-error)',
                    padding: 'var(--spacing-3)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-xs)',
                    marginBottom: 'var(--spacing-4)',
                  }}
                >
                  {formError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
                <div>
                  <label
                    htmlFor="pm-name"
                    style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--color-text-main)' }}
                  >
                    Full Name *
                  </label>
                  <input
                    id="pm-name"
                    type="text"
                    required
                    placeholder="e.g. Alex Morgan"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-sm)',
                      outline: 'none',
                      backgroundColor: 'var(--color-bg)',
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="pm-email"
                    style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--color-text-main)' }}
                  >
                    Business Email *
                  </label>
                  <input
                    id="pm-email"
                    type="email"
                    required
                    placeholder="e.g. alex.morgan@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-sm)',
                      outline: 'none',
                      backgroundColor: 'var(--color-bg)',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
                  <div>
                    <label
                      htmlFor="pm-password"
                      style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--color-text-main)' }}
                    >
                      Initial Password *
                    </label>
                    <input
                      id="pm-password"
                      type="password"
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--font-size-sm)',
                        outline: 'none',
                        backgroundColor: 'var(--color-bg)',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="pm-confirm"
                      style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--color-text-main)' }}
                    >
                      Confirm Password *
                    </label>
                    <input
                      id="pm-confirm"
                      type="password"
                      required
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--font-size-sm)',
                        outline: 'none',
                        backgroundColor: 'var(--color-bg)',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 'var(--spacing-3)',
                  marginTop: 'var(--spacing-6)',
                  paddingTop: 'var(--spacing-4)',
                  borderTop: '1px solid var(--color-border)',
                }}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCloseModal}
                  disabled={formSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? 'Creating Account...' : 'Create Account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserManagementPage;
