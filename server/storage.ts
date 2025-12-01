import { type User, type InsertUser, type UpdateUserProfile, type Purchase, type InsertPurchase, type Settings, type InsertSettings, type PasswordResetToken, type BusinessProfile, type InsertBusinessProfile, type UpdateBusinessProfile, type Client, type InsertClient, type UpdateClient, type MerchantRule, type InsertMerchantRule } from "@shared/schema";
import { randomUUID } from "crypto";

export const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(userId: string): Promise<boolean>;
  updateUserProfile(userId: string, updates: UpdateUserProfile): Promise<User | undefined>;
  updateUserPassword(userId: string, newPassword: string): Promise<User | undefined>;
  updateUserContext(userId: string, context: string): Promise<User | undefined>;
  
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  deletePasswordResetToken(token: string): Promise<void>;
  cleanupExpiredTokens(): Promise<void>;
  
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private purchases: Map<string, Map<string, Purchase>>;
  private settings: Map<string, Settings>;
  private passwordResetTokens: Map<string, PasswordResetToken>;
  private businessProfiles: Map<string, BusinessProfile>;
  private clients: Map<string, Map<string, Client>>;
  private merchantRules: Map<string, Map<string, MerchantRule>>;

  constructor() {
    this.users = new Map();
    this.purchases = new Map();
    this.settings = new Map();
    this.passwordResetTokens = new Map();
    this.businessProfiles = new Map();
    this.clients = new Map();
    this.merchantRules = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      id,
      email: null,
      phone: null,
      homeAddress: null,
      idNumber: null,
      profilePicture: null,
      accountType: "individual",
      activeContext: "personal",
      ...insertUser,
    };
    this.users.set(id, user);
    return user;
  }

  async deleteUser(userId: string): Promise<boolean> {
    return this.users.delete(userId);
  }

  async updateUserProfile(userId: string, updates: UpdateUserProfile): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updated = { ...user, ...updates };
    this.users.set(userId, updated);
    return updated;
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updated = { ...user, password: newPassword };
    this.users.set(userId, updated);
    return updated;
  }

  async updateUserContext(userId: string, context: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updated = { ...user, activeContext: context };
    this.users.set(userId, updated);
    return updated;
  }

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const id = randomUUID();
    const resetToken: PasswordResetToken = {
      id,
      userId,
      token,
      expiresAt,
      createdAt: new Date(),
    };
    this.passwordResetTokens.set(token, resetToken);
    return resetToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    return this.passwordResetTokens.get(token);
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    this.passwordResetTokens.delete(token);
  }

  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date();
    for (const [token, resetToken] of Array.from(this.passwordResetTokens.entries())) {
      if (resetToken.expiresAt < now) {
        this.passwordResetTokens.delete(token);
      }
    }
  }

  async getBusinessProfile(userId: string): Promise<BusinessProfile | undefined> {
    return this.businessProfiles.get(userId);
  }

  async createBusinessProfile(insertProfile: InsertBusinessProfile): Promise<BusinessProfile> {
    const id = randomUUID();
    const profile: BusinessProfile = {
      id,
      ...insertProfile,
      email: insertProfile.email || null,
      phone: insertProfile.phone || null,
      taxId: insertProfile.taxId || null,
      vatNumber: insertProfile.vatNumber || null,
      registrationNumber: insertProfile.registrationNumber || null,
      address: insertProfile.address || null,
      invoicePrefix: insertProfile.invoicePrefix || "INV",
      nextInvoiceNumber: "1",
      createdAt: new Date(),
    };
    this.businessProfiles.set(insertProfile.userId, profile);
    return profile;
  }

  async updateBusinessProfile(userId: string, updates: UpdateBusinessProfile): Promise<BusinessProfile | undefined> {
    const profile = this.businessProfiles.get(userId);
    if (!profile) return undefined;
    
    const updated = { ...profile, ...updates };
    this.businessProfiles.set(userId, updated);
    return updated;
  }

  async getNextInvoiceNumber(userId: string): Promise<string> {
    const profile = this.businessProfiles.get(userId);
    if (!profile) return "INV-0001";
    
    const num = parseInt(profile.nextInvoiceNumber);
    const invoiceNumber = `${profile.invoicePrefix}-${String(num).padStart(4, '0')}`;
    
    const updated = { 
      ...profile, 
      nextInvoiceNumber: String(num + 1) 
    };
    this.businessProfiles.set(userId, updated);
    
    return invoiceNumber;
  }

  async getAllClients(userId: string): Promise<Client[]> {
    const userClients = this.clients.get(userId);
    if (!userClients) return [];
    return Array.from(userClients.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getClientById(userId: string, clientId: string): Promise<Client | undefined> {
    return this.clients.get(userId)?.get(clientId);
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    if (!this.clients.has(insertClient.userId)) {
      this.clients.set(insertClient.userId, new Map());
    }
    
    const id = randomUUID();
    const client: Client = {
      id,
      ...insertClient,
      email: insertClient.email || null,
      phone: insertClient.phone || null,
      taxId: insertClient.taxId || null,
      address: insertClient.address || null,
      notes: insertClient.notes || null,
      createdAt: new Date(),
    };
    this.clients.get(insertClient.userId)!.set(id, client);
    return client;
  }

  async updateClient(userId: string, clientId: string, updates: UpdateClient): Promise<Client | undefined> {
    const userClients = this.clients.get(userId);
    if (!userClients) return undefined;
    const client = userClients.get(clientId);
    if (!client) return undefined;
    
    const updated = { ...client, ...updates };
    userClients.set(clientId, updated);
    return updated;
  }

  async deleteClient(userId: string, clientId: string): Promise<boolean> {
    const userClients = this.clients.get(userId);
    if (!userClients) return false;
    return userClients.delete(clientId);
  }

  async createPurchase(userId: string, insertPurchase: InsertPurchase): Promise<Purchase> {
    if (insertPurchase.userId !== userId) {
      throw new Error(`Purchase userId mismatch: payload has "${insertPurchase.userId}" but authenticated user is "${userId}"`);
    }
    
    if (!this.purchases.has(userId)) {
      this.purchases.set(userId, new Map());
    }
    
    const userPurchases = this.purchases.get(userId)!;
    const existing = Array.from(userPurchases.values()).find(
      (p) => p.hash === insertPurchase.hash
    );
    if (existing) {
      return existing;
    }
    
    const id = randomUUID();
    const purchase: Purchase = {
      ...insertPurchase,
      id,
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
      createdAt: new Date(),
    };
    userPurchases.set(id, purchase);
    return purchase;
  }

  async getPurchaseByHash(hash: string): Promise<Purchase | undefined> {
    for (const userPurchases of Array.from(this.purchases.values())) {
      const purchase = Array.from(userPurchases.values()).find(
        (p) => p.hash === hash
      );
      if (purchase) return purchase;
    }
    return undefined;
  }

  async getAllPurchases(userId: string): Promise<Purchase[]> {
    const userPurchases = this.purchases.get(userId);
    if (!userPurchases) return [];
    return Array.from(userPurchases.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getPurchasesByContext(userId: string, context: string): Promise<Purchase[]> {
    const userPurchases = this.purchases.get(userId);
    if (!userPurchases) return [];
    return Array.from(userPurchases.values())
      .filter(p => p.context === context)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getPurchaseById(userId: string, id: string): Promise<Purchase | undefined> {
    return this.purchases.get(userId)?.get(id);
  }

  async getPurchasesByCategory(userId: string, category: string, context?: string): Promise<Purchase[]> {
    const userPurchases = this.purchases.get(userId);
    if (!userPurchases) return [];
    return Array.from(userPurchases.values())
      .filter(p => p.category === category && (!context || p.context === context))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async searchPurchases(userId: string, query: string, context?: string): Promise<Purchase[]> {
    const userPurchases = this.purchases.get(userId);
    if (!userPurchases) return [];
    const lowerQuery = query.toLowerCase();
    return Array.from(userPurchases.values())
      .filter(p => 
        (!context || p.context === context) &&
        (p.merchant.toLowerCase().includes(lowerQuery) ||
        (p.category || "Other").toLowerCase().includes(lowerQuery) ||
        p.total.toString().includes(query) ||
        p.date.includes(query))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updatePurchase(userId: string, id: string, updates: Partial<Purchase>): Promise<Purchase | undefined> {
    const userPurchases = this.purchases.get(userId);
    if (!userPurchases) return undefined;
    const purchase = userPurchases.get(id);
    if (!purchase) return undefined;
    
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );
    
    const updated = { ...purchase, ...cleanUpdates };
    userPurchases.set(id, updated);
    return updated;
  }

  async getSettings(userId: string): Promise<Settings> {
    let userSettings = this.settings.get(userId);
    if (!userSettings) {
      userSettings = {
        id: randomUUID(),
        userId,
        theme: "light",
        notifyReturnDeadline: true,
        notifyWarrantyExpiry: true,
        returnAlertDays: "7",
        warrantyAlertDays: "30",
      };
      this.settings.set(userId, userSettings);
    }
    return userSettings;
  }

  async updateSettings(userId: string, updates: Partial<InsertSettings>): Promise<Settings> {
    const currentSettings = await this.getSettings(userId);
    const updated = { ...currentSettings, ...updates };
    this.settings.set(userId, updated);
    return updated;
  }

  async getAllMerchantRules(userId: string): Promise<MerchantRule[]> {
    const userRules = this.merchantRules.get(userId);
    if (!userRules) return [];
    return Array.from(userRules.values());
  }

  async getMerchantRule(userId: string, merchantName: string): Promise<MerchantRule | undefined> {
    const normalizedName = merchantName.trim().toLowerCase();
    const userRules = this.merchantRules.get(userId);
    if (!userRules) return undefined;
    
    return Array.from(userRules.values()).find(
      (rule) => rule.normalizedMerchantName === normalizedName
    );
  }

  async createMerchantRule(insertRule: InsertMerchantRule): Promise<MerchantRule> {
    const normalizedName = insertRule.merchantName.trim().toLowerCase();
    
    // Check for existing rule with same normalized merchant name
    const existing = await this.getMerchantRule(insertRule.userId, insertRule.merchantName);
    if (existing) {
      throw new Error(`A rule for merchant "${insertRule.merchantName}" already exists`);
    }
    
    const id = randomUUID();
    const rule: MerchantRule = {
      ...insertRule,
      id,
      normalizedMerchantName: normalizedName,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!this.merchantRules.has(insertRule.userId)) {
      this.merchantRules.set(insertRule.userId, new Map());
    }
    
    this.merchantRules.get(insertRule.userId)!.set(id, rule);
    return rule;
  }

  async updateMerchantRule(userId: string, id: string, updates: Partial<InsertMerchantRule>): Promise<MerchantRule | undefined> {
    const userRules = this.merchantRules.get(userId);
    if (!userRules) return undefined;
    
    const rule = userRules.get(id);
    if (!rule) return undefined;

    const normalizedName = updates.merchantName 
      ? updates.merchantName.trim().toLowerCase()
      : rule.normalizedMerchantName;

    // Check for duplicate if merchantName is being changed
    if (updates.merchantName && normalizedName !== rule.normalizedMerchantName) {
      const existing = Array.from(userRules.values()).find(
        (r) => r.id !== id && r.normalizedMerchantName === normalizedName
      );
      if (existing) {
        throw new Error(`A rule for merchant "${updates.merchantName}" already exists`);
      }
    }

    const updated: MerchantRule = {
      ...rule,
      ...updates,
      normalizedMerchantName: normalizedName,
      updatedAt: new Date(),
    };
    
    userRules.set(id, updated);
    return updated;
  }

  async deleteMerchantRule(userId: string, id: string): Promise<boolean> {
    const userRules = this.merchantRules.get(userId);
    if (!userRules) return false;
    return userRules.delete(id);
  }
}

export const storage = new MemStorage();
