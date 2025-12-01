# SlipSafe

> Digital receipt management with OCR, smart deadlines, and verifiable claims

SlipSafe is a comprehensive receipt management system that transforms physical receipts into digital records using OCR technology. It automatically computes return and warranty deadlines, generates verifiable claims with QR codes, and provides offline-first Progressive Web App capabilities. The system supports both personal and business contexts with comprehensive tax reporting and expense analytics.

![SlipSafe Logo](client/public/logo.png)

## Key Features

### Intelligent OCR Processing
- **Automated Data Extraction**: Upload receipt images (JPEG, PNG, PDF) and let Tesseract.js extract merchant name, date, and total amount
- **Confidence Scoring**: Visual indicators (high/medium/low) show OCR accuracy
- **Manual Correction**: Edit any extracted field before saving to ensure accuracy
- **Smart Parsing**: Advanced regex patterns detect multiple date formats, currency symbols, and merchant names

### Custom Merchant Rules
- **Flexible Policies**: Set custom return periods (days) and warranty durations (months) per merchant
- **Automatic Application**: System matches merchant names and applies appropriate deadlines
- **Default Fallbacks**: 30-day return, 12-month warranty for merchants without custom rules
- **Easy Management**: Full CRUD interface in Settings for creating, editing, and deleting rules

### Verifiable Claims
- **QR Code Generation**: Each claim includes a scannable QR code linking to verification page
- **6-Digit PIN**: Additional security layer for claim verification
- **JWT Tokens**: Cryptographically signed claims with 90-day expiration
- **Merchant Verification**: Dedicated verification page for retailers to validate claims

### PDF Export
- **Professional Documents**: Generate PDF receipts with embedded QR codes
- **Complete Information**: Includes merchant, date, amount, return deadline, warranty expiration
- **Download & Share**: Save locally or share via messaging apps

### Business Context Switching
- **Dual Mode**: Switch between personal and business contexts for separate receipt tracking
- **Business Profile**: Manage business name, tax ID, VAT number, registration number, address, and contact details
- **Context Persistence**: Active context is saved and persists across sessions
- **Separate Analytics**: Each context has its own receipts, reports, and expense tracking

### Tax & Reports
- **Summary Dashboard**: View total receipts, spending, tax deductible amounts, and VAT claimable
- **Category Breakdown**: Visual pie chart and detailed table of expenses by category
- **Vendor Analysis**: Track spending patterns across different merchants
- **Monthly Trends**: Bar charts showing spending patterns over time with tax breakdown
- **Date Filtering**: Filter reports by custom date ranges
- **CSV Export**: Download comprehensive reports for accounting and tax purposes

### Admin Dashboard
- **User Activity Monitoring**: Track login attempts, receipt uploads, and system usage
- **System Statistics**: View total users, receipts, claims, and activity metrics
- **Security Audit**: Monitor failed login attempts and account recovery requests
- **Admin Authentication**: Secure access with environment-based admin credentials

### Email System
- **Account Recovery**: Forgot password and username recovery via email
- **Professional Branding**: HTML email templates with SlipSafe branding
- **Resend Integration**: Reliable transactional email delivery
- **Security Measures**: Rate limiting and token expiration for reset requests

### Progressive Web App (PWA)
- **Offline Support**: Cache-first strategy for static assets, network-first for API calls
- **Background Sync**: Automatic upload retry when connection is restored
- **Install Prompt**: Add to home screen for native app experience
- **Offline Indicator**: Real-time connection status with automatic hide/show
- **IndexedDB Storage**: Persistent local storage with blob support for receipt images (~500KB per receipt)

### Security & Authentication
- **Session-Based Auth**: Secure passport-local strategy with bcrypt password hashing
- **Rate Limiting**: Protection against brute force attacks (3-5 attempts per 15 minutes)
- **Account Recovery**: Forgot password/username with secure token-based reset
- **Phone/Email Registration**: Mandatory phone number, optional email for account recovery
- **Defense in Depth**: Server-side userId validation prevents privilege escalation

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

### Backend
- **Express.js** - Fast, minimal web framework
- **TypeScript** - End-to-end type safety
- **Tesseract.js** - Client-side OCR engine
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

## Usage Guide

