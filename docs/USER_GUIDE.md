# SlipSafe User Guide

> Complete guide for using SlipSafe receipt management system

## Table of Contents

1. [Getting Started](#getting-started)
2. [Account Types](#account-types)
3. [Context Switching](#context-switching)
4. [Scanning Receipts](#scanning-receipts)
5. [Managing Receipts](#managing-receipts)
6. [Policy Management](#policy-management)
7. [Generating Claims](#generating-claims)
8. [Reports & Analytics](#reports--analytics)
9. [Team Management](#team-management)
10. [Merchant Verification](#merchant-verification)
11. [Settings](#settings)
12. [PWA & Offline](#pwa--offline)
13. [USSD Access](#ussd-access)

---

## Getting Started

### Registration

1. Navigate to the registration page
2. Choose your account type:
   - **Individual** - Personal use only
   - **Business** - Access to VAT reporting, team features, and business context
3. Fill in required information:
   - Full name
   - Username
   - Cellphone number (+27 format)
   - Email address
   - Password (minimum 6 characters)
4. For business accounts, also provide:
   - Business name (required)
   - Tax ID (required)
   - VAT number (optional)
5. Click "Create Account"
6. Check your email for verification link
7. Click the verification link within 24 hours
8. Receive welcome email upon successful verification

### Login

1. Enter your username
2. Enter your password
3. Optionally check "Stay logged in" for extended session (30 days vs 7 days)
4. Click "Sign In"

> **Note**: You must verify your email before logging in. If you haven't received the verification email, click "Resend verification email" on the login page.

### Password Recovery

1. Click "Forgot password?" on login page
2. Choose recovery method (email or phone)
3. Enter your username or contact information
4. Check your email for reset link (valid for 1 hour)
5. Click the link and set a new password

---

## Account Types

### Individual Account
- Personal receipt tracking
- Unlimited personal receipts
- Basic reports dashboard
- No VAT/tax reporting
- No team features

### Business Account
- Everything in Individual
- Access to business context
- VAT/tax reporting
- Expense categorization
- CSV and PDF exports
- Team management (Pro plan)
- Organization creation

---

## Context Switching

Business account users can switch between two contexts:

### Personal Context (Default)
- Track personal receipts
- No VAT fields displayed
- Standard categories
- Personal dashboard

### Business Context
- Track business expenses
- Full VAT/tax fields
- Business categories
- Comprehensive tax reports
- Team receipts (if in organization)

### How to Switch

1. Look for the context toggle in the sidebar
2. Click to switch between "Personal" and "Business"
3. Your active context is saved and persists across sessions
4. Each context has completely separate receipts

> **Important**: Receipts saved in one context are NOT visible in the other context.

---

## Scanning Receipts

### Camera Capture

1. Click "Upload" or navigate to the home page
2. Click the camera icon or "Use Camera"
3. Position the receipt within the frame guide
4. Tap screen to focus (yellow = focusing, green = locked)
5. Use flash toggle for low-light conditions
6. Capture the image when quality indicator shows green
7. For long receipts, use multi-part capture mode

### File Upload

1. Click "Browse" or drag & drop a file
2. Supported formats: JPEG, PNG, PDF
3. Maximum file size: 10MB
4. Wait for OCR processing

### Email Receipt Paste

1. Click "Email Receipt" tab
2. Copy your email receipt content
3. Paste into the text area
4. Click "Parse Email"
5. Review extracted data

### Quality Tips

- Ensure good lighting
- Keep receipt flat and unwrinkled
- Include all text, especially totals and dates
- Avoid shadows and glare
- Use flash in low-light conditions

---

## Managing Receipts

### OCR Preview

After scanning, you'll see the OCR preview with:

- **Merchant name** - Store/business name
- **Date** - Purchase date
- **Total** - Purchase amount in Rand (R)
- **VAT** - Value Added Tax (business context only)
- **Invoice number** - Receipt/invoice reference
- **Confidence level** - OCR accuracy indicator

### Editing Extracted Data

1. Review all extracted fields
2. Click any field to edit if incorrect
3. Use "Refresh OCR" button to re-scan if merchant name is wrong
4. Adjust date format if needed
5. Verify total amount

### Saving Receipts

1. Select a category
2. Review all information
3. Click "Save Receipt"
4. Receipt is stored with computed deadlines

### Viewing Receipts

1. Navigate to "Receipts" in sidebar
2. Use search to find specific receipts
3. Filter by category
4. Toggle between card and table view
5. Click a receipt for full details

### Receipt Details

Each receipt shows:
- Merchant and date
- Amount and VAT
- Category
- Return deadline (if applicable)
- Warranty expiration (if applicable)
- Policy information
- Source type (camera/upload/email)

---

## Policy Management

### Automatic Policy Extraction

The OCR system automatically detects:
- Return policy days (e.g., "30 day return")
- Refund types (full, store credit, exchange only)
- Exchange periods
- Warranty terms (months/years)

### Conditional vs Unconditional Policies

SlipSafe distinguishes between:
- **Conditional**: "NO REFUNDS WITHOUT ORIGINAL INVOICE" = Returns allowed with invoice
- **Unconditional**: "ALL SALES FINAL" = No returns accepted

### Manual Policy Entry

1. Open receipt details
2. Click "Edit Policies"
3. Enter or modify:
   - Return period (days)
   - Refund type
   - Exchange period (days)
   - Warranty duration (months)
   - Policy notes
4. Save changes

### Custom Merchant Rules

Set default policies for specific merchants:

1. Go to "Settings"
2. Scroll to "Merchant Rules"
3. Click "Add Rule"
4. Enter merchant name
5. Set return period (days)
6. Set warranty duration (months)
7. Save

These rules apply automatically when a receipt doesn't have explicit policies.

---

## Generating Claims

### Create a Claim

1. Open a receipt from your list
2. Click "Generate Claim"
3. View your claim with:
   - **QR Code** - Scannable verification code
   - **6-Digit PIN** - Security verification
   - **Claim Code** - Text reference
   - **Expiration** - 90 days from creation

### Sharing Claims

1. Download QR code image
2. Share via:
   - WhatsApp
   - Email
   - Other messaging apps
3. Include PIN for verification

### Claim States

| State | Description |
|-------|-------------|
| Issued | Claim created, not yet presented |
| Pending | Presented to merchant, awaiting processing |
| Redeemed | Full refund processed |
| Partial | Partial refund processed |
| Refused | Merchant declined the claim |
| Expired | Claim passed 90-day validity |

---

## Reports & Analytics

### Personal Dashboard

Available to all users:
- Total receipts count
- Total spent amount
- Pending returns count
- Active warranties count
- Upcoming return deadlines
- Expiring warranties

### Business Reports

Available in business context:
- **Summary Tab**: Total receipts, spending, tax, VAT
- **By Category**: Pie chart and table of expenses
- **By Vendor**: Merchant-level spending breakdown
- **By Month**: Bar chart of monthly trends

### Date Filtering

1. Select start date
2. Select end date
3. Reports update automatically

### Export Options

#### CSV Export
1. Click "Export CSV"
2. Download opens automatically
3. Import into Excel or accounting software

#### PDF Reports
- **Summary PDF**: Overview statistics
- **Detailed PDF**: Includes transaction list
- **Preview**: Open in new tab before downloading
- **Download**: Save directly to device

---

## Team Management

### Creating an Organization

1. Navigate to business context
2. Go to "Team" page
3. Click "Create Organization"
4. Enter organization name
5. Your subscription limits apply

### Inviting Team Members

1. Go to "Team" page
2. Click "Invite Member"
3. Enter email address
4. Select role (Admin or Member)
5. Send invitation
6. Invitee receives email with join link

### Roles & Permissions

| Role | Permissions |
|------|-------------|
| Owner | Full control, billing, delete org, remove anyone |
| Admin | Invite/remove members, view all receipts |
| Member | Add receipts, view team receipts |

### Managing Members

- View all team members
- See pending invitations
- Remove members (owners/admins only)
- Cancel pending invitations

### Plan Limits

| Plan | Users | Receipts/Month |
|------|-------|----------------|
| Solo | 1 | 1,000 |
| Pro | 10 | 5,000 |
| Enterprise | Custom | Custom |

---

## Merchant Verification

### For Merchants

Two portal options:

#### Legacy Portal (/merchant)
- Separate staff login
- Dedicated merchant credentials
- Independent session

#### Integrated Portal (/merchant-portal)
- For app users with merchant roles
- Access via sidebar
- Uses main app authentication

### Verifying Claims

1. Customer presents QR code
2. Scan code or enter claim code manually
3. Request 6-digit PIN from customer
4. Enter PIN to verify
5. View claim details and purchase info

### Processing Refunds

1. After verification, choose action:
   - **Full Refund** - Complete refund of original amount
   - **Partial Refund** - Specify reduced amount
   - **Refuse** - Decline with reason
2. Add notes for audit trail
3. Submit action
4. Claim state updates automatically

### Verification History

- View all past verifications
- Filter by date range
- See refund amounts
- Review staff actions
- Export for records

---

## Settings

### Profile Settings

- Update email address
- Change phone number
- Update home address
- Change password

### Business Profile

(Business accounts only)
- Business name
- Tax ID
- VAT number
- Registration number
- Business address
- Business contact info

### Notification Settings

- Return deadline alerts
- Warranty expiry reminders
- Days before deadline to alert

### Appearance

- Light/Dark theme toggle
- Persistent across sessions

---

## PWA & Offline

### Installing the App

1. Look for install banner at bottom of screen
2. Click "Install SlipSafe"
3. Confirm installation
4. App appears on home screen
5. Opens without browser chrome

### Offline Capabilities

- **Cached Pages**: All app pages available offline
- **Saved Receipts**: View previously loaded receipts
- **Pending Uploads**: Queue receipts for upload when online
- **Background Sync**: Automatic upload retry on reconnection

### Offline Indicator

- Green: Online
- Yellow banner: Offline mode active
- Pending uploads shown in queue

### Camera Features

- 4K resolution capture (3840x2160)
- Receipt frame guide overlay
- Tap-to-focus with visual indicator
- Flash/torch control
- Image quality assessment
- Multi-part capture for long receipts

---

## USSD Access

For feature phone users without smartphones:

### Accessing via USSD

1. Dial the USSD shortcode
2. Navigate menu with number keys
3. Options include:
   - Check recent receipts
   - View claim status
   - Get return deadlines

### Menu Navigation

```
Welcome to SlipSafe
1. My Receipts
2. My Claims
3. Upcoming Deadlines
0. Exit

[Enter selection]
```

### Limitations

- Text-based display only
- Cannot upload new receipts
- View-only access
- Requires prior account registration via web

---

## Troubleshooting

### OCR Not Working

- Check image quality (lighting, focus)
- Ensure receipt text is visible
- Try "Refresh OCR" button
- For persistent issues, use email paste method

### Email Verification Not Received

- Check spam/junk folder
- Click "Resend verification email"
- Ensure correct email address
- Wait a few minutes and check again

### Camera Not Working

- Grant camera permissions in browser
- Refresh the page
- Try different browser
- Use file upload as alternative

### Sync Issues

- Check internet connection
- Look for offline indicator
- Wait for background sync
- Force refresh the page

---

## Support

- **Email**: Support@slip-safe.net
- **Enterprise**: enterprise@slipsafe.com

---

*SlipSafe - Your receipts, organized and protected.*
