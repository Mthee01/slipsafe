import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  // First, try to use direct API key from environment variable
  if (process.env.RESEND_API_KEY) {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    console.log(`[Email] Using API key from environment, from email: ${fromEmail}`);
    return {
      apiKey: process.env.RESEND_API_KEY,
      fromEmail
    };
  }

  // Fallback to Replit connector
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('RESEND_API_KEY not set and X_REPLIT_TOKEN not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected. Please set RESEND_API_KEY environment variable.');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email || 'onboarding@resend.dev'
  };
}

async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail: fromEmail
  };
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    console.log(`[Email] Attempting to send email to ${to} from ${fromEmail}`);
    console.log(`[Email] Subject: ${subject}`);
    
    const result = await client.emails.send({
      from: `SlipSafe <${fromEmail}>`,
      to: [to],
      subject,
      html
    });

    if (result.error) {
      console.error('[Email] Failed to send:', JSON.stringify(result.error, null, 2));
      console.error('[Email] Error details - statusCode:', (result.error as any).statusCode);
      console.error('[Email] Error details - message:', result.error.message);
      console.error('[Email] Error details - name:', result.error.name);
      return false;
    }

    console.log(`[Email] Sent successfully to ${to}, id: ${result.data?.id}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Error sending email:', error.message || error);
    console.error('[Email] Full error:', JSON.stringify(error, null, 2));
    return false;
  }
}

export function generatePasswordResetEmail(resetLink: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - SlipSafe</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SlipSafe</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Your receipts, secured</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Reset Your Password</h2>
              <p style="color: #52525b; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                We received a request to reset the password for your SlipSafe account. Click the button below to create a new password.
              </p>
              
              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #71717a; margin: 24px 0 0 0; font-size: 14px; line-height: 1.6;">
                This link will expire in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
              </p>
              
              <!-- Fallback Link -->
              <div style="margin-top: 24px; padding: 16px; background-color: #f4f4f5; border-radius: 6px;">
                <p style="color: #71717a; margin: 0 0 8px 0; font-size: 12px;">If the button doesn't work, copy and paste this link:</p>
                <p style="color: #4f46e5; margin: 0; font-size: 12px; word-break: break-all;">${resetLink}</p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e4e4e7; text-align: center;">
              <p style="color: #a1a1aa; margin: 0; font-size: 12px;">
                This is an automated message from SlipSafe. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function generateUsernameRecoveryEmail(username: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Username - SlipSafe</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SlipSafe</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Your receipts, secured</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Your Username</h2>
              <p style="color: #52525b; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                You requested your SlipSafe username. Here it is:
              </p>
              
              <!-- Username Box -->
              <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px solid #4f46e5; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
                <p style="color: #71717a; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your Username</p>
                <p style="color: #18181b; margin: 0; font-size: 24px; font-weight: 700;">${username}</p>
              </div>
              
              <p style="color: #52525b; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                You can now use this username to log in to your SlipSafe account.
              </p>
              
              <p style="color: #71717a; margin: 24px 0 0 0; font-size: 14px; line-height: 1.6;">
                If you didn't request this information, you can safely ignore this email. Your account remains secure.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e4e4e7; text-align: center;">
              <p style="color: #a1a1aa; margin: 0; font-size: 12px;">
                This is an automated message from SlipSafe. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function generateEmailVerificationEmail(verifyLink: string, fullName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - SlipSafe</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SlipSafe</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Your receipts, secured</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Welcome to SlipSafe, ${fullName}!</h2>
              <p style="color: #52525b; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                Thank you for registering. Please verify your email address by clicking the button below to complete your registration.
              </p>
              
              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <a href="${verifyLink}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #71717a; margin: 24px 0 0 0; font-size: 14px; line-height: 1.6;">
                This link will expire in <strong>24 hours</strong>. If you didn't create an account with SlipSafe, you can safely ignore this email.
              </p>
              
              <!-- Fallback Link -->
              <div style="margin-top: 24px; padding: 16px; background-color: #f4f4f5; border-radius: 6px;">
                <p style="color: #71717a; margin: 0 0 8px 0; font-size: 12px;">If the button doesn't work, copy and paste this link:</p>
                <p style="color: #4f46e5; margin: 0; font-size: 12px; word-break: break-all;">${verifyLink}</p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e4e4e7; text-align: center;">
              <p style="color: #a1a1aa; margin: 0; font-size: 12px;">
                This is an automated message from SlipSafe. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

interface WarrantyItem {
  merchant: string;
  date: string;
  warrantyEnds: string;
  total: string;
  daysLeft: number;
}

export function generateWarrantyAlertEmail(fullName: string, items: WarrantyItem[]): string {
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e4e4e7;">
        <strong style="color: #18181b;">${item.merchant}</strong>
        <br><span style="color: #71717a; font-size: 13px;">Purchased: ${new Date(item.date).toLocaleDateString()}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e4e4e7; text-align: right;">
        <span style="color: #18181b; font-weight: 600;">$${item.total}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e4e4e7; text-align: right;">
        <span style="color: ${item.daysLeft <= 7 ? '#ef4444' : '#f59e0b'}; font-weight: 600;">
          ${item.daysLeft} day${item.daysLeft !== 1 ? 's' : ''} left
        </span>
        <br><span style="color: #71717a; font-size: 13px;">Expires: ${new Date(item.warrantyEnds).toLocaleDateString()}</span>
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Warranty Expiry Alert - SlipSafe</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 32px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SlipSafe</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Warranty Expiry Alert</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hi ${fullName},</h2>
              <p style="color: #52525b; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                Some of your product warranties are expiring soon. Make sure to use them before they expire!
              </p>
              
              <!-- Items Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e4e4e7; border-radius: 8px; margin: 24px 0;">
                <thead>
                  <tr style="background-color: #f4f4f5;">
                    <th style="padding: 12px; text-align: left; color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Item</th>
                    <th style="padding: 12px; text-align: right; color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Value</th>
                    <th style="padding: 12px; text-align: right; color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Warranty</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
              
              <p style="color: #52525b; margin: 24px 0; font-size: 15px; line-height: 1.6;">
                <strong>Tip:</strong> If you need to make a warranty claim, log in to SlipSafe to generate a verifiable claim with QR code for easy verification.
              </p>
              
              <p style="color: #71717a; margin: 24px 0 0 0; font-size: 14px; line-height: 1.6;">
                You're receiving this because you have warranty notifications enabled. You can manage your notification preferences in Settings.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e4e4e7; text-align: center;">
              <p style="color: #a1a1aa; margin: 0; font-size: 12px;">
                This is an automated message from SlipSafe. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function generateWelcomeEmail(fullName: string, username: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to SlipSafe</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">SlipSafe</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Your receipts, secured</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Welcome, ${fullName}!</h2>
              <p style="color: #52525b; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                Your email has been verified and your SlipSafe account is now active. You can start managing your receipts securely.
              </p>
              
              <!-- Account Details Box -->
              <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px solid #4f46e5; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <p style="color: #71717a; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your Account Details</p>
                <p style="color: #18181b; margin: 0 0 4px 0; font-size: 16px;"><strong>Username:</strong> ${username}</p>
              </div>
              
              <p style="color: #52525b; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                Here's what you can do with SlipSafe:
              </p>
              
              <ul style="color: #52525b; margin: 0 0 24px 0; padding-left: 24px; font-size: 15px; line-height: 1.8;">
                <li>Upload and digitize your receipts using OCR</li>
                <li>Track return deadlines and warranty expiry dates</li>
                <li>Generate verifiable claims with QR codes</li>
                <li>Manage both personal and business receipts</li>
              </ul>
              
              <p style="color: #71717a; margin: 24px 0 0 0; font-size: 14px; line-height: 1.6;">
                For security reasons, we do not include your password in this email. If you forget your password, you can always reset it from the login page.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e4e4e7; text-align: center;">
              <p style="color: #a1a1aa; margin: 0; font-size: 12px;">
                This is an automated message from SlipSafe. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
