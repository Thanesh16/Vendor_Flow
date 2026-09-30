const express = require('express');
const {
  getUnreadCount,
  getMyNotifications,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  deleteNotification,
} = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Get authenticated user's unread count
router.get('/unread-count', getUnreadCount);

// Get authenticated user's notifications (with ?filter=all|unread|read&page=1&limit=20)
router.get('/', getMyNotifications);

// Mark single notification as read
router.patch('/:id/read', markNotificationRead);

// Mark single notification as unread
router.patch('/:id/unread', markNotificationUnread);

// Mark all notifications as read
router.patch('/read-all', markAllNotificationsRead);

// Delete notification
router.delete('/:id', deleteNotification);

module.exports = router;
