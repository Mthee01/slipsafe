import { db } from '../../db';
import { 
  plans, planFeatures, subscriptions, subscriptionUsage,
  invoices, paymentMethods, crmAccounts,
  users, organizations, purchases, organizationMembers
} from '@shared/schema';
import type { 
  Plan, PlanFeature, Subscription, SubscriptionUsage, 
  Invoice, PaymentMethod, CrmAccount
} from '@shared/schema';
import { eq, and, count, gte, lte } from 'drizzle-orm';

export interface Entitlements {
  plan: Plan | null;
  features: Record<string, number | boolean | string | null>;
  subscription: Subscription | null;
  usage: SubscriptionUsage | null;
  subscriptionStatus: string;
  canUseBusinessMode: boolean;
  canAddReceipts: boolean;
  canAddMembers: boolean;
  receiptsRemaining: number | null;
  membersRemaining: number | null;
}

export interface SubscriptionDetails {
  subscription: Subscription;
  plan: Plan;
  features: Record<string, number | boolean | string | null>;
  usage: SubscriptionUsage | null;
  paymentMethod: PaymentMethod | null;
  invoices: Invoice[];
}

export async function getActiveSubscription(
  accountType: 'user' | 'organization',
  accountId: string
): Promise<Subscription | null> {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(and(
      eq(subscriptions.accountType, accountType),
      eq(subscriptions.accountId, accountId),
      eq(subscriptions.status, 'active')
    ))
    .limit(1);

  if (subscription) return subscription;

  const [trialingSubscription] = await db
    .select()
    .from(subscriptions)
    .where(and(
      eq(subscriptions.accountType, accountType),
      eq(subscriptions.accountId, accountId),
      eq(subscriptions.status, 'trialing')
    ))
    .limit(1);

  return trialingSubscription || null;
}

export async function getPlanWithFeatures(planId: string): Promise<{ plan: Plan; features: Record<string, number | boolean | string | null> } | null> {
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1);

  if (!plan) return null;

  const features = await db
    .select()
    .from(planFeatures)
    .where(eq(planFeatures.planId, planId));

  const featureMap: Record<string, number | boolean | string | null> = {};
  for (const f of features) {
    if (f.valueInt !== null) {
      featureMap[f.key] = f.valueInt;
    } else if (f.valueBool !== null) {
      featureMap[f.key] = f.valueBool;
    } else if (f.valueText !== null) {
      featureMap[f.key] = f.valueText;
    } else {
      featureMap[f.key] = null;
    }
  }

  return { plan, features: featureMap };
}

export async function getFreePlan(): Promise<Plan | null> {
  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.code, 'free'), eq(plans.isActive, true)))
    .limit(1);

  return plan || null;
}

export async function getCurrentUsage(
  subscriptionId: string
): Promise<SubscriptionUsage | null> {
  const now = new Date();

  const [usage] = await db
    .select()
    .from(subscriptionUsage)
    .where(and(
      eq(subscriptionUsage.subscriptionId, subscriptionId),
      lte(subscriptionUsage.periodStart, now),
      gte(subscriptionUsage.periodEnd, now)
    ))
    .limit(1);

  return usage || null;
}

export async function getOrCreateCurrentUsage(
  subscriptionId: string,
  subscription: Subscription
): Promise<SubscriptionUsage> {
  const existing = await getCurrentUsage(subscriptionId);
  if (existing) return existing;

  const periodStart = subscription.currentPeriodStart || new Date();
  const periodEnd = subscription.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [newUsage] = await db
    .insert(subscriptionUsage)
    .values({
      subscriptionId,
      periodStart,
      periodEnd,
      receiptsCount: 0,
      teamMembersCount: 0,
    })
    .returning();

  return newUsage;
}

export async function incrementReceiptCount(subscriptionId: string): Promise<void> {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);

  if (!subscription) return;

  const usage = await getOrCreateCurrentUsage(subscriptionId, subscription);

  await db
    .update(subscriptionUsage)
    .set({ 
      receiptsCount: usage.receiptsCount + 1,
      updatedAt: new Date()
    })
    .where(eq(subscriptionUsage.id, usage.id));
}