### 1. User Registration
1. Navigate to the home page
2. Click "Register" if you don't have an account
3. Fill in username, phone number (required), email (optional), and password
4. Optionally check "Register as Business Account" for business features
5. Click "Register" to create your account

### 2. Upload a Receipt
1. Click "Upload" in the sidebar
2. Drag & drop or click to browse for a receipt image
3. Select category (Food, Shopping, Entertainment, etc.)
4. Click "Scan Receipt" to run OCR processing

### 3. Review & Edit OCR Results
1. Review the extracted merchant, date, and total
2. Check the confidence badge (high/medium/low)
3. Edit any incorrect fields manually
4. View computed deadlines based on merchant rules
5. Click "Save Receipt" to store the record

### 4. Switch Context (Business Users)
1. Business users see a toggle in the sidebar
2. Switch between "Personal" and "Business" modes
3. Each context has separate receipts and reports
4. Context is saved and persists across sessions

### 5. View Tax & Reports
1. Click "Reports" in the sidebar
2. View summary cards (Total Receipts, Spent, Tax, VAT)
3. Explore "By Category" tab with pie chart visualization
4. Check "By Vendor" tab for merchant-level breakdown
5. Review "By Month" tab with bar chart trends
6. Use date filters for custom date ranges
7. Click "Export CSV" to download report data

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
4. Click a receipt to view full details

### 8. Generate a Claim
1. Open a receipt from your list
2. Click "Generate Claim"
3. View the QR code and 6-digit PIN
4. Download the QR code image
5. Share via WhatsApp or other messaging apps

### 9. Download PDF
1. Open a receipt from your list
2. Click "Download PDF"
3. PDF includes merchant info, amounts, dates, deadlines, and QR code
4. Save or share the PDF document

### 10. Install as PWA
1. Look for the install prompt banner at the bottom
2. Click "Install SlipSafe"
3. App will be added to your home screen
4. Launch like a native app with offline support

## API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/register
Content-Type: application/json

{
  "username": "johndoe",
  "phone": "+27123456789",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "isBusiness": false
}

Response: 200 OK
{
  "id": "uuid-here",
  "username": "johndoe",
  "phone": "+27123456789",
  "email": "john@example.com"
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
  "email": "john@example.com"
}
```

#### Logout
```http
POST /api/logout

Response: 200 OK
{ "ok": true }
```

### Reports Endpoints

#### Get Reports Summary
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
  "byCategory": [
    {
      "name": "Shopping",
      "count": 15,
      "total": "5200.00",
      "tax": "780.00",
      "vat": "676.52"
    }
  ],
  "byMerchant": [
    {
      "name": "WALMART",
      "count": 8,
      "total": "2400.00",
      "tax": "360.00",
      "vat": "312.17"
    }
  ],
  "byMonth": [
    {
      "month": "2025-01",
      "count": 12,
      "total": "3800.00",
      "tax": "570.00",
      "vat": "494.35"
    }
  ],
  "context": "personal"
}
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
  "merchant": "WALMART",
  "date": "2025-01-15",
  "total": "52.50",
  "confidence": "high",
  "rawText": "WALMART\nReceipt...",
  "imagePath": "uploads/abc123...",
  "returnBy": "2025-02-14",
  "warrantyEnds": "2026-01-15"
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
  "category": "Shopping"
}

Response: 200 OK
{
  "purchase": {
    "id": "uuid-here",
    "merchant": "WALMART",
    "date": "2025-01-15",
    "total": "52.50",
    "returnBy": "2025-04-15",
    "warrantyEnds": "2027-01-15",
    "category": "Shopping",
    "ocrConfidence": "high"
  }
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
      "returnBy": "2025-04-15",
      "warrantyEnds": "2027-01-15",
      "category": "Shopping",
      "ocrConfidence": "high"
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

### Business Profile Endpoints

#### Update Business Profile
```http
PUT /api/users/business-profile
Content-Type: application/json
Authorization: Session cookie required

{
  "businessName": "My Company Ltd",
  "taxId": "TAX123456",
  "vatNumber": "VAT789012",
  "registrationNumber": "REG456789",
  "businessAddress": "123 Business St",
  "businessPhone": "+27987654321",
  "businessEmail": "accounts@mycompany.com"
}

Response: 200 OK
{
  "user": { ... updated user object ... }
}
```

### Merchant Rules Endpoints

#### Create Merchant Rule
```http
POST /api/merchant-rules
Content-Type: application/json
Authorization: Session cookie required

