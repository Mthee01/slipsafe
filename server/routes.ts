import type { Express, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import QRCode from "qrcode";
import { createHash } from "crypto";
import jwt from "jsonwebtoken";
import passport from "./auth";
import { hashPassword, isAuthenticated, getCurrentUserId } from "./auth";
import { storage } from "./storage";
import { insertPurchaseSchema, insertSettingsSchema, insertUserSchema, updateUserProfileSchema, updateBusinessProfileSchema, changePasswordSchema, forgotUsernameSchema, forgotPasswordSchema, resetPasswordSchema, registerSchema, CATEGORIES, insertMerchantRuleSchema, updateMerchantRuleSchema, type ActivityType, insertMerchantSchema, insertMerchantUserSchema, merchantLoginSchema, createClaimSchema, verifyClaimSchema, redeemClaimSchema, updatePurchasePoliciesSchema } from "@shared/schema";
import { comparePassword } from "./auth";
import { randomBytes } from "crypto";
import { processReceipt } from "./lib/ocr";
import { generateReceiptPDF, generateExpenseReportPDF } from "./lib/pdf";
import { readFile } from "fs/promises";
import path from "path";
import { sendEmail, generatePasswordResetEmail, generateUsernameRecoveryEmail, generateEmailVerificationEmail, generateWelcomeEmail } from "./lib/email";

async function logUserActivity(
  userId: string, 
  action: ActivityType, 
  metadata?: Record<string, any>,
  req?: Request
) {
  try {
    await storage.logActivity({
      userId,
      action,
      metadata: metadata ? JSON.stringify(metadata) : null,
      ipAddress: req?.ip || req?.socket?.remoteAddress || null,
      userAgent: req?.headers?.["user-agent"] || null,
    });
  } catch (error) {
    console.error(`[Activity Log] Failed to log activity "${action}" for user ${userId}:`, error);
  }
}

const upload = multer({ dest: "uploads/" });
const JWT_SECRET = process.env.JWT_SECRET || "slipsafe_dev_secret";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// In-memory cache for OCR preview data (keyed by userId)
interface PolicyPreview {
  returnPolicyDays: number | null;
  returnPolicyTerms: string | null;
  refundType: 'not_specified' | 'full' | 'store_credit' | 'exchange_only' | 'partial' | 'none' | null;
  exchangePolicyDays: number | null;
  exchangePolicyTerms: string | null;
  warrantyMonths: number | null;
  warrantyTerms: string | null;
  policySource: 'extracted' | 'user_entered' | 'merchant_default';
}

interface PreviewData {
  merchant: string;
  date: string;
  total: string;
  returnBy: string;
  warrantyEnds: string;
  confidence: 'low' | 'medium' | 'high' | number;
  rawText: string;
  imagePath: string | null;
  sourceType: 'camera' | 'upload' | 'email_paste';
  policies: PolicyPreview;
  vatAmount: number | null;
  vatSource: 'extracted' | 'calculated' | 'none';
  invoiceNumber: string | null;
  timestamp: number;
}
const ocrPreviewCache = new Map<string, PreviewData>();

// Clean up old preview cache entries (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [userId, data] of Array.from(ocrPreviewCache.entries())) {
    if (data.timestamp < oneHourAgo) {
      ocrPreviewCache.delete(userId);
    }
  }
}, 10 * 60 * 1000); // Run every 10 minutes

function rateLimit(identifier: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);
  
  if (!record || now > record.resetAt) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (record.count >= maxAttempts) {
    return false;
  }
  
  record.count++;
  return true;
}

function generateResetToken(): string {
  return randomBytes(32).toString('hex');
}

function generateHash(merchant: string, date: string, total: string): string {
  const data = `${merchant}|${date}|${total}`;
  return createHash("sha256").update(data).digest("hex");
}

function generatePIN(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isValidDate(year: number, month: number, day: number): boolean {
  // Check basic ranges
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  
  // Check month-specific day limits
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  
  // Check for leap year
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  if (month === 2 && isLeapYear) {
    daysInMonth[1] = 29;
  }
  
  return day <= daysInMonth[month - 1];
}

function parseDateToISO(dateString: string | null): string {
  if (!dateString) {
    console.warn('[Date Parser] No date provided, using current date');
    return new Date().toISOString().split('T')[0];
  }

  // Clean input: remove ordinal suffixes and trailing punctuation
  const cleaned = dateString.trim().replace(/(\d+)(st|nd|rd|th)/gi, '$1').replace(/[.,;]+$/, '');
  
  if (cleaned !== dateString.trim()) {
    console.log(`[Date Parser] Cleaned input: "${dateString}" -> "${cleaned}"`);
  }

  // Try YYYY-MM-DD format (ISO)
  const isoMatch = cleaned.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1]);
    const month = parseInt(isoMatch[2]);
    const day = parseInt(isoMatch[3]);
    
    if (isValidDate(year, month, day)) {
      const result = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      console.log(`[Date Parser] Successfully parsed ISO format: "${dateString}" -> ${result}`);
      return result;
    } else {
      console.warn(`[Date Parser] Invalid date values in ISO format: "${dateString}" (Y:${year}, M:${month}, D:${day}) - trying other formats`);
    }
  }

  // Try DD/MM/YYYY or MM/DD/YYYY format
  const slashMatch = cleaned.match(/^(\d{1,2})([-\/\.])(\d{1,2})\2(\d{2,4})$/);
  if (slashMatch) {
    let first = parseInt(slashMatch[1]);
    const separator = slashMatch[2];
    let second = parseInt(slashMatch[3]);
    let year = parseInt(slashMatch[4]);
    
    // Handle 2-digit years (00-99 -> 2000-2099)
    if (year < 100) {
      year += 2000;
    }
    
    let day: number, month: number;
    let formatAssumption = '';
    
    // Hyphen separator: try MM-DD-YYYY first (US standard), then DD-MM-YYYY
    // Slash/dot separator: use disambiguation logic
    if (separator === '-') {
      // Try MM-DD-YYYY (US standard with hyphens)
      month = first;
      day = second;
      formatAssumption = 'MM-DD-YYYY';
      
      // If validation fails, try DD-MM-YYYY interpretation
      if (!isValidDate(year, month, day)) {
        day = first;
        month = second;
        formatAssumption = 'DD-MM-YYYY (fallback)';
      }
    } else if (first > 12 && second <= 12) {
      // first is definitely day, second is month (DD/MM/YYYY)
      day = first;
      month = second;
      formatAssumption = 'DD/MM/YYYY (day>12)';
    } else if (second > 12 && first <= 12) {
      // second is day, first is month (MM/DD/YYYY)
      day = second;
      month = first;
      formatAssumption = 'MM/DD/YYYY (day>12)';
    } else {
      // Ambiguous, assume DD/MM/YYYY (international standard)
      day = first;
      month = second;
      formatAssumption = 'DD/MM/YYYY (ambiguous)';
    }
    
    if (isValidDate(year, month, day)) {
      const result = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      console.log(`[Date Parser] Successfully parsed ${separator}-delimited format (${formatAssumption}): "${dateString}" -> ${result}`);
      return result;
    } else {
      console.warn(`[Date Parser] Invalid date values (${separator}-delimited, tried ${formatAssumption}): "${dateString}" parsed as Y:${year}, M:${month}, D:${day} - trying other formats`);
    }
  }

  // Try month name formats
  const monthNames: { [key: string]: number } = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, september: 9, sept: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12
  };

  // Format: "25 Dec 2024" or "25 December 2024"
  const dayMonthYearMatch = cleaned.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{2,4})$/i);
  if (dayMonthYearMatch) {
    const day = parseInt(dayMonthYearMatch[1]);
    const monthName = dayMonthYearMatch[2].toLowerCase();
    let year = parseInt(dayMonthYearMatch[3]);
    
    if (year < 100) year += 2000;
    
    const month = monthNames[monthName];
    if (month && isValidDate(year, month, day)) {
      const result = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      console.log(`[Date Parser] Successfully parsed day-month-year format: "${dateString}" -> ${result}`);
      return result;
    } else if (month) {
      console.warn(`[Date Parser] Invalid date values in day-month-year format: "${dateString}" (Y:${year}, M:${month}, D:${day}) - trying other formats`);
    }
  }

  // Format: "Dec 25, 2024" or "December 25, 2024"
  const monthDayYearMatch = cleaned.match(/^([a-z]+)\s+(\d{1,2}),?\s+(\d{2,4})$/i);
  if (monthDayYearMatch) {
    const monthName = monthDayYearMatch[1].toLowerCase();
    const day = parseInt(monthDayYearMatch[2]);
    let year = parseInt(monthDayYearMatch[3]);
    
    if (year < 100) year += 2000;
    
    const month = monthNames[monthName];
    if (month && isValidDate(year, month, day)) {
      const result = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      console.log(`[Date Parser] Successfully parsed month-day-year format: "${dateString}" -> ${result}`);
      return result;
    } else if (month) {
      console.warn(`[Date Parser] Invalid date values in month-day-year format: "${dateString}" (Y:${year}, M:${month}, D:${day}) - trying other formats`);
    }
  }

  // If none of the formats match or all validations failed, fall back to today's date
  const fallback = new Date().toISOString().split('T')[0];
  console.warn(`[Date Parser] Could not parse date: "${dateString}" - falling back to current date: ${fallback}`);
  return fallback;
}

async function computeDeadlines(purchaseDate: string, userId: string, merchantName: string) {
  const date = new Date(purchaseDate);
  
  // Default values
  let returnPolicyDays = 30;
  let warrantyMonths = 12;
  
  // Look up merchant-specific rules
  const merchantRule = await storage.getMerchantRule(userId, merchantName);
  if (merchantRule) {
    console.log(`[Deadlines] Applying custom rules for merchant "${merchantName}": returnDays=${merchantRule.returnPolicyDays}, warrantyMonths=${merchantRule.warrantyMonths}`);
    returnPolicyDays = merchantRule.returnPolicyDays;
    warrantyMonths = merchantRule.warrantyMonths;
  } else {
    console.log(`[Deadlines] Using default rules for merchant "${merchantName}": returnDays=${returnPolicyDays}, warrantyMonths=${warrantyMonths}`);
  }
  
  // Calculate deadlines
  const returnBy = new Date(date);
  returnBy.setDate(returnBy.getDate() + returnPolicyDays);
  
  const warrantyEnds = new Date(date);
  warrantyEnds.setMonth(warrantyEnds.getMonth() + warrantyMonths);
  
  return {
    returnBy: returnBy.toISOString().split('T')[0],
    warrantyEnds: warrantyEnds.toISOString().split('T')[0]
  };
}


