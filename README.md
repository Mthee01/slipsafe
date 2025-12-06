# SlipSafe

> Smart Receipt Management with AI-Powered OCR, Policy Extraction, and Verifiable Claims

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.0-61dafb.svg)](https://reactjs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791.svg)](https://neon.tech/)
[![PWA](https://img.shields.io/badge/PWA-Enabled-5A0FC8.svg)](https://web.dev/progressive-web-apps/)

SlipSafe is a comprehensive receipt management system designed for the South African market. It digitizes physical and digital receipts using **Gemini Vision AI** (exclusive OCR provider), automatically extracts store policies, computes return and warranty deadlines, and generates verifiable claims with QR codes and PINs. The system supports both personal and business contexts with organization/team management, tax reporting, and three subscription tiers.

![SlipSafe Logo](attached_assets/SlipSafe%20Logo_1762888976121.png)

## Table of Contents

- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Subscription Plans](#subscription-plans)
- [Currency & Market](#currency--market)
- [Contributing](#contributing)
- [License](#license)

---

## Key Features

### AI-Powered OCR Processing
- **Gemini Vision AI** - Exclusive OCR provider using Google's multimodal AI for superior accuracy
- **No Fallback System** - When Gemini is unavailable, users are prompted to save and retry later
- **Automatic Data Extraction** - Merchant name, date, total, VAT, invoice number
- **Policy Extraction** - Return periods, refund types, exchange policies, warranty terms
- **Confidence Scoring** - Visual indicators (high/medium/low) for OCR accuracy
- **Refresh OCR** - Re-scan button for correcting merchant name errors

### Smart Policy Management
- **Auto-Detection** - Extracts policies directly from receipt text
- **Conditional Policy Detection** - Distinguishes between "NO REFUNDS WITHOUT INVOICE" (conditional) vs "ALL SALES FINAL" (unconditional)
- **Merchant Rules Fallback** - Custom default policies per merchant when receipt doesn't specify
- **Dynamic Deadlines** - Auto-computed return and warranty expiration dates
- **Manual Override** - Edit any policy field with source tracking

### VAT & Tax Handling
- **Three-Tier VAT Logic**:
  1. Extract explicit VAT from receipt
  2. Calculate from subtotal/total difference
  3. Estimate at 15% (South African standard rate)
- **VAT Source Tracking** - Records 'extracted', 'calculated', or 'none'
- **Context-Aware Display** - VAT fields only visible in business mode

### Business & Personal Contexts
- **Dual Mode Operation** - Switch between personal and business contexts
- **Separate Receipt Tracking** - Each context maintains independent records
- **Context Persistence** - Active context saved across sessions
- **VAT Gating** - Business-only VAT fields hidden in personal mode

### Organization & Team Management
- **Multi-User Teams** - Create organizations with team members
- **Role Hierarchy** - Owner > Admin > Member with strict permissions
- **Invitation System** - Email-based team invitations
- **Plan Limits** - Enforced user and receipt limits per subscription tier

### Verifiable Claims System
- **QR Code Generation** - Scannable codes linking to verification pages
- **6-Digit PIN** - Additional security layer for verification
- **JWT Tokens** - Cryptographically signed claims with 90-day expiration
- **State Machine** - Tracks: issued → pending → redeemed/partial/refused/expired
- **Fraud Detection** - Prevents duplicate redemptions

### Merchant Portal
- **Dual Access Modes**:
  - Legacy Portal (`/merchant`) - Separate staff login
  - Integrated Portal (`/merchant-portal`) - For app users with merchant roles
- **Claim Verification** - QR scanning or manual code entry
- **Refund Processing** - Full/partial options with audit notes
- **Verification History** - Paginated audit trail

### Reports & Analytics
- **Personal Dashboard** - Receipt totals, spending, pending returns, active warranties
- **Business Reports** - Tax/VAT summaries, expense categorization, monthly trends
- **Visual Charts** - Pie charts and bar graphs (Recharts)
- **Export Options** - CSV download and PDF generation
- **Date Filtering** - Custom date ranges

### Progressive Web App (PWA)
- **Offline Support** - Cache-first for assets, network-first for API
- **Background Sync** - Auto-retry uploads when connection restored
- **Install Prompt** - Add to home screen capability
- **IndexedDB Storage** - Local persistence with blob support
- **4K Camera Capture** - High-resolution receipt scanning

### Email System
- **Resend Integration** - Professional transactional email delivery
- **Email Verification** - Required before login (24-hour expiry)
- **Password Reset** - Secure token-based recovery (1-hour expiry)
- **Welcome Email** - Sent after successful verification

### USSD Gateway
- **Feature Phone Access** - Text-based menu via webhook
- **Receipt Lookup** - Check receipts and claims without smartphone
- **Accessibility** - Enables access for all user types

---

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI library with hooks |
| TypeScript | Type-safe development |
| Vite | Build tool and dev server |
| Wouter | Lightweight client-side routing |
| TanStack Query v5 | Server state management |
| Shadcn/ui | Accessible components (Radix UI) |
| Tailwind CSS | Utility-first styling |
| Recharts | Data visualization |
| Framer Motion | Animations |

### Backend
| Technology | Purpose |
|------------|---------|
| Express.js | Web framework |
| TypeScript | End-to-end type safety |
| Gemini Vision AI | OCR processing (exclusive) |
| Multer | File upload handling (10MB limit) |
| PDFKit | PDF generation |
| QRCode | QR code generation |
| JWT | Token-based claim verification |
| Passport.js | Authentication |
| Bcrypt | Password hashing |
| Resend | Email delivery |

### Database
| Technology | Purpose |
|------------|---------|
| PostgreSQL | Relational database (Neon serverless) |
| Drizzle ORM | TypeScript ORM |
| Drizzle Zod | Schema validation |

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database (or Neon serverless)

### Installation

```bash
# Clone the repository
git clone https://github.com/Mthee01/slipsafe.git
cd slipsafe

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your credentials

# Push database schema
npm run db:push

# Start development server
npm run dev
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Authentication
SESSION_SECRET=your-secure-random-string
JWT_SECRET=another-secure-random-string

# Gemini AI (auto-configured via Replit integration)
AI_INTEGRATIONS_GEMINI_API_KEY=your-gemini-api-key

# Email (Resend)
RESEND_API_KEY=re_your_api_key

# Stripe Billing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Admin Dashboard
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure_password

# Server
PORT=5000
NODE_ENV=development
```

---

## Project Structure

```
slipsafe/
├── client/                    # React frontend
│   ├── public/               # Static assets, PWA manifest
│   └── src/
│       ├── components/       # Reusable UI components
│       │   └── ui/          # Shadcn components
│       ├── hooks/           # Custom React hooks
│       ├── lib/             # Utilities (queryClient, utils)
│       ├── pages/           # Route pages
│       └── App.tsx          # Main app with routing
├── server/                   # Express backend
│   ├── lib/                 # Server utilities
│   │   ├── gemini-ocr.ts   # Gemini Vision AI OCR
│   │   ├── email.ts        # Resend email templates
│   │   ├── pdf.ts          # PDF generation
│   │   └── planLimits.ts   # Subscription limits
│   ├── auth.ts             # Passport authentication
│   ├── billing.ts          # Stripe billing routes
│   ├── routes.ts           # Main API routes
│   ├── organization-routes.ts # Team management
│   ├── storage.ts          # Database operations
│   └── index.ts            # Server entry point
├── shared/                   # Shared types
│   └── schema.ts           # Drizzle schema + Zod validators
├── docs/                     # Documentation
│   ├── USER_GUIDE.md       # End-user guide
│   ├── API_REFERENCE.md    # API documentation
│   ├── TECHNICAL_ARCHITECTURE.md # System design
│   └── DEPLOYMENT_GUIDE.md # Setup & deployment
└── scripts/                  # Utility scripts
    └── push-to-github.ts   # GitHub API push
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [User Guide](docs/USER_GUIDE.md) | End-user documentation for all features |
| [API Reference](docs/API_REFERENCE.md) | Complete API endpoint documentation |
| [Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md) | System design with diagrams |
| [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) | Environment setup and deployment |

---

## Subscription Plans

| Feature | Free | Solo (R99/mo) | Pro (R269/mo) | Enterprise |
|---------|------|---------------|---------------|------------|
| Users | 1 | 1 | Up to 10 | Custom |
| Receipts/month | Unlimited personal | 1,000 business | 5,000 business | Unlimited |
| Personal receipts | Yes | Yes | Yes | Yes |
| Business context | No | Yes | Yes | Yes |
| VAT/Tax reports | No | Yes | Yes | Yes |
| Team workspace | No | No | Yes | Yes |
| CSV/PDF export | Limited | Yes | Yes | Yes |
| Priority support | No | Email | Email | Dedicated |

---

## Currency & Market

SlipSafe is designed for the **South African market**:

- **Currency**: South African Rand (R / ZAR)
- **VAT Rate**: 15% standard rate
- **Phone Format**: +27 prefix support
- **USSD**: Feature phone accessibility for broader reach

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is proprietary software. All rights reserved.

---

## Support

- **Email**: Support@slip-safe.net
- **Enterprise Inquiries**: enterprise@slip-safe.net

---

Built with care for South African consumers and businesses.
