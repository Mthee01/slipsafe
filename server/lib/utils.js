/**
 * Utility functions for data comparison and validation
 */

/**
 * Check if two numbers are close (within tolerance)
 * Useful for comparing monetary amounts that might have floating point differences
 * @param {number} a - First number
 * @param {number} b - Second number
 * @param {number} tolerance - Tolerance (default: 0.01 for cents)
 * @returns {boolean} True if numbers are within tolerance
 */
export function isClose(a, b, tolerance = 0.01) {
  return Math.abs(a - b) < tolerance;
}

/**
 * Normalize date string to YYYY-MM-DD format
 * Handles various date formats
 * @param {string} dateString - Date in various formats
 * @returns {string|null} Normalized date or null if invalid
 */
export function normalizeDate(dateString) {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    return null;
  }
}

/**
 * Sanitize merchant name for comparison
 * Removes extra spaces, converts to lowercase
 * @param {string} merchant - Merchant name
 * @returns {string} Sanitized merchant name
 */
export function sanitizeMerchant(merchant) {
  return merchant?.trim().toLowerCase().replace(/\s+/g, ' ') || '';
}

/**
 * Validate receipt data completeness
 * @param {Object} data - {merchant, date, total}
 * @returns {Object} {isValid, missing}
 */
export function validateReceiptData(data) {
  const missing = [];
  
  if (!data.merchant) missing.push('merchant');
  if (!data.date) missing.push('date');
  if (data.total === null || data.total === undefined) missing.push('total');
  
  return {
    isValid: missing.length === 0,
    missing
  };
}

/**
 * Format currency for display
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
}