export async function getEntitlementsForAccount(
  accountType: 'user' | 'organization',
  accountId: string
): Promise<Entitlements> {
  const subscription = await getActiveSubscription(accountType, accountId);

  if (!subscription) {
    const freePlan = await getFreePlan();
    return {
      plan: freePlan,
      features: {
        business_mode_enabled: false,
        max_business_receipts_per_month: 0,
        max_team_members: 0,
        vat_reports_enabled: false,
        csv_export_enabled: false,
        pdf_export_enabled: false,
      },
      subscription: null,
      usage: null,
      subscriptionStatus: 'none',
      canUseBusinessMode: false,
      canAddReceipts: true,
      canAddMembers: false,
      receiptsRemaining: null,
      membersRemaining: null,
    };
  }

  const planData = await getPlanWithFeatures(subscription.planId);
  if (!planData) {
    return {
      plan: null,
      features: {},
      subscription,
      usage: null,
      subscriptionStatus: subscription.status,
      canUseBusinessMode: false,
      canAddReceipts: false,
      canAddMembers: false,
      receiptsRemaining: null,
      membersRemaining: null,
    };
  }

  const usage = await getOrCreateCurrentUsage(subscription.id, subscription);

  const maxReceipts = planData.features.max_business_receipts_per_month as number | null;
  const maxMembers = planData.features.max_team_members as number | null;
  const businessModeEnabled = planData.features.business_mode_enabled as boolean ?? planData.plan.isBusinessPlan;

  const receiptsRemaining = maxReceipts !== null ? Math.max(0, maxReceipts - usage.receiptsCount) : null;
  
  let currentMemberCount = 0;
  if (accountType === 'organization') {
    const [memberCount] = await db
      .select({ count: count() })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, accountId),
        eq(organizationMembers.isActive, true)
      ));
    currentMemberCount = memberCount?.count ?? 0;
  }
  
  const membersRemaining = maxMembers !== null ? Math.max(0, maxMembers - currentMemberCount) : null;

  const isActiveSubscription = subscription.status === 'active' || subscription.status === 'trialing';

  return {
    plan: planData.plan,
    features: planData.features,
    subscription,
    usage,
    subscriptionStatus: subscription.status,
    canUseBusinessMode: businessModeEnabled && isActiveSubscription,
    canAddReceipts: receiptsRemaining === null || receiptsRemaining > 0,
    canAddMembers: membersRemaining === null || membersRemaining > 0,
    receiptsRemaining,
    membersRemaining,
  };
}

export async function getSubscriptionDetails(
  accountType: 'user' | 'organization',
  accountId: string
): Promise<SubscriptionDetails | null> {
  const subscription = await getActiveSubscription(accountType, accountId);
  if (!subscription) return null;

  const planData = await getPlanWithFeatures(subscription.planId);
  if (!planData) return null;

  const usage = await getCurrentUsage(subscription.id);

  const [paymentMethod] = await db
    .select()
    .from(paymentMethods)
    .where(and(
      eq(paymentMethods.subscriptionId, subscription.id),
      eq(paymentMethods.isDefault, true)
    ))
    .limit(1);

  const invoiceList = await db
    .select()
    .from(invoices)
    .where(eq(invoices.subscriptionId, subscription.id))
    .orderBy(invoices.createdAt)
    .limit(10);

  return {
    subscription,
    plan: planData.plan,
    features: planData.features,
    usage,
    paymentMethod: paymentMethod || null,
    invoices: invoiceList,
  };
}

export async function createSubscription(data: {
  planId: string;
  billingPeriod: 'monthly' | 'annual' | 'none';
  accountType: 'user' | 'organization';
  accountId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  status?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}): Promise<Subscription> {
  const [subscription] = await db
    .insert(subscriptions)
    .values({
      planId: data.planId,
      billingPeriod: data.billingPeriod,
      accountType: data.accountType,
      accountId: data.accountId,
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      status: data.status || 'active',
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
    })
    .returning();

  return subscription;
}

export async function updateSubscription(
  subscriptionId: string,
  updates: Partial<{
    planId: string;
    billingPeriod: string;
    stripeSubscriptionId: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
  }>
): Promise<Subscription> {
  const [subscription] = await db
    .update(subscriptions)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  return subscription;
}

export async function getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  return subscription || null;
}

export async function ensureCrmAccount(
  accountType: 'user' | 'organization',
  accountId: string
): Promise<CrmAccount> {
  const [existing] = await db
    .select()
    .from(crmAccounts)
    .where(and(
      eq(crmAccounts.accountType, accountType),
      eq(crmAccounts.accountId, accountId)
    ))
    .limit(1);

  if (existing) return existing;

  let displayName = 'Unknown';
  let primaryEmail = '';
  let primaryPhone: string | undefined;

  if (accountType === 'user') {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, accountId))
      .limit(1);

    if (user) {
      displayName = user.fullName;
      primaryEmail = user.email;
      primaryPhone = user.phone || undefined;
    }
  } else {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, accountId))
      .limit(1);

    if (org) {
      displayName = org.name;
      primaryEmail = org.billingEmail;
      primaryPhone = org.phone || undefined;
    }
  }

  const [newAccount] = await db
    .insert(crmAccounts)
    .values({
      accountType,
      accountId,
      displayName,
      primaryEmail,
      primaryPhone,
      sizeSegment: accountType === 'organization' ? 'sme' : 'individual',
      lifecycleStage: 'lead',
    })
    .returning();

  return newAccount;
}

export async function getAllPlans(): Promise<Plan[]> {
  return await db
    .select()
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(plans.sortOrder);
}

export async function getPlanByCode(code: string): Promise<Plan | null> {
  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.code, code), eq(plans.isActive, true)))
    .limit(1);

  return plan || null;
}
