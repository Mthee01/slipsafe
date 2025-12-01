# SlipSafe

## Overview

SlipSafe is a receipt management system that digitizes physical receipts using OCR technology, automatically computes return/warranty deadlines, and generates verifiable claims with QR codes and PINs. The system serves both consumers (managing receipts and claims) and merchants (verifying claims), with additional USSD support for feature phone accessibility.

The application is built as a full-stack monorepo with a React-based Progressive Web App client and an Express.js backend API that handles OCR processing, claim generation, and USSD webhooks.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### Critical Bug Fixes (November 18, 2025)

**1. Receipt Save Validation Fix**
- **Issue**: POST /api/receipts/confirm failed with "userId required" validation error
- **Root Cause**: userId was not included in purchaseData before schema validation
- **Fix**: Added userId to purchaseData object in server/routes.ts before validation (line 760)
- **Impact**: Receipt saving now works correctly, preventing validation failures

**2. Query Parameter Serialization Fix**
- **Issue**: Receipts page showed "No receipts found" despite server returning data; malformed URLs like "/api/purchases/[object%20Object]" appeared in logs
- **Root Cause**: TanStack Query's queryKey objects were joined with "/" instead of being converted to URL query parameters
- **Fix**: Rewrote getQueryFn in client/src/lib/queryClient.ts (lines 98-149) to properly handle all query key patterns:
  - String/number segments → path parts (joined with "/")
  - Object segments → URL query parameters (URLSearchParams)
  - Multiple objects → merged via Object.assign
  - Array values → multiple params (e.g., tags=a&tags=b)
  - Boolean values → "true"/"false" strings
  - Nested objects → JSON.stringify
  - Explicit errors for unsupported types
- **Impact**: Receipts page now correctly displays saved receipts with proper filtering; category and search filters work as expected

**3. Storage Layer Security Enhancement**
- **Issue**: Potential privilege escalation if userId in payload doesn't match authenticated user
- **Fix**: Added defensive validation in server/storage.ts createPurchase method (lines 294-296)
- **Validation**: Throws error if insertPurchase.userId !== authenticated userId parameter
- **Impact**: Prevents any future code paths from creating purchases with mismatched user IDs

**Testing Status**: All fixes verified through comprehensive E2E tests covering registration, merchant rules, OCR processing, receipt save, receipts listing with filters, PDF generation, claim generation, and PWA features.

## System Architecture

### Application Structure

**Monorepo Architecture**: The project uses a single repository with two main directories:
- `/client` - React/Vite PWA frontend
- `/server` - Express.js API backend
- `/shared` - Shared TypeScript schemas and types

**Build System**: Vite powers the development server and build process, with TypeScript throughout. The build outputs a bundled Express server and static client assets.

### Frontend Architecture

**Framework Stack**:
- React 18 with TypeScript
- Vite for bundling and dev server
- Wouter for client-side routing
- TanStack React Query for server state management
- Shadcn/ui component library (Radix UI primitives)
- Tailwind CSS with custom design system

**Error Handling**: Custom ApiError class extracts user-friendly messages from API responses by parsing JSON payloads and checking common error fields (error, message, detail, errors array). Prevents technical jargon (HTTP status codes, JSON formatting) from reaching users. Falls back gracefully for HTML error pages, empty bodies, and malformed responses.

**Design System**: Material Design-inspired approach focused on utility and data clarity over visual flourish. Uses Inter font family, standardized spacing units (4, 6, 8, 12, 16, 24), and a comprehensive color system with HSL-based theming support.

**Branding**: Professional 3D shield logo featuring a large "S" letter integrated with a receipt containing a QR code. The design uses a clean turquoise/teal gradient with professional shading on a light background, with a polished 3D appearance. Symbolizes security, digital verification, and trust. Logo appears at multiple sizes:
- Login/Register pages: 80×80px (h-20 w-20) for prominent branding
- Sidebar header: 40×40px (h-10 w-10) paired with "SlipSafe" text
- Favicon: Full-resolution PNG (1024×1024) for browser tab icons
- All logo instances use `object-contain` to preserve aspect ratio without distortion

