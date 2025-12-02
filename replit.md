# SlipSafe

## Overview
SlipSafe is a receipt management system designed to digitize physical and digital receipts using OCR technology. It automates the extraction of store policies (return/refund/exchange/warranty), computation of return/warranty deadlines, VAT extraction, and generates verifiable claims with QR codes and PINs. The system caters to both consumers for receipt and claim management, and merchants for claim verification, with added USSD support for feature phone accessibility. The project aims to provide a secure, efficient, and verifiable solution for receipt management, reducing paper waste and simplifying the claims process.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
**Monorepo Structure**: The project is organized as a monorepo, separating the React/Vite PWA frontend (`/client`), the Express.js API backend (`/server`), and shared TypeScript schemas/types (`/shared`).

**Frontend**:
- **Framework**: React 18 with TypeScript, Vite, Wouter for routing, and TanStack React Query for state management.
- **UI/UX**: Utilizes Shadcn/ui (Radix UI primitives) and Tailwind CSS with a Material Design-inspired aesthetic. Features an indigo/teal gradient branding with a 3D shield logo.
- **PWA Capabilities**: Full PWA implementation including manifest, service worker for offline support, IndexedDB for offline data persistence, and an install prompt.
- **Camera Features**: 4K resolution capture with receipt frame guide overlay, tap-to-focus, flash/torch control, real-time image quality assessment, multi-part capture mode for long receipts, and quality gating.
- **Accessibility**: WCAG 2.1 Level AA compliant with proper HTML5 autocomplete attributes.
- **Error Handling**: Custom `ApiError` class for user-friendly error messages from API responses.

**Backend**:
- **API**: RESTful Express.js server handling receipt OCR processing, claim generation/verification, merchant portal, and USSD webhooks.
- **OCR Pipeline**: Processes uploaded receipts (JPEG/PNG/PDF) using Tesseract.js for text extraction with Sharp image preprocessing. Employs enhanced regex and heuristics to extract merchant, date, total, VAT, invoice number, and store policies, with robust date normalization and validation. Computes return/warranty deadlines and generates an SHA256 hash for deduplication.
  - **VAT Extraction**: Three-tier logic for extracting explicit VAT, calculating from subtotal/total difference, or estimating at 15%.
  - **Policy Extraction**: Automatically extracts return policy days, refund types, exchange policy periods, and warranty terms.
  - **Policy Editing**: Users can manually enter or edit policies.
- **Email Receipt Support**: Accepts pasted email receipt content (HTML or plain text) via `/api/receipts/text` endpoint. Cleans HTML tags and extracts relevant data, bypassing OCR.
- **Claim System**: Generates JWT tokens with 90-day expiration for claims, uses 6-digit random PINs for verification, and QR codes encoding verification URLs. State machine tracks claim lifecycle.
- **Merchant Portal**: Separate authentication system for store staff to verify customer claims via QR code scanning or manual entry, process refunds, log refusals, and manage staff. Includes fraud detection and an audit trail.
- **Security**: Session-based authentication with `passport-local`, rate limiting, and 1-hour expiring, single-use password reset tokens.
- **Email Verification**: Registration requires email verification before login, with tokens expiring after 24 hours.
- **Email System**: Integrates with Resend for professional HTML email delivery for verification, welcome, and account recovery.
- **Context Switching**: Business accounts can toggle between personal and business modes to manage receipts separately.
- **Reports**: Two-tier reporting system:
  - **Personal Users**: Dashboard showing total receipts, total spent, pending returns, active warranties, upcoming deadlines, spending by category, and monthly spending trends.
  - **Business Users**: Comprehensive tax/VAT summaries, expense categorization, monthly trends with visual charts, CSV export, and PDF report generation.
- **USSD Gateway**: Webhook endpoint (`/api/ussd`) for feature phone interaction via text-based menus for receipt lookup and claim checking.

**Data Storage**:
- **Database**: PostgreSQL, primarily via Neon serverless driver with Drizzle ORM, for persistent storage of users, purchases, claims, merchant rules, and activity logs.
- **Schema**: Includes `users`, `business_profiles`, `purchases` (with hash-based deduplication, policy fields, VAT tracking), `claims`, `merchant_rules`, and `activity_log` tables.

## External Dependencies

**Third-Party Services**:
- **Neon Database**: Serverless PostgreSQL solution.
- **Resend**: Transactional email delivery.

**Key Libraries**:
- `tesseract.js`: For OCR processing.
- `sharp`: Image preprocessing.
- `multer`: Handles multipart file uploads.
- `jsonwebtoken`: For JWT creation and verification.
- `qrcode`: Generates QR codes.
- `pdfkit`: PDF generation.
- `dayjs` & `date-fns`: For date manipulation.
- `recharts`: For data visualization.
- `bcrypt`: Secure password hashing.
- `passport` & `passport-local`: Authentication middleware.
- `@radix-ui/*`, `tailwindcss`, `class-variance-authority`, `clsx`: Frontend UI and styling.
- `framer-motion`: Animations.
- `wouter`: Lightweight client-side routing.
- `@tanstack/react-query`: Server state management.

**API Integrations**:
- **USSD Gateway**: Provides a webhook endpoint (`/api/ussd`) for feature phone interaction.
- **Resend Email API**: Transactional email delivery.

**Environment Variables**:
- `DATABASE_URL`
- `SESSION_SECRET`
- `JWT_SECRET`
- `RESEND_API_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `PORT`
- `NODE_ENV`