{
  "merchantName": "WALMART",
  "returnPolicyDays": 90,
  "warrantyMonths": 24
}

Response: 200 OK
{
  "rule": {
    "id": "uuid-here",
    "merchantName": "WALMART",
    "returnPolicyDays": 90,
    "warrantyMonths": 24
  }
}
```

### Claims Endpoints

#### Generate Claim
```http
POST /api/claims
Content-Type: application/json
Authorization: Session cookie required

{
  "purchaseId": "uuid-here"
}

Response: 200 OK
{
  "claim": {
    "id": "uuid-here",
    "purchaseId": "uuid-here",
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "pin": "123456",
    "qrCodeUrl": "data:image/png;base64,...",
    "verificationUrl": "https://app.com/claim/eyJhbG...",
    "expiresAt": "2025-04-15T12:00:00Z"
  }
}
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR NOT NULL UNIQUE,
  email VARCHAR UNIQUE,
  phone VARCHAR NOT NULL,
  password VARCHAR NOT NULL,
  full_name VARCHAR,
  id_number VARCHAR,
  home_address TEXT,
  is_business BOOLEAN DEFAULT false,
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
  return_by DATE,
  warranty_ends DATE,
  category VARCHAR DEFAULT 'Other',
  context VARCHAR DEFAULT 'personal',
  image_path VARCHAR,
  ocr_confidence VARCHAR,
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
│   │   │   └── admin.tsx      # Admin dashboard
│   │   ├── lib/           # Utilities & query client
│   │   └── hooks/         # Custom React hooks
│   └── public/            # Static assets & PWA files
├── server/                # Express backend
│   ├── routes.ts          # API route handlers
│   ├── storage.ts         # Database layer
│   ├── auth.ts            # Authentication logic
│   ├── lib/               # Server utilities
│   │   ├── ocr.ts         # OCR processing
│   │   ├── pdf.ts         # PDF generation
│   │   └── email.ts       # Email sending
│   └── index.ts           # Server entry point
├── shared/                # Shared types & schemas
│   └── schema.ts          # Drizzle schema & Zod validation
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
  2. Tesseract.js performs OCR extraction
  3. Enhanced regex parsers extract structured data
  4. Date normalization with comprehensive validation
  5. Weighted confidence scoring (merchant 30%, date 35%, total 35%)
  6. Deadline computation applies merchant rules
  7. SHA256 hash for deduplication
- **Claim System**: JWT tokens (90-day expiration) + 6-digit PINs + QR codes
- **Reports System**: Aggregates data by category, vendor, and month with tax calculations
- **Email System**: Resend integration for account recovery emails
- **Security**: Session-based auth, rate limiting, bcrypt hashing, userId validation

### Data Flow
1. User uploads receipt image
2. Frontend sends to `/api/receipts/preview` (OCR processing)
3. Server extracts data and returns preview
4. User reviews/edits in UI
5. Frontend sends to `/api/receipts/confirm` (save)
6. Server applies merchant rules, computes deadlines, stores purchase with context
7. Frontend invalidates cache, refetches receipts list
8. Receipt appears in list with correct deadlines

## Recent Updates

### December 2025

**1. Tax & Reports Feature**
- Added comprehensive reporting system with summary dashboard
- Visual charts using Recharts (pie charts for categories, bar charts for trends)
- CSV export functionality for accounting
- Date range filtering

**2. Business Context Switching**
- Dual mode support for personal and business receipts
- Business profile management with tax and registration details
- Context-aware receipt filtering and reporting

**3. Email System Integration**
- Resend API integration for transactional emails
- Professional HTML email templates
- Account recovery (forgot password/username)

**4. Admin Dashboard**
- User activity monitoring
- System statistics and metrics
- Security audit logging

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- **Tesseract.js** - OCR engine
- **Shadcn/ui** - Beautiful component library
- **TanStack Query** - Powerful data synchronization
- **Radix UI** - Accessible component primitives
- **Recharts** - Data visualization library
- **Resend** - Transactional email service
- **Neon** - Serverless PostgreSQL
- **Replit** - Development platform

## Support

For issues or questions, please open an issue on GitHub.

---

Built with React, Express.js, and TypeScript
