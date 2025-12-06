# SlipSafe API Reference

> Complete API documentation for SlipSafe backend services

## Base URL

```
Development: http://localhost:5000/api
Production: https://your-domain.replit.app/api
```

## Authentication

All protected endpoints require session-based authentication via cookies.

```
Cookie: connect.sid=<session_id>
```

---

## Table of Contents

1. [Authentication](#authentication-endpoints)
2. [Receipts](#receipt-endpoints)
3. [Claims](#claim-endpoints)
4. [Reports](#report-endpoints)
5. [Organizations](#organization-endpoints)
6. [Billing](#billing-endpoints)
7. [Merchant Portal](#merchant-portal-endpoints)
8. [Settings](#settings-endpoints)
9. [Admin](#admin-endpoints)
10. [USSD](#ussd-endpoint)

---

## Authentication Endpoints

### Register User

```http
POST /api/auth/register
Content-Type: application/json
```

**Request Body:**
```json
{
  "fullName": "John Doe",
  "username": "johndoe",
  "phone": "+27123456789",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "accountType": "individual",
  "idNumber": "optional",
  "homeAddress": "optional",
  "businessName": "required for business",
  "taxId": "required for business",
  "vatNumber": "optional"
}
```

**Response (200):**
```json
{
  "message": "Registration successful. Please check your email to verify your account."
}
```

---

### Verify Email

```http
GET /api/auth/verify-email?token=<verification_token>
```

**Response (200):**
```json
{
  "message": "Email verified successfully"
}
```

---

### Resend Verification Email

```http
POST /api/auth/resend-verification
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response (200):**
```json
{
  "message": "Verification email sent"
}
```

---

### Login

```http
POST /api/auth/login
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "johndoe",
  "password": "SecurePass123!",
  "rememberMe": true
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "username": "johndoe",
  "email": "john@example.com",
  "fullName": "John Doe",
  "accountType": "individual",
  "activeContext": "personal",
  "planType": "free"
}
```

---

### Logout

```http
POST /api/auth/logout
```

**Response (200):**
```json
{ "ok": true }
```

---

### Get Current User

```http
GET /api/user
```

**Response (200):**
```json
{
  "id": "uuid",
  "username": "johndoe",
  "fullName": "John Doe",
  "email": "john@example.com",
  "accountType": "business",
  "activeContext": "business",
  "planType": "business_solo",
  "businessName": "Acme Corp"
}
```

---

### Forgot Password

```http
POST /api/auth/forgot-password
Content-Type: application/json
```

**Request Body:**
```json
{
  "recoveryMethod": "email",
  "usernameOrEmail": "john@example.com"
}
```

**Response (200):**
```json
{
  "message": "If an account exists with that information, a password reset link has been sent."
}
```

---

### Reset Password

```http
POST /api/auth/reset-password
Content-Type: application/json
```

**Request Body:**
```json
{
  "token": "reset_token_here",
  "newPassword": "NewSecurePass123!",
  "confirmPassword": "NewSecurePass123!"
}
```

**Response (200):**
```json
{
  "message": "Password reset successfully"
}
```

---

## Receipt Endpoints

### OCR Preview (Image)

```http
POST /api/receipts/preview
Content-Type: multipart/form-data
```

**Form Data:**
- `receipt`: Image file (JPEG, PNG, PDF, max 10MB)

**Response (200):**
```json
{
  "success": true,
  "ocrData": {
    "merchant": "WOOLWORTHS",
    "date": "2025-01-15",
    "total": "152.50",
    "confidence": "high",
    "rawText": "WOOLWORTHS...",
    "returnBy": "2025-02-14",
    "warrantyEnds": "2026-01-15",
    "vatAmount": 19.89,
    "vatSource": "extracted",
    "subtotal": 132.61,
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

---

### OCR Preview (Text/Email)

```http
POST /api/receipts/text
Content-Type: application/json
```

**Request Body:**
```json
{
  "text": "Order Confirmation from Takealot...",
  "source": "email_paste"
}
```

**Response (200):**
```json
{
  "success": true,
  "ocrData": {
    "merchant": "Takealot",
    "date": "2025-01-15",
    "total": "899.00",
    "sourceType": "email_paste",
    "confidence": "high"
  }
}
```

---

### Refresh OCR

```http
POST /api/receipts/refresh-ocr
Content-Type: multipart/form-data
```

Clears cache and re-processes the receipt image.

---

### Confirm & Save Receipt

```http
POST /api/receipts/confirm
Content-Type: application/json
```

**Request Body:**
```json
{
  "merchant": "WOOLWORTHS",
  "date": "2025-01-15",
  "total": "152.50",
  "category": "Shopping",
  "invoiceNumber": "INV-123456",
  "vatAmount": 19.89,
  "subtotal": 132.61,
  "vatSource": "extracted",
  "policies": {
    "returnPolicyDays": 30,
    "refundType": "full",
    "exchangePolicyDays": null,
    "warrantyMonths": 12,
    "policySource": "extracted"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "purchase": {
    "id": "uuid",
    "merchant": "WOOLWORTHS",
    "date": "2025-01-15",
    "total": "152.50",
    "returnBy": "2025-02-14",
    "warrantyEnds": "2026-01-15",
    "category": "Shopping",
    "context": "personal"
  }
}
```

---

### Get All Receipts

```http
GET /api/purchases?category=Shopping&search=woolworths
```

**Query Parameters:**
- `category` (optional): Filter by category
- `search` (optional): Search merchant name

**Response (200):**
```json
{
  "purchases": [
    {
      "id": "uuid",
      "merchant": "WOOLWORTHS",
      "date": "2025-01-15",
      "total": "152.50",
      "returnBy": "2025-02-14",
      "warrantyEnds": "2026-01-15",
      "category": "Shopping",
      "ocrConfidence": "high",
      "vatAmount": "19.89",
      "returnPolicyDays": 30
    }
  ]
}
```

---

### Get Single Receipt

```http
GET /api/purchases/:id
```

**Response (200):**
```json
{
  "id": "uuid",
  "merchant": "WOOLWORTHS",
  "date": "2025-01-15",
  "total": "152.50",
  "returnBy": "2025-02-14",
  "warrantyEnds": "2026-01-15",
  "category": "Shopping",
  "invoiceNumber": "INV-123456",
  "vatAmount": "19.89",
  "subtotal": "132.61",
  "vatSource": "extracted",
  "returnPolicyDays": 30,
  "refundType": "full",
  "warrantyMonths": 12,
  "policySource": "extracted"
}
```

---

### Update Receipt Policies

```http
PATCH /api/receipts/:id/policies
Content-Type: application/json
```

**Request Body:**
```json
{
  "returnPolicyDays": 45,
  "refundType": "store_credit",
  "exchangePolicyDays": 30,
  "warrantyMonths": 24,
  "warrantyTerms": "Extended warranty",
  "policySource": "user_entered"
}
```

**Response (200):**
```json
{
  "success": true,
  "purchase": { ... }
}
```

---

### Delete Receipt

```http
DELETE /api/purchases/:id
```

**Response (200):**
```json
{ "success": true }
```

---

### Download PDF

```http
GET /api/purchases/:id/pdf
```

**Response (200):**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="receipt-WOOLWORTHS-2025-01-15.pdf"

[PDF binary data]
```

---

## Claim Endpoints

### Generate Claim

```http
POST /api/claims/create
Content-Type: application/json
```

**Request Body:**
```json
{
  "purchaseId": "uuid",
  "claimType": "return"
}
```

**Response (200):**
```json
{
  "claim": {
    "id": "uuid",
    "claimCode": "ABC123",
    "pin": "123456",
    "qrCode": "data:image/png;base64,...",
    "verificationUrl": "https://app.com/verify/ABC123",
    "expiresAt": "2025-04-15T12:00:00Z",
    "state": "issued",
    "originalAmount": "152.50",
    "merchantName": "WOOLWORTHS"
  }
}
```

---

### Get User Claims

```http
GET /api/claims
```

**Response (200):**
```json
{
  "claims": [
    {
      "id": "uuid",
      "claimCode": "ABC123",
      "state": "issued",
      "merchantName": "WOOLWORTHS",
      "originalAmount": "152.50",
      "expiresAt": "2025-04-15T12:00:00Z"
    }
  ]
}
```

---

### Verify Claim (Public)

```http
POST /api/claims/verify
Content-Type: application/json
```

**Request Body:**
```json
{
  "claimCode": "ABC123",
  "pin": "123456"
}
```

**Response (200):**
```json
{
  "valid": true,
  "claim": {
    "id": "uuid",
    "claimCode": "ABC123",
    "state": "issued",
    "merchantName": "WOOLWORTHS",
    "originalAmount": "152.50"
  },
  "purchase": {
    "merchant": "WOOLWORTHS",
    "date": "2025-01-15",
    "total": "152.50"
  }
}
```

---

### Redeem Claim

```http
POST /api/claims/redeem
Content-Type: application/json
```

**Request Body:**
```json
{
  "claimCode": "ABC123",
  "pin": "123456",
  "refundAmount": 152.50,
  "isPartial": false,
  "notes": "Customer satisfied"
}
```

**Response (200):**
```json
{
  "success": true,
  "claim": {
    "state": "redeemed",
    "redeemedAmount": "152.50",
    "redeemedAt": "2025-01-20T10:30:00Z"
  }
}
```

---

## Report Endpoints

### Personal Reports

```http
GET /api/reports/personal
```

**Response (200):**
```json
{
  "totalReceipts": 42,
  "totalSpent": 15250.00,
  "pendingReturns": 5,
  "activeWarranties": 12,
  "upcomingReturnDeadlines": [
    {
      "merchant": "WOOLWORTHS",
      "returnBy": "2025-01-25",
      "daysRemaining": 5
    }
  ],
  "expiringWarranties": [...],
  "spendingByCategory": [
    { "category": "Shopping", "total": 5000 },
    { "category": "Electronics", "total": 3500 }
  ],
  "monthlySpendingTrends": [...]
}
```

---

### Business Reports Summary

```http
GET /api/reports/summary?startDate=2025-01-01&endDate=2025-12-31
```

**Response (200):**
```json
{
  "summary": {
    "totalReceipts": 150,
    "totalSpent": "45000.00",
    "totalTax": "6750.00",
    "totalVat": "5869.57"
  },
  "byCategory": [
    { "category": "Office Supplies", "count": 45, "total": 12000 }
  ],
  "byMerchant": [
    { "merchant": "MAKRO", "count": 20, "total": 15000 }
  ],
  "byMonth": [
    { "month": "2025-01", "total": 8500, "vat": 1108.70 }
  ],
  "context": "business"
}
```

---

### Generate PDF Report

```http
GET /api/reports/pdf?startDate=2025-01-01&endDate=2025-12-31&includeTransactions=true
```

**Response (200):**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="slipsafe-report-2025.pdf"

[PDF binary data]
```

---

### Export CSV

```http
GET /api/reports/csv?startDate=2025-01-01&endDate=2025-12-31
```

**Response (200):**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="slipsafe-export-2025.csv"

merchant,date,total,vat,category
WOOLWORTHS,2025-01-15,152.50,19.89,Shopping
...
```

---

## Organization Endpoints

### Get Current Organization

```http
GET /api/organizations/current
```

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Acme Corp",
  "ownerId": "user-uuid",
  "planType": "business_pro",
  "memberCount": 5,
  "receiptCount": 450,
  "receiptLimit": 5000,
  "userLimit": 10
}
```

---

### Create Organization

```http
POST /api/organizations
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Acme Corp"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Acme Corp",
  "ownerId": "user-uuid"
}
```

---

### Invite Member

```http
POST /api/organizations/current/invitations
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "newmember@example.com",
  "role": "member"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "email": "newmember@example.com",
  "role": "member",
  "status": "pending",
  "expiresAt": "2025-01-22T12:00:00Z"
}
```

---

### Get Organization Members

```http
GET /api/organizations/current/members
```

**Response (200):**
```json
{
  "members": [
    {
      "id": "uuid",
      "userId": "user-uuid",
      "fullName": "John Doe",
      "email": "john@example.com",
      "role": "owner"
    }
  ],
  "invitations": [
    {
      "id": "uuid",
      "email": "newmember@example.com",
      "role": "member",
      "status": "pending"
    }
  ]
}
```

---

### Remove Member

```http
DELETE /api/organizations/current/members/:memberId
```

**Response (200):**
```json
{ "success": true }
```

---

### Cancel Invitation

```http
DELETE /api/organizations/current/invitations/:invitationId
```

**Response (200):**
```json
{ "success": true }
```

---

## Billing Endpoints

### Get Subscription

```http
GET /api/billing/subscription
```

**Response (200):**
```json
{
  "planType": "business_solo",
  "subscriptionStatus": "active",
  "billingInterval": "monthly",
  "currentPeriodEnd": "2025-02-15T00:00:00Z",
  "receiptLimit": 1000,
  "userLimit": 1
}
```

---

### Create Checkout Session

```http
POST /api/billing/create-checkout-session
Content-Type: application/json
```

**Request Body:**
```json
{
  "planId": "solo-monthly",
  "termsAccepted": true,
  "termsVersion": "v1.0"
}
```

**Response (200):**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

---

### Create Portal Session

```http
POST /api/billing/create-portal-session
```

**Response (200):**
```json
{
  "url": "https://billing.stripe.com/..."
}
```

---

### Stripe Webhook

```http
POST /api/billing/webhook
Content-Type: application/json
Stripe-Signature: <signature>
```

Handles subscription events from Stripe.

---

## Merchant Portal Endpoints

### Merchant Staff Login

```http
POST /api/merchant/login
Content-Type: application/json
```

**Request Body:**
```json
{
  "merchantId": "merchant-uuid",
  "email": "staff@store.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "staff": {
    "id": "staff-uuid",
    "email": "staff@store.com",
    "fullName": "Staff Member",
    "role": "staff"
  },
  "merchant": {
    "id": "merchant-uuid",
    "businessName": "My Store"
  }
}
```

---

### Verify Claim (Merchant)

```http
POST /api/merchant/verify
Content-Type: application/json
```

**Request Body:**
```json
{
  "claimCode": "ABC123",
  "pin": "123456"
}
```

**Response (200):**
```json
{
  "valid": true,
  "claim": { ... },
  "purchase": { ... }
}
```

---

### Process Claim

```http
POST /api/merchant/claims/:claimCode/process
Content-Type: application/json
```

**Request Body:**
```json
{
  "action": "full_refund",
  "notes": "Customer satisfied",
  "staffId": "staff-uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "claim": {
    "state": "redeemed"
  }
}
```

---

### Verification History

```http
GET /api/merchant/verifications?page=1&limit=20
```

**Response (200):**
```json
{
  "verifications": [
    {
      "id": "uuid",
      "claimCode": "ABC123",
      "result": "approved",
      "refundAmount": "152.50",
      "createdAt": "2025-01-20T10:30:00Z"
    }
  ],
  "total": 45,
  "page": 1,
  "pages": 3
}
```

---

## Settings Endpoints

### Get Settings

```http
GET /api/settings
```

**Response (200):**
```json
{
  "theme": "light",
  "notifyReturnDeadline": true,
  "notifyWarrantyExpiry": true,
  "returnAlertDays": 7,
  "warrantyAlertDays": 30
}
```

---

### Update Settings

```http
PATCH /api/settings
Content-Type: application/json
```

**Request Body:**
```json
{
  "theme": "dark",
  "returnAlertDays": 14
}
```

---

### Get Merchant Rules

```http
GET /api/merchant-rules
```

**Response (200):**
```json
{
  "rules": [
    {
      "id": "uuid",
      "merchantName": "WOOLWORTHS",
      "returnPolicyDays": 30,
      "warrantyMonths": 12
    }
  ]
}
```

---

### Create Merchant Rule

```http
POST /api/merchant-rules
Content-Type: application/json
```

**Request Body:**
```json
{
  "merchantName": "WOOLWORTHS",
  "returnPolicyDays": 30,
  "warrantyMonths": 12
}
```

---

### Update Merchant Rule

```http
PATCH /api/merchant-rules/:id
Content-Type: application/json
```

---

### Delete Merchant Rule

```http
DELETE /api/merchant-rules/:id
```

---

## Admin Endpoints

### Admin Login

```http
POST /api/admin/login
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin_password"
}
```

---

### Get System Stats

```http
GET /api/admin/stats
```

**Response (200):**
```json
{
  "totalUsers": 1500,
  "totalReceipts": 25000,
  "totalClaims": 800,
  "activeSubscriptions": 120
}
```

---

### Get Activity Log

```http
GET /api/admin/activity?page=1&limit=50
```

---

## USSD Endpoint

```http
POST /api/ussd
Content-Type: application/json
```

**Request Body:**
```json
{
  "sessionId": "session-123",
  "phoneNumber": "+27123456789",
  "text": "1*2"
}
```

**Response (200):**
```json
{
  "response": "CON Your receipts:\n1. Woolworths - R152.50\n2. Pick n Pay - R89.00"
}
```

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "error": "Error message here",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Not logged in |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid request data |
| RATE_LIMITED | 429 | Too many requests |
| SERVER_ERROR | 500 | Internal server error |

---

## Rate Limiting

- Login attempts: 5 per 15 minutes per IP
- Password reset: 3 per 15 minutes per account
- API general: 100 requests per minute

---

*SlipSafe API v1.0*
