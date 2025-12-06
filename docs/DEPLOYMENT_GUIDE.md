# SlipSafe Deployment Guide

> Environment setup, service configuration, and deployment instructions

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Database Setup](#database-setup)
4. [Gemini AI Setup](#gemini-ai-setup)
5. [Stripe Billing Setup](#stripe-billing-setup)
6. [Resend Email Setup](#resend-email-setup)
7. [Local Development](#local-development)
8. [Production Deployment](#production-deployment)
9. [Webhook Configuration](#webhook-configuration)
10. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Prerequisites

### System Requirements

- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **PostgreSQL**: 14+ (or Neon serverless)

### Required Accounts

- **Neon** (database): https://neon.tech
- **Google Cloud** (Gemini AI): https://cloud.google.com
- **Stripe** (billing): https://stripe.com
- **Resend** (email): https://resend.com

---

## Environment Variables

### Complete Reference

Create a `.env` file in the project root:

```env
# ═══════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Individual components (auto-configured by Neon)
PGHOST=your-host.neon.tech
PGPORT=5432
PGUSER=your-username
PGPASSWORD=your-password
PGDATABASE=slipsafe

# ═══════════════════════════════════════════════════════════
# AUTHENTICATION
# ═══════════════════════════════════════════════════════════
# Session encryption (generate with: openssl rand -hex 32)
SESSION_SECRET=your-secure-random-string-at-least-32-characters

# JWT signing for claims (generate with: openssl rand -hex 32)
JWT_SECRET=another-secure-random-string-for-jwt-tokens

# ═══════════════════════════════════════════════════════════
# GEMINI AI (OCR)
# ═══════════════════════════════════════════════════════════
# Auto-configured via Replit integration
AI_INTEGRATIONS_GEMINI_API_KEY=your-gemini-api-key

# ═══════════════════════════════════════════════════════════
# EMAIL (RESEND)
# ═══════════════════════════════════════════════════════════
RESEND_API_KEY=re_your_resend_api_key

# ═══════════════════════════════════════════════════════════
# STRIPE BILLING
# ═══════════════════════════════════════════════════════════
STRIPE_SECRET_KEY=sk_live_your_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Price IDs for subscription plans
STRIPE_PRICE_SOLO_MONTHLY=price_solo_monthly_id
STRIPE_PRICE_SOLO_ANNUAL=price_solo_annual_id
STRIPE_PRICE_PRO_MONTHLY=price_pro_monthly_id
STRIPE_PRICE_PRO_ANNUAL=price_pro_annual_id

# ═══════════════════════════════════════════════════════════
# ADMIN DASHBOARD
# ═══════════════════════════════════════════════════════════
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-admin-password

# ═══════════════════════════════════════════════════════════
# SERVER
# ═══════════════════════════════════════════════════════════
PORT=5000
NODE_ENV=development

# ═══════════════════════════════════════════════════════════
# REPLIT (auto-configured)
# ═══════════════════════════════════════════════════════════
REPLIT_CONNECTORS_HOSTNAME=auto
REPL_IDENTITY=auto
```

### Variable Categories

| Category | Required | Description |
|----------|----------|-------------|
| Database | Yes | PostgreSQL connection |
| Authentication | Yes | Session and JWT secrets |
| Gemini AI | Yes | OCR processing |
| Email | Yes | Transactional emails |
| Stripe | For billing | Subscription payments |
| Admin | Optional | Admin dashboard access |
| Server | Yes | Port and environment |

---

## Database Setup

### Option 1: Neon Serverless (Recommended)

1. **Create Account**: Sign up at https://neon.tech

2. **Create Project**:
   - Click "New Project"
   - Name: `slipsafe`
   - Region: Select closest to your users

3. **Get Connection String**:
   - Copy the connection string from dashboard
   - Format: `postgresql://user:pass@host/dbname?sslmode=require`

4. **Set Environment Variable**:
   ```bash
   DATABASE_URL=postgresql://...
   ```

### Option 2: Self-Hosted PostgreSQL

1. **Install PostgreSQL**:
   ```bash
   # Ubuntu/Debian
   sudo apt install postgresql postgresql-contrib
   
   # macOS
   brew install postgresql
   ```

2. **Create Database**:
   ```sql
   CREATE DATABASE slipsafe;
   CREATE USER slipsafe_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE slipsafe TO slipsafe_user;
   ```

3. **Set Connection**:
   ```bash
   DATABASE_URL=postgresql://slipsafe_user:your_password@localhost:5432/slipsafe
   ```

### Push Schema

After configuring the database:

```bash
# Push Drizzle schema to database
npm run db:push

# If data-loss warning appears (safe for fresh db)
npm run db:push --force
```

---

## Gemini AI Setup

### Via Replit Integration (Recommended)

1. In Replit, the Gemini integration is auto-configured
2. The `AI_INTEGRATIONS_GEMINI_API_KEY` is set automatically
3. No additional setup required

### Manual Setup

1. **Create Google Cloud Project**:
   - Go to https://console.cloud.google.com
   - Create new project: `slipsafe`

2. **Enable Gemini API**:
   - Navigate to APIs & Services
   - Enable "Generative Language API"

3. **Create API Key**:
   - Go to Credentials
   - Create API Key
   - Restrict to Generative Language API

4. **Set Environment Variable**:
   ```bash
   AI_INTEGRATIONS_GEMINI_API_KEY=your-api-key
   ```

### Usage Notes

- **Rate Limits**: Check Google's quotas for your tier
- **No Fallback**: If Gemini is unavailable, users see a retry message
- **Caching**: OCR results are cached for retry operations

---

## Stripe Billing Setup

### 1. Create Stripe Account

1. Sign up at https://stripe.com
2. Complete business verification
3. Switch to "Live mode" for production

### 2. Get API Keys

1. Go to Developers > API Keys
2. Copy:
   - **Publishable key**: `pk_live_...`
   - **Secret key**: `sk_live_...`

### 3. Create Products and Prices

Create these products in Stripe Dashboard:

#### Solo Plan
- **Product Name**: SlipSafe Business Solo
- **Prices**:
  - Monthly: R99/month (recurring)
  - Annual: R960/year (R80/month effective)

#### Pro Plan
- **Product Name**: SlipSafe Business Team
- **Prices**:
  - Monthly: R269/month (recurring)
  - Annual: R2,748/year (R229/month effective)

### 4. Set Price IDs

Copy the price IDs and set in `.env`:

```bash
STRIPE_PRICE_SOLO_MONTHLY=price_1234...
STRIPE_PRICE_SOLO_ANNUAL=price_5678...
STRIPE_PRICE_PRO_MONTHLY=price_9012...
STRIPE_PRICE_PRO_ANNUAL=price_3456...
```

### 5. Configure Webhook

See [Webhook Configuration](#webhook-configuration) section.

---

## Resend Email Setup

### 1. Create Account

1. Sign up at https://resend.com
2. Verify your email

### 2. Add Domain (Production)

1. Go to Domains
2. Add your domain: `slip-safe.net`
3. Add DNS records:
   - SPF record
   - DKIM record
   - DMARC record (recommended)
4. Verify domain

### 3. Get API Key

1. Go to API Keys
2. Create new key with permissions:
   - `emails:send`
   - `domains:read`

### 4. Set Environment Variable

```bash
RESEND_API_KEY=re_your_api_key
```

### Email Templates

SlipSafe uses these email templates:

| Email | Trigger | Expiry |
|-------|---------|--------|
| Verification | Registration | 24 hours |
| Welcome | Email verified | N/A |
| Password Reset | Forgot password | 1 hour |
| Username Recovery | Forgot username | N/A |
| Team Invitation | Admin invites | 7 days |

---

## Local Development

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/Mthee01/slipsafe.git
cd slipsafe

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 4. Push database schema
npm run db:push

# 5. Start development server
npm run dev
```

### Development Server

The `npm run dev` command starts:
- **Vite dev server**: Hot module reloading
- **Express server**: API on port 5000
- **Both proxied**: Single port access

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Drizzle Studio |
| `npm test` | Run test suite |

---

## Production Deployment

### Replit Deployment

1. **Push to GitHub**: Code syncs automatically

2. **Configure Secrets**:
   - Go to Secrets tab
   - Add all environment variables

3. **Deploy**:
   - Click "Deploy" button
   - Select "Autoscale" or "Reserved VM"

4. **Configure Domain**:
   - Add custom domain in Deployments
   - Update DNS records

### Manual Deployment

```bash
# Build production assets
npm run build

# Start production server
NODE_ENV=production npm start
```

### Environment Checklist

Before deploying:

- [ ] `DATABASE_URL` points to production database
- [ ] `SESSION_SECRET` is unique and secure
- [ ] `JWT_SECRET` is unique and secure
- [ ] `RESEND_API_KEY` is production key
- [ ] `STRIPE_SECRET_KEY` is live mode key
- [ ] `STRIPE_WEBHOOK_SECRET` is configured
- [ ] All Stripe price IDs are live mode
- [ ] `NODE_ENV=production`

---

## Webhook Configuration

### Stripe Webhook

1. **Create Endpoint** in Stripe Dashboard:
   - URL: `https://your-domain.com/api/billing/webhook`
   - Events to listen:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

2. **Get Webhook Secret**:
   - Copy the signing secret: `whsec_...`

3. **Set Environment Variable**:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_your_secret
   ```

### Testing Webhooks Locally

Use Stripe CLI:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:5000/api/billing/webhook

# In another terminal, trigger test events
stripe trigger checkout.session.completed
```

### USSD Webhook

Configure your USSD gateway to send requests to:
```
POST https://your-domain.com/api/ussd
```

---

## Monitoring & Maintenance

### Health Checks

The app exposes:
- `/api/health` - Basic health check

### Logging

Important log locations:
- Application logs: stdout/stderr
- Database queries: Drizzle logging (dev mode)
- Authentication: Passport debug (dev mode)

### Database Maintenance

```bash
# View database in browser
npm run db:studio

# Backup (Neon)
# Use Neon dashboard for point-in-time recovery

# Manual backup (self-hosted)
pg_dump -h localhost -U user slipsafe > backup.sql
```

### Performance Monitoring

Recommended tools:
- **Sentry**: Error tracking
- **LogRocket**: Session replay
- **Neon**: Database metrics

### Security Updates

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies
npm update
```

---

## Troubleshooting

### Common Issues

#### Database Connection Failed
```
Error: Connection refused
```
**Solution**: Check DATABASE_URL and ensure database is running.

#### Gemini API Error
```
Error: API key not valid
```
**Solution**: Verify AI_INTEGRATIONS_GEMINI_API_KEY is set correctly.

#### Email Not Sending
```
Error: Domain not verified
```
**Solution**: Complete domain verification in Resend dashboard.

#### Stripe Webhook Fails
```
Error: Signature verification failed
```
**Solution**: Ensure STRIPE_WEBHOOK_SECRET matches the webhook endpoint.

### Debug Mode

Enable verbose logging:
```bash
DEBUG=* npm run dev
```

### Support

- **Email**: Support@slip-safe.net
- **Enterprise**: enterprise@slipsafe.com

---

*SlipSafe Deployment Guide v1.0*
