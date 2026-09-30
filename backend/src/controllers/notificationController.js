const { Notification } = require('../models/Notification');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * Get unread notification count for authenticated user
 * @route GET /api/notifications/unread-count
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    return successResponse(res, 200, 'Unread notification count retrieved', {
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get notifications for authenticated user with pagination and filter support
 * @route GET /api/notifications
 * @query filter: 'all' | 'unread' | 'read' (default: 'all')
 * @query page: number (default: 1)
 * @query limit: number (default: 20)
 */
const getMyNotifications = async (req, res, next) => {
  try {
    const { filter = 'all', page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = { recipient: req.user._id };

    if (filter === 'unread') {
      query.isRead = false;
    } else if (filter === 'read') {
      query.isRead = true;
    }

    const [notifications, totalMatching, unreadCount, totalAll] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
      Notification.countDocuments({ recipient: req.user._id }),
    ]);

    const readCount = Math.max(0, totalAll - unreadCount);
    const totalPages = Math.ceil(totalMatching / limitNum) || 1;

    return successResponse(res, 200, 'Notifications retrieved successfully', {
      unreadCount,
      readCount,
      totalAll,
      total: totalMatching,
      count: notifications.length,
      page: pageNum,
      limit: limitNum,
      totalPages,
      filter,
      notifications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark single notification as read
 * @route PATCH /api/notifications/:id/read
 */
const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user._id,
    });

    if (!notification) {
      return errorResponse(res, 404, 'Notification not found');
    }

    if (!notification.isRead) {
      notification.isRead = true;
      await notification.save();
    }

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    return successResponse(res, 200, 'Notification marked as read', {
      notification,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark single notification as unread
 * @route PATCH /api/notifications/:id/unread
 */
const markNotificationUnread = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user._id,
    });

    if (!notification) {
      return errorResponse(res, 404, 'Notification not found');
    }

    if (notification.isRead) {
      notification.isRead = false;
      await notification.save();
    }

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    return successResponse(res, 200, 'Notification marked as unread', {
      notification,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read for current user
 * @route PATCH /api/notifications/read-all
 */
const markAllNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );

    return successResponse(res, 200, 'All notifications marked as read', {
      unreadCount: 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a notification
 * @route DELETE /api/notifications/:id
 */
const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id,
    });

    if (!notification) {
      return errorResponse(res, 404, 'Notification not found');
    }

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    return successResponse(res, 200, 'Notification deleted successfully', {
      deletedId: req.params.id,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUnreadCount,
  getMyNotifications,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  deleteNotification,
};
