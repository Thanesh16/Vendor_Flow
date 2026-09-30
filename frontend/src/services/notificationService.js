import api from './api';

export const notificationService = {
  /**
   * Get authenticated user unread notification count
   */
  async getUnreadCount() {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  /**
   * Get notifications for authenticated user
   * @param {Object} params - { filter: 'all'|'unread'|'read', page: number, limit: number }
   */
  async getMyNotifications(params = {}) {
    const response = await api.get('/notifications', { params });
    return response.data;
  },

  /**
   * Mark single notification as read
   */
  async markRead(id) {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data;
  },

  /**
   * Mark single notification as unread
   */
  async markUnread(id) {
    const response = await api.patch(`/notifications/${id}/unread`);
    return response.data;
  },

  /**
   * Mark all notifications as read
   */
  async markAllRead() {
    const response = await api.patch('/notifications/read-all');
    return response.data;
  },

  /**
   * Delete a notification
   */
  async deleteNotification(id) {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  },
};

export default notificationService;
