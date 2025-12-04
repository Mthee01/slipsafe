import { db } from "../../server/db";
import { 
  users, 
  organizations, 
  organizationMembers, 
  purchases,
  businessProfiles
} from "../../shared/schema";
import type { 
  PlanCode, 
  OrgMemberRole,
  Context
} from "../../shared/schema";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

export const PLAN_CODES = {
  SOLO: "BUSINESS_SOLO" as PlanCode,
  PRO: "BUSINESS_PRO" as PlanCode,
  ENTERPRISE: "BUSINESS_ENTERPRISE" as PlanCode,
};

export interface CreateUserOptions {
  email?: string;
  fullName?: string;
  username?: string;
  password?: string;
  accountType?: "individual" | "business";
  emailVerified?: boolean;
}

export async function createUser(options: CreateUserOptions = {}) {
  const id = randomUUID();
  const username = options.username || `test_user_${id.slice(0, 8)}`;
  const email = options.email || `${username}@test.com`;
  const fullName = options.fullName || `Test User ${id.slice(0, 8)}`;
  const password = await bcrypt.hash(options.password || "password123", 10);
  
  const [user] = await db.insert(users).values({
    id,
    username,
    email,
    fullName,
    password,
    phone: "+27821234567",
    accountType: options.accountType || "individual",
    emailVerified: options.emailVerified ?? true,
  }).returning();
  
  return user;
}

export interface CreateOrganizationOptions {
  name?: string;
  ownerUserId: string;
  planCode?: PlanCode;
  billingEmail?: string;
}

export async function createOrganization(options: CreateOrganizationOptions) {
  const id = randomUUID();
  const name = options.name || `Test Organization ${id.slice(0, 8)}`;
  const planCode = options.planCode || PLAN_CODES.SOLO;
  const billingEmail = options.billingEmail || `billing@${name.toLowerCase().replace(/\s+/g, "-")}.test`;
  
  const [org] = await db.insert(organizations).values({
    id,
    name,
    ownerUserId: options.ownerUserId,
    planCode,
    billingEmail,
    billingStatus: "active",
  }).returning();
  
  return org;
}

export interface AddMemberOptions {
  organizationId: string;
  userId: string;
  role?: OrgMemberRole;
  isActive?: boolean;
  invitedBy?: string;
}

export async function addMember(options: AddMemberOptions) {
  const id = randomUUID();
  
  const [member] = await db.insert(organizationMembers).values({
    id,
    organizationId: options.organizationId,
    userId: options.userId,
    role: options.role || "member",
    isActive: options.isActive ?? true,
    invitedBy: options.invitedBy,
  }).returning();
  
  return member;
}

export interface CreatePurchaseOptions {
  userId: string;
  organizationId?: string | null;
  context?: Context;
  date?: string;
  merchant?: string;
  category?: string;
  total?: string;
  vatAmount?: string;
}

export async function createPurchase(options: CreatePurchaseOptions) {
  const id = randomUUID();
  const now = new Date();
  const date = options.date || now.toISOString().split('T')[0];
  
  const [purchase] = await db.insert(purchases).values({
    id,
    userId: options.userId,
    organizationId: options.organizationId || null,
    context: options.context || "personal",
    hash: `test_hash_${id}`,
    merchant: options.merchant || "Test Merchant",
    date,
    total: options.total || "100.00",
    category: options.category || "Other",
    vatAmount: options.vatAmount || "15.00",
    sourceType: "upload",
  }).returning();
  
  return purchase;
}

export async function createManyPurchases(
  count: number,
  options: Omit<CreatePurchaseOptions, 'total'> & { baseTotal?: number }
) {
  const results = [];
  for (let i = 0; i < count; i++) {
    const purchase = await createPurchase({
      ...options,
      total: ((options.baseTotal || 100) + i).toFixed(2),
    });
    results.push(purchase);
  }
  return results;
}

export async function createBusinessProfile(userId: string, businessName?: string) {
  const id = randomUUID();
  
  const [profile] = await db.insert(businessProfiles).values({
    id,
    userId,
    businessName: businessName || `Business ${id.slice(0, 8)}`,
    taxId: `TAX${id.slice(0, 6)}`,
  }).returning();
  
  return profile;
}

export async function setUserActiveOrg(userId: string, organizationId: string | null) {
  const { eq } = await import("drizzle-orm");
  await db.update(users)
    .set({ 
      activeOrganizationId: organizationId,
      activeContext: organizationId ? "business" : "personal"
    })
    .where(eq(users.id, userId));
}

export async function getMemberCount(organizationId: string): Promise<number> {
  const { eq, and, count } = await import("drizzle-orm");
  const [result] = await db
    .select({ count: count() })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.isActive, true)
      )
    );
  return result?.count ?? 0;
}

export async function getReceiptCount(organizationId: string): Promise<number> {
  const { eq, and, count, gte, lte } = await import("drizzle-orm");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const [result] = await db
    .select({ count: count() })
    .from(purchases)
    .where(
      and(
        eq(purchases.organizationId, organizationId),
        eq(purchases.context, "business"),
        gte(purchases.date, monthStart.toISOString().split('T')[0]),
        lte(purchases.date, monthEnd.toISOString().split('T')[0])
      )
    );
  return result?.count ?? 0;
}
