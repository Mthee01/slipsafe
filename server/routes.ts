import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import QRCode from "qrcode";
import { createHash } from "crypto";
import jwt from "jsonwebtoken";
import passport from "./auth";
import { hashPassword, isAuthenticated, getCurrentUserId } from "./auth";
import { storage } from "./storage";
import { insertPurchaseSchema, insertSettingsSchema, insertUserSchema, updateUserProfileSchema, changePasswordSchema, forgotUsernameSchema, forgotPasswordSchema, resetPasswordSchema, registerSchema, CATEGORIES, insertMerchantRuleSchema, updateMerchantRuleSchema } from "@shared/schema";
import { comparePassword } from "./auth";
import { randomBytes } from "crypto";
import { processReceipt } from "./lib/ocr";
import { generateReceiptPDF } from "./lib/pdf";
import { readFile } from "fs/promises";
import { sendEmail, generatePasswordResetEmail, generateUsernameRecoveryEmail } from "./lib/email";

const upload = multer({ dest: "uploads/" });
const JWT_SECRET = process.env.JWT_SECRET || "slipsafe_dev_secret";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// In-memory cache for OCR preview data (keyed by userId)
interface PreviewData {
  merchant: string;
  date: string;
  total: string;
  returnBy: string;
  warrantyEnds: string;
  confidence: 'low' | 'medium' | 'high';
  rawText: string;
  imagePath: string;
  timestamp: number;
}
const ocrPreviewCache = new Map<string, PreviewData>();

