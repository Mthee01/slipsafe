import { db } from "../db";
import { organizations, organizationMembers, purchases } from "@shared/schema";
import { eq, and, gte, lte, count } from "drizzle-orm";
import type { PlanCode, PlanLimitResult, PlanLimitType } from "@shared/schema";
import { getPlanLimitsByCode } from "@shared/schema";

interface CheckPlanLimitOptions {
  monthStart?: Date;
  monthEnd?: Date;
}

function getUpgradeRecommendation(currentPlanCode: PlanCode, limitType: PlanLimitType): PlanLimitResult["recommendation"] | undefined {
  if (currentPlanCode === "BUSINESS_SOLO") {
    return {
      recommendedPlanCode: "BUSINESS_PRO",
      recommendedPlanName: "Business Pro",
      reason: limitType === "members" 
        ? "You need more team members than your current plan allows."
        : "You are uploading more receipts than your current plan allows each month."
    };
  }
  
  if (currentPlanCode === "BUSINESS_PRO") {
    return {
      recommendedPlanCode: "BUSINESS_ENTERPRISE",
      recommendedPlanName: "Enterprise",
      reason: limitType === "members"
        ? "You need more than 10 team members. Contact us for an Enterprise plan."
        : "You need more than 5,000 receipts per month. Contact us for an Enterprise plan."
    };
  }
  
  return undefined;
}

export async function checkPlanLimit(
  organizationId: string,
  type: PlanLimitType,
  options?: CheckPlanLimitOptions
): Promise<PlanLimitResult> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) {
    return {
      ok: false,
      message: "Organization not found"
    };
  }

  const planCode = org.planCode as PlanCode;
  const planLimits = getPlanLimitsByCode(planCode);

  if (type === "members") {
    const maxUsers = planLimits.maxUsers;
    
    if (maxUsers === null) {
      return { ok: true };
    }

    const [memberCount] = await db
      .select({ count: count() })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.isActive, true)
        )
      );

    const currentCount = memberCount?.count ?? 0;

    if (currentCount < maxUsers) {
      return { 
        ok: true,
        currentCount,
        maxAllowed: maxUsers
      };
    }

    return {
      ok: false,
      reason: "max_users_reached",
      message: `You have reached the maximum number of users (${maxUsers}) for your ${planLimits.name} plan.`,
      currentCount,
      maxAllowed: maxUsers,
      recommendation: getUpgradeRecommendation(planCode, "members")
    };
  }

  if (type === "receipts") {
    const maxReceipts = planLimits.maxReceiptsPerMonth;
    
    if (maxReceipts === null) {
      return { ok: true };
    }

    const now = new Date();
    const monthStart = options?.monthStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = options?.monthEnd ?? new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const monthStartStr = monthStart.toISOString().split('T')[0];
    const monthEndStr = monthEnd.toISOString().split('T')[0];

    const [receiptCount] = await db
      .select({ count: count() })
      .from(purchases)
      .where(
        and(
          eq(purchases.organizationId, organizationId),
          eq(purchases.context, "business"),
          gte(purchases.date, monthStartStr),
          lte(purchases.date, monthEndStr)
        )
      );

    const currentCount = receiptCount?.count ?? 0;

    if (currentCount < maxReceipts) {
      return { 
        ok: true,
        currentCount,
        maxAllowed: maxReceipts
      };
    }

    return {
      ok: false,
      reason: "max_receipts_reached",
      message: `You have reached the monthly receipt limit (${maxReceipts}) for your ${planLimits.name} plan.`,
      currentCount,
      maxAllowed: maxReceipts,
      recommendation: getUpgradeRecommendation(planCode, "receipts")
    };
  }

  return { ok: true };
}

export async function canAddMember(organizationId: string): Promise<PlanLimitResult> {
  return checkPlanLimit(organizationId, "members");
}

export async function canAddReceipt(organizationId: string): Promise<PlanLimitResult> {
  return checkPlanLimit(organizationId, "receipts");
}

export async function validatePlanDowngrade(
  organizationId: string,
  targetPlanCode: PlanCode
): Promise<{ ok: boolean; message?: string }> {
  const targetLimits = getPlanLimitsByCode(targetPlanCode);

  if (targetLimits.maxUsers !== null) {
    const [memberCount] = await db
      .select({ count: count() })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.isActive, true)
        )
      );

    const currentMembers = memberCount?.count ?? 0;

    if (currentMembers > targetLimits.maxUsers) {
      return {
        ok: false,
        message: `You currently have ${currentMembers} team member${currentMembers !== 1 ? 's' : ''}. ${targetLimits.name} allows only ${targetLimits.maxUsers} user${targetLimits.maxUsers !== 1 ? 's' : ''}. Please remove extra members before downgrading.`
      };
    }
  }

  return { ok: true };
}

export async function getOrganizationUsage(organizationId: string): Promise<{
  memberCount: number;
  monthlyReceiptCount: number;
  planCode: PlanCode;
  planName: string;
  limits: { maxUsers: number | null; maxReceiptsPerMonth: number | null };
}> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) {
    throw new Error("Organization not found");
  }

  const planCode = org.planCode as PlanCode;
  const planLimits = getPlanLimitsByCode(planCode);

  const [memberCount] = await db
    .select({ count: count() })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.isActive, true)
      )
    );

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthStartStr = monthStart.toISOString().split('T')[0];
  const monthEndStr = monthEnd.toISOString().split('T')[0];

  const [receiptCount] = await db
    .select({ count: count() })
    .from(purchases)
    .where(
      and(
        eq(purchases.organizationId, organizationId),
        eq(purchases.context, "business"),
        gte(purchases.date, monthStartStr),
        lte(purchases.date, monthEndStr)
      )
    );

  return {
    memberCount: memberCount?.count ?? 0,
    monthlyReceiptCount: receiptCount?.count ?? 0,
    planCode,
    planName: planLimits.name,
    limits: {
      maxUsers: planLimits.maxUsers,
      maxReceiptsPerMonth: planLimits.maxReceiptsPerMonth
    }
  };
}
