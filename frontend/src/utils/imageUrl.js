/**
 * Utility functions for handling and resolving image URLs across VENDORFLOW
 */

/**
 * Resolves an image URL so it can be reliably fetched by the browser.
 * - Handles full URLs (http://, https://)
 * - Handles local blob previews (blob:...)
 * - Resolves relative backend paths (/uploads/vendors/..., /uploads/products/...)
 *   against the backend host.
 *
 * @param {string} url - Image path or URL
 * @returns {string} Fully resolved browser-accessible image URL
 */
export const getImageUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Already a full or blob URL
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Relative upload path, e.g. /uploads/vendors/... or uploads/products/...
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const backendHost = apiBase.replace(/\/api\/?$/, '');
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${backendHost}${cleanPath}`;
};

/**
 * Validates whether a given string is a safe, valid HTTP/HTTPS image URL.
 * Rejects javascript:, data:, vbscript:, file:, and malformed URLs.
 *
 * @param {string} url - Candidate URL string
 * @returns {boolean} True if safe and valid HTTP/HTTPS URL
 */
export const isValidImageUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (err) {
    return false;
  }
};

export default {
  getImageUrl,
  isValidImageUrl,
};
