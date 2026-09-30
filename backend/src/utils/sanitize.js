const mongoose = require('mongoose');

/**
 * Escapes special regex characters and bounds string length to prevent ReDoS and regex syntax crashes.
 * @param {string} str - Raw search query
 * @param {number} [maxLength=100] - Maximum allowed search length
 * @returns {string} Safe escaped string
 */
const escapeRegex = (str, maxLength = 100) => {
  if (typeof str !== 'string') return '';
  const trimmed = str.trim().slice(0, maxLength);
  return trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Safely parses and clamps integer values within [min, max] bounds.
 * Flexible signature support:
 *   toSafeInteger(val, defaultVal = 1, min = 1, max = 100)
 *   toSafeInteger(val, min, max, defaultVal)
 * @param {any} val - Input value
 * @param {number} [arg2=1] - defaultVal OR min
 * @param {number} [arg3=1] - min OR max
 * @param {number} [arg4=100] - max OR defaultVal
 * @returns {number} Clamped integer
 */
const toSafeInteger = (val, arg2 = 1, arg3 = 1, arg4 = 100) => {
  let defaultVal = 1;
  let min = 1;
  let max = 100000;

  if (arg2 > arg3) {
    // Caller passed (val, defaultVal, min, max) e.g. (limit, 10, 1, 100)
    defaultVal = arg2;
    min = arg3;
    max = arg4;
  } else if (arg3 > 10) {
    // Caller passed (val, min, max, defaultVal) e.g. (page, 1, 10000, 1) or (limit, 1, 100, 10)
    min = arg2;
    max = arg3;
    defaultVal = arg4 !== undefined ? arg4 : arg2;
  } else {
    // Both <= 10, e.g. (page, 1, 1, 10000) or (page, 1, 1)
    defaultVal = arg2;
    min = arg3;
    max = arg4 || 100000;
  }

  if (min > max) {
    const temp = min;
    min = max;
    max = temp;
  }

  const parsed = parseInt(val, 10);
  if (isNaN(parsed)) return defaultVal;
  return Math.min(max, Math.max(min, parsed));
};

/**
 * Validates whether an ID string is a valid MongoDB ObjectId hex string.
 * @param {any} id - Target ID
 * @returns {boolean}
 */
const isValidObjectId = (id) => {
  if (!id) return false;
  return mongoose.Types.ObjectId.isValid(String(id));
};

/**
 * Sanitizes arbitrary user string input (removes null bytes, trims, clamps length).
 * @param {any} val - Input value
 * @param {number} [maxLength=1000] - Max length
 * @returns {string}
 */
const sanitizeString = (val, maxLength = 1000) => {
  if (typeof val !== 'string') return '';
  return val.replace(/\0/g, '').trim().slice(0, maxLength);
};

module.exports = {
  escapeRegex,
  toSafeInteger,
  isValidObjectId,
  sanitizeString,
};
