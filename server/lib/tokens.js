/**
 * JWT token generation, PIN creation, and hashing utilities
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_me';
const JWT_EXPIRY = '90d'; // 90 days as per spec

/**
 * Generate SHA256 hash from merchant, date, and total
 * @param {string} merchant - Merchant name
 * @param {string} date - Purchase date
 * @param {number} total - Purchase total
 * @returns {string} SHA256 hash
 */
export function generateHash(merchant, date, total) {
  const data = `${merchant}|${date}|${total}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate 6-digit random PIN
 * @returns {string} 6-digit PIN
 */
export function generatePIN() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create JWT token for claim
 * @param {Object} payload - {merchant, date, total, hash}
 * @returns {string} JWT token
 */
export function createClaimToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Verify and decode JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded payload or null if invalid
 */
export function verifyClaimToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
}

/**
 * Generate QR code URL for claim
 * @param {string} token - JWT token
 * @param {string} baseUrl - Base URL of server (e.g., http://localhost:3001)
 * @returns {string} Full verifier URL
 */
export function generateQRUrl(token, baseUrl) {
  return `${baseUrl}/claim/${token}`;
}
