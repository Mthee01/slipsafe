# SlipSafe

> Digital receipt management with OCR, smart deadlines, policy extraction, and verifiable claims

SlipSafe is a comprehensive receipt management system that transforms physical and digital receipts into organized records using OCR technology. It automatically extracts store policies, computes return and warranty deadlines, generates verifiable claims with QR codes, and provides offline-first Progressive Web App capabilities. The system supports both personal and business contexts with comprehensive tax reporting, VAT tracking, and expense analytics.

![SlipSafe Logo](client/public/logo.png)

## Table of Contents

- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Architecture Overview](#architecture-overview)
- [PWA Features](#pwa-features)
- [Merchant Portal](#merchant-portal)
- [USSD Support](#ussd-support)
- [Recent Updates](#recent-updates)
- [Contributing](#contributing)
- [License](#license)

---

## Key Features

### Intelligent OCR Processing
- **Automated Data Extraction**: Upload receipt images (JPEG, PNG, PDF) or paste email receipts for automatic extraction of merchant name, date, total amount, VAT, and invoice numbers
- **Policy Extraction**: Automatically detects store policies including:
  - Return policy periods (e.g., "30 day return", "14-day refund")
  - Refund types (full refund, store credit, exchange only, partial refund)
  - Exchange policy periods
  - Warranty terms (months/years, including lifetime warranties)
- **VAT Extraction**: Three-tier logic:
  1. Extract explicit VAT from receipt text
  2. Calculate from subtotal/total difference
  3. Calculate at 15% from total when not found
  - Tracks `vatSource` field ('extracted', 'calculated', 'none') for accuracy
- **Invoice Number Detection**: Supports multiple formats (Invoice #, INV-, Receipt No., Tax Invoice, TX numbers)
- **Confidence Scoring**: Visual indicators (high/medium/low) show OCR accuracy
- **Manual Correction**: Edit any extracted field before saving to ensure accuracy
- **Smart Parsing**: Advanced regex patterns detect multiple date formats, currency symbols, and merchant names with company suffixes (CC, PTY, LTD, Inc, LLC)

### Email Receipt Support
- **Paste Email Content**: Copy and paste email receipts (HTML or plain text) directly
- **Automatic Parsing**: Extracts merchant, date, and total from order confirmations and digital receipts
- **Higher Accuracy**: Bypasses OCR for text-based receipts, resulting in cleaner extraction
- **Source Tracking**: Records source type as 'email_paste' for reference

### Policy Management
- **Auto-Detection**: OCR automatically extracts return/exchange/warranty policies from receipt text
- **Manual Entry**: Add or edit policies when not detected with intuitive form fields
- **Visual Indicators**: Badges show "Auto-detected" or "Edited" policy source
- **Dynamic Deadlines**: Computed return and warranty deadlines update automatically based on policy values
- **Policy Fields**:
  - Return period (days)
  - Refund type (full, store credit, exchange only, partial, none)
  - Exchange period (days)
  - Warranty duration (months)
  - Policy notes

### Custom Merchant Rules
- **Flexible Policies**: Set custom return periods (days) and warranty durations (months) per merchant
- **Automatic Application**: System matches merchant names and applies appropriate deadlines
- **Default Fallbacks**: 30-day return, 12-month warranty for merchants without custom rules
- **Easy Management**: Full CRUD interface in Settings for creating, editing, and deleting rules

### Verifiable Claims
- **QR Code Generation**: Each claim includes a scannable QR code linking to verification page
- **6-Digit PIN**: Additional security layer for claim verification
- **JWT Tokens**: Cryptographically signed claims with 90-day expiration
- **Claim Lifecycle**: State machine tracks: issued → pending → redeemed/partial/refused
- **Fraud Detection**: Prevents duplicate redemptions with atomic PIN consumption

### Merchant Portal
- **Staff Authentication**: Separate login system for store staff with merchant ID, email, and password
- **Claim Verification**: Scan QR codes or enter claim codes manually with auto-lookup
- **Refund Processing**: Full or partial refund options with notes
- **Claim Refusal**: Log refusal reasons for audit trail
- **Verification History**: Paginated audit trail of all verifications
- **Staff Management**: Add/remove staff members with role assignment (owner/manager/staff)
- **Deep Links**: Direct verification links from QR codes (/verify/:claimCode)

### PDF Export
- **Professional Documents**: Generate PDF receipts with embedded QR codes
- **Complete Information**: Includes merchant, date, amount, VAT, return deadline, warranty expiration
- **Download & Share**: Save locally or share via messaging apps

### Business Context Switching
- **Dual Mode**: Switch between personal and business contexts for separate receipt tracking
- **Business Profile**: Manage business name, tax ID, VAT number, registration number, address, and contact details
- **Context Persistence**: Active context is saved and persists across sessions
- **Separate Analytics**: Each context has its own receipts, reports, and expense tracking

### Tax & Reports
- **Personal Dashboard**: Total receipts, spending, pending returns, active warranties, upcoming deadlines
- **Business Reports**: Comprehensive tax/VAT summaries with expense categorization
- **Visual Charts**: Pie charts for category/warranty breakdown, bar charts for monthly trends (Recharts)
- **Category Breakdown**: Visual pie chart and detailed table of expenses by category
- **Vendor Analysis**: Track spending patterns across different merchants
- **Monthly Trends**: Bar charts showing spending patterns over time with tax breakdown
- **Date Filtering**: Filter reports by custom date ranges
- **CSV Export**: Download comprehensive reports for accounting and tax purposes
- **PDF Reports**: Generate PDF reports with optional transaction details

### Admin Dashboard
- **User Activity Monitoring**: Track login attempts, receipt uploads, and system usage
- **System Statistics**: View total users, receipts, claims, and activity metrics
- **Security Audit**: Monitor failed login attempts and account recovery requests
- **Admin Authentication**: Secure access with environment-based admin credentials

### Email System
- **Email Verification**: Registration requires email verification before login
- **Verification Tokens**: 24-hour expiry with resend option
- **Welcome Email**: Sent after successful verification (username only for security)
- **Account Recovery**: Forgot password and username recovery via email
- **Professional Branding**: HTML email templates with SlipSafe branding
- **Resend Integration**: Reliable transactional email delivery
- **Security Measures**: Rate limiting and token expiration for reset requests

### Progressive Web App (PWA)
- **Offline Support**: Cache-first strategy for static assets, network-first for API calls
- **Background Sync**: Two-step automatic upload retry when connection is restored
- **Install Prompt**: Add to home screen for native app experience
- **Offline Indicator**: Real-time connection status with automatic hide/show
- **IndexedDB Storage**: Persistent local storage with blob support for receipt images (~500KB per receipt)

### Camera Features
- **4K Resolution**: High-quality capture at 3840x2160 resolution
- **Receipt Frame Guide**: Overlay guide for proper receipt positioning
- **Tap-to-Focus**: Animated focus indicator (yellow when focusing, green when locked)
- **Flash Control**: Toggle torch/flash for low-light conditions
- **Image Quality Assessment**: Real-time sharpness, brightness, and contrast analysis
- **Multi-Part Capture**: Capture long receipts in multiple sections (top/middle/bottom)
- **Quality Gating**: Actionable feedback when image quality is insufficient

### USSD Support
- **Feature Phone Access**: Text-based menu system via USSD gateway webhook
- **Receipt Lookup**: Check receipts and claims via feature phone
- **Accessibility**: Enables access for users without smartphones

### Security & Authentication
- **Session-Based Auth**: Secure passport-local strategy with bcrypt password hashing
- **Rate Limiting**: Protection against brute force attacks (3-5 attempts per 15 minutes)
- **Account Recovery**: Forgot password/username with secure token-based reset (1-hour expiry)
- **Phone/Email Registration**: Mandatory phone number, email required for verification
- **Defense in Depth**: Server-side userId validation prevents privilege escalation
- **Generic Responses**: API responses prevent user enumeration attacks

---

## Technology Stack

### Frontend
- **React 18** - Modern UI library with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Wouter** - Lightweight client-side routing
- **TanStack Query v5** - Powerful server state management
- **Shadcn/ui** - Beautiful accessible components (Radix UI primitives)
- **Tailwind CSS** - Utility-first styling with custom design system
- **Recharts** - Data visualization for reports (pie charts, bar charts)
- **Lucide React** - Clean, consistent icons
- **Framer Motion** - Smooth animations

### Backend
- **Express.js** - Fast, minimal web framework
- **TypeScript** - End-to-end type safety
- **Tesseract.js** - Client-side OCR engine with Sharp preprocessing
- **Multer** - Multipart file upload handling (10MB limit)
- **PDFKit** - PDF generation with QR code embedding
- **QRCode** - QR code generation for claims
- **JWT** - Token-based claim verification
- **Passport.js** - Authentication middleware
- **Bcrypt** - Secure password hashing
- **Resend** - Transactional email delivery

### Database & ORM
- **PostgreSQL** - Robust relational database via Neon serverless
- **Drizzle ORM** - Lightweight TypeScript ORM
- **Drizzle Zod** - Schema validation with Zod integration

### PWA & Storage
- **Service Worker** - Offline caching and background sync
- **IndexedDB** - Client-side blob storage and data persistence
- **Web App Manifest** - Install prompt and app metadata

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database (or use provided Neon serverless)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd slipsafe
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL=postgresql://user:password@host:5432/dbname
   
   # Authentication
   SESSION_SECRET=your-secure-random-string-here
   JWT_SECRET=another-secure-random-string-here
   
   # Email (Resend)
   RESEND_API_KEY=re_your_api_key_here
   
   # Admin Dashboard (optional)
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=secure_admin_password
   
   # Server
   PORT=5000
   NODE_ENV=development
   ```

4. **Set up the database**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   
   Navigate to `http://localhost:5000`

---

## Usage Guide

### 1. User Registration
1. Navigate to the registration page
2. Fill in full name, username, phone number (required), and email (required for verification)
3. Create a secure password
4. Optionally check "Register as Business Account" for business features
5. Click "Register" to create your account
6. Check your email for verification link
7. Click verification link to activate account
8. Receive welcome email upon successful verification

### 2. Upload a Receipt
1. Click "Upload" or "Home" in the sidebar
2. Choose input method:
   - **Scan Receipt**: Drag & drop, browse, or use camera to capture receipt image
   - **Email Receipt**: Paste email order confirmation text
3. Select category (Food, Shopping, Entertainment, etc.)
4. Click "Scan Receipt" or "Parse Email" to run OCR processing

### 3. Review & Edit OCR Results
1. Review extracted merchant, date, total, VAT, and invoice number
2. Check the confidence badge (high/medium/low)
3. Edit any incorrect fields manually
4. Review extracted policies (return/warranty)
5. Click "Edit" to modify policies if needed or add missing ones
6. View computed deadlines based on policies
7. Click "Save Receipt" to store the record

### 4. Switch Context (Business Users)
1. Business users see a toggle in the sidebar
2. Switch between "Personal" and "Business" modes
3. Each context has separate receipts and reports
4. Context is saved and persists across sessions

### 5. View Tax & Reports
1. Click "Reports" in the sidebar
2. **Personal Users**: View dashboard with total receipts, spending, pending returns, warranties
3. **Business Users**: View comprehensive tax/VAT summaries
4. Explore "By Category" tab with pie chart visualization
5. Check "By Vendor" tab for merchant-level breakdown
6. Review "By Month" tab with bar chart trends
7. Use date filters for custom date ranges
8. Click "Export CSV" or "Generate PDF" for downloads

### 6. Manage Merchant Rules
1. Navigate to "Settings" in the sidebar
2. Scroll to "Merchant Rules" card
3. Click "Add Rule" to create a new policy
4. Enter merchant name (e.g., "WALMART")
5. Set return period (days) and warranty duration (months)
6. Click "Save" to apply the rule

### 7. View Your Receipts
1. Click "Receipts" in the sidebar
2. Search by merchant, amount, or date
3. Filter by category using the dropdown
4. Click a receipt to view full details including policies

### 8. Generate a Claim
1. Open a receipt from your list
2. Click "Generate Claim"
3. View the QR code and 6-digit PIN
4. Download the QR code image
5. Share via WhatsApp or other messaging apps

### 9. Download PDF
1. Open a receipt from your list
2. Click "Download PDF"
3. PDF includes merchant info, amounts, VAT, dates, deadlines, policies, and QR code
4. Save or share the PDF document

### 10. Install as PWA
1. Look for the install prompt banner at the bottom
2. Click "Install SlipSafe"
3. App will be added to your home screen
4. Launch like a native app with offline support

---

## API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/register
Content-Type: application/json

{
  "fullName": "John Doe",
  "username": "johndoe",
  "phone": "+27123456789",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "accountType": "personal"
}

Response: 200 OK
{
  "message": "Registration successful. Please check your email to verify your account."
}
```

#### Verify Email
```http
GET /api/verify-email?token=<verification_token>

Response: 200 OK
{
  "message": "Email verified successfully"
}
```

#### Login
```http
POST /api/login
Content-Type: application/json

{
  "username": "johndoe",
  "password": "SecurePass123!"
}

Response: 200 OK
{
  "id": "uuid-here",
  "username": "johndoe",
  "email": "john@example.com",
  "fullName": "John Doe"
}
```

#### Logout
```http
POST /api/logout

Response: 200 OK
{ "ok": true }
```

### Receipt Endpoints

#### Upload & OCR Preview
```http
POST /api/receipts/preview
Content-Type: multipart/form-data
Authorization: Session cookie required

Form Data:
- receipt: [image file] (JPEG, PNG, or PDF, max 10MB)

Response: 200 OK
{
  "success": true,
  "ocrData": {
    "merchant": "WALMART",
    "date": "2025-01-15",
    "total": "52.50",
    "confidence": "high",
    "rawText": "WALMART\nReceipt...",
    "returnBy": "2025-02-14",
    "warrantyEnds": "2026-01-15",
    "vatAmount": 6.85,
    "vatSource": "calculated",
    "invoiceNumber": "INV-123456",
    "policies": {
      "returnPolicyDays": 30,
      "refundType": "full",
      "warrantyMonths": 12,
      "policySource": "extracted"
    }
  }
}
```

#### Parse Email Receipt
```http
POST /api/receipts/text
Content-Type: application/json
Authorization: Session cookie required

{
  "text": "Order Confirmation from Amazon...",
  "source": "email_paste"
}

Response: 200 OK
{
  "success": true,
  "ocrData": {
    "merchant": "Amazon",
    "date": "2025-01-15",
    "total": "125.99",
    "sourceType": "email_paste",
    ...
  }
}
```

#### Confirm & Save Receipt
```http
POST /api/receipts/confirm
Content-Type: application/json
Authorization: Session cookie required

{
  "merchant": "WALMART",
  "date": "2025-01-15",
  "total": "52.50",
  "category": "Shopping",
  "policies": {
    "returnPolicyDays": 30,
    "refundType": "full",
    "warrantyMonths": 12,
    "policySource": "user_entered"
  }
}

Response: 200 OK
{
  "success": true,
  "purchase": {
    "id": "uuid-here",
    "merchant": "WALMART",
    "date": "2025-01-15",
    "total": "52.50",
    "returnBy": "2025-02-14",
    "warrantyEnds": "2026-01-15",
    "category": "Shopping",
    "ocrConfidence": "high",
    "vatAmount": "6.85",
    "invoiceNumber": "INV-123456",
    "returnPolicyDays": 30,
    "refundType": "full",
    "warrantyMonths": 12,
    "policySource": "user_entered"
  }
}
```

#### Update Receipt Policies
```http
PATCH /api/receipts/:id/policies
Content-Type: application/json
Authorization: Session cookie required

{
  "returnPolicyDays": 45,
  "refundType": "store_credit",
  "exchangePolicyDays": 30,
  "warrantyMonths": 24,
  "warrantyTerms": "Extended warranty",
  "policySource": "user_entered"
}

Response: 200 OK
{
  "success": true,
  "purchase": { ... }
}
```

#### Get All Receipts
```http
GET /api/purchases?category=Shopping&search=walmart
Authorization: Session cookie required

Response: 200 OK
{
  "purchases": [
    {
      "id": "uuid-here",
      "merchant": "WALMART",
      "date": "2025-01-15",
      "total": "52.50",
      "returnBy": "2025-02-14",
      "warrantyEnds": "2026-01-15",
      "category": "Shopping",
      "ocrConfidence": "high",
      "vatAmount": "6.85",
      "returnPolicyDays": 30,
      "refundType": "full"
    }
  ]
}
```

#### Download PDF
```http
GET /api/purchases/:id/pdf
Authorization: Session cookie required

Response: 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="receipt-WALMART-2025-01-15.pdf"

[PDF binary data]
```

### Reports Endpoints

#### Get Personal Reports
```http
GET /api/reports/personal
Authorization: Session cookie required

Response: 200 OK
{
  "totalReceipts": 42,
  "totalSpent": 15250.00,
  "pendingReturns": 5,
  "activeWarranties": 12,
  "upcomingReturnDeadlines": [...],
  "expiringWarranties": [...],
  "spendingByCategory": [...],
  "warrantyStatusBreakdown": [...],
  "monthlySpendingTrends": [...]
}
```

#### Get Business Reports Summary
```http
GET /api/reports/summary?startDate=2025-01-01&endDate=2025-12-31
Authorization: Session cookie required

Response: 200 OK
{
  "summary": {
    "totalReceipts": 42,
    "totalSpent": "15250.00",
    "totalTax": "2287.50",
    "totalVat": "1982.61"
  },
  "byCategory": [...],
  "byMerchant": [...],
  "byMonth": [...],
  "context": "business"
}
```

### Claims Endpoints

#### Generate Claim
```http
POST /api/claims/create
Content-Type: application/json
Authorization: Session cookie required

{
  "hash": "receipt-hash-here"
}

Response: 200 OK
{
  "claim": {
    "id": "uuid-here",
    "claimCode": "ABC123",
    "pin": "123456",
    "qrCode": "data:image/png;base64,...",
    "verificationUrl": "https://app.com/verify/ABC123",
    "expiresAt": "2025-04-15T12:00:00Z",
    "status": "issued"
  }
}
```

#### Verify Claim (Merchant)
```http
POST /api/claims/verify
Content-Type: application/json

{
  "claimCode": "ABC123",
  "pin": "123456",
  "merchantId": "merchant-uuid"
}

Response: 200 OK
{
  "valid": true,
  "claim": {...},
  "purchase": {...}
}
```

### Merchant Portal Endpoints

#### Merchant Staff Login
```http
POST /api/merchant/login
Content-Type: application/json

{
  "merchantId": "merchant-uuid",
  "email": "staff@store.com",
  "password": "password123"
}

Response: 200 OK
{
  "staff": {
    "id": "staff-uuid",
    "email": "staff@store.com",
    "role": "staff"
  },
  "merchant": {
    "businessName": "Store Name"
  }
}
```

#### Process Refund
```http
POST /api/merchant/claims/:claimCode/process
Content-Type: application/json

{
  "action": "full_refund",
  "notes": "Customer satisfied",
  "staffId": "staff-uuid"
}

Response: 200 OK
{
  "success": true,
  "claim": {
    "status": "redeemed"
  }
}
```

### USSD Endpoint

```http
POST /api/ussd
Content-Type: application/json

{
  "sessionId": "session-123",
  "phoneNumber": "+27123456789",
  "text": "1*2"
}

Response: 200 OK
{
  "response": "CON Your receipts:\n1. Walmart - R52.50\n2. Pick n Pay - R123.00"
}
```

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR NOT NULL,
  username VARCHAR NOT NULL UNIQUE,
  email VARCHAR NOT NULL UNIQUE,
  email_verified BOOLEAN DEFAULT false,
  verification_token VARCHAR,
  verification_token_expires TIMESTAMP,
  phone VARCHAR NOT NULL,
  password VARCHAR NOT NULL,
  id_number VARCHAR,
  home_address TEXT,
  account_type VARCHAR DEFAULT 'personal',
  business_name VARCHAR,
  tax_id VARCHAR,
  vat_number VARCHAR,
  registration_number VARCHAR,
  business_address TEXT,
  business_phone VARCHAR,
  business_email VARCHAR,
  active_context VARCHAR DEFAULT 'personal',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Purchases Table
```sql
CREATE TABLE purchases (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  hash VARCHAR NOT NULL,
  merchant VARCHAR NOT NULL,
  date DATE NOT NULL,
  total VARCHAR NOT NULL,
  tax_amount VARCHAR,
  vat_amount VARCHAR,
  vat_source VARCHAR DEFAULT 'none',
  invoice_number VARCHAR,
  return_by DATE,
  warranty_ends DATE,
  category VARCHAR DEFAULT 'Other',
  context VARCHAR DEFAULT 'personal',
  image_path VARCHAR,
  ocr_confidence VARCHAR,
  -- Policy fields
  return_policy_days INTEGER,
  return_policy_terms TEXT,
  refund_type VARCHAR,
  exchange_policy_days INTEGER,
  exchange_policy_terms TEXT,
  warranty_months INTEGER,
  warranty_terms TEXT,
  policy_source VARCHAR DEFAULT 'merchant_default',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Claims Table
```sql
CREATE TABLE claims (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id VARCHAR REFERENCES purchases(id),
  claim_code VARCHAR NOT NULL UNIQUE,
  pin VARCHAR NOT NULL,
  token TEXT NOT NULL,
  status VARCHAR DEFAULT 'issued',
  expires_at TIMESTAMP NOT NULL,
  redeemed_at TIMESTAMP,
  redeemed_by VARCHAR,
  refund_type VARCHAR,
  refund_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Merchant Rules Table
```sql
CREATE TABLE merchant_rules (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  merchant_name VARCHAR NOT NULL,
  return_policy_days INTEGER DEFAULT 30,
  warranty_months INTEGER DEFAULT 12,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Activity Log Table
```sql
CREATE TABLE activity_log (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id),
  action VARCHAR NOT NULL,
  metadata TEXT,
  ip_address VARCHAR,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Architecture Overview

### Frontend Architecture
- **Component Library**: Shadcn/ui with Radix UI primitives for accessibility
- **State Management**: TanStack Query handles server state; React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with custom design system (Material Design-inspired)
- **Charts**: Recharts for data visualization in Reports page
- **Error Handling**: Custom ApiError class extracts user-friendly messages

### Backend Architecture
- **API Design**: RESTful Express.js with modular route handlers
- **OCR Pipeline**: 
  1. Multer handles file uploads (10MB limit)
  2. Sharp preprocesses images for optimal OCR
  3. Tesseract.js performs OCR extraction
  4. Enhanced regex parsers extract structured data
  5. Policy extraction identifies return/warranty terms
  6. VAT extraction with three-tier fallback logic
  7. Invoice number detection with pattern filtering
  8. Date normalization with comprehensive validation
  9. Weighted confidence scoring (merchant 30%, date 35%, total 35%)
  10. Deadline computation applies extracted policies or merchant rules
  11. SHA256 hash for deduplication
- **Claim System**: JWT tokens (90-day expiration) + 6-digit PINs + QR codes
- **Merchant Portal**: Separate auth system for store staff verification
- **Reports System**: Aggregates data by category, vendor, and month with tax calculations
- **Email System**: Resend integration for verification, welcome, and recovery emails
- **USSD Gateway**: Webhook endpoint for feature phone text-based interaction
- **Security**: Session-based auth, rate limiting, bcrypt hashing, userId validation

### Data Flow
1. User uploads receipt image or pastes email text
2. Frontend sends to `/api/receipts/preview` or `/api/receipts/text`
3. Server extracts data including policies, VAT, and invoice number
4. User reviews/edits extracted data and policies in UI
5. Frontend sends to `/api/receipts/confirm` with final data
6. Server applies merchant rules, computes deadlines, stores purchase
7. Frontend invalidates cache, refetches receipts list
8. Receipt appears in list with correct deadlines and policies

---

## PWA Features

### Offline Support
- **Cache Strategy**: Cache-first for static assets (HTML, CSS, JS, images)
- **API Caching**: Network-first with offline fallback for API responses
- **Blob Storage**: IndexedDB stores receipt images locally (~500KB each)
- **Auto-Sync**: Queued uploads automatically retry when connection restores

### Background Sync
1. User uploads receipt while offline
2. Receipt stored in IndexedDB with blob data
3. Service worker registers sync event
4. When online, two-step sync occurs:
   - Re-upload blob to `/api/receipts/preview` (refreshes server cache)
   - POST edited metadata to `/api/receipts/confirm`
5. Receipt marked as synced in IndexedDB
6. Client cache invalidated via postMessage

### Installation
- **Install Prompt**: Bottom banner appears on compatible browsers
- **Add to Home Screen**: Full native app experience
- **App Shortcuts**: Quick access to Upload, Receipts, Claims (configured in manifest)
- **Theme**: Indigo primary color (#4f46e5)
- **Icons**: Multiple sizes (192x192, 512x512) for all devices

---

## Merchant Portal

The Merchant Portal provides a dedicated interface for store staff to verify and process customer claims.

### Features
- **Staff Login**: Authenticate with merchant ID, email, and password
- **QR Scanning**: Built-in QR code scanner for claim verification
- **Manual Entry**: Enter claim codes manually when scanning isn't possible
- **Auto-Lookup**: Deep links from QR codes automatically load claim details
- **PIN Verification**: Secure 6-digit PIN verification with atomic consumption
- **Refund Options**:
  - Full refund
  - Partial refund (with amount)
  - Store credit
  - Exchange
- **Claim Refusal**: Log refusal with reason for audit trail
- **Verification History**: Paginated list of all verifications with timestamps
- **Staff Management**: Owners can add/remove staff and assign roles
- **Fraud Detection**: Flags multiple redemption attempts on same claim

### Access
Navigate to `/merchant` to access the Merchant Portal.

---

## USSD Support

SlipSafe includes USSD gateway support for feature phone accessibility.

### Webhook Endpoint
```
POST /api/ussd
```

### Menu Structure
```
1. View Receipts
2. Check Claims
3. Account Settings
0. Exit
```

### Integration
Configure your USSD gateway provider to send requests to the `/api/ussd` endpoint with:
- `sessionId`: Unique session identifier
- `phoneNumber`: User's phone number
- `text`: User's menu selection

---

## Development

### Project Structure
```
slipsafe/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Route pages
│   │   │   ├── home.tsx       # Upload page
│   │   │   ├── receipts.tsx   # Receipt list
│   │   │   ├── claims.tsx     # Claims management
│   │   │   ├── reports.tsx    # Tax & Reports
│   │   │   ├── settings.tsx   # Settings page
│   │   │   ├── profile.tsx    # User profile
│   │   │   ├── admin.tsx      # Admin dashboard
│   │   │   └── merchant/      # Merchant portal pages
│   │   ├── lib/           # Utilities & query client
│   │   └── hooks/         # Custom React hooks
│   └── public/            # Static assets & PWA files
├── server/                # Express backend
│   ├── routes.ts          # API route handlers
│   ├── storage.ts         # Database layer
│   ├── auth.ts            # Authentication logic
│   ├── lib/               # Server utilities
│   │   ├── ocr.ts         # OCR processing with policy extraction
│   │   ├── pdf.ts         # PDF generation
│   │   └── email.ts       # Email sending
│   └── index.ts           # Server entry point
├── shared/                # Shared types & schemas
│   └── schema.ts          # Drizzle schema & Zod validation
├── design_guidelines.md   # UI/UX design system
├── replit.md              # Project documentation
└── package.json           # Dependencies & scripts
```

### Available Scripts

```bash
# Development
npm run dev              # Start dev server (frontend + backend)

# Database
npm run db:push          # Push schema changes to database
npm run db:push --force  # Force push (data loss warning)
npm run db:studio        # Open Drizzle Studio (database GUI)

# Production
npm run build            # Build for production
npm start                # Start production server
```

### Environment Variables

```env
# Required
DATABASE_URL=postgresql://...     # PostgreSQL connection string
SESSION_SECRET=random-string      # Express session secret
JWT_SECRET=random-string          # JWT signing secret
RESEND_API_KEY=re_...             # Resend API key for emails

# Optional
PORT=5000                         # Server port (default: 5000)
NODE_ENV=development              # Environment (development/production)
ADMIN_USERNAME=admin              # Admin dashboard username
ADMIN_PASSWORD=secure_password    # Admin dashboard password
```

---

## Recent Updates

### December 2025

**1. Policy Extraction Feature**
- Automatic extraction of return/refund/exchange/warranty policies from receipts
- Manual policy entry when auto-detection fails
- Visual badges indicating policy source (auto-detected vs user-edited)
- Dynamic deadline computation based on policy values

**2. VAT & Invoice Extraction**
- Three-tier VAT extraction logic with source tracking
- Invoice number detection supporting multiple formats
- Enhanced OCR patterns for South African receipts

**3. Email Receipt Support**
- Paste email order confirmations for parsing
- Higher accuracy for text-based receipts
- Source type tracking for analytics

**4. Merchant Portal**
- Dedicated staff authentication system
- QR code scanning and manual code entry
- Full/partial refund processing
- Staff management with role-based access

**5. Email Verification System**
- Registration requires email verification
- 24-hour verification token expiry
- Welcome email after successful verification
- Resend verification option

**6. Tax & Reports Enhancement**
- Personal user dashboard with warranty tracking
- Business reports with VAT summaries
- PDF report generation with transaction details
- Enhanced charts and visualizations

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License.

---

## Acknowledgments

- **Tesseract.js** - OCR engine
- **Sharp** - Image preprocessing
- **Shadcn/ui** - Beautiful component library
- **TanStack Query** - Powerful data synchronization
- **Radix UI** - Accessible component primitives
- **Recharts** - Data visualization library
- **Resend** - Transactional email service
- **Neon** - Serverless PostgreSQL
- **Drizzle ORM** - TypeScript ORM
