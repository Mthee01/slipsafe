import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, numeric, boolean, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const ACCOUNT_TYPES = ["individual", "business"] as const;
export type AccountType = typeof ACCOUNT_TYPES[number];

export const USER_ROLES = ["user", "admin", "support", "merchant_admin", "merchant_staff"] as const;
export type UserRole = typeof USER_ROLES[number];

export const PLAN_TYPES = ["free", "business_solo", "business_pro", "enterprise"] as const;
export type PlanType = typeof PLAN_TYPES[number];

export const BILLING_INTERVALS = ["monthly", "annual"] as const;
export type BillingInterval = typeof BILLING_INTERVALS[number];

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  fullName: text("full_name").notNull(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  phone: text("phone"),
  homeAddress: text("home_address"),
  idNumber: text("id_number"),
  profilePicture: text("profile_picture"),
  accountType: text("account_type").notNull().default("individual"),
  activeContext: text("active_context").notNull().default("personal"),
  activeOrganizationId: varchar("active_organization_id"),
  role: text("role").notNull().default("user"),
  merchantId: varchar("merchant_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planType: text("plan_type").notNull().default("free"),
  billingInterval: text("billing_interval"),
  subscriptionStatus: text("subscription_status"),
  businessReceiptLimitPerMonth: integer("business_receipt_limit_per_month"),
  businessUserLimit: integer("business_user_limit"),
  subscriptionCurrentPeriodEnd: timestamp("subscription_current_period_end"),
  termsVersionAccepted: text("terms_version_accepted"),
  termsAcceptedAt: timestamp("terms_accepted_at"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  fullName: true,
  password: true,
  email: true,
  phone: true,
  homeAddress: true,
  idNumber: true,
  accountType: true,
}).extend({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Phone number is required"),
});

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\.]/g, "");
}

export const registerSchema = z.object({
  username: z.string().min(1, "Username is required"),
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  accountType: z.enum(ACCOUNT_TYPES),
  idNumber: z.string().optional(),
  homeAddress: z.string().optional(),
  businessName: z.string().optional(),
  taxId: z.string().optional(),
  vatNumber: z.string().optional(),
  registrationNumber: z.string().optional(),
  businessAddress: z.string().optional(),
  businessPhone: z.string().optional(),
  businessEmail: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.accountType === "business") {
    if (!data.businessName || data.businessName.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Business name is required for business accounts",
        path: ["businessName"],
      });
    }
    if (!data.taxId || data.taxId.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tax ID is required for business accounts",
        path: ["taxId"],
      });
    }
  }
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const updateUserProfileSchema = createInsertSchema(users).pick({
  email: true,
  phone: true,
  homeAddress: true,
  idNumber: true,
  profilePicture: true,
}).partial();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;
export type ChangePassword = z.infer<typeof changePasswordSchema>;
export type User = typeof users.$inferSelect;

