import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Card, { CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import notificationService from '../../services/notificationService';

export const NotificationCenterPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [readCount, setReadCount] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [totalMatching, setTotalMatching] = useState(0);

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread' | 'read'
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSec = Math.floor((now - date) / 1000);

    if (diffInSec < 30) return 'Just now';
    if (diffInSec < 60) return `${diffInSec}s ago`;
    const diffInMin = Math.floor(diffInSec / 60);
    if (diffInMin < 60) return `${diffInMin}m ago`;
    const diffInHours = Math.floor(diffInMin / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
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

  const fetchNotifications = useCallback(
    async (tab = activeTab, page = currentPage, currentLimit = limit) => {
      setLoading(true);
      setError('');
      try {
        const response = await notificationService.getMyNotifications({
          filter: tab,
          page,
          limit: currentLimit,
        });

        if (response.data) {
          setNotifications(response.data.notifications || []);
          setUnreadCount(response.data.unreadCount || 0);
          setReadCount(response.data.readCount || 0);
          setTotalAll(response.data.totalAll || 0);
          setTotalMatching(response.data.total || 0);
          setTotalPages(response.data.totalPages || 1);
        }
      } catch (err) {
        setError(err.message || 'Failed to load notifications');
      } finally {
        setLoading(false);
      }
    },
    [activeTab, currentPage, limit]
  );

  useEffect(() => {
    fetchNotifications(activeTab, currentPage, limit);
  }, [activeTab, currentPage, limit, fetchNotifications]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleMarkRead = async (notif) => {
    setActionLoadingId(notif._id);
    try {
      await notificationService.markRead(notif._id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setReadCount((prev) => prev + 1);

      // If on unread tab, re-fetch to maintain accurate list
      if (activeTab === 'unread') {
        fetchNotifications('unread', currentPage);
      }
    } catch (err) {
      alert(err.message || 'Failed to mark notification as read');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkUnread = async (notif) => {
    setActionLoadingId(notif._id);
    try {
      await notificationService.markUnread(notif._id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, isRead: false } : n))
      );
      setUnreadCount((prev) => prev + 1);
      setReadCount((prev) => Math.max(0, prev - 1));

      // If on read tab, re-fetch to maintain accurate list
      if (activeTab === 'read') {
        fetchNotifications('read', currentPage);
      }
    } catch (err) {
      alert(err.message || 'Failed to mark notification as unread');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await notificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      setReadCount(totalAll);
      if (activeTab === 'unread') {
        fetchNotifications('unread', 1);
      }
    } catch (err) {
      alert(err.message || 'Failed to mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async (id) => {
    setActionLoadingId(id);
    try {
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      fetchNotifications(activeTab, currentPage);
    } catch (err) {
      alert(err.message || 'Failed to delete notification');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await notificationService.markRead(notif._id);
      } catch {
        // Non-blocking
      }
    }
    const targetLink = resolveRoleAwareLink(notif.link);
    if (targetLink) {
      navigate(targetLink);
    }
  };

  const getTypeBadgeVariant = (type) => {
    switch (type) {
      case 'SUCCESS':
        return 'success';
      case 'WARNING':
        return 'warning';
      case 'ALERT':
        return 'error';
      case 'INFO':
      default:
        return 'info';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'SUCCESS':
        return '✅';
      case 'WARNING':
        return '⚠️';
      case 'ALERT':
        return '🚨';
      case 'INFO':
      default:
        return 'ℹ️';
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--spacing-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>
            Notification Center
          </h1>
          <p style={{ margin: 'var(--spacing-1) 0 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Real-time updates on purchase requisitions, orders, delivery milestones, and vendor activity.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNotifications(activeTab, currentPage)}
            disabled={loading}
          >
            🔄 Refresh
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markingAll}
            >
              {markingAll ? 'Marking...' : 'Mark All Read'}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: 'var(--spacing-4)', backgroundColor: '#FEF2F2', border: '1px solid #F87171', borderRadius: 'var(--radius-md)', color: '#991B1B', fontSize: 'var(--font-size-sm)' }}>
          {error}
        </div>
      )}

      {/* Tabs & Summary Bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--color-border)', gap: 'var(--spacing-2)' }}>
        <button
          type="button"
          onClick={() => handleTabChange('all')}
          style={{
            padding: 'var(--spacing-3) var(--spacing-4)',
            border: 'none',
            borderBottom: activeTab === 'all' ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: '-2px',
            backgroundColor: 'transparent',
            fontWeight: activeTab === 'all' ? 700 : 500,
            color: activeTab === 'all' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-2)',
          }}
        >
          <span>All</span>
          <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '10px', backgroundColor: activeTab === 'all' ? 'var(--color-primary-light)' : 'var(--color-bg-subtle)', color: activeTab === 'all' ? '#fff' : 'var(--color-text-muted)' }}>
            {totalAll}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('unread')}
          style={{
            padding: 'var(--spacing-3) var(--spacing-4)',
            border: 'none',
            borderBottom: activeTab === 'unread' ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: '-2px',
            backgroundColor: 'transparent',
            fontWeight: activeTab === 'unread' ? 700 : 500,
            color: activeTab === 'unread' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-2)',
          }}
        >
          <span>Unread</span>
          {unreadCount > 0 && (
            <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '10px', backgroundColor: 'var(--color-error)', color: '#fff', fontWeight: 700 }}>
              {unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('read')}
          style={{
            padding: 'var(--spacing-3) var(--spacing-4)',
            border: 'none',
            borderBottom: activeTab === 'read' ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: '-2px',
            backgroundColor: 'transparent',
            fontWeight: activeTab === 'read' ? 700 : 500,
            color: activeTab === 'read' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-2)',
          }}
        >
          <span>Read</span>
          <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '10px', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
            {readCount}
          </span>
        </button>
      </div>

      {/* Notifications List */}
      <Card>
        <CardBody style={{ padding: 0 }}>
          {loading && notifications.length === 0 ? (
            <div style={{ padding: 'var(--spacing-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: 'var(--spacing-12)', textAlign: 'center' }}>
              <div style={{ fontSize: '42px', marginBottom: 'var(--spacing-3)' }}>📬</div>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-main)', margin: '0 0 var(--spacing-1) 0' }}>
                {activeTab === 'unread'
                  ? 'No unread notifications'
                  : activeTab === 'read'
                  ? 'No read notifications'
                  : 'No notifications found'}
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                {activeTab === 'unread'
                  ? "You're all caught up! New business updates will appear here."
                  : 'Notifications will automatically appear as purchase requests, orders, and deliveries advance.'}
              </p>
            </div>
          ) : (
            <div>
              {notifications.map((notif, index) => {
                const targetLink = resolveRoleAwareLink(notif.link);
                const isUnread = !notif.isRead;

                return (
                  <div
                    key={notif._id}
                    style={{
                      padding: 'var(--spacing-4) var(--spacing-5)',
                      borderBottom: index < notifications.length - 1 ? '1px solid var(--color-border)' : 'none',
                      backgroundColor: isUnread ? 'rgba(30, 58, 138, 0.03)' : 'transparent',
                      display: 'flex',
                      gap: 'var(--spacing-4)',
                      alignItems: 'flex-start',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    {/* Status indicator dot / icon */}
                    <div style={{ paddingTop: '2px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '18px' }} title={notif.type}>
                        {getTypeIcon(notif.type)}
                      </span>
                      {isUnread && (
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-primary)',
                          }}
                          title="Unread notification"
                        />
                      )}
                    </div>

                    {/* Notification Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                          <span
                            onClick={() => targetLink && handleNotificationClick(notif)}
                            style={{
                              fontSize: 'var(--font-size-sm)',
                              fontWeight: isUnread ? 700 : 600,
                              color: 'var(--color-text-main)',
                              cursor: targetLink ? 'pointer' : 'default',
                              textDecoration: targetLink ? 'none' : 'none',
                            }}
                          >
                            {notif.title}
                          </span>
                          <Badge variant={getTypeBadgeVariant(notif.type)} dot={false}>
                            {notif.type}
                          </Badge>
                        </div>

                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-text-light)',
                            whiteSpace: 'nowrap',
                          }}
                          title={new Date(notif.createdAt).toLocaleString()}
                        >
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>

                      <p
                        style={{
                          fontSize: 'var(--font-size-sm)',
                          color: isUnread ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                          margin: '0 0 var(--spacing-2) 0',
                          lineHeight: 1.4,
                        }}
                      >
                        {notif.message}
                      </p>

                      {/* Action buttons on notification item */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', fontSize: '12px' }}>
                        {targetLink && (
                          <button
                            type="button"
                            onClick={() => handleNotificationClick(notif)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: 'var(--color-primary)',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            View Details &rarr;
                          </button>
                        )}

                        {isUnread ? (
                          <button
                            type="button"
                            onClick={() => handleMarkRead(notif)}
                            disabled={actionLoadingId === notif._id}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: 'var(--color-text-muted)',
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            Mark as read
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleMarkUnread(notif)}
                            disabled={actionLoadingId === notif._id}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: 'var(--color-text-muted)',
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            Mark as unread
                          </button>
                        )}

                        <span style={{ color: 'var(--color-border)' }}>•</span>

                        <button
                          type="button"
                          onClick={() => handleDelete(notif._id)}
                          disabled={actionLoadingId === notif._id}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: 'var(--color-error)',
                            cursor: 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Pagination Controls */}
      {!loading && totalMatching > 0 && (
        <Card style={{ marginTop: 'var(--spacing-4)' }}>
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            total={totalMatching}
            limit={limit}
            onPageChange={(p) => setCurrentPage(p)}
            onLimitChange={(lim) => {
              setLimit(lim);
              setCurrentPage(1);
            }}
            itemLabel="notifications"
            pageSizeOptions={[10, 20, 50]}
          />
        </Card>
      )}
    </div>
  );
};

export default NotificationCenterPage;