**PWA Capabilities**: Fully implemented Progressive Web App with comprehensive offline support:
- **Manifest**: Enhanced manifest.json with app metadata, theme colors (#4f46e5 indigo), icon references, orientation settings, categories (finance, productivity, utilities), and app shortcuts for quick access
- **Service Worker**: Registered at `/sw.js` with dual caching strategies and two-step background sync:
  - Cache-first for static assets (HTML, CSS, JS, images) with runtime updates
  - Network-first for API calls with offline fallback to cached responses
  - Two-step background sync: (1) re-upload blob to /api/receipts/preview to refresh server cache, (2) POST user-edited metadata to /api/receipts/confirm
  - Handles cache expiration by refreshing preview data on every sync
  - Retry logic with MAX_RETRIES=3, removes failed uploads after exhausting attempts or validation errors (400)
- **IndexedDB Storage**: Complete offline data persistence layer with blob storage (`client/src/lib/indexedDB.ts`):
  - `receipts` store with synced/merchant indexes for filtered queries
  - `pending-uploads` store with blob storage (fileBlob, fileName) for network error fallback
  - Transaction-safe CRUD operations using request callbacks (onsuccess) to prevent "transaction inactive" errors
  - Average receipt: ~500KB, minimal storage impact for typical usage
- **Offline Indicator**: Real-time connection status UI (`client/src/components/offline-indicator.tsx`) with auto-hide after reconnection
- **Install Prompt**: Native PWA install prompt (`client/src/components/install-prompt.tsx`) with dismissible card interface and localStorage persistence
- **Background Sync**: Automatic two-step synchronization when connection is restored:
  - Service worker registers sync event after queuing uploads (no isOnline check required)
  - Sync event triggers preview re-upload + confirm metadata submission
  - Marks receipts as synced in IndexedDB after server confirmation
  - Notifies client via postMessage to invalidate React Query cache and refetch purchases
  - Preserves user edits over OCR results throughout sync process

**State Management Strategy**: React Query handles API state with infinite stale time and disabled refetching, indicating data is treated as stable once fetched. Component state managed via React hooks.

**Accessibility Compliance**: All form inputs include proper HTML5 autocomplete attributes following WCAG 2.1 Level AA guidelines:
- Standard fields use semantic values: `username`, `email`, `tel`, `street-address`, `organization`
- Password fields distinguish between `current-password` and `new-password` contexts
- Sensitive fields (ID numbers, tax IDs, tokens) use `autoComplete="off"` to prevent unintended storage
- Enables browser autocomplete and improves screen reader context

### Backend Architecture

**API Design**: RESTful Express.js server with modular route handlers:
- `/api/receipts` - Receipt upload and OCR processing
- `/api/claims` - Claim generation and verification
- `/api/ussd` - USSD webhook endpoint
- `/claim/:token` - Server-rendered claim verification page

**OCR Processing Pipeline**:
1. Multer handles multipart file uploads (10MB limit, JPEG/PNG/PDF)
2. Tesseract.js performs OCR text extraction (server/lib/ocr.ts)
3. Enhanced regex/heuristic parser extracts:
   - **Merchant**: Priority patterns (explicit keywords → CAPS detection → first line), filters out non-merchant text
   - **Date**: Multiple formats (ISO YYYY-MM-DD, DD/MM/YYYY, MM-DD-YYYY with dual-attempt validation, month names, 2-digit years → 20XX)
   - **Total**: Currency symbols, comma/space removal, sanity checks (< 1M), contextual patterns
4. Date normalization with comprehensive validation:
   - Range validation (year 1900-2100, month 1-12, day 1-31)
   - Month-specific day limits with leap year handling
   - Separator-aware parsing (hyphens → MM-DD-YYYY then DD-MM-YYYY fallback, slash/dot → disambiguation)
   - Input cleaning (ordinal suffixes, trailing punctuation)
   - Structured logging with format assumptions and parsed components
5. Weighted confidence scoring (merchant 30%, date 35%, total 35%) based on field quality
6. Deadline computation applies configurable return (30d) and warranty (12mo) rules
7. SHA256 hash generated from merchant|date|total for deduplication

**Claim System Design**:
- JWT tokens with 90-day expiration containing claim payload
- 6-digit random PINs for additional verification
- QR codes encode claim verification URLs
- Verification endpoint compares JWT payload against database records

**Security Model**: Session-based authentication with passport-local strategy. Rate limiting on authentication endpoints (3-5 attempts per 15 minutes). Password reset tokens with 1-hour expiration and single-use enforcement. Generic API responses for forgot password/username prevent user enumeration attacks.

**Email System**: Production-grade email delivery via Resend integration (`server/lib/email.ts`):
- Forgot username: Users enter email → system sends professional HTML email with username
- Forgot password: Users enter username/email → system generates secure reset token → sends HTML email with reset link
- Sender: "SlipSafe" <onboarding@resend.dev> (configurable via Resend connector)
- Email templates: Professional SlipSafe-branded HTML with indigo/purple gradient headers
- Security features: Rate limiting, token expiration (1 hour), single-use tokens, server-side validation
- Emails only sent when user exists; API responses remain generic to prevent enumeration
- Resend integration: Uses Replit connector for secure API key management, fresh client per send

**Context Switching (Business Accounts)**: Business users can toggle between personal and business contexts to separate receipts:
- Context switcher appears in sidebar for business accounts only
- Displays current mode with visual indicator (Personal Mode / Business Mode)
- Button toggles between contexts via POST `/api/users/context`
- Receipts are filtered by `activeContext` field in all queries
- Context persists across sessions and page navigation

### Data Storage

**Database Solution**: PostgreSQL via Neon serverless driver with Drizzle ORM. The schema uses connection pooling for serverless environments.

**Schema Design** (from code references):
- `users` table with UUID primary keys and username/password auth
- `purchases` table (referenced in server code) stores: id, hash, merchant, date, total, returnBy, warrantyEnds, created_at
- Hash-based deduplication prevents duplicate receipt entries

**Data Access Pattern**: Supabase REST API used for CRUD operations, though Drizzle ORM is configured suggesting a migration path from Supabase to direct PostgreSQL access.

### Authentication & Authorization

**Current Implementation**: Basic user schema with username/password. JWT tokens used for claim verification rather than user sessions.

**Session Management**: Express sessions mentioned in dependencies (connect-pg-simple) but not actively implemented in visible routes.

**Authorization Model**: RLS policies planned but not yet implemented, indicated by TODO comments in schema file.

## External Dependencies

### Third-Party Services

**Supabase**: Backend-as-a-Service providing:
- PostgreSQL database hosting
- REST API for database access
- Planned RLS for authorization
- Environment configuration via SUPABASE_URL and SUPABASE_ANON_KEY

**Neon Database**: Serverless PostgreSQL alternative (Drizzle configured for direct connection). May be replacing Supabase as primary database.

### Key Libraries

**OCR & Image Processing**:
- `tesseract.js` - Client-side OCR processing
- `multer` - File upload handling

**Security & Tokens**:
- `jsonwebtoken` - JWT claim generation and verification
- `qrcode` - QR code generation for claims

**Date Handling**:
- `dayjs` - Date manipulation and deadline computation
- `date-fns` - Additional date utilities

**UI Framework**:
- `@radix-ui/*` - Headless UI component primitives (20+ components)
- `tailwindcss` - Utility-first CSS framework
- `class-variance-authority` & `clsx` - Conditional className utilities

**Development Tools**:
- `tsx` - TypeScript execution for development
- `esbuild` - Server bundling for production
- Replit-specific plugins for error overlay and dev tooling

### API Integrations

**USSD Gateway**: Webhook endpoint at `/api/ussd` expects aggregator to POST with sessionId, msisdn, and text parameters. Returns plain text USSD menu screens for feature phone interaction.

**Environment Variables Required**:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `SUPABASE_URL` & `SUPABASE_ANON_KEY` - Supabase credentials (if using Supabase mode)
- `PORT` - Server port (defaults to 3001)