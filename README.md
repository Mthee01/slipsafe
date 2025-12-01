# SlipSafe

> Digital receipt management with OCR, smart deadlines, and verifiable claims

SlipSafe is a comprehensive receipt management system that transforms physical receipts into digital records using OCR technology. It automatically computes return and warranty deadlines, generates verifiable claims with QR codes, and provides offline-first Progressive Web App capabilities.

![SlipSafe Logo](client/public/logo.png)

## 🌟 Key Features

### 📸 Intelligent OCR Processing
- **Automated Data Extraction**: Upload receipt images (JPEG, PNG, PDF) and let Tesseract.js extract merchant name, date, and total amount
- **Confidence Scoring**: Visual indicators (high/medium/low) show OCR accuracy
- **Manual Correction**: Edit any extracted field before saving to ensure accuracy
- **Smart Parsing**: Advanced regex patterns detect multiple date formats, currency symbols, and merchant names

### 📋 Custom Merchant Rules
- **Flexible Policies**: Set custom return periods (days) and warranty durations (months) per merchant
- **Automatic Application**: System matches merchant names and applies appropriate deadlines
- **Default Fallbacks**: 30-day return, 12-month warranty for merchants without custom rules
- **Easy Management**: Full CRUD interface in Settings for creating, editing, and deleting rules

### 🎫 Verifiable Claims
- **QR Code Generation**: Each claim includes a scannable QR code linking to verification page
- **6-Digit PIN**: Additional security layer for claim verification
- **JWT Tokens**: Cryptographically signed claims with 90-day expiration
- **Merchant Verification**: Dedicated verification page for retailers to validate claims

### 📄 PDF Export
- **Professional Documents**: Generate PDF receipts with embedded QR codes
- **Complete Information**: Includes merchant, date, amount, return deadline, warranty expiration
- **Download & Share**: Save locally or share via messaging apps

### 📱 Progressive Web App (PWA)
- **Offline Support**: Cache-first strategy for static assets, network-first for API calls
- **Background Sync**: Automatic upload retry when connection is restored
- **Install Prompt**: Add to home screen for native app experience
- **Offline Indicator**: Real-time connection status with automatic hide/show
- **IndexedDB Storage**: Persistent local storage with blob support for receipt images (~500KB per receipt)

### 🔐 Security & Authentication
- **Session-Based Auth**: Secure passport-local strategy with bcrypt password hashing
- **Rate Limiting**: Protection against brute force attacks (3-5 attempts per 15 minutes)
- **Account Recovery**: Forgot password/username with secure token-based reset
- **Demo Mailbox**: Development-only interface for testing email flows
- **Defense in Depth**: Server-side userId validation prevents privilege escalation

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern UI library with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Wouter** - Lightweight client-side routing
- **TanStack Query v5** - Powerful server state management
- **Shadcn/ui** - Beautiful accessible components (Radix UI primitives)
- **Tailwind CSS** - Utility-first styling with custom design system
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

### Database & ORM
- **PostgreSQL** - Robust relational database via Neon serverless
- **Drizzle ORM** - Lightweight TypeScript ORM
- **Drizzle Zod** - Schema validation with Zod integration

### PWA & Storage
- **Service Worker** - Offline caching and background sync
- **IndexedDB** - Client-side blob storage and data persistence
- **Web App Manifest** - Install prompt and app metadata

## 🚀 Getting Started

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
   
   # Server
   PORT=3001
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

## 📖 Usage Guide

### 1. User Registration
1. Navigate to the home page
2. Click "Register" if you don't have an account
3. Fill in username, email, and password
4. Click "Register" to create your account

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

### 4. Manage Merchant Rules
1. Navigate to "Settings" in the sidebar
2. Scroll to "Merchant Rules" card
3. Click "Add Rule" to create a new policy
4. Enter merchant name (e.g., "WALMART")
5. Set return period (days) and warranty duration (months)
6. Click "Save" to apply the rule

### 5. View Your Receipts
1. Click "Receipts" in the sidebar
2. Search by merchant, amount, or date
3. Filter by category using the dropdown
4. Click a receipt to view full details

### 6. Generate a Claim
1. Open a receipt from your list
2. Click "Generate Claim"
3. View the QR code and 6-digit PIN
4. Download the QR code image
5. Share via WhatsApp or other messaging apps

### 7. Download PDF
1. Open a receipt from your list
2. Click "Download PDF"
3. PDF includes merchant info, amounts, dates, deadlines, and QR code
4. Save or share the PDF document

### 8. Install as PWA (Progressive Web App)
1. Look for the install prompt banner at the bottom
2. Click "Install SlipSafe"
3. App will be added to your home screen
4. Launch like a native app with offline support

## 🔌 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}

