import type { Express, Request, Response } from "express";
import { getUncachableStripeClient, getStripePublishableKey } from "./lib/stripeClient";
import { storage } from "./storage";
import { createCheckoutSessionSchema, getPlanDetails, type PlanId, type PlanType } from "@shared/schema";
import { isAuthenticated } from "./auth";

const CURRENT_TERMS_VERSION = "v1.0";

const PLAN_PRICE_ENV_KEYS: Record<PlanId, string> = {
  "solo-monthly": "STRIPE_PRICE_SOLO_MONTHLY",
  "solo-annual": "STRIPE_PRICE_SOLO_ANNUAL",
  "pro-monthly": "STRIPE_PRICE_PRO_MONTHLY",
  "pro-annual": "STRIPE_PRICE_PRO_ANNUAL",
};

function getPriceId(planId: PlanId): string | null {
  const envKey = PLAN_PRICE_ENV_KEYS[planId];
  return process.env[envKey] || null;
}

function applyPlanLimits(planType: PlanType): { receiptLimit: number | null; userLimit: number | null } {
  switch (planType) {
    case "business_solo":
      return { receiptLimit: 1000, userLimit: 1 };
    case "business_pro":
      return { receiptLimit: 5000, userLimit: 10 };
    case "enterprise":
      return { receiptLimit: null, userLimit: null };
    case "free":
    default:
      return { receiptLimit: 0, userLimit: 0 };
  }
}

export function registerBillingRoutes(app: Express) {
  app.get("/api/billing/publishable-key", async (req: Request, res: Response) => {
    try {
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (error: any) {
      console.error("Failed to get Stripe publishable key:", error);
      res.status(500).json({ error: "Failed to get Stripe configuration" });
    }
  });

  app.post("/api/billing/create-checkout-session", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      
      const parsed = createCheckoutSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: parsed.error.flatten() 
        });
      }

      const { planId, termsAccepted, termsVersion } = parsed.data;

      if (!termsAccepted) {
        return res.status(400).json({ 
          error: "You must accept the Business Pricing & Subscription Terms to continue." 
        });
      }

      const priceId = getPriceId(planId);
      if (!priceId) {
        return res.status(400).json({ 
          error: "Selected plan is not available. Please contact support." 
        });
      }

      const stripe = await getUncachableStripeClient();
      
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.fullName,
          metadata: {
            userId: user.id,
            username: user.username,
          },
        });
        customerId = customer.id;
        await storage.updateUserStripeInfo(user.id, { stripeCustomerId: customerId });
      }

      if (!user.termsVersionAccepted || user.termsVersionAccepted !== termsVersion) {
        await storage.updateUserTermsAcceptance(user.id, termsVersion);
      }

      const planDetails = getPlanDetails(planId);
      
      const baseUrl = process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : `${req.protocol}://${req.get('host')}`;

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${baseUrl}/pricing?success=true&plan=${planId}`,
        cancel_url: `${baseUrl}/pricing?canceled=true`,
        metadata: {
          userId: user.id,
          planId: planId,
          planType: planDetails.planType,
          billingInterval: planDetails.billingInterval,
        },
        subscription_data: {
          metadata: {
            userId: user.id,
            planId: planId,
            planType: planDetails.planType,
            billingInterval: planDetails.billingInterval,
          },
        },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Failed to create checkout session:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.get("/api/billing/portal-session", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      
      if (!user.stripeCustomerId) {
        return res.status(400).json({ 
          error: "No billing account found. Please subscribe to a plan first." 
        });
      }

      const stripe = await getUncachableStripeClient();
      
      const baseUrl = process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : `${req.protocol}://${req.get('host')}`;

      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${baseUrl}/profile`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Failed to create portal session:", error);
      res.status(500).json({ error: "Failed to access billing portal" });
    }
  });

  app.get("/api/billing/subscription", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      
      res.json({
        planType: user.planType || "free",
        billingInterval: user.billingInterval,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
        businessReceiptLimitPerMonth: user.businessReceiptLimitPerMonth,
        businessUserLimit: user.businessUserLimit,
        termsVersionAccepted: user.termsVersionAccepted,
        termsAcceptedAt: user.termsAcceptedAt,
      });
    } catch (error: any) {
      console.error("Failed to get subscription:", error);
      res.status(500).json({ error: "Failed to get subscription details" });
    }
  });

  app.get("/api/billing/terms-version", (req: Request, res: Response) => {
    res.json({ currentVersion: CURRENT_TERMS_VERSION });
  });

  app.get("/api/billing/usage", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      
      const receiptCount = await storage.getUserReceiptCount(user.id);
      
      let teamMemberCount = 1;
      if (user.activeOrganizationId) {
        const members = await storage.getOrganizationMembers(user.activeOrganizationId);
        teamMemberCount = members?.length || 1;
      }

      res.json({
        usage: {
          receiptsUsed: receiptCount,
          usersCount: teamMemberCount,
        }
      });
    } catch (error: any) {
      console.error("Failed to get usage:", error);
      res.status(500).json({ error: "Failed to get usage data" });
    }
  });

}

export async function handleSubscriptionWebhook(
  userId: string,
  subscriptionId: string,
  status: string,
  planType: PlanType,
  billingInterval: string,
  currentPeriodEnd: Date | null
) {
  const limits = applyPlanLimits(planType);
  
  await storage.updateUserSubscription(userId, {
    stripeSubscriptionId: subscriptionId,
    planType,
    billingInterval,
    subscriptionStatus: status,
    subscriptionCurrentPeriodEnd: currentPeriodEnd,
    businessReceiptLimitPerMonth: limits.receiptLimit,
    businessUserLimit: limits.userLimit,
  });
  
  if (planType !== "free" && status === "active") {
    const user = await storage.getUser(userId);
    if (user && user.accountType === "individual") {
      await storage.upgradeToBusinessAccount(userId, {
        businessName: user.fullName + "'s Business",
        taxId: "",
      });
    }
  }
}
