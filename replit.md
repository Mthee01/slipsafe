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
- **OCR Pipeline**: Uses Google Gemini Vision AI exclusively for receipt scanning.
  - **Gemini Vision AI** (`server/lib/gemini-ocr.ts`): Uses multimodal AI to analyze receipt images directly, providing superior accuracy especially for thermal receipts. Extracts merchant, date, total, VAT, invoice number, and policies in a single API call.
  - **No Fallback**: When Gemini is unavailable, displays user-friendly message asking to save receipt and try again later.
  - **Refresh OCR**: Button to clear cache and re-scan receipts with fresh OCR processing if merchant name is incorrect.
  - **VAT Extraction**: Three-tier logic for extracting explicit VAT, calculating from subtotal/total difference, or estimating at 15%. VAT data includes `subtotal`, `vatAmount`, and `vatSource` ('extracted'|'calculated'|'none') fields.
  - **Policy Extraction**: Automatically extracts return policy days, refund types, exchange policy periods, and warranty terms.
  - **Conditional Policy Detection**: Distinguishes between conditional policies ("NO REFUNDS WITHOUT ORIGINAL INVOICE" = returns allowed with invoice) and unconditional bans ("ALL SALES FINAL" = no returns). Conditional policies show "Not specified" for days rather than "No returns accepted".
  - **Merchant Rules Fallback**: When receipt shows conditional policy but no specific days, system pulls default return/warranty days from merchant rules table if configured. Policy source is tracked as 'merchant_default' in these cases.
  - **Policy Editing**: Users can manually enter or edit policies.
- **Email Receipt Support**: Accepts pasted email receipt content (HTML or plain text) via `/api/receipts/text` endpoint. Uses Gemini AI for intelligent parsing of email receipts (with regex fallback), extracting merchant, date, total, invoice numbers, and policies from complex email formats.
- **Claim System**: Generates JWT tokens with 90-day expiration for claims, uses 6-digit random PINs for verification, and QR codes encoding verification URLs. State machine tracks claim lifecycle.
- **Merchant Portal**: Dual access modes:
  - **Legacy Portal** (`/merchant`): Separate session-based authentication for dedicated merchant staff with their own login credentials.
  - **Integrated Portal** (`/merchant-portal`): For main app users with `merchant_admin` or `merchant_staff` roles, accessible via sidebar without separate login.
  - Both portals support claim verification via QR code scanning or manual entry, refund processing, and verification history. Includes fraud detection and audit trail.
- **Security**: Session-based authentication with `passport-local`, rate limiting, and 1-hour expiring, single-use password reset tokens. "Stay logged in" option extends session from 7 to 30 days.
- **Admin Role Restrictions**: Admin accounts (role: 'admin' or 'support') are support-only and cannot access user features:
  - Sidebar hides all user navigation (Upload, Receipts, Claims, Reports, Settings, Profile)
  - Admin login redirects to `/admin` instead of home page
  - `blockAdminAccess` middleware returns 403 on all user-specific API routes
  - Context switching disabled for admins (no personal/business mode)
- **Admin Support Tools** (`/admin`): Comprehensive admin dashboard with tabbed interface:
  - **Overview Tab**: System statistics (users, receipts, claims, active users), quick actions, system status
  - **Users Tab**: Search/filter users, view detailed user profiles (with receipts/claims counts), action buttons for:
    - Send password reset email (triggers email flow, doesn't set password directly)
    - Unlock account (clears rate limits for failed logins)
    - Verify email manually (for users who can't receive verification emails)
    - Change account type (individual ↔ business)
  - **Organizations Tab**: Search/view organizations, view membership details, remove members, transfer ownership
  - **Activity Log Tab**: Enhanced filtering by user and action type, includes admin action types
  - **API Endpoints**: All protected with `isAuthenticated` and `isAdmin` middleware:
    - `GET /api/admin/users` (with search/pagination)
    - `GET /api/admin/users/:userId` (detailed user info)
    - `POST /api/admin/users/:userId/password-reset`
    - `POST /api/admin/users/:userId/unlock`
    - `POST /api/admin/users/:userId/verify-email`
    - `PATCH /api/admin/users/:userId/account-type`
    - `GET /api/admin/organizations` (with search/pagination)
    - `GET /api/admin/organizations/:organizationId`
    - `POST /api/admin/organizations/:organizationId/transfer-ownership`
    - `DELETE /api/admin/organizations/:organizationId/members/:userId`
    - `PATCH /api/admin/organizations/:organizationId/members/:userId/role`
- **Session-Based Context**: User context (personal/business mode) is stored per-session to prevent cross-device conflicts:
  - Each browser/device maintains independent context
  - `getSessionContext(req, user)` helper prioritizes session over stored user preference
  - Prevents data integrity issues when same user is logged in from multiple devices
- **Email Verification**: Registration requires email verification before login, with tokens expiring after 24 hours.
- **Email System**: Integrates with Resend for professional HTML email delivery for verification, welcome, and account recovery.
- **Context Switching**: Business accounts can toggle between personal and business modes to manage receipts separately.
- **Organization/Team Management**: Business accounts can create organizations and manage team members.
  - **Plan Limits**: Three-tier subscription system (Solo: 1 user/1K receipts, Pro: 10 users/5K receipts, Enterprise: custom) enforced via `planLimits.ts`.
  - **Team Page** (`/team`): Displays members, pending invitations, and usage statistics. Owners/admins can invite members, remove members, and cancel invitations.
  - **Route Ordering**: CRITICAL - In `server/organization-routes.ts`, all `/api/organizations/current/*` routes MUST be defined BEFORE `/api/organizations/:organizationId` routes to prevent Express from matching "current" as an organizationId parameter. This is a common Express routing pattern issue.
  - **Security**: All `/api/organizations/current/*` endpoints use `verifyCurrentOrgMembership` helper to prevent stale/forged activeOrganizationId attacks. Role-based access (owner > admin > member) with strict enforcement:
    - Only owners can remove admins
    - Only admins/owners can invite members or cancel invitations
    - All organization data access requires active membership verification
  - **Multi-tenant Receipts**: Organization receipts are tracked via `organizationId` field on purchases, enabling aggregation for business reports across all team members.
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
- `@google/genai`: Gemini Vision AI for OCR (exclusive, no fallback).
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
- `AI_INTEGRATIONS_GEMINI_API_KEY` - Gemini Vision AI for OCR (auto-configured via Replit integration)
- `PORT`
- `NODE_ENV`