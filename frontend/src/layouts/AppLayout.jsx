import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import notificationService from '../services/notificationService';
import ErrorBoundary from '../components/common/ErrorBoundary';

export const AppLayout = () => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Navigation configuration structured strictly by authenticated role
  const navigationByRole = {
    ADMIN: [
      { to: '/dashboard', label: 'Dashboard', icon: '📊' },
      { to: '/admin/master-catalog', label: 'Master Catalog', icon: '📚' },
      { to: '/admin/users', label: 'User Management', icon: '👥' },
      { to: '/reports', label: 'Reports & Analytics', icon: '📈' },
      { to: '/admin/audit-logs', label: 'Audit Logs', icon: '🛡️' },
      { to: '/procurement/orders', label: 'Purchase Orders', icon: '📑' },
      { to: '/purchase-requests', label: 'Purchase Requests', icon: '📝' },
      { to: '/procurement/products', label: 'Vendor Products', icon: '🛍️' },
      { to: '/vendors', label: 'Vendors', icon: '🏢' },
    ],
    PROCUREMENT_MANAGER: [
      { to: '/dashboard', label: 'Dashboard', icon: '📊' },
      { to: '/reports', label: 'Reports & Analytics', icon: '📈' },
      { to: '/procurement/orders', label: 'Purchase Orders', icon: '📑' },
      { to: '/purchase-requests', label: 'Purchase Requests', icon: '📝' },
      { to: '/procurement/products', label: 'Vendor Products', icon: '🛍️' },
      { to: '/vendors', label: 'Vendors', icon: '🏢' },
    ],
    EMPLOYEE: [
      { to: '/dashboard', label: 'Dashboard', icon: '📊' },
      { to: '/purchase-requests?action=create', label: 'Create Request', icon: '➕' },
      { to: '/purchase-requests', label: 'My Requests', icon: '📝' },
      { to: '/employee/orders', label: 'My Orders', icon: '📦' },
    ],
    VENDOR: [
      { to: '/dashboard', label: 'Dashboard', icon: '📊' },
      { to: '/vendor/orders', label: 'Incoming Orders', icon: '📥' },
      { to: '/vendor/products', label: 'My Products', icon: '📦' },
      { to: '/profile', label: 'My Company', icon: '🏢' },
    ],
  };

  const resolveRoleAwareLink = (link) => {
    if (!link) return null;
    const role = user?.role;
    if (link.startsWith('/purchase-orders')) {
      if (role === 'VENDOR') return '/vendor/orders';
      if (role === 'EMPLOYEE') return '/employee/orders';
      return '/procurement/orders';
    }
    if (link.startsWith('/vendors') && role === 'VENDOR') {
      return '/profile';
    }
    return link;
  };

  const loadNotifications = async () => {
    try {
      const response = await notificationService.getMyNotifications({ limit: 5 });
      if (response.data) {
        setNotifications(response.data.notifications || []);
        setUnreadCount(response.data.unreadCount || 0);
      }
    } catch {
      // Non-blocking notification loading
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 15000); // Polling every 15s
    return () => clearInterval(interval);
  }, []);

  // Handle click outside notification dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkNotificationRead = async (notif) => {
    try {
      if (!notif.isRead) {
        await notificationService.markRead(notif._id);
        setNotifications((prev) =>
          prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      setShowNotifications(false);
      const targetLink = resolveRoleAwareLink(notif.link);
      if (targetLink) {
        navigate(targetLink);
      }
    } catch {
      // Ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Ignore
    }
  };

  const navItems = (user && navigationByRole[user.role]) || [];

  // Get human-friendly label for current topbar title
  const currentNavItem = navItems.find((item) => item.to === location.pathname);
  const pageTitle = currentNavItem ? currentNavItem.label : 'Dashboard';

  const roleBadgeVariant =
    user?.role === 'ADMIN'
      ? 'error'
      : user?.role === 'PROCUREMENT_MANAGER'
      ? 'warning'
      : user?.role === 'EMPLOYEE'
      ? 'info'
      : 'neutral';

  return (
    <div className="app-shell">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`app-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
            <div className="navbar-logo-icon">VF</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 'var(--font-size-base)', color: 'var(--color-primary)', lineHeight: 1.2 }}>
                VENDORFLOW
              </div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-light)', letterSpacing: '0.05em' }}>
                PROCUREMENT PORTAL
              </div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div style={{ padding: 'var(--spacing-2) var(--spacing-3)', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Main Menu
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                `sidebar-nav-link ${isActive ? 'active' : ''}`
              }
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Role:</span>
            <Badge variant={roleBadgeVariant} size="sm">
              {user?.role}
            </Badge>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="app-main-wrapper">
        {/* Top Header */}
        <header className="app-topbar">
          <div className="app-topbar-left">
            <button
              className="menu-toggle-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              ☰
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-light)' }}>Portal /</span>
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text-main)' }}>
                {pageTitle}
              </h2>
            </div>
          </div>

          <div className="app-topbar-right">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
              {/* Notification Bell Dropdown */}
              <div ref={notificationRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowNotifications(!showNotifications)}
                  style={{
                    position: 'relative',
                    background: 'none',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-full)',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '16px',
                    backgroundColor: 'var(--color-surface)',
                  }}
                  aria-label="Notifications"
                >
                  🔔
                  {unreadCount > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        backgroundColor: 'var(--color-error)',
                        color: '#fff',
                        borderRadius: 'var(--radius-full)',
                        padding: '1px 5px',
                        fontSize: '10px',
                        fontWeight: 800,
                        lineHeight: 1.2,
                      }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown Panel */}
                {showNotifications && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '42px',
                      width: '340px',
                      maxHeight: '440px',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: 'var(--shadow-xl)',
                      zIndex: 1200,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: 'var(--spacing-3) var(--spacing-4)',
                        borderBottom: '1px solid var(--color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'var(--color-bg)',
                      }}
                    >
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Notifications {unreadCount > 0 ? `(${unreadCount} Unread)` : ''}
                      </span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '11px',
                            color: 'var(--color-primary)',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div style={{ overflowY: 'auto', maxHeight: '300px' }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: 'var(--spacing-6)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                          No notifications yet.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n._id}
                            onClick={() => handleMarkNotificationRead(n)}
                            style={{
                              padding: 'var(--spacing-3) var(--spacing-4)',
                              borderBottom: '1px solid var(--color-border)',
                              cursor: 'pointer',
                              backgroundColor: n.isRead ? 'transparent' : 'rgba(30, 58, 138, 0.04)',
                              transition: 'background 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: n.isRead ? 600 : 700, color: 'var(--color-text-main)' }}>
                                {n.title}
                              </span>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-light)' }}>
                                {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', lineHeight: 1.3 }}>
                              {n.message}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Footer link to Notification Center */}
                    <div
                      style={{
                        padding: 'var(--spacing-2) var(--spacing-4)',
                        borderTop: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg)',
                        textAlign: 'center',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotifications(false);
                          navigate('/notifications');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-primary)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 'var(--spacing-1) 0',
                          width: '100%',
                        }}
                      >
                        View All Notifications ➔
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'right', display: 'none', md: 'block' }}>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-main)' }}>
                  {user?.name}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>
                  {user?.email}
                </div>
              </div>

              <Badge variant={roleBadgeVariant}>
                {user?.role}
              </Badge>

              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="app-content">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
