# SlipSafe

## Overview
SlipSafe is a receipt management system designed to digitize physical receipts using OCR technology. It automates the computation of return/warranty deadlines and generates verifiable claims with QR codes and PINs. The system caters to both consumers for receipt and claim management, and merchants for claim verification, with added USSD support for feature phone accessibility. The project aims to provide a secure, efficient, and verifiable solution for receipt management, reducing paper waste and simplifying the claims process.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
**Monorepo Structure**: The project is organized as a monorepo, separating the React/Vite PWA frontend (`/client`), the Express.js API backend (`/server`), and shared TypeScript schemas/types (`/shared`).

**Frontend**:
- **Framework**: React 18 with TypeScript, Vite, Wouter for routing, and TanStack React Query for state management.
- **UI/UX**: Utilizes Shadcn/ui (Radix UI primitives) and Tailwind CSS with a Material Design-inspired aesthetic focusing on utility and clarity. Features an indigo/teal gradient branding with a 3D shield logo symbolizing security.
- **PWA Capabilities**: Full PWA implementation including a manifest, service worker for offline support (cache-first for assets, network-first with offline fallback for APIs, two-step background sync for uploads), IndexedDB for offline data persistence, an offline indicator, and an install prompt.
- **Accessibility**: WCAG 2.1 Level AA compliant with proper HTML5 autocomplete attributes and `autoComplete="off"` for sensitive fields.
- **Error Handling**: Custom `ApiError` class for user-friendly error messages from API responses.

**Backend**:
- **API**: RESTful Express.js server handling receipt OCR processing (`/api/receipts`), claim generation/verification (`/api/claims`), and USSD webhooks (`/api/ussd`).
- **OCR Pipeline**: Processes uploaded receipts (JPEG/PNG/PDF) using Tesseract.js for text extraction. Employs enhanced regex and heuristics to extract merchant, date, and total, with robust date normalization and validation. Computes return/warranty deadlines and generates an SHA256 hash for deduplication.
- **Claim System**: Generates JWT tokens with 90-day expiration for claims, uses 6-digit random PINs for verification, and QR codes encoding verification URLs.
- **Security**: Session-based authentication with `passport-local`, rate limiting on authentication endpoints, and 1-hour expiring, single-use password reset tokens. Generic API responses prevent user enumeration.
- **Email System**: Integrates with Resend for professional HTML email delivery for account recovery (forgot username/password), featuring SlipSafe branding and security measures like rate limiting and token expiration.
- **Context Switching**: Business accounts can toggle between personal and business modes to manage receipts separately, with the active context persisting across sessions.
- **Tax & Reports**: Comprehensive reporting system (`/api/reports`) for business users with tax/VAT summaries, expense categorization by category and vendor, monthly trends with visual charts (Recharts), and CSV export functionality.

**Data Storage**:
- **Database**: PostgreSQL, primarily via Neon serverless driver with Drizzle ORM, for persistent storage of users, purchases, and settings.
- **Schema**: Includes `users` and `purchases` tables, with hash-based deduplication for receipts.

## External Dependencies

**Third-Party Services**:
- **Supabase**: Used for PostgreSQL hosting and REST API access, with planned RLS policies.
- **Neon Database**: Serverless PostgreSQL solution, integrated via Drizzle ORM.
- **Resend**: For transactional email delivery (account recovery, notifications).

**Key Libraries**:
- `tesseract.js`: For OCR processing.
- `multer`: Handles multipart file uploads.
- `jsonwebtoken`: For JWT creation and verification in the claim system.
- `qrcode`: Generates QR codes for claim URLs.
- `dayjs` & `date-fns`: For date manipulation and deadline calculations.
- `recharts`: For data visualization in the Tax & Reports page (pie charts, bar charts).
- `@radix-ui/*`, `tailwindcss`, `class-variance-authority`, `clsx`: Frontend UI and styling.

**API Integrations**:
- **USSD Gateway**: Provides a webhook endpoint (`/api/ussd`) for feature phone interaction via text-based menus.

**Environment Variables**:
- `DATABASE_URL`
- `JWT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `PORT`