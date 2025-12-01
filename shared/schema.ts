import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, numeric, boolean, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const ACCOUNT_TYPES = ["individual", "business"] as const;
export type AccountType = typeof ACCOUNT_TYPES[number];

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  phone: text("phone"),
  homeAddress: text("home_address"),
  idNumber: text("id_number"),
  profilePicture: text("profile_picture"),
  accountType: text("account_type").notNull().default("individual"),
  activeContext: text("active_context").notNull().default("personal"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  phone: true,
  homeAddress: true,
  idNumber: true,
  accountType: true,
});

export const registerSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional(),
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
  context: text("context").notNull().default("personal"),
  clientId: varchar("client_id"),
  invoiceNumber: text("invoice_number"),
  taxAmount: numeric("tax_amount"),
  vatAmount: numeric("vat_amount"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPurchaseSchema = createInsertSchema(purchases).omit({
  id: true,
  createdAt: true,
});

export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
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
  email: z.string().email("Please enter a valid email address"),
});

export const forgotPasswordSchema = z.object({
  usernameOrEmail: z.string().min(1, "Please enter your username or email"),
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
