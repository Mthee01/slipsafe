/**
 * USSD webhook endpoint
 * Handles USSD session state machine
 */

import { Router } from 'express';

const router = Router();

/**
 * POST /api/ussd
 * USSD aggregator webhook
 * Body: {sessionId, msisdn, text}
 * Returns: Plain text USSD screen
 */
router.post('/', async (req, res) => {
  try {
    const { sessionId, msisdn, text } = req.body;

    console.log('USSD Request:', { sessionId, msisdn, text });

    // Parse user input
    const input = (text || '').trim();
    const inputParts = input.split('*').filter(Boolean);
    const currentLevel = inputParts.length;
    const lastInput = inputParts[inputParts.length - 1];

    let response = '';

    // State machine based on input depth
    if (currentLevel === 0) {
      // Root menu
      response = `SlipSafe
1) Check return window
2) Get claim code
3) Warranty status
4) Help`;
    } 
    else if (currentLevel === 1) {
      switch (lastInput) {
        case '1':
          // Check return window
          // TODO: Implement real lookup by msisdn
          response = `END Enter receipt ID to check return window.

TODO: Link phone number to receipts in database.`;
          break;

        case '2':
          // Get claim code
          // TODO: Implement real claim lookup
          response = `END Your claim codes:

TODO: Lookup claims by phone number (msisdn: ${msisdn}).

Visit SlipSafe web app to create claims.`;
          break;

        case '3':
          // Warranty status
          // TODO: Implement real warranty lookup
          response = `END Active warranties:

TODO: Query database for warranties linked to ${msisdn}.

Visit SlipSafe web app for details.`;
          break;

        case '4':
          // Help
          response = `END SlipSafe Help

Visit our web app to:
- Upload receipts
- Track warranties
- Generate claim codes

Need help? Contact support.`;
          break;

        default:
          response = `END Invalid option. Please try again.`;
      }
    }
    else {
      // Additional levels (for future expansion)
      response = `END Feature coming soon. Please use the web app for full functionality.`;
    }

    // Return plain text response
    res.type('text/plain');
    res.send(response);

  } catch (error) {
    console.error('USSD error:', error);
    res.type('text/plain');
    res.send('END An error occurred. Please try again later.');
  }
});

/**
 * GET /api/ussd/test
 * Test endpoint to simulate USSD flow
 */
router.get('/test', (req, res) => {
  res.json({
    message: 'USSD webhook is active',
    endpoint: 'POST /api/ussd',
    expectedBody: {
      sessionId: 'string',
      msisdn: 'string (phone number)',
      text: 'string (user input path, e.g., "1*2*3")'
    },
    example: {
      sessionId: 'ATUid_123456',
      msisdn: '+254712345678',
      text: '1'
    }
  });
});

export default router;