Response: 200 OK
{
  "id": "uuid-here",
  "username": "johndoe",
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

#### Get All Rules
```http
GET /api/merchant-rules
Authorization: Session cookie required

Response: 200 OK
{
  "rules": [
    {
      "id": "uuid-here",
      "merchantName": "WALMART",
      "returnPolicyDays": 90,
      "warrantyMonths": 24
    }
  ]
}
```

#### Update Merchant Rule
```http
PATCH /api/merchant-rules/:id
Content-Type: application/json
Authorization: Session cookie required

{
  "returnPolicyDays": 120,
  "warrantyMonths": 36
}

Response: 200 OK
{
  "rule": {
    "id": "uuid-here",
    "merchantName": "WALMART",
    "returnPolicyDays": 120,
    "warrantyMonths": 36
  }
}
```

#### Delete Merchant Rule
```http
DELETE /api/merchant-rules/:id
Authorization: Session cookie required

Response: 200 OK
{ "ok": true }
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

#### Get User Claims
```http
GET /api/claims
Authorization: Session cookie required

Response: 200 OK
{
  "claims": [
    {
      "id": "uuid-here",
      "purchase": {
        "merchant": "WALMART",
        "date": "2025-01-15",
        "total": "52.50"
      },
      "pin": "123456",
      "qrCodeUrl": "data:image/png;base64,...",
      "verificationUrl": "https://app.com/claim/...",
      "expiresAt": "2025-04-15T12:00:00Z"
    }
  ]
}
```

#### Verify Claim (Public)
```http
GET /claim/:token?pin=123456

Response: 200 OK (HTML page)
Displays verification result with purchase details
```

## 💾 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR NOT NULL UNIQUE,
  email VARCHAR NOT NULL UNIQUE,
  password VARCHAR NOT NULL,
  full_name VARCHAR,
  phone VARCHAR,
  id_number VARCHAR,
  home_address TEXT,
  is_business BOOLEAN DEFAULT false,
  business_name VARCHAR,
  tax_id VARCHAR,
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
  return_by DATE,
  warranty_ends DATE,
  category VARCHAR DEFAULT 'Other',
  image_path VARCHAR,
  ocr_confidence VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Merchant Rules Table
```sql
CREATE TABLE merchant_rules (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  merchant_name VARCHAR NOT NULL,
  return_policy_days INTEGER NOT NULL,
  warranty_months INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Claims Table
```sql
CREATE TABLE claims (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id VARCHAR NOT NULL REFERENCES purchases(id),
  token TEXT NOT NULL UNIQUE,
  pin VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔧 Development

### Project Structure
```
slipsafe/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Route pages
│   │   ├── lib/           # Utilities & query client
│   │   └── hooks/         # Custom React hooks
│   └── public/            # Static assets & PWA files
├── server/                # Express backend
│   ├── routes.ts          # API route handlers
│   ├── storage.ts         # Database layer
│   ├── lib/               # Server utilities
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

# Optional
PORT=3001                         # Server port (default: 3001)
NODE_ENV=development              # Environment (development/production)
```

### Testing

The project uses Playwright for end-to-end testing:

```bash
# Run tests via testing subagent (automated)
# Tests cover:
# - User registration & authentication
# - Receipt upload & OCR processing
# - Merchant rules CRUD operations
# - Receipt listing with filters
# - PDF generation & download
# - Claim generation & verification
# - PWA features (offline, background sync)
```

## 📱 PWA Features

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

## 🏗️ Architecture Overview

### Frontend Architecture
- **Component Library**: Shadcn/ui with Radix UI primitives for accessibility
- **State Management**: TanStack Query handles server state; React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with custom design system (Material Design-inspired)
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
- **Security**: Session-based auth, rate limiting, bcrypt hashing, userId validation

### Data Flow
1. User uploads receipt image
2. Frontend sends to `/api/receipts/preview` (OCR processing)
3. Server extracts data and returns preview
4. User reviews/edits in UI
5. Frontend sends to `/api/receipts/confirm` (save)
6. Server applies merchant rules, computes deadlines, stores purchase
7. Frontend invalidates cache, refetches receipts list
8. Receipt appears in list with correct deadlines

## 🐛 Recent Bug Fixes

### November 18, 2025

**1. Receipt Save Validation Fix**
- **Issue**: POST /api/receipts/confirm failed with "userId required"
- **Fix**: Added userId to purchaseData before schema validation
- **Impact**: Receipt saving works correctly

**2. Query Parameter Serialization Fix**
- **Issue**: Receipts page showed "No receipts found" despite server returning data
- **Fix**: Rewrote getQueryFn to properly handle query key objects
- **Features**: Merges multiple objects, handles arrays/booleans, JSON-stringifies nested objects
- **Impact**: Receipts page displays correctly, filters work

**3. Storage Layer Security Enhancement**
- **Issue**: Potential privilege escalation via userId mismatch
- **Fix**: Added defensive validation in createPurchase method
- **Impact**: Prevents creating purchases with mismatched user IDs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **Tesseract.js** - OCR engine
- **Shadcn/ui** - Beautiful component library
- **TanStack Query** - Powerful data synchronization
- **Radix UI** - Accessible component primitives
- **Neon** - Serverless PostgreSQL
- **Replit** - Development platform

## 📧 Support

For issues or questions, please open an issue on GitHub.

---

Built with ❤️ using React, Express.js, and TypeScript
