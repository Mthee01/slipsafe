/**
 * Return window and warranty rules
 * Computes deadline dates based on purchase date
 */

import dayjs from 'dayjs';

// Default rules (configurable)
const DEFAULT_RETURN_WINDOW_DAYS = 30;
const DEFAULT_WARRANTY_MONTHS = 12;

/**
 * Compute return and warranty deadlines
 * @param {string|Date} purchaseDate - Date of purchase
 * @param {Object} options - {returnDays, warrantyMonths} overrides
 * @returns {Object} {returnBy, warrantyEnds}
 */
export function computeDeadlines(purchaseDate, options = {}) {
  const {
    returnDays = DEFAULT_RETURN_WINDOW_DAYS,
    warrantyMonths = DEFAULT_WARRANTY_MONTHS
  } = options;

  const date = dayjs(purchaseDate);
  
  if (!date.isValid()) {
    throw new Error('Invalid purchase date');
  }

  return {
    returnBy: date.add(returnDays, 'day').format('YYYY-MM-DD'),
    warrantyEnds: date.add(warrantyMonths, 'month').format('YYYY-MM-DD')
  };
}

/**
 * Get merchant-specific rules (for future implementation)
 * TODO: Add database table for merchant-specific return/warranty policies
 * @param {string} merchant - Merchant name
 * @returns {Object} {returnDays, warrantyMonths}
 */
export function getMerchantRules(merchant) {
  // TODO: Query database for merchant-specific rules
  // For now, return defaults
  return {
    returnDays: DEFAULT_RETURN_WINDOW_DAYS,
    warrantyMonths: DEFAULT_WARRANTY_MONTHS
  };
}

/**
 * Check if return window is still valid
 * @param {string|Date} returnByDate - Return deadline
 * @returns {boolean} True if still within return window
 */
export function isReturnWindowValid(returnByDate) {
  return dayjs().isBefore(dayjs(returnByDate));
}

/**
 * Check if warranty is still valid
 * @param {string|Date} warrantyEndsDate - Warranty expiration
 * @returns {boolean} True if warranty still valid
 */
export function isWarrantyValid(warrantyEndsDate) {
  return dayjs().isBefore(dayjs(warrantyEndsDate));
}

/**
 * Get days remaining for return
 * @param {string|Date} returnByDate - Return deadline
 * @returns {number} Days remaining (negative if expired)
 */
export function getDaysUntilReturn(returnByDate) {
  return dayjs(returnByDate).diff(dayjs(), 'day');
}

/**
 * Get days remaining for warranty
 * @param {string|Date} warrantyEndsDate - Warranty expiration
 * @returns {number} Days remaining (negative if expired)
 */
export function getDaysUntilWarrantyExpiry(warrantyEndsDate) {
  return dayjs(warrantyEndsDate).diff(dayjs(), 'day');
}