export async function registerRoutes(app: Express): Promise<Server> {
  app.use("/uploads", express.static("uploads"));

  app.post("/api/auth/register", async (req, res) => {
    let createdUserId: string | undefined;
    
    try {
      const input = registerSchema.parse(req.body);
      
      const existing = await storage.getUserByUsername(input.username);
      if (existing) {
        return res.status(409).json({ error: "Username already exists" });
      }

      // Check if email is already in use
      if (input.email) {
        const existingEmail = await storage.getUserByEmail(input.email);
        if (existingEmail) {
          return res.status(409).json({ error: "Email address is already registered" });
        }
      }
      
      const hashedPassword = await hashPassword(input.password);
      const userData = insertUserSchema.parse({
        username: input.username,
        fullName: input.fullName,
        password: hashedPassword,
        email: input.email,
        phone: input.phone,
        homeAddress: input.homeAddress,
        idNumber: input.idNumber,
        accountType: input.accountType,
        emailVerified: false
      });
      
      const user = await storage.createUser(userData);
      createdUserId = user.id;
      
      if (input.accountType === "business") {
        try {
          await storage.createBusinessProfile({
            userId: user.id,
            businessName: input.businessName!,
            taxId: input.taxId!,
            vatNumber: input.vatNumber,
            registrationNumber: input.registrationNumber,
            address: input.businessAddress,
            phone: input.businessPhone,
            email: input.businessEmail,
          });
        } catch (profileError: any) {
          console.error("Failed to create business profile, rolling back user:", profileError);
          await storage.deleteUser(user.id);
          throw new Error("Failed to create business profile");
        }
      }

      // Email verification temporarily disabled - auto-login after registration
      // TODO: Re-enable when domain is verified with Resend
      // if (input.email) {
      //   const verificationToken = generateResetToken();
      //   const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      //   await storage.createEmailVerificationToken(user.id, verificationToken, expiresAt);
      //   const baseUrl = `${req.protocol}://${req.get("host")}`;
      //   const verifyLink = `${baseUrl}/verify-email?token=${verificationToken}`;
      //   const emailHtml = generateEmailVerificationEmail(verifyLink, user.fullName);
      //   await sendEmail(input.email, "Verify Your Email - SlipSafe", emailHtml);
      // }
      
      req.login(user, async (err) => {
        if (err) {
          console.error("Login after registration failed:", err);
          return res.status(500).json({ error: "Registration succeeded but login failed" });
        }
        await logUserActivity(user.id, "register", { accountType: input.accountType }, req);
        const { password, ...userWithoutPassword } = user;
        res.json({
          success: true,
          user: userWithoutPassword
        });
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors 
        });
      }
      res.status(500).json({ error: "Registration failed", message: error.message });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ error: "Login failed. Please try again." });
      }
      
      if (!user) {
        return res.status(401).json({ 
          error: info?.message || "Invalid username or password. Please check your credentials and try again." 
        });
      }
      
      req.login(user, async (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ error: "Login failed. Please try again." });
        }
        
        await logUserActivity(user.id, "login", undefined, req);
        
        // Return full user data (excluding password)
        const { password, ...userWithoutPassword } = user;
        res.json({
          success: true,
          user: userWithoutPassword
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", async (req, res) => {
    const userId = getCurrentUserId(req);
    if (userId) {
      await logUserActivity(userId, "logout", undefined, req);
    }
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Invalid verification link" });
      }
      
      await storage.cleanupExpiredTokens();
      
      const verificationToken = await storage.getEmailVerificationToken(token);
      
      if (!verificationToken) {
        return res.status(400).json({ error: "Invalid or expired verification link. Please request a new one." });
      }
      
      if (new Date() > verificationToken.expiresAt) {
        await storage.deleteEmailVerificationToken(token);
        return res.status(400).json({ error: "Verification link has expired. Please request a new one." });
      }
      
      const user = await storage.getUser(verificationToken.userId);
      if (!user) {
        await storage.deleteEmailVerificationToken(token);
        return res.status(400).json({ error: "User account not found" });
      }
      
      if (user.emailVerified) {
        await storage.deleteEmailVerificationToken(token);
        return res.json({ success: true, message: "Email already verified. You can now log in.", alreadyVerified: true });
      }
      
      await storage.verifyUserEmail(user.id);
      await storage.deleteEmailVerificationToken(token);
      
      await logUserActivity(user.id, "email_verified", undefined, req);
      
      if (user.email) {
        const welcomeHtml = generateWelcomeEmail(user.fullName, user.username);
        await sendEmail(user.email, "Welcome to SlipSafe!", welcomeHtml);
      }
      
      res.json({ 
        success: true, 
        message: "Email verified successfully! You can now log in to your account."
      });
    } catch (error: any) {
      console.error("Email verification error:", error);
      res.status(500).json({ error: "Verification failed. Please try again." });
    }
  });

  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      const identifier = `resend-verification:${email}`;
      if (!rateLimit(identifier, 3, 15 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many requests. Please try again in 15 minutes." });
      }
      
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.json({ success: true, message: "If an account exists with this email, a new verification link has been sent." });
      }
      
      if (user.emailVerified) {
        return res.json({ success: true, message: "Email is already verified. You can log in." });
      }
      
      const verificationToken = generateResetToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      await storage.createEmailVerificationToken(user.id, verificationToken, expiresAt);
      
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const verifyLink = `${baseUrl}/verify-email?token=${verificationToken}`;
      
      const emailHtml = generateEmailVerificationEmail(verifyLink, user.fullName);
      await sendEmail(email, "Verify Your Email - SlipSafe", emailHtml);
      
      res.json({ success: true, message: "If an account exists with this email, a new verification link has been sent." });
    } catch (error: any) {
      console.error("Resend verification error:", error);
      res.status(500).json({ error: "Failed to resend verification email" });
    }
  });

  app.post("/api/auth/forgot-username", async (req, res) => {
    try {
      const data = forgotUsernameSchema.parse(req.body);
      const { recoveryMethod, email, phone } = data;
      const contactInfo = recoveryMethod === "email" ? email : phone;
      console.log(`[ForgotUsername] Processing request via ${recoveryMethod}: ${contactInfo}`);
      const identifier = `forgot-username:${contactInfo}`;
      
      if (!rateLimit(identifier, 3, 15 * 60 * 1000)) {
        console.log(`[ForgotUsername] Rate limit exceeded for ${contactInfo}`);
        return res.status(429).json({ error: "Too many requests. Please try again later." });
      }
      
      let user;
      if (recoveryMethod === "email" && email) {
        user = await storage.getUserByEmail(email);
      } else if (recoveryMethod === "phone" && phone) {
        user = await storage.getUserByPhone(phone);
      }
      console.log(`[ForgotUsername] User found: ${!!user}, username: ${user?.username}`);
      
      if (user && recoveryMethod === "email" && email) {
        const emailHtml = generateUsernameRecoveryEmail(user.username);
        const sent = await sendEmail(email, "Your SlipSafe Username", emailHtml);
        console.log(`[ForgotUsername] Email sent: ${sent}`);
      } else if (user && recoveryMethod === "phone") {
        console.log(`[ForgotUsername] Would send SMS to ${phone} with username: ${user.username}`);
      } else {
        console.log(`[ForgotUsername] No user found for ${recoveryMethod}: ${contactInfo}`);
      }
      
      const message = recoveryMethod === "email" 
        ? "If an account exists with this email, we've sent your username information."
        : "If an account exists with this phone number, we've sent your username via SMS.";
      
      return res.json({ 
        success: true, 
        message
      });
    } catch (error: any) {
      console.error("Forgot username error:", error);
      res.status(400).json({ error: error.message || "Invalid request" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const data = forgotPasswordSchema.parse(req.body);
      const { recoveryMethod, usernameOrEmail, usernameOrPhone } = data;
      const contactInfo = recoveryMethod === "email" ? usernameOrEmail : usernameOrPhone;
      const identifier = `forgot-password:${contactInfo}`;
      
      if (!rateLimit(identifier, 3, 15 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many requests. Please try again later." });
      }
      
      await storage.cleanupExpiredTokens();
      
      let user;
      if (recoveryMethod === "email" && usernameOrEmail) {
        user = await storage.getUserByUsername(usernameOrEmail);
        if (!user) {
          user = await storage.getUserByEmail(usernameOrEmail);
        }
      } else if (recoveryMethod === "phone" && usernameOrPhone) {
        user = await storage.getUserByUsername(usernameOrPhone);
        if (!user) {
          user = await storage.getUserByPhone(usernameOrPhone);
        }
      }
      
      if (user) {
        const token = generateResetToken();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await storage.createPasswordResetToken(user.id, token, expiresAt);
        
        const host = req.headers.host || 'localhost:5000';
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const resetLink = `${protocol}://${host}/reset-password?token=${token}`;
        
        if (recoveryMethod === "email" && user.email) {
          const emailHtml = generatePasswordResetEmail(resetLink);
          const sent = await sendEmail(user.email, "Reset Your Password - SlipSafe", emailHtml);
          console.log(`[ForgotPassword] Email sent to ${user.email}: ${sent}`);
        } else if (recoveryMethod === "phone" && user.phone) {
          console.log(`[ForgotPassword] Would send SMS to ${user.phone} with reset link: ${resetLink}`);
        }
      }
      
      const message = recoveryMethod === "email"
        ? "If an account exists, we've sent password reset instructions to your email."
        : "If an account exists, we've sent password reset instructions via SMS.";
      
      return res.json({
        success: true,
        message
      });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(400).json({ error: error.message || "Invalid request" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword, confirmPassword } = resetPasswordSchema.parse(req.body);
      
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: "Passwords do not match" });
      }
      
      await storage.cleanupExpiredTokens();
      
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }
      
      if (resetToken.expiresAt < new Date()) {
        await storage.deletePasswordResetToken(token);
        return res.status(400).json({ error: "Reset token has expired" });
      }
      
      const user = await storage.getUser(resetToken.userId);
      if (!user) {
        await storage.deletePasswordResetToken(token);
        return res.status(400).json({ error: "User not found" });
      }
      
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUserPassword(user.id, hashedPassword);
      
      await storage.deletePasswordResetToken(token);
      
      res.json({
        success: true,
        message: "Password has been reset successfully. You can now log in with your new password."
      });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(400).json({ error: error.message || "Invalid request" });
    }
  });

  app.get("/api/users/me", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const fullUser = await storage.getUser(user.id);
      if (!fullUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const { password, ...userWithoutPassword } = fullUser;
      
      // Include business profile data if user is a business account
      let businessProfile = null;
      if (fullUser.accountType === "business") {
        businessProfile = await storage.getBusinessProfile(fullUser.id);
      }
      
      res.json({ 
        user: {
          ...userWithoutPassword,
          businessName: businessProfile?.businessName || null,
          businessProfile: businessProfile || null,
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch user data", message: error.message });
    }
  });

  app.put("/api/users/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const updates = updateUserProfileSchema.parse(req.body);
      const updatedUser = await storage.updateUserProfile(userId, updates);
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      await logUserActivity(userId, "profile_update", { fields: Object.keys(updates) }, req);
      const { password, ...userWithoutPassword } = updatedUser;
      res.json({ success: true, user: userWithoutPassword });
    } catch (error: any) {
      console.error("Profile update error:", error);
      res.status(500).json({ error: "Failed to update profile", message: error.message });
    }
  });

  app.post("/api/users/context", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { context } = req.body;
      if (!context || !["personal", "business"].includes(context)) {
        return res.status(400).json({ error: "Invalid context. Must be 'personal' or 'business'" });
      }

      const updatedUser = await storage.updateUserContext(userId, context);
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      await logUserActivity(userId, "context_switch", { newContext: context }, req);
      const { password, ...userWithoutPassword } = updatedUser;
      
      // Include business profile data for consistent response
      let businessProfile = null;
      if (updatedUser.accountType === "business") {
        businessProfile = await storage.getBusinessProfile(updatedUser.id);
      }
      
      res.json({ 
        success: true, 
        user: {
          ...userWithoutPassword,
          businessName: businessProfile?.businessName || null,
          businessProfile: businessProfile || null,
        }
      });
    } catch (error: any) {
      console.error("Context switch error:", error);
      res.status(500).json({ error: "Failed to switch context", message: error.message });
    }
  });

  app.post("/api/users/upgrade-to-business", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.accountType === "business") {
        return res.status(400).json({ error: "Account is already a business account" });
      }

      const { businessName, taxId, vatNumber, registrationNumber, businessAddress, businessPhone, businessEmail, invoicePrefix } = req.body;

      if (!businessName || businessName.trim() === "") {
        return res.status(400).json({ error: "Business name is required" });
      }
      if (!taxId || taxId.trim() === "") {
        return res.status(400).json({ error: "Tax ID is required for business accounts" });
      }

      const businessProfile = await storage.createBusinessProfile({
        userId,
        businessName: businessName.trim(),
        taxId: taxId.trim(),
        vatNumber: vatNumber?.trim() || null,
        registrationNumber: registrationNumber?.trim() || null,
        address: businessAddress?.trim() || null,
        phone: businessPhone?.trim() || null,
        email: businessEmail?.trim() || null,
        invoicePrefix: invoicePrefix?.trim() || "INV",
      });

      const updatedUser = await storage.updateAccountType(userId, "business");
      if (!updatedUser) {
        return res.status(500).json({ error: "Failed to update account type" });
      }

      // Automatically switch to business context after upgrade
      const userWithBusinessContext = await storage.updateUserContext(userId, "business");

      await logUserActivity(userId, "business_profile_update", { action: "upgrade_to_business" }, req);
      
      const finalUser = userWithBusinessContext || updatedUser;
      const { password, ...userWithoutPassword } = finalUser;
      res.json({ 
        success: true, 
        user: {
          ...userWithoutPassword,
          businessName: businessProfile.businessName,
          businessProfile,
        }
      });
    } catch (error: any) {
      console.error("Upgrade to business error:", error);
      res.status(500).json({ error: "Failed to upgrade to business account", message: error.message });
    }
  });

  app.get("/api/users/business-profile", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const profile = await storage.getBusinessProfile(userId);
      res.json({ profile });
    } catch (error: any) {
      console.error("Get business profile error:", error);
      res.status(500).json({ error: "Failed to fetch business profile", message: error.message });
    }
  });

  app.put("/api/users/business-profile", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.accountType !== "business") {
        return res.status(403).json({ error: "Only business accounts can update business profile" });
      }

      const validatedData = updateBusinessProfileSchema.parse(req.body);
      
      let profile = await storage.getBusinessProfile(userId);
      
      if (!profile) {
        profile = await storage.createBusinessProfile({
          userId,
          businessName: validatedData.businessName || "My Business",
          ...validatedData,
        });
      } else {
        profile = await storage.updateBusinessProfile(userId, validatedData);
      }

      if (!profile) {
        return res.status(500).json({ error: "Failed to update business profile" });
      }

      await logUserActivity(userId, "business_profile_update", { fields: Object.keys(validatedData) }, req);
      res.json({ success: true, profile });
    } catch (error: any) {
      console.error("Update business profile error:", error);
      res.status(500).json({ error: "Failed to update business profile", message: error.message });
    }
  });

  app.post("/api/users/profile/picture", isAuthenticated, upload.single("picture"), async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const profilePicturePath = req.file.path;
      const updatedUser = await storage.updateUserProfile(userId, { profilePicture: profilePicturePath });
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const { password, ...userWithoutPassword } = updatedUser;
      res.json({ success: true, user: userWithoutPassword, profilePicture: profilePicturePath });
    } catch (error: any) {
      console.error("Profile picture upload error:", error);
      res.status(500).json({ error: "Failed to upload profile picture", message: error.message });
    }
  });

  app.post("/api/users/change-password", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const validatedData = changePasswordSchema.parse(req.body);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isCurrentPasswordValid = await comparePassword(validatedData.currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      const hashedNewPassword = await hashPassword(validatedData.newPassword);
      const updatedUser = await storage.updateUserPassword(userId, hashedNewPassword);
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      await logUserActivity(userId, "password_change", undefined, req);
      res.json({ success: true, message: "Password changed successfully" });
    } catch (error: any) {
      console.error("Password change error:", error);
      res.status(500).json({ error: "Failed to change password", message: error.message });
    }
  });

  app.post("/api/receipts/preview", isAuthenticated, upload.single("receipt"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const ocrResult = await processReceipt(req.file.path);
      
      // Check for OCR errors
      if (ocrResult.error && ocrResult.error.type !== 'PARTIAL_EXTRACTION') {
        return res.status(422).json({
          success: false,
          error: ocrResult.error.message,
          errorType: ocrResult.error.type,
          suggestion: ocrResult.error.suggestion,
          canRetry: ocrResult.error.canRetry,
          ocrConfidence: ocrResult.ocrConfidence
        });
      }
      
      // Normalize data for preview
      const merchant = ocrResult.merchant || "";
      const total = ocrResult.total ? ocrResult.total.toString() : "";
      
      // Parse and normalize date to ISO format using enhanced parser
      const isoDate = parseDateToISO(ocrResult.date);
      
      // Compute deadlines from extracted policy values
      // Fallback to merchant rules if policy allows returns but no days specified
      const purchaseDate = new Date(isoDate);
      let returnBy: string | null = null;
      let warrantyEnds: string | null = null;
      let returnPolicyDays: number | null = null;
      let warrantyMonths: number | null = null;
      let policySource = ocrResult.policies?.policySource || 'extracted';
      
      // Check if returns are explicitly disallowed
      const noReturnsAllowed = ocrResult.policies?.refundType === 'none' || ocrResult.policies?.returnPolicyDays === 0;
      
      // Get days from OCR or fall back to merchant rules
      if (ocrResult.policies) {
        returnPolicyDays = ocrResult.policies.returnPolicyDays;
        warrantyMonths = ocrResult.policies.warrantyMonths;
      }
      
      // If OCR didn't extract days but returns are allowed, look up merchant rules
      if (!noReturnsAllowed && merchant) {
        const merchantRule = await storage.getMerchantRule(userId, merchant);
        
        // Fallback to merchant rules for return days if not extracted from receipt
        if (returnPolicyDays === null && merchantRule?.returnPolicyDays) {
          returnPolicyDays = merchantRule.returnPolicyDays;
          if (ocrResult.policies) {
            ocrResult.policies.returnPolicyDays = returnPolicyDays;
            policySource = 'merchant_default';
          }
          console.log(`[Preview] Using merchant rule for return days: ${returnPolicyDays} days for "${merchant}"`);
        }
        
        // Fallback to merchant rules for warranty months if not extracted from receipt
        if (warrantyMonths === null && merchantRule?.warrantyMonths) {
          warrantyMonths = merchantRule.warrantyMonths;
          if (ocrResult.policies) {
            ocrResult.policies.warrantyMonths = warrantyMonths;
            policySource = 'merchant_default';
          }
          console.log(`[Preview] Using merchant rule for warranty: ${warrantyMonths} months for "${merchant}"`);
        }
      }
      
      // Calculate deadlines based on final policy values
      if (!noReturnsAllowed && returnPolicyDays && returnPolicyDays > 0) {
        const returnDate = new Date(purchaseDate);
        returnDate.setDate(returnDate.getDate() + returnPolicyDays);
        returnBy = returnDate.toISOString().split('T')[0];
      }
      if (warrantyMonths && warrantyMonths > 0) {
        const warrantyDate = new Date(purchaseDate);
        warrantyDate.setMonth(warrantyDate.getMonth() + warrantyMonths);
        warrantyEnds = warrantyDate.toISOString().split('T')[0];
      }
      
      // Update policy source if we used merchant defaults
      if (ocrResult.policies && policySource === 'merchant_default') {
        ocrResult.policies.policySource = 'merchant_default';
      }

      // Store preview data server-side for later confirmation
      const previewData: PreviewData = {
        merchant: merchant || "Unknown Merchant",
        date: isoDate,
        total: total || "0.00",
        returnBy: returnBy || "",
        warrantyEnds: warrantyEnds || "",
        confidence: ocrResult.confidence,
        rawText: ocrResult.rawText,
        imagePath: req.file.path,
        sourceType: "upload",
        policies: ocrResult.policies,
        vatAmount: ocrResult.vatAmount,
        vatSource: ocrResult.vatSource,
        invoiceNumber: ocrResult.invoiceNumber,
        timestamp: Date.now()
      };
      ocrPreviewCache.set(userId, previewData);

      res.json({
        success: true,
        ocrData: {
          merchant,
          date: isoDate,
          total,
          returnBy,
          warrantyEnds,
          confidence: ocrResult.confidence,
          rawText: ocrResult.rawText,
          ocrConfidence: ocrResult.ocrConfidence,
          warnings: ocrResult.warnings,
          hasPartialData: ocrResult.error?.type === 'PARTIAL_EXTRACTION',
          partialDataMessage: ocrResult.error?.message,
          partialDataSuggestion: ocrResult.error?.suggestion,
          // Policy data extracted from receipt
          policies: ocrResult.policies,
          vatAmount: ocrResult.vatAmount,
          vatSource: ocrResult.vatSource,
          invoiceNumber: ocrResult.invoiceNumber
        }
      });
    } catch (error: any) {
      console.error("OCR preview error:", error);
      res.status(500).json({ 
        success: false,
        error: "OCR processing failed", 
        message: error.message,
        suggestion: "Please try again. If the problem persists, you can enter the details manually.",
        canRetry: true
      });
    }
  });

  app.post("/api/receipts/confirm", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get user's active context
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const context = user.activeContext || "personal";

      // Retrieve preview data from server-side cache
      const previewData = ocrPreviewCache.get(userId);
      if (!previewData) {
        return res.status(400).json({ error: "No preview data found. Please scan a receipt first." });
      }

      const { merchant, date, total, category } = req.body;

      // Validate required fields
      if (!merchant || !date || !total) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Normalize and validate merchant
      const normalizedMerchant = merchant.trim();
      if (!normalizedMerchant) {
        return res.status(400).json({ error: "Merchant name cannot be empty" });
      }

      // Normalize and validate date using the same parser as OCR
      const normalizedDate = parseDateToISO(date);
      
      // Validate total
      const normalizedTotal = parseFloat(total);
      if (isNaN(normalizedTotal) || normalizedTotal <= 0) {
        return res.status(400).json({ error: "Total must be a positive number" });
      }

      const hash = generateHash(normalizedMerchant, normalizedDate, normalizedTotal.toString());

      // Normalize confidence to string (schema expects "low" | "medium" | "high")
      let confidenceStr: string;
      if (typeof previewData.confidence === 'number') {
        confidenceStr = previewData.confidence >= 0.7 ? 'high' : previewData.confidence >= 0.4 ? 'medium' : 'low';
      } else {
        confidenceStr = previewData.confidence;
      }

      // Get policies from request body (user may have edited) or from preview data (extracted)
      const policies = req.body.policies || previewData.policies || {};
      
      // Get invoiceNumber from request body (user may have edited) or from preview data (extracted)
      const invoiceNumber = req.body.invoiceNumber || previewData.invoiceNumber || null;

      // Compute deadlines from user-edited policy values (product-specific, not merchant defaults)
      // Only compute if the user provided actual values - no defaults!
      const purchaseDate = new Date(normalizedDate);
      let returnBy: string | null = null;
      let warrantyEnds: string | null = null;
      
      // Only calculate return deadline if returns are allowed AND a return policy is specified
      const noReturnsAllowed = policies.refundType === 'none' || policies.returnPolicyDays === 0;
      if (!noReturnsAllowed && policies.returnPolicyDays && policies.returnPolicyDays > 0) {
        const returnDate = new Date(purchaseDate);
        returnDate.setDate(returnDate.getDate() + policies.returnPolicyDays);
        returnBy = returnDate.toISOString().split('T')[0];
      }
      
      // Only calculate warranty deadline if warranty months is specified
      if (policies.warrantyMonths && policies.warrantyMonths > 0) {
        const warrantyDate = new Date(purchaseDate);
        warrantyDate.setMonth(warrantyDate.getMonth() + policies.warrantyMonths);
        warrantyEnds = warrantyDate.toISOString().split('T')[0];
      }

      const purchaseData = {
        userId,
        hash,
        merchant: normalizedMerchant,
        date: normalizedDate,
        total: normalizedTotal.toString(),
        returnBy,
        warrantyEnds,
        category: category || "Other",
        imagePath: previewData.imagePath,
        ocrConfidence: confidenceStr,
        sourceType: previewData.sourceType || "upload",
        context,
        // Policy fields
        returnPolicyDays: policies.returnPolicyDays ?? null,
        returnPolicyTerms: policies.returnPolicyTerms ?? null,
        refundType: policies.refundType ?? null,
        exchangePolicyDays: policies.exchangePolicyDays ?? null,
        exchangePolicyTerms: policies.exchangePolicyTerms ?? null,
        warrantyMonths: policies.warrantyMonths ?? null,
        warrantyTerms: policies.warrantyTerms ?? null,
        policySource: policies.policySource || 'merchant_default',
        // VAT fields
        vatAmount: previewData.vatAmount?.toString() ?? null,
        invoiceNumber: invoiceNumber,
      };

      const validatedData = insertPurchaseSchema.parse(purchaseData);
      const purchase = await storage.createPurchase(userId, validatedData);

      // Clear preview data after successful save
      ocrPreviewCache.delete(userId);

      await logUserActivity(userId, "receipt_upload", { merchant: normalizedMerchant, category: category || "Other" }, req);
      
      res.json({
        success: true,
        purchase
      });
    } catch (error: any) {
      console.error("Receipt confirm error:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Validation failed", message: error.message });
      }
      res.status(500).json({ error: "Failed to save receipt", message: error.message });
    }
  });

  app.post("/api/receipts/text", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { text, source } = req.body;

      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text content is required" });
      }

      if (text.trim().length < 20) {
        return res.status(400).json({ 
          error: "Text too short",
          message: "Please paste the complete email receipt content"
        });
      }

      // Try Gemini AI first for better accuracy (especially for business users)
      const { parseEmailWithGemini, isGeminiAvailable } = await import('./lib/gemini-ocr');
      const { parseEmailReceiptText } = await import('./lib/ocr');
      
      let parseResult;
      const geminiAvailable = await isGeminiAvailable();
      
      if (geminiAvailable) {
        try {
          console.log('[Email Receipt] Using Gemini AI for email parsing...');
          const geminiResult = await parseEmailWithGemini(text);
          
          // Check if Gemini returned useful data
          if (geminiResult.merchant || geminiResult.total || geminiResult.date) {
            console.log('[Email Receipt] Gemini AI parsing successful!');
            parseResult = {
              merchant: geminiResult.merchant,
              date: geminiResult.date,
              total: geminiResult.total,
              subtotal: geminiResult.subtotal,
              taxAmount: null,
              vatAmount: geminiResult.vatAmount,
              vatSource: geminiResult.vatSource,
              invoiceNumber: geminiResult.invoiceNumber,
              confidence: geminiResult.confidence,
              rawText: geminiResult.rawText,
              ocrConfidence: geminiResult.ocrConfidence,
              policies: geminiResult.policies,
              warnings: geminiResult.warnings,
              error: null
            };
          } else {
            console.log('[Email Receipt] Gemini returned no useful data, falling back to regex parser...');
            parseResult = parseEmailReceiptText(text);
          }
        } catch (geminiError: any) {
          console.log('[Email Receipt] Gemini AI failed:', geminiError.message);
          console.log('[Email Receipt] Falling back to regex parser...');
          parseResult = parseEmailReceiptText(text);
        }
      } else {
        console.log('[Email Receipt] Gemini AI not available, using regex parser...');
        parseResult = parseEmailReceiptText(text);
      }

      const merchant = parseResult.merchant?.trim() || null;
      let isoDate: string | null = null;
      
      if (parseResult.date) {
        isoDate = parseDateToISO(parseResult.date);
      }
      
      const total = parseResult.total;

      // Compute deadlines from extracted policy values
      // Fallback to merchant rules if policy allows returns but no days specified
      let returnBy: string | null = null;
      let warrantyEnds: string | null = null;
      let returnPolicyDays: number | null = null;
      let warrantyMonths: number | null = null;
      let policySource = parseResult.policies?.policySource || 'extracted';
      
      // Check if returns are explicitly disallowed
      const noReturnsAllowed = parseResult.policies?.refundType === 'none' || parseResult.policies?.returnPolicyDays === 0;
      
      // Get days from parsing or fall back to merchant rules
      if (parseResult.policies) {
        returnPolicyDays = parseResult.policies.returnPolicyDays;
        warrantyMonths = parseResult.policies.warrantyMonths;
      }
      
      // If parsing didn't extract days but returns are allowed, look up merchant rules
      if (!noReturnsAllowed && merchant && isoDate) {
        const merchantRule = await storage.getMerchantRule(userId, merchant);
        
        // Fallback to merchant rules for return days if not extracted
        if (returnPolicyDays === null && merchantRule?.returnPolicyDays) {
          returnPolicyDays = merchantRule.returnPolicyDays;
          if (parseResult.policies) {
            parseResult.policies.returnPolicyDays = returnPolicyDays;
            policySource = 'merchant_default';
          }
          console.log(`[Email Preview] Using merchant rule for return days: ${returnPolicyDays} days for "${merchant}"`);
        }
        
        // Fallback to merchant rules for warranty months if not extracted
        if (warrantyMonths === null && merchantRule?.warrantyMonths) {
          warrantyMonths = merchantRule.warrantyMonths;
          if (parseResult.policies) {
            parseResult.policies.warrantyMonths = warrantyMonths;
            policySource = 'merchant_default';
          }
          console.log(`[Email Preview] Using merchant rule for warranty: ${warrantyMonths} months for "${merchant}"`);
        }
      }
      
      // Calculate deadlines based on final policy values
      if (isoDate) {
        const purchaseDate = new Date(isoDate);
        if (!noReturnsAllowed && returnPolicyDays && returnPolicyDays > 0) {
          const returnDate = new Date(purchaseDate);
          returnDate.setDate(returnDate.getDate() + returnPolicyDays);
          returnBy = returnDate.toISOString().split('T')[0];
        }
        if (warrantyMonths && warrantyMonths > 0) {
          const warrantyDate = new Date(purchaseDate);
          warrantyDate.setMonth(warrantyDate.getMonth() + warrantyMonths);
          warrantyEnds = warrantyDate.toISOString().split('T')[0];
        }
      }
      
      // Update policy source if we used merchant defaults
      if (parseResult.policies && policySource === 'merchant_default') {
        parseResult.policies.policySource = 'merchant_default';
      }

      ocrPreviewCache.set(userId, {
        merchant: merchant || "Unknown Merchant",
        date: isoDate || "",
        total: total?.toString() || "0.00",
        returnBy: returnBy || "",
        warrantyEnds: warrantyEnds || "",
        confidence: parseResult.confidence,
        rawText: text,
        imagePath: null,
        sourceType: 'email_paste',
        policies: parseResult.policies,
        vatAmount: parseResult.vatAmount,
        vatSource: parseResult.vatSource,
        invoiceNumber: parseResult.invoiceNumber,
        timestamp: Date.now()
      });

      res.json({
        success: true,
        ocrData: {
          merchant,
          date: isoDate,
          total,
          returnBy,
          warrantyEnds,
          confidence: parseResult.confidence,
          rawText: parseResult.rawText,
          ocrConfidence: parseResult.ocrConfidence,
          warnings: parseResult.warnings,
          hasPartialData: parseResult.error?.type === 'PARTIAL_EXTRACTION',
          partialDataMessage: parseResult.error?.message,
          partialDataSuggestion: parseResult.error?.suggestion,
          sourceType: source || 'email_paste',
          // Policy data extracted from email
          policies: parseResult.policies,
          vatAmount: parseResult.vatAmount,
          vatSource: parseResult.vatSource,
          invoiceNumber: parseResult.invoiceNumber
        }
      });
    } catch (error: any) {
      console.error("Email receipt parsing error:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to parse email receipt", 
        message: error.message,
        suggestion: "Please check that you've pasted the complete email content.",
        canRetry: true
      });
    }
  });

  // Update receipt policies (return/refund/exchange/warranty)
  app.patch("/api/receipts/:id/policies", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const purchaseId = req.params.id;
      
      // Verify user owns this purchase
      const purchase = await storage.getPurchaseById(userId, purchaseId);
      if (!purchase) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      // Validate policy updates
      const validationResult = updatePurchasePoliciesSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.errors 
        });
      }

      const policyUpdates = validationResult.data;
      
      // Recalculate deadlines based on updated policy values
      const purchaseDate = new Date(purchase.date);
      let returnBy: string | null = purchase.returnBy;
      let warrantyEnds: string | null = purchase.warrantyEnds;
      
      // Recalculate return deadline if return policy was updated
      if ('returnPolicyDays' in policyUpdates || 'refundType' in policyUpdates) {
        const returnDays = policyUpdates.returnPolicyDays ?? purchase.returnPolicyDays;
        const refundType = policyUpdates.refundType ?? purchase.refundType;
        const noReturnsAllowed = refundType === 'none' || returnDays === 0;
        
        if (noReturnsAllowed) {
          returnBy = null;
        } else if (returnDays && returnDays > 0) {
          const returnDate = new Date(purchaseDate);
          returnDate.setDate(returnDate.getDate() + returnDays);
          returnBy = returnDate.toISOString().split('T')[0];
        } else {
          returnBy = null;
        }
      }
      
      // Recalculate warranty deadline if warranty was updated
      if ('warrantyMonths' in policyUpdates) {
        const warrantyMonthsVal = policyUpdates.warrantyMonths;
        if (warrantyMonthsVal && warrantyMonthsVal > 0) {
          const warrantyDate = new Date(purchaseDate);
          warrantyDate.setMonth(warrantyDate.getMonth() + warrantyMonthsVal);
          warrantyEnds = warrantyDate.toISOString().split('T')[0];
        } else {
          warrantyEnds = null;
        }
      }
      
      // Mark as user_entered if coming from user edit
      const updates = {
        ...policyUpdates,
        returnBy: returnBy || undefined,
        warrantyEnds: warrantyEnds || undefined,
        policySource: 'user_entered' as const,
      };

      const updatedPurchase = await storage.updatePurchase(userId, purchaseId, updates);
      
      if (!updatedPurchase) {
        return res.status(500).json({ error: "Failed to update policies" });
      }

      res.json({
        success: true,
        purchase: updatedPurchase
      });
    } catch (error: any) {
      console.error("Policy update error:", error);
      res.status(500).json({ error: "Failed to update policies", message: error.message });
    }
  });

  // Get receipt policies
  app.get("/api/receipts/:id/policies", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const purchaseId = req.params.id;
      const purchase = await storage.getPurchaseById(userId, purchaseId);
      
      if (!purchase) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      res.json({
        success: true,
        policies: {
          returnPolicyDays: purchase.returnPolicyDays,
          returnPolicyTerms: purchase.returnPolicyTerms,
          refundType: purchase.refundType,
          exchangePolicyDays: purchase.exchangePolicyDays,
          exchangePolicyTerms: purchase.exchangePolicyTerms,
          warrantyMonths: purchase.warrantyMonths,
          warrantyTerms: purchase.warrantyTerms,
          policySource: purchase.policySource,
        }
      });
    } catch (error: any) {
      console.error("Get policies error:", error);
      res.status(500).json({ error: "Failed to get policies", message: error.message });
    }
  });

  app.post("/api/claims/create", async (req, res) => {
    try {
      const { hash } = req.body;

      if (!hash) {
        return res.status(400).json({ error: "Hash is required" });
      }

      const purchase = await storage.getPurchaseByHash(hash);

      if (!purchase) {
        return res.status(404).json({ error: "Purchase not found" });
      }

      const payload = {
        merchant: purchase.merchant,
        date: purchase.date,
        total: purchase.total,
        hash: purchase.hash
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "90d" });
      const pin = generatePIN();

      const protocol = req.protocol;
      const host = req.get("host");
      const verifierUrl = `${protocol}://${host}/api/claims/verify?token=${token}`;

      const qrCodeDataUrl = await QRCode.toDataURL(verifierUrl, {
        errorCorrectionLevel: "M",
        type: "image/png",
        width: 256,
        margin: 2
      });

      await logUserActivity(purchase.userId, "claim_create", { merchant: purchase.merchant }, req);

      res.json({
        success: true,
        token,
        pin,
        verifierUrl,
        qrCodeDataUrl,
        purchase: {
          merchant: purchase.merchant,
          date: purchase.date,
          total: purchase.total,
          returnBy: purchase.returnBy,
          warrantyEnds: purchase.warrantyEnds
        }
      });
    } catch (error: any) {
      console.error("Claim creation error:", error);
      res.status(500).json({ error: "Claim creation failed", message: error.message });
    }
  });

  app.get("/api/claims/verify", async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Token is required" });
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const purchase = await storage.getPurchaseByHash(decoded.hash);

      const matches = purchase &&
        purchase.merchant === decoded.merchant &&
        purchase.date === decoded.date &&
        purchase.total === decoded.total;

      res.json({
        valid: matches,
        purchase: matches ? purchase : null,
        decoded
      });
    } catch (error: any) {
      console.error("Verification error:", error);
      res.status(401).json({ error: "Invalid or expired token" });
    }
  });

  app.get("/api/purchases", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { category, search } = req.query;
      const context = user.activeContext;
      
      let purchases;
      if (search && typeof search === "string") {
        purchases = await storage.searchPurchases(userId, search, context);
      } else if (category && typeof category === "string") {
        purchases = await storage.getPurchasesByCategory(userId, category, context);
      } else {
        purchases = await storage.getPurchasesByContext(userId, context);
      }
      
      res.json({ purchases });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch purchases", message: error.message });
    }
  });

  // Get single purchase by ID
  app.get("/api/purchases/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const purchase = await storage.getPurchaseById(userId, id);

      if (!purchase) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      res.json(purchase);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch purchase", message: error.message });
    }
  });

  app.patch("/api/purchases/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const { category } = req.body;
      
      if (!category || !CATEGORIES.includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }
      
      const updated = await storage.updatePurchase(userId, id, { category });
      
      if (!updated) {
        return res.status(404).json({ error: "Purchase not found" });
      }
      
      res.json({ purchase: updated });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update purchase", message: error.message });
    }
  });

  // Personal user reports - returns and warranty focused
  app.get("/api/reports/personal", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // For personal context (individual users always use personal context)
      const purchases = await storage.getPurchasesByContext(userId, "personal");
      const today = new Date().toISOString().split('T')[0];
      
      // Calculate totals
      let totalSpent = 0;
      let pendingReturns = 0;
      let expiredReturns = 0;
      let activeWarranties = 0;
      let expiredWarranties = 0;
      const byCategory: Record<string, { count: number; total: number }> = {};
      const byMonth: Record<string, { count: number; total: number }> = {};
      const upcomingReturns: Array<{ merchant: string; date: string; returnBy: string; total: string; daysLeft: number }> = [];
      const upcomingWarrantyExpiries: Array<{ merchant: string; date: string; warrantyEnds: string; total: string; daysLeft: number }> = [];
      const warrantyStatus: { active: number; expiringSoon: number; expired: number } = { active: 0, expiringSoon: 0, expired: 0 };

      for (const purchase of purchases) {
        const amount = parseFloat(purchase.total) || 0;
        totalSpent += amount;

        // Returns analysis
        if (purchase.returnBy) {
          if (purchase.returnBy >= today) {
            pendingReturns++;
            const daysLeft = Math.ceil((new Date(purchase.returnBy).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 14) {
              upcomingReturns.push({
                merchant: purchase.merchant,
                date: purchase.date,
                returnBy: purchase.returnBy,
                total: purchase.total,
                daysLeft
              });
            }
          } else {
            expiredReturns++;
          }
        }

        // Warranty analysis - mutually exclusive categories
        if (purchase.warrantyEnds) {
          const daysLeft = Math.ceil((new Date(purchase.warrantyEnds).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
          if (daysLeft > 30) {
            // Active: more than 30 days left
            activeWarranties++;
            warrantyStatus.active++;
          } else if (daysLeft >= 1) {
            // Expiring soon: 1-30 days left
            activeWarranties++; // Still counts as active for summary
            warrantyStatus.expiringSoon++;
            upcomingWarrantyExpiries.push({
              merchant: purchase.merchant,
              date: purchase.date,
              warrantyEnds: purchase.warrantyEnds,
              total: purchase.total,
              daysLeft
            });
          } else {
            // Expired: less than 1 day (past or today)
            expiredWarranties++;
            warrantyStatus.expired++;
          }
        }

        // By category
        const cat = purchase.category || "Other";
        if (!byCategory[cat]) {
          byCategory[cat] = { count: 0, total: 0 };
        }
        byCategory[cat].count++;
        byCategory[cat].total += amount;

        // By month
        const month = purchase.date.substring(0, 7);
        if (!byMonth[month]) {
          byMonth[month] = { count: 0, total: 0 };
        }
        byMonth[month].count++;
        byMonth[month].total += amount;
      }

      // Sort upcoming items by days left
      upcomingReturns.sort((a, b) => a.daysLeft - b.daysLeft);
      upcomingWarrantyExpiries.sort((a, b) => a.daysLeft - b.daysLeft);

      res.json({
        summary: {
          totalReceipts: purchases.length,
          totalSpent: totalSpent.toFixed(2),
          pendingReturns,
          expiredReturns,
          activeWarranties,
          expiredWarranties,
        },
        upcomingReturns: upcomingReturns.slice(0, 10),
        upcomingWarrantyExpiries: upcomingWarrantyExpiries.slice(0, 10),
        warrantyStatus,
        byCategory: Object.entries(byCategory).map(([name, data]) => ({
          name,
          ...data,
          total: data.total.toFixed(2),
        })).sort((a, b) => b.count - a.count),
        byMonth: Object.entries(byMonth).map(([month, data]) => ({
          month,
          ...data,
          total: data.total.toFixed(2),
        })).sort((a, b) => a.month.localeCompare(b.month)),
      });
    } catch (error: any) {
      console.error("Personal reports error:", error);
      res.status(500).json({ error: "Failed to generate personal report", message: error.message });
    }
  });

  app.get("/api/reports/summary", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Restrict access to business accounts only
      if (user.accountType !== "business") {
        return res.status(403).json({ error: "Tax & Reports is only available for business accounts" });
      }

      const context = user.activeContext;
      const { startDate, endDate } = req.query;
      
      const purchases = await storage.getPurchasesByContext(userId, context);
      
      // Filter by date range if provided
      let filteredPurchases = purchases;
      if (startDate && typeof startDate === "string") {
        filteredPurchases = filteredPurchases.filter(p => p.date >= startDate);
      }
      if (endDate && typeof endDate === "string") {
        filteredPurchases = filteredPurchases.filter(p => p.date <= endDate);
      }

      // Calculate totals
      let totalSpent = 0;
      let totalTax = 0;
      let totalVat = 0;
      const byCategory: Record<string, { count: number; total: number; tax: number; vat: number }> = {};
      const byMerchant: Record<string, { count: number; total: number; tax: number; vat: number }> = {};
      const byMonth: Record<string, { count: number; total: number; tax: number; vat: number }> = {};

      for (const purchase of filteredPurchases) {
        const amount = parseFloat(purchase.total) || 0;
        const tax = parseFloat(purchase.taxAmount || "0") || 0;
        const vat = parseFloat(purchase.vatAmount || "0") || 0;
        
        totalSpent += amount;
        totalTax += tax;
        totalVat += vat;

        // By category
        const cat = purchase.category || "Other";
        if (!byCategory[cat]) {
          byCategory[cat] = { count: 0, total: 0, tax: 0, vat: 0 };
        }
        byCategory[cat].count++;
        byCategory[cat].total += amount;
        byCategory[cat].tax += tax;
        byCategory[cat].vat += vat;

        // By merchant
        const merchant = purchase.merchant;
        if (!byMerchant[merchant]) {
          byMerchant[merchant] = { count: 0, total: 0, tax: 0, vat: 0 };
        }
        byMerchant[merchant].count++;
        byMerchant[merchant].total += amount;
        byMerchant[merchant].tax += tax;
        byMerchant[merchant].vat += vat;

        // By month
        const month = purchase.date.substring(0, 7); // YYYY-MM
        if (!byMonth[month]) {
          byMonth[month] = { count: 0, total: 0, tax: 0, vat: 0 };
        }
        byMonth[month].count++;
        byMonth[month].total += amount;
        byMonth[month].tax += tax;
        byMonth[month].vat += vat;
      }

      res.json({
        summary: {
          totalReceipts: filteredPurchases.length,
          totalSpent: totalSpent.toFixed(2),
          totalTax: totalTax.toFixed(2),
          totalVat: totalVat.toFixed(2),
        },
        byCategory: Object.entries(byCategory).map(([name, data]) => ({
          name,
          ...data,
          total: data.total.toFixed(2),
          tax: data.tax.toFixed(2),
          vat: data.vat.toFixed(2),
        })).sort((a, b) => b.count - a.count),
        byMerchant: Object.entries(byMerchant).map(([name, data]) => ({
          name,
          ...data,
          total: data.total.toFixed(2),
          tax: data.tax.toFixed(2),
          vat: data.vat.toFixed(2),
        })).sort((a, b) => b.count - a.count),
        byMonth: Object.entries(byMonth).map(([month, data]) => ({
          month,
          ...data,
          total: data.total.toFixed(2),
          tax: data.tax.toFixed(2),
          vat: data.vat.toFixed(2),
        })).sort((a, b) => a.month.localeCompare(b.month)),
        context,
      });
    } catch (error: any) {
      console.error("Reports summary error:", error);
      res.status(500).json({ error: "Failed to generate report", message: error.message });
    }
  });

  // Generate PDF expense report for business users
  app.get("/api/reports/pdf", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Restrict access to business accounts only
      if (user.accountType !== "business") {
        return res.status(403).json({ error: "PDF reports are only available for business accounts" });
      }

      // Get business profile for tax info
      const businessProfile = await storage.getBusinessProfile(userId);
      
      const context = user.activeContext;
      const { startDate, endDate, includeTransactions } = req.query;
      
      const purchases = await storage.getPurchasesByContext(userId, context);
      
      // Filter by date range if provided
      let filteredPurchases = purchases;
      if (startDate && typeof startDate === "string") {
        filteredPurchases = filteredPurchases.filter(p => p.date >= startDate);
      }
      if (endDate && typeof endDate === "string") {
        filteredPurchases = filteredPurchases.filter(p => p.date <= endDate);
      }

      // Calculate totals
      let totalSpent = 0;
      let totalTax = 0;
      let totalVat = 0;
      const byCategory: Record<string, { count: number; total: number; tax: number; vat: number }> = {};
      const byMerchant: Record<string, { count: number; total: number; tax: number; vat: number }> = {};
      const byMonth: Record<string, { count: number; total: number; tax: number; vat: number }> = {};

      for (const purchase of filteredPurchases) {
        const amount = parseFloat(purchase.total) || 0;
        const tax = parseFloat(purchase.taxAmount || "0") || 0;
        const vat = parseFloat(purchase.vatAmount || "0") || 0;
        
        totalSpent += amount;
        totalTax += tax;
        totalVat += vat;

        // By category
        const cat = purchase.category || "Other";
        if (!byCategory[cat]) {
          byCategory[cat] = { count: 0, total: 0, tax: 0, vat: 0 };
        }
        byCategory[cat].count++;
        byCategory[cat].total += amount;
        byCategory[cat].tax += tax;
        byCategory[cat].vat += vat;

        // By merchant
        const merchant = purchase.merchant;
        if (!byMerchant[merchant]) {
          byMerchant[merchant] = { count: 0, total: 0, tax: 0, vat: 0 };
        }
        byMerchant[merchant].count++;
        byMerchant[merchant].total += amount;
        byMerchant[merchant].tax += tax;
        byMerchant[merchant].vat += vat;

        // By month
        const month = purchase.date.substring(0, 7);
        if (!byMonth[month]) {
          byMonth[month] = { count: 0, total: 0, tax: 0, vat: 0 };
        }
        byMonth[month].count++;
        byMonth[month].total += amount;
        byMonth[month].tax += tax;
        byMonth[month].vat += vat;
      }

      // Prepare report data
      const reportData = {
        businessName: businessProfile?.businessName || "Business Account",
        taxId: businessProfile?.taxId || undefined,
        vatNumber: businessProfile?.vatNumber || undefined,
        reportPeriod: {
          startDate: typeof startDate === "string" ? startDate : undefined,
          endDate: typeof endDate === "string" ? endDate : undefined,
        },
        summary: {
          totalReceipts: filteredPurchases.length,
          totalSpent,
          totalTax,
          totalVat,
        },
        byCategory: Object.entries(byCategory).map(([name, data]) => ({
          name,
          ...data,
        })).sort((a, b) => b.total - a.total),
        byMerchant: Object.entries(byMerchant).map(([name, data]) => ({
          name,
          ...data,
        })).sort((a, b) => b.total - a.total),
        byMonth: Object.entries(byMonth).map(([month, data]) => ({
          month,
          ...data,
        })).sort((a, b) => a.month.localeCompare(b.month)),
        transactions: includeTransactions === "true" ? filteredPurchases.map(p => ({
          date: p.date,
          merchant: p.merchant,
          category: p.category || "Other",
          total: parseFloat(p.total) || 0,
          tax: parseFloat(p.taxAmount || "0") || 0,
          vat: parseFloat(p.vatAmount || "0") || 0,
        })).sort((a, b) => b.date.localeCompare(a.date)) : undefined,
      };

      // Generate PDF
      const doc = generateExpenseReportPDF(reportData);
      
      // Set response headers for PDF download
      const filename = `slipsafe-expense-report-${new Date().toISOString().split('T')[0]}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Pipe the PDF to the response
      doc.pipe(res);
      doc.end();
      
      await logUserActivity(userId, "report_generated", { format: "pdf", context }, req);
    } catch (error: any) {
      console.error("PDF report generation error:", error);
      res.status(500).json({ error: "Failed to generate PDF report", message: error.message });
    }
  });

  app.get("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const settings = await storage.getSettings(userId);
      res.json({ settings });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch settings", message: error.message });
    }
  });

  app.patch("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const validated = insertSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateSettings(userId, validated);
      res.json({ settings });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update settings", message: error.message });
    }
  });

  // Merchant Rules Management API
  app.get("/api/merchant-rules", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const rules = await storage.getAllMerchantRules(userId);
      res.json({ rules });
    } catch (error: any) {
      console.error("Get merchant rules error:", error);
      res.status(500).json({ error: "Failed to fetch merchant rules", message: error.message });
    }
  });

  app.post("/api/merchant-rules", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const validated = insertMerchantRuleSchema.parse({
        ...req.body,
        userId,
      });

      const rule = await storage.createMerchantRule(validated);
      res.json({ rule });
    } catch (error: any) {
      console.error("Create merchant rule error:", error);
      if (error.message.includes("already exists")) {
        return res.status(409).json({ error: error.message });
      }
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Validation failed", message: error.message });
      }
      res.status(500).json({ error: "Failed to create merchant rule", message: error.message });
    }
  });

  app.patch("/api/merchant-rules/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const validated = updateMerchantRuleSchema.parse(req.body);

      const rule = await storage.updateMerchantRule(userId, id, validated);
      if (!rule) {
        return res.status(404).json({ error: "Merchant rule not found" });
      }

      res.json({ rule });
    } catch (error: any) {
      console.error("Update merchant rule error:", error);
      if (error.message.includes("already exists")) {
        return res.status(409).json({ error: error.message });
      }
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Validation failed", message: error.message });
      }
      res.status(500).json({ error: "Failed to update merchant rule", message: error.message });
    }
  });

  app.delete("/api/merchant-rules/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const deleted = await storage.deleteMerchantRule(userId, id);

      if (!deleted) {
        return res.status(404).json({ error: "Merchant rule not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete merchant rule error:", error);
      res.status(500).json({ error: "Failed to delete merchant rule", message: error.message });
    }
  });

  // Serve receipt image
  app.get("/api/receipts/image/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const purchase = await storage.getPurchaseById(userId, id);

      if (!purchase) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      if (!purchase.imagePath) {
        return res.status(404).json({ error: "No image for this receipt" });
      }

      try {
        const imageBuffer = await readFile(purchase.imagePath);
        const mimeType = purchase.imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.send(imageBuffer);
      } catch (err) {
        console.error('Failed to read receipt image:', err);
        return res.status(404).json({ error: "Image file not found" });
      }
    } catch (error: any) {
      console.error("Get receipt image error:", error);
      res.status(500).json({ error: "Failed to get receipt image", message: error.message });
    }
  });

  app.get("/api/purchases/:id/pdf", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const purchase = await storage.getPurchaseById(userId, id);

      if (!purchase) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      // Prepare image data URL if receipt image exists
      let imageDataUrl: string | undefined;
      if (purchase.imagePath) {
        try {
          const imageBuffer = await readFile(purchase.imagePath);
          const base64Image = imageBuffer.toString('base64');
          const mimeType = purchase.imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
          imageDataUrl = `data:${mimeType};base64,${base64Image}`;
        } catch (err) {
          console.error('Failed to load receipt image:', err);
        }
      }

      // Generate QR code for verification
      let qrCodeDataUrl: string | undefined;
      try {
        const verificationUrl = `${req.protocol}://${req.get('host')}/receipt/${id}`;
        qrCodeDataUrl = await QRCode.toDataURL(verificationUrl);
      } catch (err) {
        console.error('Failed to generate QR code:', err);
      }

      // Logo path for PDF - use path.join for cross-platform compatibility
      const logoPath = path.join(process.cwd(), 'attached_assets', 'SlipSafe Logo_1762888976121.png');

      // Generate PDF
      const pdfDoc = generateReceiptPDF({
        merchant: purchase.merchant,
        date: purchase.date,
        total: Number(purchase.total),
        returnBy: purchase.returnBy,
        warrantyEnds: purchase.warrantyEnds,
        imageUrl: imageDataUrl,
        qrCodeDataUrl: qrCodeDataUrl,
        logoPath: logoPath,
      });

      // Set response headers - use inline to allow viewing in iframe
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="receipt-${purchase.merchant.replace(/[^a-z0-9]/gi, '-')}-${new Date(purchase.date).toISOString().split('T')[0]}.pdf"`
      );

      // Pipe PDF to response
      pdfDoc.pipe(res);
      pdfDoc.end();
    } catch (error: any) {
      console.error("PDF generation error:", error);
      res.status(500).json({ error: "Failed to generate PDF", message: error.message });
    }
  });

  // Admin middleware - checks if user is authenticated and has admin or support role
  const isAdminOrSupport = async (req: Request, res: express.Response, next: express.NextFunction) => {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    if (!user || (user.role !== 'admin' && user.role !== 'support')) {
      return res.status(403).json({ error: "Forbidden: Admin or support access required" });
    }
    
    (req as any).adminUser = user;
    next();
  };

  // Merchant role middleware - checks if user has merchant_admin or merchant_staff role
  const isMerchantRole = async (req: Request, res: express.Response, next: express.NextFunction) => {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    if (!user || (user.role !== 'merchant_admin' && user.role !== 'merchant_staff')) {
      return res.status(403).json({ error: "Forbidden: Merchant access required" });
    }
    
    if (!user.merchantId) {
      return res.status(403).json({ error: "Forbidden: No merchant associated with this account" });
    }
    
    (req as any).merchantUser = user;
    (req as any).merchantId = user.merchantId;
    next();
  };

  // Legacy isAdmin for backwards compatibility
  const isAdmin = isAdminOrSupport;

  // Admin API endpoints
  app.get("/api/admin/activity", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const userId = req.query.userId as string | undefined;
      const action = req.query.action as string | undefined;

      const result = await storage.getAllUserActivity(page, limit, userId, action);
      res.json(result);
    } catch (error: any) {
      console.error("Admin activity fetch error:", error);
      res.status(500).json({ error: "Failed to fetch activity", message: error.message });
    }
  });

  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from response
      const sanitizedUsers = users.map(({ password, ...user }) => user);
      res.json({ users: sanitizedUsers });
    } catch (error: any) {
      console.error("Admin users fetch error:", error);
      res.status(500).json({ error: "Failed to fetch users", message: error.message });
    }
  });

  app.get("/api/admin/stats", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Admin stats fetch error:", error);
      res.status(500).json({ error: "Failed to fetch stats", message: error.message });
    }
  });

  app.get("/api/admin/user/:userId/activity", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const result = await storage.getUserActivity(userId, page, limit);
      res.json(result);
    } catch (error: any) {
      console.error("Admin user activity fetch error:", error);
      res.status(500).json({ error: "Failed to fetch user activity", message: error.message });
    }
  });

  // Admin endpoint to update user role
  app.patch("/api/admin/users/:userId/role", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { role, merchantId } = req.body;
      
      // Validate role
      const validRoles = ["user", "admin", "support", "merchant_admin", "merchant_staff"];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be one of: " + validRoles.join(", ") });
      }

      // For merchant roles, merchantId is required
      if ((role === "merchant_admin" || role === "merchant_staff") && !merchantId) {
        return res.status(400).json({ error: "Merchant ID is required for merchant roles" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Update user role
      const updatedUser = await storage.updateUserRole(userId, role);
      
      // If merchant role, also update merchantId
      if (merchantId && (role === "merchant_admin" || role === "merchant_staff")) {
        await storage.updateUserMerchantId(userId, merchantId);
      } else if (role === "user" || role === "admin" || role === "support") {
        // Clear merchantId for non-merchant roles
        await storage.updateUserMerchantId(userId, null);
      }

      if (!updatedUser) {
        return res.status(500).json({ error: "Failed to update user role" });
      }

      const finalUser = await storage.getUser(userId);
      const { password, ...userWithoutPassword } = finalUser!;
      
      await logUserActivity(getCurrentUserId(req)!, "admin_role_change", { 
        targetUserId: userId, 
        newRole: role,
        merchantId: merchantId || null
      }, req);
      
      res.json({ success: true, user: userWithoutPassword });
    } catch (error: any) {
      console.error("Admin role update error:", error);
      res.status(500).json({ error: "Failed to update user role", message: error.message });
    }
  });

  // Admin endpoint to get all merchants for role assignment
  app.get("/api/admin/merchants", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const merchants = await storage.getAllMerchants();
      res.json({ merchants });
    } catch (error: any) {
      console.error("Admin merchants fetch error:", error);
      res.status(500).json({ error: "Failed to fetch merchants", message: error.message });
    }
  });

  // ============================================
  // INTEGRATED MERCHANT PORTAL ROUTES (for users with merchant roles)
  // These routes allow main app users with merchant_admin/merchant_staff roles
  // to access merchant functionality without separate merchant login
  // ============================================

  // Get merchant dashboard for authenticated users with merchant roles
  app.get("/api/merchant-portal/dashboard", isAuthenticated, isMerchantRole, async (req, res) => {
    try {
      const merchantId = (req as any).merchantId;
      const merchant = await storage.getMerchantById(merchantId);
      
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      
      const verifications = await storage.getVerificationsByMerchant(merchant.id, 20);
      const staff = await storage.getMerchantUsers(merchant.id);
      
      res.json({
        merchant: {
          id: merchant.id,
          businessName: merchant.businessName,
          email: merchant.email,
          returnPolicyDays: merchant.returnPolicyDays,
          warrantyMonths: merchant.warrantyMonths,
        },
        recentVerifications: verifications,
        staffCount: staff.length,
      });
    } catch (error: any) {
      console.error("Merchant portal dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard" });
    }
  });

  // Verify a claim via integrated merchant portal
  app.post("/api/merchant-portal/verify", isAuthenticated, isMerchantRole, async (req, res) => {
    try {
      const merchantId = (req as any).merchantId;
      const merchantUser = (req as any).merchantUser;
      const validatedData = verifyClaimSchema.parse(req.body);
      
      // Rate limit PIN verification attempts per claim code (5 attempts per 15 minutes)
      const rateLimitKey = `merchant_verify:${validatedData.claimCode}`;
      if (!rateLimit(rateLimitKey, 5, 15 * 60 * 1000)) {
        return res.status(429).json({ 
          error: "Too many verification attempts. Please try again later.",
          retryAfter: 15 * 60
        });
      }
      
      const claim = await storage.getClaimByCode(validatedData.claimCode);
      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }
      
      // Check if claim is in a valid state for verification
      if (claim.state !== 'issued' && claim.state !== 'pending') {
        return res.status(400).json({ 
          error: `Claim cannot be verified - current state: ${claim.state}` 
        });
      }
      
      // Verify PIN
      const pinCorrect = validatedData.pin === claim.pin;
      
      // Get merchant for policy info
      const merchant = await storage.getMerchantById(merchantId);
      
      // Log verification attempt
      await storage.createClaimVerification({
        claimId: claim.id,
        merchantId: merchantId,
        merchantUserId: merchantUser.id,
        result: pinCorrect ? 'approved' : 'rejected',
        attemptedPin: validatedData.pin,
        pinCorrect,
        notes: null,
      });
      
      if (!pinCorrect) {
        // Check for fraud patterns
        const failedAttempts = await storage.getFailedPinAttempts(claim.id, 15);
        if (failedAttempts >= 3) {
          await storage.createFraudEvent({
            userId: claim.userId,
            claimId: claim.id,
            eventType: 'excessive_pin_failures',
            severity: 'high',
            description: `Excessive PIN failures (${failedAttempts} attempts) detected`,
            metadata: JSON.stringify({ failedAttempts, lastAttempt: new Date().toISOString() }),
          });
        }
        
        return res.status(400).json({ 
          error: "Invalid PIN", 
          pinCorrect: false,
          attemptsRemaining: Math.max(0, 3 - failedAttempts)
        });
      }
      
      // PIN correct - update claim state to pending
      await storage.updateClaimState(claim.id, 'pending');
      
      // Get purchase details for response
      const purchase = await storage.getPurchaseById(claim.userId, claim.purchaseId);
      
      res.json({
        verified: true,
        claim: {
          id: claim.id,
          claimCode: claim.claimCode,
          state: 'pending',
          claimType: claim.claimType,
          originalAmount: claim.originalAmount,
          expiresAt: claim.expiresAt,
        },
        purchase: purchase ? {
          merchant: purchase.merchant,
          date: purchase.date,
          total: purchase.total,
          returnBy: purchase.returnBy,
          warrantyEnds: purchase.warrantyEnds,
        } : null,
        merchant: merchant ? {
          businessName: merchant.businessName,
          returnPolicyDays: merchant.returnPolicyDays,
        } : null,
      });
    } catch (error: any) {
      console.error("Merchant portal verify error:", error);
      res.status(500).json({ error: "Verification failed", message: error.message });
    }
  });

  // Redeem a verified claim via integrated merchant portal
  app.post("/api/merchant-portal/redeem", isAuthenticated, isMerchantRole, async (req, res) => {
    try {
      const merchantId = (req as any).merchantId;
      const merchantUser = (req as any).merchantUser;
      const validatedData = redeemClaimSchema.parse(req.body);
      
      const claim = await storage.getClaimByCode(validatedData.claimCode);
      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }
      
      if (claim.state !== 'pending') {
        return res.status(400).json({ 
          error: `Claim cannot be redeemed - current state: ${claim.state}` 
        });
      }
      
      // Determine final state based on refund amount
      const originalAmount = parseFloat(claim.originalAmount || '0');
      const refundAmount = validatedData.refundAmount || originalAmount;
      const finalState = refundAmount < originalAmount ? 'partial' : 'redeemed';
      
      // Update claim
      await storage.updateClaimState(
        claim.id, 
        finalState, 
        { merchantId, userId: merchantUser.id },
        refundAmount.toString()
      );
      
      // Log verification/redemption
      await storage.createClaimVerification({
        claimId: claim.id,
        merchantId: merchantId,
        merchantUserId: merchantUser.id,
        result: finalState === 'partial' ? 'partial_approved' : 'approved',
        refundAmount: refundAmount.toString(),
        notes: validatedData.notes || null,
      });
      
      res.json({
        success: true,
        claim: {
          id: claim.id,
          claimCode: claim.claimCode,
          state: finalState,
          refundedAmount: refundAmount,
        }
      });
    } catch (error: any) {
      console.error("Merchant portal redeem error:", error);
      res.status(500).json({ error: "Redemption failed", message: error.message });
    }
  });

  // Get recent verifications for integrated merchant portal
  app.get("/api/merchant-portal/verifications", isAuthenticated, isMerchantRole, async (req, res) => {
    try {
      const merchantId = (req as any).merchantId;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const verifications = await storage.getVerificationsByMerchant(merchantId, limit);
      res.json({ verifications });
    } catch (error: any) {
      console.error("Merchant portal verifications error:", error);
      res.status(500).json({ error: "Failed to fetch verifications" });
    }
  });

  // Protected claim lookup for integrated merchant portal
  app.get("/api/merchant-portal/lookup/:claimCode", isAuthenticated, isMerchantRole, async (req, res) => {
    try {
      const { claimCode } = req.params;
      
      const claim = await storage.getClaimByCode(claimCode);
      if (!claim) {
        return res.status(404).json({ error: "Claim not found", valid: false });
      }
      
      const now = new Date();
      const expiresAt = new Date(claim.expiresAt);
      const isExpired = now > expiresAt;
      const isUsed = claim.state === 'redeemed' || claim.state === 'partial' || claim.state === 'refused';
      
      res.json({
        valid: !isExpired && !isUsed && (claim.state === 'issued' || claim.state === 'pending'),
        claim: {
          claimCode: claim.claimCode,
          claimType: claim.claimType,
          state: claim.state,
          merchantName: claim.merchantName,
          originalAmount: claim.originalAmount,
          purchaseDate: claim.purchaseDate,
          expiresAt: claim.expiresAt.toISOString(),
          isExpired,
          isUsed,
        }
      });
    } catch (error: any) {
      console.error("Merchant portal lookup error:", error);
      res.status(500).json({ error: "Lookup failed" });
    }
  });

  // ============================================
  // MERCHANT VERIFICATION SYSTEM ROUTES
  // (Legacy routes using separate merchant session authentication)
  // ============================================

  // Generate a unique API key for merchants
  function generateApiKey(): string {
    return `slp_${randomBytes(32).toString('hex')}`;
  }

  // Generate a claim code (alphanumeric, easy to read)
  function generateClaimCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Middleware for merchant API key authentication
  const merchantApiAuth = async (req: Request, res: express.Response, next: express.NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      return res.status(401).json({ error: "API key required" });
    }
    
    const merchant = await storage.getMerchantByApiKey(apiKey);
    if (!merchant || !merchant.isActive) {
      return res.status(401).json({ error: "Invalid or inactive API key" });
    }
    
    (req as any).merchant = merchant;
    next();
  };

  // Session-based merchant user authentication
  const merchantSession = new Map<string, { merchantId: string; userId: string; expiresAt: number }>();

  const merchantSessionAuth = async (req: Request, res: express.Response, next: express.NextFunction) => {
    const sessionToken = req.headers['x-merchant-session'] as string;
    if (!sessionToken) {
      return res.status(401).json({ error: "Session token required" });
    }
    
    const session = merchantSession.get(sessionToken);
    if (!session || session.expiresAt < Date.now()) {
      merchantSession.delete(sessionToken);
      return res.status(401).json({ error: "Session expired or invalid" });
    }
    
    const merchantUser = await storage.getMerchantUserById(session.userId);
    if (!merchantUser || !merchantUser.isActive) {
      return res.status(401).json({ error: "User not found or inactive" });
    }
    
    const merchant = await storage.getMerchantById(session.merchantId);
    if (!merchant || !merchant.isActive) {
      return res.status(401).json({ error: "Merchant not found or inactive" });
    }
    
    (req as any).merchant = merchant;
    (req as any).merchantUser = merchantUser;
    next();
  };

  // Register a new merchant
  app.post("/api/merchant/register", async (req, res) => {
    try {
      const validatedData = insertMerchantSchema.parse(req.body);
      
      const existing = await storage.getMerchantByEmail(validatedData.email);
      if (existing) {
        return res.status(400).json({ error: "A merchant with this email already exists" });
      }
      
      const apiKey = generateApiKey();
      const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');
      
      const merchant = await storage.createMerchant(validatedData, apiKey, apiKeyHash);
      
      // Create owner user account
      const ownerPassword = await hashPassword(req.body.password || randomBytes(16).toString('hex'));
      await storage.createMerchantUser({
        merchantId: merchant.id,
        email: validatedData.email,
        password: ownerPassword,
        fullName: req.body.ownerName || validatedData.businessName,
        role: "owner",
        isActive: true,
      });
      
      res.status(201).json({
        success: true,
        merchant: {
          id: merchant.id,
          businessName: merchant.businessName,
          email: merchant.email,
        },
        apiKey,
        message: "Store this API key securely - it won't be shown again"
      });
    } catch (error: any) {
      console.error("Merchant registration error:", error);
      res.status(400).json({ error: error.message || "Failed to register merchant" });
    }
  });

  // Merchant user login
  app.post("/api/merchant/login", async (req, res) => {
    try {
      const validatedData = merchantLoginSchema.parse(req.body);
      
      const identifier = `merchant_login:${validatedData.email}`;
      if (!rateLimit(identifier, 5, 15 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many login attempts. Try again later." });
      }
      
      const merchant = await storage.getMerchantById(validatedData.merchantId);
      if (!merchant || !merchant.isActive) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const user = await storage.getMerchantUserByEmail(merchant.id, validatedData.email);
      if (!user || !user.isActive) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const passwordValid = await comparePassword(validatedData.password, user.password);
      if (!passwordValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Create session
      const sessionToken = randomBytes(32).toString('hex');
      const expiresAt = Date.now() + (8 * 60 * 60 * 1000); // 8 hours
      merchantSession.set(sessionToken, {
        merchantId: merchant.id,
        userId: user.id,
        expiresAt
      });
      
      await storage.updateMerchantUserLogin(user.id);
      
      res.json({
        success: true,
        sessionToken,
        expiresAt,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        merchant: {
          id: merchant.id,
          businessName: merchant.businessName,
        }
      });
    } catch (error: any) {
      console.error("Merchant login error:", error);
      res.status(400).json({ error: error.message || "Login failed" });
    }
  });

  // Merchant logout
  app.post("/api/merchant/logout", merchantSessionAuth, (req, res) => {
    const sessionToken = req.headers['x-merchant-session'] as string;
    merchantSession.delete(sessionToken);
    res.json({ success: true });
  });

  // Get merchant dashboard info
  app.get("/api/merchant/dashboard", merchantSessionAuth, async (req, res) => {
    try {
      const merchant = (req as any).merchant;
      const verifications = await storage.getVerificationsByMerchant(merchant.id, 20);
      const staff = await storage.getMerchantUsers(merchant.id);
      
      res.json({
        merchant: {
          id: merchant.id,
          businessName: merchant.businessName,
          email: merchant.email,
          returnPolicyDays: merchant.returnPolicyDays,
          warrantyMonths: merchant.warrantyMonths,
        },
        recentVerifications: verifications,
        staffCount: staff.length,
      });
    } catch (error: any) {
      console.error("Merchant dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard" });
    }
  });

  // Manage merchant staff
  app.get("/api/merchant/staff", merchantSessionAuth, async (req, res) => {
    try {
      const merchant = (req as any).merchant;
      const staff = await storage.getMerchantUsers(merchant.id);
      res.json({
        staff: staff.map(s => ({
          id: s.id,
          email: s.email,
          fullName: s.fullName,
          role: s.role,
          isActive: s.isActive,
          lastLoginAt: s.lastLoginAt,
        }))
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch staff" });
    }
  });

  app.post("/api/merchant/staff", merchantSessionAuth, async (req, res) => {
    try {
      const merchantUser = (req as any).merchantUser;
      if (merchantUser.role !== 'owner' && merchantUser.role !== 'manager') {
        return res.status(403).json({ error: "Only owners and managers can add staff" });
      }
      
      const merchant = (req as any).merchant;
      const validatedData = insertMerchantUserSchema.parse({
        ...req.body,
        merchantId: merchant.id,
      });
      
      const existing = await storage.getMerchantUserByEmail(merchant.id, validatedData.email);
      if (existing) {
        return res.status(400).json({ error: "A user with this email already exists" });
      }
      
      const hashedPassword = await hashPassword(validatedData.password);
      const staff = await storage.createMerchantUser({
        ...validatedData,
        password: hashedPassword,
      });
      
      res.status(201).json({
        success: true,
        staff: {
          id: staff.id,
          email: staff.email,
          fullName: staff.fullName,
          role: staff.role,
        }
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to add staff" });
    }
  });

  // ============================================
  // CLAIM MANAGEMENT ROUTES (User-facing)
  // ============================================

  // Create a claim for a purchase
  app.post("/api/claims", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req)!;
      const validatedData = createClaimSchema.parse(req.body);
      
      // Get the purchase
      const purchase = await storage.getPurchaseById(userId, validatedData.purchaseId);
      if (!purchase) {
        return res.status(404).json({ error: "Purchase not found" });
      }
      
      // Check if claim already exists for this purchase
      const existingClaims = await storage.getClaimsByPurchase(purchase.id);
      const activeClaim = existingClaims.find(c => 
        c.state === 'issued' || c.state === 'pending' || c.state === 'partial'
      );
      if (activeClaim) {
        return res.status(400).json({ 
          error: "An active claim already exists for this purchase",
          existingClaimCode: activeClaim.claimCode
        });
      }
      
      // Calculate expiry based on claim type
      let expiresAt: Date;
      if (validatedData.claimType === 'return') {
        if (!purchase.returnBy) {
          // Check if it's a conditional policy (has refundType but no specific date)
          if (purchase.refundType === 'none') {
            return res.status(400).json({ 
              error: "Returns not accepted for this purchase",
              suggestion: purchase.warrantyEnds ? "Try creating a warranty claim instead" : "Try creating an exchange claim instead"
            });
          }
          return res.status(400).json({ 
            error: "No return policy specified for this purchase. This may require the original invoice at the store.",
            suggestion: purchase.warrantyEnds ? "Try creating a warranty claim instead" : "Try creating an exchange claim instead"
          });
        }
        const returnByDate = new Date(purchase.returnBy);
        if (returnByDate < new Date()) {
          return res.status(400).json({ 
            error: "Return period has expired",
            suggestion: purchase.warrantyEnds && new Date(purchase.warrantyEnds) > new Date() ? "Try creating a warranty claim instead" : undefined
          });
        }
        expiresAt = returnByDate;
      } else if (validatedData.claimType === 'warranty') {
        if (!purchase.warrantyEnds) {
          return res.status(400).json({ 
            error: "No warranty specified for this purchase",
            suggestion: "Try creating an exchange claim instead"
          });
        }
        const warrantyDate = new Date(purchase.warrantyEnds);
        if (warrantyDate < new Date()) {
          return res.status(400).json({ error: "Warranty period has expired" });
        }
        expiresAt = warrantyDate;
      } else {
        // Exchange claims always allowed with 90-day expiry
        expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
      }
      
      const claimCode = generateClaimCode();
      const pin = generatePIN();
      
      // Generate QR code with verification URL
      const verificationUrl = `${req.protocol}://${req.get('host')}/verify/${claimCode}`;
      const qrCodeData = await QRCode.toDataURL(verificationUrl);
      
      const claim = await storage.createClaim(
        {
          purchaseId: purchase.id,
          userId,
          claimType: validatedData.claimType,
          originalAmount: purchase.total,
          merchantName: purchase.merchant,
          purchaseDate: purchase.date,
          expiresAt,
        },
        claimCode,
        pin,
        qrCodeData
      );
      
      await logUserActivity(userId, "claim_create", {
        claimId: claim.id,
        claimCode,
        purchaseId: purchase.id,
        claimType: validatedData.claimType,
      }, req);
      
      res.status(201).json({
        success: true,
        claim: {
          id: claim.id,
          claimCode,
          pin,
          qrCodeData,
          claimType: claim.claimType,
          merchantName: claim.merchantName,
          originalAmount: claim.originalAmount,
          expiresAt: claim.expiresAt,
          state: claim.state,
        }
      });
    } catch (error: any) {
      console.error("Claim creation error:", error);
      res.status(400).json({ error: error.message || "Failed to create claim" });
    }
  });

  // Get user's claims
  app.get("/api/claims", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req)!;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Filter claims by user's active context
      const claims = await storage.getClaimsByUserAndContext(userId, user.activeContext);
      
      res.json({
        claims: claims.map(c => ({
          id: c.id,
          claimCode: c.claimCode,
          claimType: c.claimType,
          state: c.state,
          merchantName: c.merchantName,
          originalAmount: c.originalAmount,
          redeemedAmount: c.redeemedAmount,
          purchaseDate: c.purchaseDate,
          expiresAt: c.expiresAt,
          redeemedAt: c.redeemedAt,
          createdAt: c.createdAt,
        }))
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch claims" });
    }
  });

  // Get specific claim with QR code
  app.get("/api/claims/:claimCode", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req)!;
      const { claimCode } = req.params;
      
      const claim = await storage.getClaimByCode(claimCode);
      if (!claim || claim.userId !== userId) {
        return res.status(404).json({ error: "Claim not found" });
      }
      
      res.json({
        claim: {
          id: claim.id,
          claimCode: claim.claimCode,
          pin: claim.pin,
          qrCodeData: claim.qrCodeData,
          claimType: claim.claimType,
          state: claim.state,
          merchantName: claim.merchantName,
          originalAmount: claim.originalAmount,
          redeemedAmount: claim.redeemedAmount,
          purchaseDate: claim.purchaseDate,
          expiresAt: claim.expiresAt,
          redeemedAt: claim.redeemedAt,
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch claim" });
    }
  });

  // ============================================
  // CLAIM VERIFICATION ROUTES (Merchant-facing)
  // ============================================

  // Public verification lookup (from QR code scan)
  // Rate limited and with minimal data exposure
  // Note: For full claim details, use the protected /api/merchant-portal/lookup endpoint
  app.get("/api/verify/:claimCode", async (req, res) => {
    try {
      const { claimCode } = req.params;
      
      // Rate limit public lookups per IP (15 per 15 minutes)
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const rateLimitKey = `public_verify:${ipAddress}`;
      if (!rateLimit(rateLimitKey, 15, 15 * 60 * 1000)) {
        return res.status(429).json({ 
          error: "Too many lookup requests. Please try again later.",
          retryAfter: 15 * 60
        });
      }
      
      // Also rate limit per claim code (5 per 15 minutes)
      const claimRateLimitKey = `public_verify_claim:${claimCode}`;
      if (!rateLimit(claimRateLimitKey, 5, 15 * 60 * 1000)) {
        return res.status(429).json({ 
          error: "Too many lookup requests for this claim. Please try again later.",
          retryAfter: 15 * 60
        });
      }
      
      const claim = await storage.getClaimByCode(claimCode);
      
      if (!claim) {
        return res.status(404).json({ error: "Claim not found", valid: false });
      }
      
      const isExpired = new Date(claim.expiresAt) < new Date();
      const isUsed = claim.state === 'redeemed' || claim.state === 'partial' || claim.state === 'refused';
      
      // Minimal public response - only validity and basic type info
      // Full details require authenticated access
      res.json({
        valid: !isExpired && !isUsed && (claim.state === 'issued' || claim.state === 'pending'),
        claim: {
          claimCode: claim.claimCode,
          claimType: claim.claimType,
          state: claim.state,
          merchantName: claim.merchantName,
          originalAmount: claim.originalAmount,
          purchaseDate: claim.purchaseDate,
          expiresAt: claim.expiresAt,
          isExpired,
          isUsed,
        },
        requiresPin: true,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Verification failed" });
    }
  });

  // Verify claim with PIN (merchant API or portal)
  app.post("/api/merchant/verify", merchantSessionAuth, async (req, res) => {
    try {
      const validatedData = verifyClaimSchema.parse(req.body);
      const merchant = (req as any).merchant;
      const merchantUser = (req as any).merchantUser;
      
      const claim = await storage.getClaimByCode(validatedData.claimCode);
      if (!claim) {
        return res.status(404).json({ error: "Claim not found", valid: false });
      }
      
      // Check for too many failed PIN attempts (fraud prevention)
      const failedAttempts = await storage.getFailedPinAttempts(claim.id, 15);
      if (failedAttempts >= 5) {
        await storage.createFraudEvent({
          claimId: claim.id,
          userId: claim.userId,
          eventType: "invalid_pin_attempts",
          severity: "high",
          description: `Multiple failed PIN attempts (${failedAttempts + 1}) for claim ${claim.claimCode}`,
          metadata: JSON.stringify({ merchantId: merchant.id }),
        });
        return res.status(429).json({ 
          error: "Too many failed attempts. Claim locked for security.",
          valid: false 
        });
      }
      
      const pinCorrect = claim.pin === validatedData.pin;
      
      // Log verification attempt
      await storage.createClaimVerification({
        claimId: claim.id,
        merchantId: merchant.id,
        merchantUserId: merchantUser.id,
        result: pinCorrect ? "approved" : "rejected",
        attemptedPin: validatedData.pin,
        pinCorrect,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      });
      
      if (!pinCorrect) {
        return res.status(401).json({ error: "Invalid PIN", valid: false });
      }
      
      const isExpired = new Date(claim.expiresAt) < new Date();
      if (isExpired) {
        await storage.createFraudEvent({
          claimId: claim.id,
          userId: claim.userId,
          eventType: "expired_claim_use",
          severity: "medium",
          description: `Attempted to use expired claim ${claim.claimCode}`,
          metadata: JSON.stringify({ merchantId: merchant.id }),
        });
        return res.status(400).json({ error: "Claim has expired", valid: false });
      }
      
      if (claim.state === 'redeemed') {
        await storage.createFraudEvent({
          claimId: claim.id,
          userId: claim.userId,
          eventType: "duplicate_claim_attempt",
          severity: "high",
          description: `Attempted to reuse already redeemed claim ${claim.claimCode}`,
          metadata: JSON.stringify({ 
            merchantId: merchant.id,
            originalMerchantId: claim.redeemedByMerchantId 
          }),
        });
        return res.status(400).json({ 
          error: "Claim has already been redeemed",
          valid: false,
          redeemedAt: claim.redeemedAt
        });
      }
      
      if (claim.state === 'refused') {
        return res.status(400).json({ error: "Claim was refused", valid: false });
      }
      
      // Update claim state to pending
      await storage.updateClaimState(claim.id, 'pending');
      
      await logUserActivity(claim.userId, "claim_verify", {
        claimId: claim.id,
        claimCode: claim.claimCode,
        merchantId: merchant.id,
        merchantName: merchant.businessName,
      });
      
      res.json({
        valid: true,
        claim: {
          claimCode: claim.claimCode,
          claimType: claim.claimType,
          merchantName: claim.merchantName,
          originalAmount: claim.originalAmount,
          purchaseDate: claim.purchaseDate,
          state: 'pending',
        },
        message: "PIN verified. You may now process the refund/exchange."
      });
    } catch (error: any) {
      console.error("Claim verification error:", error);
      res.status(400).json({ error: error.message || "Verification failed" });
    }
  });

  // Redeem claim (complete the return/warranty process)
  app.post("/api/merchant/redeem", merchantSessionAuth, async (req, res) => {
    try {
      const validatedData = redeemClaimSchema.parse(req.body);
      const merchant = (req as any).merchant;
      const merchantUser = (req as any).merchantUser;
      
      const claim = await storage.getClaimByCode(validatedData.claimCode);
      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }
      
      // Verify PIN again for security
      if (claim.pin !== validatedData.pin) {
        return res.status(401).json({ error: "Invalid PIN" });
      }
      
      if (claim.state === 'redeemed') {
        return res.status(400).json({ error: "Claim has already been fully redeemed" });
      }
      
      if (claim.state === 'refused') {
        return res.status(400).json({ error: "Claim was refused" });
      }
      
      const isExpired = new Date(claim.expiresAt) < new Date();
      if (isExpired) {
        return res.status(400).json({ error: "Claim has expired" });
      }
      
      const newState = validatedData.isPartial ? 'partial' : 'redeemed';
      const refundAmount = validatedData.refundAmount 
        ? String(validatedData.refundAmount)
        : claim.originalAmount;
      
      await storage.updateClaimState(
        claim.id, 
        newState,
        { merchantId: merchant.id, userId: merchantUser.id },
        refundAmount
      );
      
      // Log the redemption
      await storage.createClaimVerification({
        claimId: claim.id,
        merchantId: merchant.id,
        merchantUserId: merchantUser.id,
        result: validatedData.isPartial ? "partial_approved" : "approved",
        attemptedPin: validatedData.pin,
        pinCorrect: true,
        refundAmount,
        notes: validatedData.notes,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      });
      
      res.json({
        success: true,
        message: validatedData.isPartial 
          ? "Partial refund processed successfully"
          : "Claim redeemed successfully",
        claim: {
          claimCode: claim.claimCode,
          state: newState,
          refundAmount,
        }
      });
    } catch (error: any) {
      console.error("Claim redemption error:", error);
      res.status(400).json({ error: error.message || "Redemption failed" });
    }
  });

  // Refuse a claim
  app.post("/api/merchant/refuse", merchantSessionAuth, async (req, res) => {
    try {
      const { claimCode, pin, reason } = req.body;
      const merchant = (req as any).merchant;
      const merchantUser = (req as any).merchantUser;
      
      if (!claimCode || !pin) {
        return res.status(400).json({ error: "Claim code and PIN are required" });
      }
      
      const claim = await storage.getClaimByCode(claimCode);
      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }
      
      if (claim.pin !== pin) {
        return res.status(401).json({ error: "Invalid PIN" });
      }
      
      if (claim.state === 'redeemed' || claim.state === 'refused') {
        return res.status(400).json({ error: "Claim has already been processed" });
      }
      
      await storage.updateClaimState(claim.id, 'refused');
      
      await storage.createClaimVerification({
        claimId: claim.id,
        merchantId: merchant.id,
        merchantUserId: merchantUser.id,
        result: "rejected",
        attemptedPin: pin,
        pinCorrect: true,
        notes: reason || "Claim refused by merchant",
        ipAddress: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      });
      
      res.json({
        success: true,
        message: "Claim has been refused",
        claim: {
          claimCode: claim.claimCode,
          state: 'refused',
        }
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to refuse claim" });
    }
  });

  // API-based verification (for POS integration)
  app.post("/api/v1/verify", merchantApiAuth, async (req, res) => {
    try {
      const validatedData = verifyClaimSchema.parse(req.body);
      const merchant = (req as any).merchant;
      
      const claim = await storage.getClaimByCode(validatedData.claimCode);
      if (!claim) {
        return res.status(404).json({ success: false, error: "Claim not found" });
      }
      
      const failedAttempts = await storage.getFailedPinAttempts(claim.id, 15);
      if (failedAttempts >= 5) {
        return res.status(429).json({ 
          success: false,
          error: "Claim locked due to too many failed attempts"
        });
      }
      
      const pinCorrect = claim.pin === validatedData.pin;
      
      await storage.createClaimVerification({
        claimId: claim.id,
        merchantId: merchant.id,
        result: pinCorrect ? "approved" : "rejected",
        attemptedPin: validatedData.pin,
        pinCorrect,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      });
      
      if (!pinCorrect) {
        return res.status(401).json({ success: false, error: "Invalid PIN" });
      }
      
      const isExpired = new Date(claim.expiresAt) < new Date();
      const isUsed = claim.state === 'redeemed' || claim.state === 'refused';
      
      res.json({
        success: true,
        valid: !isExpired && !isUsed,
        claim: {
          claimCode: claim.claimCode,
          claimType: claim.claimType,
          state: claim.state,
          merchantName: claim.merchantName,
          originalAmount: claim.originalAmount,
          purchaseDate: claim.purchaseDate,
          expiresAt: claim.expiresAt,
          isExpired,
          isUsed,
        }
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Get merchant verification history
  app.get("/api/merchant/verifications", merchantSessionAuth, async (req, res) => {
    try {
      const merchant = (req as any).merchant;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      
      const verifications = await storage.getVerificationsByMerchant(merchant.id, limit);
      res.json({ verifications });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch verifications" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