export const businessProfiles = pgTable("business_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  businessName: text("business_name").notNull(),
  taxId: text("tax_id"),
  vatNumber: text("vat_number"),
  registrationNumber: text("registration_number"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  nextInvoiceNumber: numeric("next_invoice_number").notNull().default("1"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBusinessProfileSchema = createInsertSchema(businessProfiles).omit({
  id: true,
  createdAt: true,
  nextInvoiceNumber: true,
});

export const updateBusinessProfileSchema = createInsertSchema(businessProfiles).omit({
  id: true,
  userId: true,
  createdAt: true,
}).partial();

export type InsertBusinessProfile = z.infer<typeof insertBusinessProfileSchema>;
export type UpdateBusinessProfile = z.infer<typeof updateBusinessProfileSchema>;
export type BusinessProfile = typeof businessProfiles.$inferSelect;

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  taxId: text("tax_id"),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export const updateClientSchema = createInsertSchema(clients).omit({
  id: true,
  userId: true,
  createdAt: true,
}).partial();

export type InsertClient = z.infer<typeof insertClientSchema>;
export type UpdateClient = z.infer<typeof updateClientSchema>;
export type Client = typeof clients.$inferSelect;

export const CATEGORIES = ["Electronics", "Clothing", "Home", "Auto", "Other"] as const;
export type Category = typeof CATEGORIES[number];

export const BUSINESS_CATEGORIES = [
  "Office Supplies",
  "Equipment",
  "Travel",
  "Utilities",
  "Rent",
  "Insurance",
  "Professional Services",
  "Marketing",
  "Inventory",
  "Other"
] as const;
export type BusinessCategory = typeof BUSINESS_CATEGORIES[number];

export const CONTEXTS = ["personal", "business"] as const;
export type Context = typeof CONTEXTS[number];

export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number];

export const SOURCE_TYPES = ["camera", "upload", "email_paste"] as const;
export type SourceType = typeof SOURCE_TYPES[number];

export const REFUND_TYPES = ["not_specified", "full", "store_credit", "exchange_only", "partial", "none"] as const;
export type RefundType = typeof REFUND_TYPES[number];

export const POLICY_SOURCES = ["extracted", "user_entered", "merchant_default"] as const;
export type PolicySource = typeof POLICY_SOURCES[number];

export const purchases = pgTable("purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  organizationId: varchar("organization_id"),
  hash: text("hash").notNull(),
  merchant: text("merchant").notNull(),
  date: text("date").notNull(),
  total: numeric("total").notNull(),
  returnBy: text("return_by"),
  warrantyEnds: text("warranty_ends"),
  category: text("category").notNull().default("Other"),
  imagePath: text("image_path"),
  ocrConfidence: text("ocr_confidence").notNull().default("low"),
  sourceType: text("source_type").notNull().default("upload"),
  context: text("context").notNull().default("personal"),
  clientId: varchar("client_id"),
  invoiceNumber: text("invoice_number"),
  taxAmount: numeric("tax_amount"),
  vatAmount: numeric("vat_amount"),
  notes: text("notes"),
  // Policy fields - extracted from receipt or user-entered
  returnPolicyDays: integer("return_policy_days"),
  returnPolicyTerms: text("return_policy_terms"),
  refundType: text("refund_type"),
  exchangePolicyDays: integer("exchange_policy_days"),
  exchangePolicyTerms: text("exchange_policy_terms"),
  warrantyMonths: integer("warranty_months"),
  warrantyTerms: text("warranty_terms"),
  policySource: text("policy_source").default("merchant_default"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userHashUnique: unique().on(table.userId, table.hash),
}));

export const insertPurchaseSchema = createInsertSchema(purchases).omit({
  id: true,
  createdAt: true,
});

export const updatePurchasePoliciesSchema = z.object({
  returnPolicyDays: z.number().int().min(0).max(365).nullable().optional(),
  returnPolicyTerms: z.string().max(500).nullable().optional(),
  refundType: z.enum(REFUND_TYPES).nullable().optional(),
  exchangePolicyDays: z.number().int().min(0).max(365).nullable().optional(),
  exchangePolicyTerms: z.string().max(500).nullable().optional(),
  warrantyMonths: z.number().int().min(0).max(120).nullable().optional(),
  warrantyTerms: z.string().max(500).nullable().optional(),
  policySource: z.enum(POLICY_SOURCES).optional(),
});

export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type UpdatePurchasePolicies = z.infer<typeof updatePurchasePoliciesSchema>;
export type Purchase = typeof purchases.$inferSelect;

export const merchantRules = pgTable("merchant_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  merchantName: text("merchant_name").notNull(),
  normalizedMerchantName: text("normalized_merchant_name").notNull(),
  returnPolicyDays: integer("return_policy_days").notNull().default(30),
  warrantyMonths: integer("warranty_months").notNull().default(12),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userMerchantUnique: unique().on(table.userId, table.normalizedMerchantName),
}));

export const insertMerchantRuleSchema = createInsertSchema(merchantRules).omit({
  id: true,
  normalizedMerchantName: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  returnPolicyDays: z.number().int().min(0, "Return policy days must be 0 or greater"),
  warrantyMonths: z.number().int().min(0, "Warranty months must be 0 or greater"),
});

