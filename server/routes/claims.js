/**
 * Claims generation and verification routes
 */

import { Router } from 'express';
import QRCode from 'qrcode';
import { createClaimToken, generatePIN, generateQRUrl, verifyClaimToken } from '../lib/tokens.js';
import { getPurchaseByHash } from '../lib/db.js';
import { isClose, normalizeDate } from '../lib/utils.js';

const router = Router();

/**
 * POST /api/claims/create
 * Generate claim with JWT token, PIN, and QR URL
 * Body: {hash}
 */
router.post('/create', async (req, res) => {
  try {
    const { hash } = req.body;

    if (!hash) {
      return res.status(400).json({ error: 'Hash is required' });
    }

    // Fetch purchase from database
    const purchase = await getPurchaseByHash(hash);

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found for given hash' });
    }

    // Create JWT token payload
    const payload = {
      merchant: purchase.merchant,
      date: purchase.date,
      total: purchase.total,
      hash: purchase.hash
    };

    // Generate token and PIN
    const token = createClaimToken(payload);
    const pin = generatePIN();

    // Get base URL from request or environment
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    const qrUrl = generateQRUrl(token, baseUrl);

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 256,
      margin: 2
    });

    res.json({
      qrUrl,
      qrCodeDataUrl,
      token,
      pin,
      // Include purchase details for display
      purchase: {
        merchant: purchase.merchant,
        date: purchase.date,
        total: purchase.total
      }
    });

  } catch (error) {
    console.error('Claim creation error:', error);
    res.status(500).json({
      error: 'Claim creation failed',
      message: error.message
    });
  }
});

/**
 * GET /claim/:token
 * Verifier page - renders HTML showing MATCH/NO MATCH status
 */
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Verify and decode token
    const decoded = verifyClaimToken(token);

    if (!decoded) {
      return res.send(renderVerifierPage({
        status: 'INVALID',
        message: 'Token is invalid or expired'
      }));
    }

    // Fetch purchase from database using hash
    const purchase = await getPurchaseByHash(decoded.hash);

    if (!purchase) {
      return res.send(renderVerifierPage({
        status: 'NO MATCH',
        message: 'No purchase found in database',
        token: decoded
      }));
    }

    // Compare token data with database data
    const dateMatch = normalizeDate(purchase.date) === normalizeDate(decoded.date);
    const totalMatch = isClose(purchase.total, decoded.total);
    
    const isMatch = dateMatch && totalMatch;

    res.send(renderVerifierPage({
      status: isMatch ? 'MATCH' : 'NO MATCH',
      token: decoded,
      database: purchase,
      comparison: {
        dateMatch,
        totalMatch
      }
    }));

  } catch (error) {
    console.error('Verification error:', error);
    res.send(renderVerifierPage({
      status: 'ERROR',
      message: error.message
    }));
  }
});

/**
 * Render HTML verifier page
 */
function renderVerifierPage(data) {
  const { status, message, token, database, comparison } = data;

  const statusColor = status === 'MATCH' ? '#10b981' : status === 'INVALID' || status === 'ERROR' ? '#f59e0b' : '#ef4444';
  const statusIcon = status === 'MATCH' ? '✓' : '✗';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SlipSafe Verifier</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: #f3f4f6;
          padding: 2rem;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          max-width: 600px;
          width: 100%;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          padding: 2rem;
        }
        .header {
          text-align: center;
          margin-bottom: 2rem;
        }
        .logo {
          font-size: 1.5rem;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 0.5rem;
        }
        .subtitle {
          color: #6b7280;
          font-size: 0.875rem;
        }
        .status {
          text-align: center;
          padding: 2rem;
          border-radius: 8px;
          margin-bottom: 2rem;
          background: ${statusColor}15;
          border: 2px solid ${statusColor};
        }
        .status-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        .status-text {
          font-size: 2rem;
          font-weight: bold;
          color: ${statusColor};
          margin-bottom: 0.5rem;
        }
        .status-message {
          color: #6b7280;
        }
        .details {
          margin-top: 2rem;
        }
        .detail-row {
          display: flex;
          padding: 0.75rem;
          border-bottom: 1px solid #e5e7eb;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
          min-width: 120px;
        }
        .detail-value {
          color: #6b7280;
          flex: 1;
        }
        .match-indicator {
          margin-left: 0.5rem;
          font-size: 0.875rem;
        }
        .match-yes { color: #10b981; }
        .match-no { color: #ef4444; }
        .instruction {
          margin-top: 2rem;
          padding: 1.5rem;
          background: #eff6ff;
          border-radius: 8px;
          border-left: 4px solid #3b82f6;
        }
        .instruction-title {
          font-weight: 600;
          color: #1e40af;
          margin-bottom: 0.5rem;
        }
        .instruction-text {
          color: #1e3a8a;
          font-size: 0.875rem;
          line-height: 1.6;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🔒 SlipSafe</div>
          <div class="subtitle">Receipt Claim Verification</div>
        </div>

        <div class="status">
          <div class="status-icon">${statusIcon}</div>
          <div class="status-text">${status}</div>
          ${message ? `<div class="status-message">${message}</div>` : ''}
        </div>

        ${token && database ? `
          <div class="details">
            <h3 style="margin-bottom: 1rem; color: #1f2937;">Receipt Details</h3>
            
            <div class="detail-row">
              <div class="detail-label">Merchant:</div>
              <div class="detail-value">
                ${database.merchant}
              </div>
            </div>

            <div class="detail-row">
              <div class="detail-label">Date:</div>
              <div class="detail-value">
                ${database.date}
                ${comparison ? `<span class="match-indicator ${comparison.dateMatch ? 'match-yes' : 'match-no'}">${comparison.dateMatch ? '✓ Match' : '✗ No Match'}</span>` : ''}
              </div>
            </div>

            <div class="detail-row">
              <div class="detail-label">Total:</div>
              <div class="detail-value">
                $${database.total.toFixed(2)}
                ${comparison ? `<span class="match-indicator ${comparison.totalMatch ? 'match-yes' : 'match-no'}">${comparison.totalMatch ? '✓ Match' : '✗ No Match'}</span>` : ''}
              </div>
            </div>

            ${database.returnBy ? `
              <div class="detail-row">
                <div class="detail-label">Return By:</div>
                <div class="detail-value">${database.returnBy}</div>
              </div>
            ` : ''}

            ${database.warrantyEnds ? `
              <div class="detail-row">
                <div class="detail-label">Warranty Until:</div>
                <div class="detail-value">${database.warrantyEnds}</div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <div class="instruction">
          <div class="instruction-title">📋 Staff Instructions</div>
          <div class="instruction-text">
            If the status shows <strong>MATCH</strong>, the customer's claim is verified and valid. 
            You may proceed with the return or warranty service request. If the status shows 
            <strong>NO MATCH</strong>, please ask the customer for additional proof of purchase or 
            contact your supervisor. Always verify that the date and total amount align with the 
            customer's stated claim before processing.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export default router;
