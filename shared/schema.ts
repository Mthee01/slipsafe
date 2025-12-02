import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, numeric, boolean, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const ACCOUNT_TYPES = ["individual", "business"] as const;
export type AccountType = typeof ACCOUNT_TYPES[number];

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = typeof USER_ROLES[number];

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
  role: text("role").notNull().default("user"),
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

export const REFUND_TYPES = ["full", "store_credit", "exchange_only", "partial", "none"] as const;
export type RefundType = typeof REFUND_TYPES[number];

export const POLICY_SOURCES = ["extracted", "user_entered", "merchant_default"] as const;
export type PolicySource = typeof POLICY_SOURCES[number];

export const purchases = pgTable("purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  hash: text("hash").notNull().unique(),
  merchant: text("merchant").notNull(),
  date: text("date").notNull(),
  total: numeric("total").notNull(),
  returnBy: text("return_by").notNull(),
  warrantyEnds: text("warranty_ends").notNull(),
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
});

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