export const updateMerchantRuleSchema = z.preprocess(
  (data: any) => {
    // Guard against non-object payloads
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return {};
    }
    
    // Convert null values to undefined and trim strings
    const cleaned: any = {};
    
    for (const key in data) {
      if (data[key] === null) {
        cleaned[key] = undefined;
      } else if (typeof data[key] === 'string') {
        const trimmed = data[key].trim();
        cleaned[key] = trimmed === '' ? undefined : trimmed;
      } else {
        cleaned[key] = data[key];
      }
    }
    return cleaned;
  },
  z.object({
    merchantName: z.string().min(1, "Merchant name cannot be empty").optional(),
    returnPolicyDays: z.coerce.number().int().min(0, "Return policy days must be 0 or greater").optional(),
    warrantyMonths: z.coerce.number().int().min(0, "Warranty months must be 0 or greater").optional(),
  }).refine(
    (data) => Object.values(data).some(value => value !== undefined),
    { message: "At least one field must be provided for update" }
  )
);

export type InsertMerchantRule = z.infer<typeof insertMerchantRuleSchema>;
export type UpdateMerchantRule = z.infer<typeof updateMerchantRuleSchema>;
export type MerchantRule = typeof merchantRules.$inferSelect;

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  theme: text("theme").notNull().default("light"),
  notifyReturnDeadline: boolean("notify_return_deadline").notNull().default(true),
  notifyWarrantyExpiry: boolean("notify_warranty_expiry").notNull().default(true),
  returnAlertDays: numeric("return_alert_days").notNull().default("7"),
  warrantyAlertDays: numeric("warranty_alert_days").notNull().default("30"),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const forgotUsernameSchema = z.object({
  recoveryMethod: z.enum(["email", "phone"]),
  email: z.string().email("Please enter a valid email address").optional(),
  phone: z.string().min(10, "Please enter a valid phone number").optional(),
}).refine((data) => {
  if (data.recoveryMethod === "email") {
    return !!data.email && data.email.length > 0;
  }
  if (data.recoveryMethod === "phone") {
    return !!data.phone && data.phone.length >= 10;
  }
  return false;
}, {
  message: "Please enter your email address or phone number",
  path: ["email"],
});