// Clean up old preview cache entries (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [userId, data] of ocrPreviewCache.entries()) {
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
      
      const hashedPassword = await hashPassword(input.password);
      const userData = insertUserSchema.parse({
        username: input.username,
        password: hashedPassword,
        email: input.email,
        phone: input.phone,
        homeAddress: input.homeAddress,
        idNumber: input.idNumber,
        accountType: input.accountType
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
      
      req.login(user, (err) => {
        if (err) {
          console.error("Login after registration failed:", err);
          return res.status(500).json({ error: "Registration succeeded but login failed" });
        }
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
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ error: "Login failed. Please try again." });
        }
        
        res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username
          }
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  app.post("/api/auth/forgot-username", async (req, res) => {
    try {
      const { email } = forgotUsernameSchema.parse(req.body);
      console.log(`[ForgotUsername] Processing request for email: ${email}`);
      const identifier = `forgot-username:${email}`;
      
      if (!rateLimit(identifier, 3, 15 * 60 * 1000)) {
        console.log(`[ForgotUsername] Rate limit exceeded for ${email}`);
        return res.status(429).json({ error: "Too many requests. Please try again later." });
      }
      
      const user = await storage.getUserByEmail(email);
      console.log(`[ForgotUsername] User found: ${!!user}, username: ${user?.username}`);
      
      if (user) {
        const emailHtml = generateUsernameRecoveryEmail(user.username);
        const sent = await sendEmail(email, "Your SlipSafe Username", emailHtml);
        console.log(`[ForgotUsername] Email sent: ${sent}`);
      } else {
        console.log(`[ForgotUsername] No user found for email: ${email}`);
      }
      
      return res.json({ 
        success: true, 
        message: "If an account exists with this email, we've sent your username information."
      });
    } catch (error: any) {
      console.error("Forgot username error:", error);
      res.status(400).json({ error: error.message || "Invalid request" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { usernameOrEmail } = forgotPasswordSchema.parse(req.body);
      const identifier = `forgot-password:${usernameOrEmail}`;
      
      if (!rateLimit(identifier, 3, 15 * 60 * 1000)) {
        return res.status(429).json({ error: "Too many requests. Please try again later." });
      }
      
      await storage.cleanupExpiredTokens();
      
      let user = await storage.getUserByUsername(usernameOrEmail);
      if (!user) {
        user = await storage.getUserByEmail(usernameOrEmail);
      }
      
      if (user && user.email) {
        const token = generateResetToken();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await storage.createPasswordResetToken(user.id, token, expiresAt);
        
        const host = req.headers.host || 'localhost:5000';
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const resetLink = `${protocol}://${host}/reset-password?token=${token}`;
        
        const emailHtml = generatePasswordResetEmail(resetLink);
        const sent = await sendEmail(user.email, "Reset Your Password - SlipSafe", emailHtml);
        console.log(`[ForgotPassword] Email sent to ${user.email}: ${sent}`);
      }
      
      return res.json({
        success: true,
        message: "If an account exists, we've sent password reset instructions."
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
      res.json({ user: userWithoutPassword });
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

      const { password, ...userWithoutPassword } = updatedUser;
      res.json({ success: true, user: userWithoutPassword });
    } catch (error: any) {
      console.error("Context switch error:", error);
      res.status(500).json({ error: "Failed to switch context", message: error.message });
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
      
      // Normalize data for preview
      const merchant = ocrResult.merchant || "Unknown Merchant";
      const total = ocrResult.total ? ocrResult.total.toString() : "0.00";
      
      // Parse and normalize date to ISO format using enhanced parser
      const isoDate = parseDateToISO(ocrResult.date);
      
      // Compute deadlines with merchant-specific rules
      const deadlines = await computeDeadlines(isoDate, userId, merchant);

      // Store preview data server-side for later confirmation
      const previewData: PreviewData = {
        merchant,
        date: isoDate,
        total,
        returnBy: deadlines.returnBy,
        warrantyEnds: deadlines.warrantyEnds,
        confidence: ocrResult.confidence,
        rawText: ocrResult.rawText,
        imagePath: req.file.path,
        timestamp: Date.now()
      };
      ocrPreviewCache.set(userId, previewData);

      res.json({
        success: true,
        ocrData: {
          merchant,
          date: isoDate,
          total,
          returnBy: deadlines.returnBy,
          warrantyEnds: deadlines.warrantyEnds,
          confidence: ocrResult.confidence,
          rawText: ocrResult.rawText
        }
      });
    } catch (error: any) {
      console.error("OCR preview error:", error);
      res.status(500).json({ error: "OCR processing failed", message: error.message });
    }
  });

  app.post("/api/receipts/confirm", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

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
      
      // Compute deadlines with merchant-specific rules
      const deadlines = await computeDeadlines(normalizedDate, userId, normalizedMerchant);

      const purchaseData = {
        userId,
        hash,
        merchant: normalizedMerchant,
        date: normalizedDate,
        total: normalizedTotal.toString(),
        returnBy: deadlines.returnBy,
        warrantyEnds: deadlines.warrantyEnds,
        category: category || "Other",
        imagePath: previewData.imagePath, // Use server-side stored path
        ocrConfidence: previewData.confidence, // Use original OCR confidence
      };

      const validatedData = insertPurchaseSchema.parse(purchaseData);
      const purchase = await storage.createPurchase(userId, validatedData);

      // Clear preview data after successful save
      ocrPreviewCache.delete(userId);

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

      // Generate PDF
      const pdfDoc = generateReceiptPDF({
        merchant: purchase.merchant,
        date: purchase.date,
        total: Number(purchase.total),
        returnBy: purchase.returnBy,
        warrantyEnds: purchase.warrantyEnds,
        imageUrl: imageDataUrl,
        qrCodeDataUrl: qrCodeDataUrl,
      });

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="receipt-${purchase.merchant.replace(/[^a-z0-9]/gi, '-')}-${new Date(purchase.date).toISOString().split('T')[0]}.pdf"`
      );

      // Pipe PDF to response
      pdfDoc.pipe(res);
      pdfDoc.end();
    } catch (error: any) {
      console.error("PDF generation error:", error);
      res.status(500).json({ error: "Failed to generate PDF", message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
