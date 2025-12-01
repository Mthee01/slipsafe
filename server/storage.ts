import { type User, type InsertUser, type UpdateUserProfile, type Purchase, type InsertPurchase, type Settings, type InsertSettings, type PasswordResetToken, type EmailVerificationToken, type BusinessProfile, type InsertBusinessProfile, type UpdateBusinessProfile, type Client, type InsertClient, type UpdateClient, type MerchantRule, type InsertMerchantRule, type UserActivity, type InsertUserActivity, users, purchases, settings, passwordResetTokens, emailVerificationTokens, businessProfiles, clients, merchantRules, userActivity, normalizePhone } from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, or, lt, desc, sql, count } from "drizzle-orm";

export const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(userId: string): Promise<boolean>;
  updateUserProfile(userId: string, updates: UpdateUserProfile): Promise<User | undefined>;
  updateUserPassword(userId: string, newPassword: string): Promise<User | undefined>;
  updateUserContext(userId: string, context: string): Promise<User | undefined>;
  
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  deletePasswordResetToken(token: string): Promise<void>;
  cleanupExpiredTokens(): Promise<void>;
  
  createEmailVerificationToken(userId: string, token: string, expiresAt: Date): Promise<EmailVerificationToken>;
  getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined>;
  deleteEmailVerificationToken(token: string): Promise<void>;
  verifyUserEmail(userId: string): Promise<User | undefined>;
  
  getBusinessProfile(userId: string): Promise<BusinessProfile | undefined>;
  createBusinessProfile(profile: InsertBusinessProfile): Promise<BusinessProfile>;
  updateBusinessProfile(userId: string, updates: UpdateBusinessProfile): Promise<BusinessProfile | undefined>;
  getNextInvoiceNumber(userId: string): Promise<string>;
  
  getAllClients(userId: string): Promise<Client[]>;
  getClientById(userId: string, clientId: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(userId: string, clientId: string, updates: UpdateClient): Promise<Client | undefined>;
  deleteClient(userId: string, clientId: string): Promise<boolean>;
  
  createPurchase(userId: string, purchase: InsertPurchase): Promise<Purchase>;
  getPurchaseByHash(hash: string): Promise<Purchase | undefined>;
  getPurchaseById(userId: string, id: string): Promise<Purchase | undefined>;
  getAllPurchases(userId: string): Promise<Purchase[]>;
  getPurchasesByContext(userId: string, context: string): Promise<Purchase[]>;
  getPurchasesByCategory(userId: string, category: string, context?: string): Promise<Purchase[]>;
  searchPurchases(userId: string, query: string, context?: string): Promise<Purchase[]>;
  updatePurchase(userId: string, id: string, updates: Partial<Purchase>): Promise<Purchase | undefined>;
  
  getSettings(userId: string): Promise<Settings>;
  updateSettings(userId: string, updates: Partial<InsertSettings>): Promise<Settings>;
  
  getAllMerchantRules(userId: string): Promise<MerchantRule[]>;
  getMerchantRule(userId: string, merchantName: string): Promise<MerchantRule | undefined>;
  createMerchantRule(rule: InsertMerchantRule): Promise<MerchantRule>;
  updateMerchantRule(userId: string, id: string, updates: Partial<InsertMerchantRule>): Promise<MerchantRule | undefined>;
  deleteMerchantRule(userId: string, id: string): Promise<boolean>;
  
  logActivity(activity: InsertUserActivity): Promise<UserActivity>;
  getUserActivities(userId: string, limit?: number, offset?: number): Promise<UserActivity[]>;
  getAllActivities(limit?: number, offset?: number): Promise<{ activities: UserActivity[]; total: number }>;
  getActivityStats(): Promise<{ totalUsers: number; totalReceipts: number; totalClaims: number; recentLogins: number }>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(userId: string, role: string): Promise<User | undefined>;
  
  // Admin methods with pagination
  getUserActivity(userId: string, page: number, limit: number): Promise<{ activities: UserActivity[]; total: number; page: number; limit: number; totalPages: number }>;
  getAllUserActivity(page: number, limit: number, userId?: string, action?: string): Promise<{ activities: UserActivity[]; total: number; page: number; limit: number; totalPages: number }>;
  getAdminStats(): Promise<{ totalUsers: number; totalReceipts: number; totalClaims: number; recentLogins: number; activeUsersToday: number; newUsersThisWeek: number }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(ilike(users.email, email));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const normalized = normalizePhone(phone);
    const [user] = await db.select().from(users).where(eq(users.phone, normalized));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      email: insertUser.email || null,
      phone: insertUser.phone ? normalizePhone(insertUser.phone) : null,
      homeAddress: insertUser.homeAddress || null,
      idNumber: insertUser.idNumber || null,
      accountType: insertUser.accountType || "individual",
    }).returning();
    return user;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, userId));
    return (result.rowCount ?? 0) > 0;
  }

  async updateUserProfile(userId: string, updates: UpdateUserProfile): Promise<User | undefined> {
    const normalizedUpdates = {
      ...updates,
      phone: updates.phone ? normalizePhone(updates.phone) : updates.phone,
    };
    const [user] = await db.update(users)
      .set(normalizedUpdates)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ password: newPassword })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserContext(userId: string, context: string): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ activeContext: context })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const [resetToken] = await db.insert(passwordResetTokens).values({
      userId,
      token,
      expiresAt,
    }).returning();
    return resetToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return resetToken;
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
  }

  async cleanupExpiredTokens(): Promise<void> {
    await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, new Date()));
    await db.delete(emailVerificationTokens).where(lt(emailVerificationTokens.expiresAt, new Date()));
  }

  async createEmailVerificationToken(userId: string, token: string, expiresAt: Date): Promise<EmailVerificationToken> {
    const [verificationToken] = await db.insert(emailVerificationTokens).values({
      userId,
      token,
      expiresAt,
    }).returning();
    return verificationToken;
  }

  async getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined> {
    const [verificationToken] = await db.select().from(emailVerificationTokens).where(eq(emailVerificationTokens.token, token));
    return verificationToken;
  }

  async deleteEmailVerificationToken(token: string): Promise<void> {
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.token, token));
  }

  async verifyUserEmail(userId: string): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getBusinessProfile(userId: string): Promise<BusinessProfile | undefined> {
    const [profile] = await db.select().from(businessProfiles).where(eq(businessProfiles.userId, userId));
    return profile;
  }

  async createBusinessProfile(insertProfile: InsertBusinessProfile): Promise<BusinessProfile> {
    const [profile] = await db.insert(businessProfiles).values({
      ...insertProfile,
      email: insertProfile.email || null,
      phone: insertProfile.phone || null,
      taxId: insertProfile.taxId || null,
      vatNumber: insertProfile.vatNumber || null,
      registrationNumber: insertProfile.registrationNumber || null,
      address: insertProfile.address || null,
      invoicePrefix: insertProfile.invoicePrefix || "INV",
    }).returning();
    return profile;
  }

  async updateBusinessProfile(userId: string, updates: UpdateBusinessProfile): Promise<BusinessProfile | undefined> {
    const [profile] = await db.update(businessProfiles)
      .set(updates)
      .where(eq(businessProfiles.userId, userId))
      .returning();
    return profile;
  }

  async getNextInvoiceNumber(userId: string): Promise<string> {
    const profile = await this.getBusinessProfile(userId);
    if (!profile) return "INV-0001";
    
    const num = parseInt(profile.nextInvoiceNumber);
    const invoiceNumber = `${profile.invoicePrefix}-${String(num).padStart(4, '0')}`;
    
    await db.update(businessProfiles)
      .set({ nextInvoiceNumber: String(num + 1) })
      .where(eq(businessProfiles.userId, userId));
    
    return invoiceNumber;
  }

  async getAllClients(userId: string): Promise<Client[]> {
    return db.select().from(clients)
      .where(eq(clients.userId, userId))
      .orderBy(desc(clients.createdAt));
  }

  async getClientById(userId: string, clientId: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients)
      .where(and(eq(clients.userId, userId), eq(clients.id, clientId)));
    return client;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values({
      ...insertClient,
      email: insertClient.email || null,
      phone: insertClient.phone || null,
      taxId: insertClient.taxId || null,
      address: insertClient.address || null,
      notes: insertClient.notes || null,
    }).returning();
    return client;
  }

  async updateClient(userId: string, clientId: string, updates: UpdateClient): Promise<Client | undefined> {
    const [client] = await db.update(clients)
      .set(updates)
      .where(and(eq(clients.userId, userId), eq(clients.id, clientId)))
      .returning();
    return client;
  }

  async deleteClient(userId: string, clientId: string): Promise<boolean> {
    const result = await db.delete(clients)
      .where(and(eq(clients.userId, userId), eq(clients.id, clientId)));
    return (result.rowCount ?? 0) > 0;
  }

  async createPurchase(userId: string, insertPurchase: InsertPurchase): Promise<Purchase> {
    if (insertPurchase.userId !== userId) {
      throw new Error(`Purchase userId mismatch: payload has "${insertPurchase.userId}" but authenticated user is "${userId}"`);
    }
    
    const existing = await this.getPurchaseByHash(insertPurchase.hash);
    if (existing) {
      return existing;
    }
    
    const [purchase] = await db.insert(purchases).values({
      ...insertPurchase,
      userId,
      category: insertPurchase.category || "Other",
      imagePath: insertPurchase.imagePath || null,
      ocrConfidence: insertPurchase.ocrConfidence || "low",
      context: insertPurchase.context || "personal",
      clientId: insertPurchase.clientId || null,
      invoiceNumber: insertPurchase.invoiceNumber || null,
      taxAmount: insertPurchase.taxAmount || null,
      vatAmount: insertPurchase.vatAmount || null,
      notes: insertPurchase.notes || null,
    }).returning();
    return purchase;
  }

  async getPurchaseByHash(hash: string): Promise<Purchase | undefined> {
    const [purchase] = await db.select().from(purchases).where(eq(purchases.hash, hash));
    return purchase;
  }

  async getPurchaseById(userId: string, id: string): Promise<Purchase | undefined> {
    const [purchase] = await db.select().from(purchases)
      .where(and(eq(purchases.userId, userId), eq(purchases.id, id)));
    return purchase;
  }

  async getAllPurchases(userId: string): Promise<Purchase[]> {
    return db.select().from(purchases)
      .where(eq(purchases.userId, userId))
      .orderBy(desc(purchases.createdAt));
  }

  async getPurchasesByContext(userId: string, context: string): Promise<Purchase[]> {
    return db.select().from(purchases)
      .where(and(eq(purchases.userId, userId), eq(purchases.context, context)))
      .orderBy(desc(purchases.createdAt));
  }

  async getPurchasesByCategory(userId: string, category: string, context?: string): Promise<Purchase[]> {
    const conditions = [eq(purchases.userId, userId), eq(purchases.category, category)];
    if (context) {
      conditions.push(eq(purchases.context, context));
    }
    return db.select().from(purchases)
      .where(and(...conditions))
      .orderBy(desc(purchases.createdAt));
  }

  async searchPurchases(userId: string, query: string, context?: string): Promise<Purchase[]> {
    const lowerQuery = `%${query.toLowerCase()}%`;
    const conditions = [
      eq(purchases.userId, userId),
      or(
        ilike(purchases.merchant, lowerQuery),
        ilike(purchases.category, lowerQuery),
        ilike(purchases.date, `%${query}%`)
      )
    ];
    if (context) {
      conditions.push(eq(purchases.context, context));
    }
    return db.select().from(purchases)
      .where(and(...conditions))
      .orderBy(desc(purchases.createdAt));
  }

  async updatePurchase(userId: string, id: string, updates: Partial<Purchase>): Promise<Purchase | undefined> {
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );
    
    const [purchase] = await db.update(purchases)
      .set(cleanUpdates)
      .where(and(eq(purchases.userId, userId), eq(purchases.id, id)))
      .returning();
    return purchase;
  }

  async getSettings(userId: string): Promise<Settings> {
    const [existingSettings] = await db.select().from(settings).where(eq(settings.userId, userId));
    if (existingSettings) {
      return existingSettings;
    }
    
    const [newSettings] = await db.insert(settings).values({
      userId,
      theme: "light",
      notifyReturnDeadline: true,
      notifyWarrantyExpiry: true,
      returnAlertDays: "7",
      warrantyAlertDays: "30",
    }).returning();
    return newSettings;
  }

  async updateSettings(userId: string, updates: Partial<InsertSettings>): Promise<Settings> {
    await this.getSettings(userId);
    
    const [updatedSettings] = await db.update(settings)
      .set(updates)
      .where(eq(settings.userId, userId))
      .returning();
    return updatedSettings;
  }

  async getAllMerchantRules(userId: string): Promise<MerchantRule[]> {
    return db.select().from(merchantRules).where(eq(merchantRules.userId, userId));
  }

  async getMerchantRule(userId: string, merchantName: string): Promise<MerchantRule | undefined> {
    const normalizedName = merchantName.trim().toLowerCase();
    const [rule] = await db.select().from(merchantRules)
      .where(and(
        eq(merchantRules.userId, userId),
        eq(merchantRules.normalizedMerchantName, normalizedName)
      ));
    return rule;
  }

  async createMerchantRule(insertRule: InsertMerchantRule): Promise<MerchantRule> {
    const normalizedName = insertRule.merchantName.trim().toLowerCase();
    
    const existing = await this.getMerchantRule(insertRule.userId, insertRule.merchantName);
    if (existing) {
      throw new Error(`A rule for merchant "${insertRule.merchantName}" already exists`);
    }
    
    const [rule] = await db.insert(merchantRules).values({
      ...insertRule,
      normalizedMerchantName: normalizedName,
    }).returning();
    return rule;
  }

  async updateMerchantRule(userId: string, id: string, updates: Partial<InsertMerchantRule>): Promise<MerchantRule | undefined> {
    const [existingRule] = await db.select().from(merchantRules)
      .where(and(eq(merchantRules.userId, userId), eq(merchantRules.id, id)));
    
    if (!existingRule) return undefined;

    const normalizedName = updates.merchantName 
      ? updates.merchantName.trim().toLowerCase()
      : existingRule.normalizedMerchantName;

    if (updates.merchantName && normalizedName !== existingRule.normalizedMerchantName) {
      const [duplicate] = await db.select().from(merchantRules)
        .where(and(
          eq(merchantRules.userId, userId),
          eq(merchantRules.normalizedMerchantName, normalizedName)
        ));
      if (duplicate && duplicate.id !== id) {
        throw new Error(`A rule for merchant "${updates.merchantName}" already exists`);
      }
    }

    const [rule] = await db.update(merchantRules)
      .set({
        ...updates,
        normalizedMerchantName: normalizedName,
        updatedAt: new Date(),
      })
      .where(and(eq(merchantRules.userId, userId), eq(merchantRules.id, id)))
      .returning();
    return rule;
  }

  async deleteMerchantRule(userId: string, id: string): Promise<boolean> {
    const result = await db.delete(merchantRules)
      .where(and(eq(merchantRules.userId, userId), eq(merchantRules.id, id)));
    return (result.rowCount ?? 0) > 0;
  }

  async logActivity(activity: InsertUserActivity): Promise<UserActivity> {
    const [logged] = await db.insert(userActivity).values(activity).returning();
    return logged;
  }

  async getUserActivities(userId: string, limit = 50, offset = 0): Promise<UserActivity[]> {
    return await db.select()
      .from(userActivity)
      .where(eq(userActivity.userId, userId))
      .orderBy(desc(userActivity.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getAllActivities(limit = 50, offset = 0): Promise<{ activities: UserActivity[]; total: number }> {
    const activities = await db.select()
      .from(userActivity)
      .orderBy(desc(userActivity.createdAt))
      .limit(limit)
      .offset(offset);
    
    const [{ totalCount }] = await db.select({ totalCount: count() }).from(userActivity);
    
    return { activities, total: totalCount };
  }

  async getActivityStats(): Promise<{ totalUsers: number; totalReceipts: number; totalClaims: number; recentLogins: number }> {
    const [{ totalUsers }] = await db.select({ totalUsers: count() }).from(users);
    const [{ totalReceipts }] = await db.select({ totalReceipts: count() }).from(purchases);
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [{ recentLogins }] = await db.select({ recentLogins: count() })
      .from(userActivity)
      .where(and(
        eq(userActivity.action, "login"),
        sql`${userActivity.createdAt} > ${oneDayAgo}`
      ));
    
    const [{ totalClaims }] = await db.select({ totalClaims: count() })
      .from(userActivity)
      .where(eq(userActivity.action, "claim_create"));
    
    return { totalUsers, totalReceipts, totalClaims, recentLogins };
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.username);
  }

  async updateUserRole(userId: string, role: string): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ role })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getUserActivity(userId: string, page: number, limit: number): Promise<{ activities: UserActivity[]; total: number; page: number; limit: number; totalPages: number }> {
    const offset = (page - 1) * limit;
    
    const activities = await db.select()
      .from(userActivity)
      .where(eq(userActivity.userId, userId))
      .orderBy(desc(userActivity.createdAt))
      .limit(limit)
      .offset(offset);
    
    const [{ totalCount }] = await db.select({ totalCount: count() })
      .from(userActivity)
      .where(eq(userActivity.userId, userId));
    
    return {
      activities,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    };
  }

  async getAllUserActivity(page: number, limit: number, filterUserId?: string, filterAction?: string): Promise<{ activities: UserActivity[]; total: number; page: number; limit: number; totalPages: number }> {
    const offset = (page - 1) * limit;
    
    let conditions: any[] = [];
    if (filterUserId) {
      conditions.push(eq(userActivity.userId, filterUserId));
    }
    if (filterAction) {
      conditions.push(eq(userActivity.action, filterAction));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const activities = await db.select()
      .from(userActivity)
      .where(whereClause)
      .orderBy(desc(userActivity.createdAt))
      .limit(limit)
      .offset(offset);
    
    const [{ totalCount }] = await db.select({ totalCount: count() })
      .from(userActivity)
      .where(whereClause);
    
    return {
      activities,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    };
  }

  async getAdminStats(): Promise<{ totalUsers: number; totalReceipts: number; totalClaims: number; recentLogins: number; activeUsersToday: number; newUsersThisWeek: number }> {
    const [{ totalUsers }] = await db.select({ totalUsers: count() }).from(users);
    const [{ totalReceipts }] = await db.select({ totalReceipts: count() }).from(purchases);
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const [{ recentLogins }] = await db.select({ recentLogins: count() })
      .from(userActivity)
      .where(and(
        eq(userActivity.action, "login"),
        sql`${userActivity.createdAt} > ${oneDayAgo}`
      ));
    
    const [{ totalClaims }] = await db.select({ totalClaims: count() })
      .from(userActivity)
      .where(eq(userActivity.action, "claim_create"));
    
    // Count distinct users active today
    const activeToday = await db.selectDistinct({ userId: userActivity.userId })
      .from(userActivity)
      .where(sql`${userActivity.createdAt} > ${oneDayAgo}`);
    const activeUsersToday = activeToday.length;
    
    // Count users registered in the last week
    const [{ newUsersThisWeek }] = await db.select({ newUsersThisWeek: count() })
      .from(users)
      .where(sql`${users.id} IS NOT NULL`); // Placeholder - we don't have createdAt on users
    
    return { totalUsers, totalReceipts, totalClaims, recentLogins, activeUsersToday, newUsersThisWeek: 0 };
  }
}

export const storage = new DatabaseStorage();