export const forgotPasswordSchema = z.object({
  recoveryMethod: z.enum(["email", "phone"]),
  usernameOrEmail: z.string().min(1, "Please enter your username or email").optional(),
  usernameOrPhone: z.string().min(1, "Please enter your username or phone").optional(),
}).refine((data) => {
  if (data.recoveryMethod === "email") {
    return !!data.usernameOrEmail && data.usernameOrEmail.length > 0;
  }
  if (data.recoveryMethod === "phone") {
    return !!data.usernameOrPhone && data.usernameOrPhone.length > 0;
  }
  return false;
}, {
  message: "Please enter your username or contact information",
  path: ["usernameOrEmail"],
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type ForgotUsername = z.infer<typeof forgotUsernameSchema>;
export type ForgotPassword = z.infer<typeof forgotPasswordSchema>;
export type ResetPassword = z.infer<typeof resetPasswordSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;

export const ACTIVITY_TYPES = [
  "login",
  "logout",
  "register",
  "email_verified",
  "receipt_upload",
  "claim_create",
  "claim_verify",
  "context_switch",
  "profile_update",
  "password_change",
  "business_profile_update",
  "report_generated",
  "admin_role_change",
] as const;
export type ActivityType = typeof ACTIVITY_TYPES[number];

export const userActivity = pgTable("user_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  action: text("action").notNull(),
  metadata: text("metadata"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserActivitySchema = createInsertSchema(userActivity).omit({
  id: true,
  createdAt: true,
});

export type InsertUserActivity = z.infer<typeof insertUserActivitySchema>;
export type UserActivity = typeof userActivity.$inferSelect;

// ============================================
// MERCHANT VERIFICATION SYSTEM
// ============================================

export const CLAIM_STATES = ["issued", "pending", "redeemed", "partial", "refused", "expired"] as const;
export type ClaimState = typeof CLAIM_STATES[number];

export const MERCHANT_USER_ROLES = ["owner", "manager", "staff"] as const;
export type MerchantUserRole = typeof MERCHANT_USER_ROLES[number];

export const VERIFICATION_RESULTS = ["approved", "partial_approved", "rejected", "fraud_suspected"] as const;
export type VerificationResult = typeof VERIFICATION_RESULTS[number];

// Registered merchant businesses that can verify claims
export const merchants = pgTable("merchants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessName: text("business_name").notNull(),
  registrationNumber: text("registration_number"),
  taxId: text("tax_id"),
  email: text("email").notNull(),
  phone: text("phone"),
  address: text("address"),
  apiKey: text("api_key").notNull().unique(),
  apiKeyHash: text("api_key_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  returnPolicyDays: integer("return_policy_days").notNull().default(30),
  warrantyMonths: integer("warranty_months").notNull().default(12),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMerchantSchema = createInsertSchema(merchants).omit({
  id: true,
  apiKey: true,
  apiKeyHash: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  businessName: z.string().min(1, "Business name is required"),
  email: z.string().email("Please enter a valid email address"),
});

export type InsertMerchant = z.infer<typeof insertMerchantSchema>;
export type Merchant = typeof merchants.$inferSelect;

// Staff members who can verify claims at merchant locations
export const merchantUsers = pgTable("merchant_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").notNull(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("staff"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  emailMerchantUnique: unique().on(table.merchantId, table.email),
}));

export const insertMerchantUserSchema = createInsertSchema(merchantUsers).omit({
  id: true,
  lastLoginAt: true,
  createdAt: true,
}).extend({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const merchantLoginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  merchantId: z.string().min(1, "Merchant ID is required"),
});

export type InsertMerchantUser = z.infer<typeof insertMerchantUserSchema>;
export type MerchantLogin = z.infer<typeof merchantLoginSchema>;
export type MerchantUser = typeof merchantUsers.$inferSelect;

// Claims generated from purchases - tracks state for single-use enforcement
export const claims = pgTable("claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseId: varchar("purchase_id").notNull(),
  userId: varchar("user_id").notNull(),
  claimCode: text("claim_code").notNull().unique(),
  pin: text("pin").notNull(),
  state: text("state").notNull().default("issued"),
  claimType: text("claim_type").notNull().default("return"),
  originalAmount: numeric("original_amount").notNull(),
  redeemedAmount: numeric("redeemed_amount"),
  merchantName: text("merchant_name").notNull(),
  purchaseDate: text("purchase_date").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  redeemedAt: timestamp("redeemed_at"),
  redeemedByMerchantId: varchar("redeemed_by_merchant_id"),
  redeemedByUserId: varchar("redeemed_by_user_id"),
  qrCodeData: text("qr_code_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClaimSchema = createInsertSchema(claims).omit({
  id: true,
  claimCode: true,
  pin: true,
  state: true,
  redeemedAmount: true,
  redeemedAt: true,
  redeemedByMerchantId: true,
  redeemedByUserId: true,
  qrCodeData: true,
  createdAt: true,
});

export const createClaimSchema = z.object({
  purchaseId: z.string().min(1, "Purchase ID is required"),
  claimType: z.enum(["return", "warranty", "exchange"]).default("return"),
});

export type InsertClaim = z.infer<typeof insertClaimSchema>;
export type CreateClaim = z.infer<typeof createClaimSchema>;
export type Claim = typeof claims.$inferSelect;

// Audit log of all verification attempts
export const claimVerifications = pgTable("claim_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  claimId: varchar("claim_id").notNull(),
  merchantId: varchar("merchant_id"),
  merchantUserId: varchar("merchant_user_id"),
  result: text("result").notNull(),
  attemptedPin: text("attempted_pin"),
  pinCorrect: boolean("pin_correct"),
  refundAmount: numeric("refund_amount"),
  notes: text("notes"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClaimVerificationSchema = createInsertSchema(claimVerifications).omit({
  id: true,
  createdAt: true,
});

export const verifyClaimSchema = z.object({
  claimCode: z.string().min(1, "Claim code is required"),
  pin: z.string().length(6, "PIN must be 6 digits"),
});

export const redeemClaimSchema = z.object({
  claimCode: z.string().min(1, "Claim code is required"),
  pin: z.string().length(6, "PIN must be 6 digits"),
  refundAmount: z.number().positive("Refund amount must be positive").optional(),
  isPartial: z.boolean().default(false),
  notes: z.string().optional(),
});

export type InsertClaimVerification = z.infer<typeof insertClaimVerificationSchema>;
export type VerifyClaim = z.infer<typeof verifyClaimSchema>;
export type RedeemClaim = z.infer<typeof redeemClaimSchema>;
export type ClaimVerification = typeof claimVerifications.$inferSelect;

// Fraud detection events
export const fraudEvents = pgTable("fraud_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  claimId: varchar("claim_id"),
  purchaseId: varchar("purchase_id"),
  userId: varchar("user_id"),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull().default("low"),
  description: text("description").notNull(),
  metadata: text("metadata"),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const FRAUD_EVENT_TYPES = [
  "duplicate_claim_attempt",
  "expired_claim_use",
  "invalid_pin_attempts",
  "cross_merchant_claim",
  "suspicious_pattern",
] as const;
export type FraudEventType = typeof FRAUD_EVENT_TYPES[number];

export const insertFraudEventSchema = createInsertSchema(fraudEvents).omit({
  id: true,
  resolved: true,
  resolvedAt: true,
  resolvedBy: true,
  createdAt: true,
});

export type InsertFraudEvent = z.infer<typeof insertFraudEventSchema>;
export type FraudEvent = typeof fraudEvents.$inferSelect;

// ============================================
// ORGANIZATION / TEAM MANAGEMENT
// ============================================

export const ORG_MEMBER_ROLES = ["owner", "admin", "member"] as const;
export type OrgMemberRole = typeof ORG_MEMBER_ROLES[number];

export const BILLING_STATUSES = ["active", "past_due", "canceled", "trialing"] as const;
export type BillingStatus = typeof BILLING_STATUSES[number];

export const PLAN_CODES = ["BUSINESS_SOLO", "BUSINESS_PRO", "BUSINESS_ENTERPRISE"] as const;
export type PlanCode = typeof PLAN_CODES[number];

// Subscription plan definitions with limits
export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  maxUsers: integer("max_users"),
  maxReceiptsPerMonth: integer("max_receipts_per_month"),
  priceMonthly: integer("price_monthly"),
  priceAnnual: integer("price_annual"),
  description: text("description"),
  features: text("features"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
});

export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

// Organizations (business accounts with multiple team members)
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  ownerUserId: varchar("owner_user_id").notNull(),
  planId: varchar("plan_id"),
  planCode: varchar("plan_code", { length: 50 }).notNull().default("BUSINESS_SOLO"),
  vatNumber: varchar("vat_number", { length: 50 }),
  taxId: varchar("tax_id", { length: 50 }),
  registrationNumber: varchar("registration_number", { length: 50 }),
  billingEmail: varchar("billing_email", { length: 255 }).notNull(),
  billingStatus: varchar("billing_status", { length: 20 }).notNull().default("active"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 100 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 100 }),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Organization name is required"),
  billingEmail: z.string().email("Valid billing email is required"),
});

export const updateOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  ownerUserId: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

// Organization members (links users to organizations with roles)
export const organizationMembers = pgTable("organization_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  userId: varchar("user_id").notNull(),
  role: varchar("role", { length: 20 }).notNull().default("member"),
  invitedBy: varchar("invited_by"),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  orgUserUnique: unique().on(table.organizationId, table.userId),
}));

export const insertOrganizationMemberSchema = createInsertSchema(organizationMembers).omit({
  id: true,
  invitedAt: true,
  acceptedAt: true,
  createdAt: true,
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Valid email is required"),
  role: z.enum(ORG_MEMBER_ROLES).default("member"),
});

export type InsertOrganizationMember = z.infer<typeof insertOrganizationMemberSchema>;
export type InviteMember = z.infer<typeof inviteMemberSchema>;
export type OrganizationMember = typeof organizationMembers.$inferSelect;

// Organization invitations (for pending invites)
export const organizationInvitations = pgTable("organization_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("member"),
  token: varchar("token", { length: 100 }).notNull().unique(),
  invitedBy: varchar("invited_by").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrganizationInvitationSchema = createInsertSchema(organizationInvitations).omit({
  id: true,
  token: true,
  expiresAt: true,
  acceptedAt: true,
  createdAt: true,
});

export type InsertOrganizationInvitation = z.infer<typeof insertOrganizationInvitationSchema>;
export type OrganizationInvitation = typeof organizationInvitations.$inferSelect;

// Plan change request schema
export const changePlanSchema = z.object({
  planCode: z.enum(PLAN_CODES),
});

export type ChangePlanRequest = z.infer<typeof changePlanSchema>;

// Plan limit check types
export const PLAN_LIMIT_TYPES = ["members", "receipts"] as const;
export type PlanLimitType = typeof PLAN_LIMIT_TYPES[number];

export interface PlanLimitResult {
  ok: boolean;
  reason?: "max_users_reached" | "max_receipts_reached";
  message?: string;
  currentCount?: number;
  maxAllowed?: number | null;
  recommendation?: {
    recommendedPlanCode: PlanCode;
    recommendedPlanName: string;
    reason: string;
  };
}

// Helper to get plan limits by code
export function getPlanLimitsByCode(planCode: PlanCode): { maxUsers: number | null; maxReceiptsPerMonth: number | null; name: string } {
  switch (planCode) {
    case "BUSINESS_SOLO":
      return { maxUsers: 1, maxReceiptsPerMonth: 1000, name: "Business 1 (Solo)" };
    case "BUSINESS_PRO":
      return { maxUsers: 10, maxReceiptsPerMonth: 5000, name: "Business Team (Pro)" };
    case "BUSINESS_ENTERPRISE":
      return { maxUsers: null, maxReceiptsPerMonth: null, name: "Enterprise" };
  }
}

// Billing schemas
export const PLAN_IDS = ["solo-monthly", "solo-annual", "pro-monthly", "pro-annual"] as const;
export type PlanId = typeof PLAN_IDS[number];

export const createCheckoutSessionSchema = z.object({
  planId: z.enum(PLAN_IDS),
  termsAccepted: z.boolean(),
  termsVersion: z.string(),
});

export type CreateCheckoutSession = z.infer<typeof createCheckoutSessionSchema>;

export function getPlanDetails(planId: PlanId): { 
  planType: PlanType; 
  billingInterval: BillingInterval;
  receiptLimit: number;
  userLimit: number;
  priceMonthly: number;
  priceDisplay: string;
} {
  switch (planId) {
    case "solo-monthly":
      return { 
        planType: "business_solo", 
        billingInterval: "monthly",
        receiptLimit: 1000,
        userLimit: 1,
        priceMonthly: 99,
        priceDisplay: "R99/month"
      };
    case "solo-annual":
      return { 
        planType: "business_solo", 
        billingInterval: "annual",
        receiptLimit: 1000,
        userLimit: 1,
        priceMonthly: 80,
        priceDisplay: "R80/month (billed annually)"
      };
    case "pro-monthly":
      return { 
        planType: "business_pro", 
        billingInterval: "monthly",
        receiptLimit: 5000,
        userLimit: 10,
        priceMonthly: 269,
        priceDisplay: "R269/month"
      };
    case "pro-annual":
      return { 
        planType: "business_pro", 
        billingInterval: "annual",
        receiptLimit: 5000,
        userLimit: 10,
        priceMonthly: 229,
        priceDisplay: "R229/month (billed annually)"
      };
  }
}
