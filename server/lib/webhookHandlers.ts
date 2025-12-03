import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from '../storage';
import Stripe from 'stripe';
import type { PlanType } from '@shared/schema';

function getPlanLimits(planType: PlanType): { receiptLimit: number | null; userLimit: number | null } {
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

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string, uuid: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    
    await sync.processWebhook(payload, signature, uuid);
    
    const stripe = await getUncachableStripeClient();
    const event = JSON.parse(payload.toString()) as Stripe.Event;
    
    await WebhookHandlers.handleCustomEvents(event);
  }

  private static async handleCustomEvents(event: Stripe.Event): Promise<void> {
    console.log(`[Webhook] Processing event: ${event.type}`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await WebhookHandlers.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await WebhookHandlers.handleSubscriptionChange(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await WebhookHandlers.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.payment_failed':
          await WebhookHandlers.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          break;
      }
    } catch (error) {
      console.error(`[Webhook] Error processing ${event.type}:`, error);
    }
  }

  private static async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    console.log(`[Webhook] Checkout completed: ${session.id}`);
    
    const userId = session.metadata?.userId;
    const planType = session.metadata?.planType as PlanType;
    const billingInterval = session.metadata?.billingInterval;

    if (!userId || !planType) {
      console.error('[Webhook] Missing userId or planType in checkout metadata');
      return;
    }

    const limits = getPlanLimits(planType);

    await storage.updateUserSubscription(userId, {
      stripeSubscriptionId: session.subscription as string,
      planType,
      billingInterval: billingInterval || 'monthly',
      subscriptionStatus: 'active',
      subscriptionCurrentPeriodEnd: null,
      businessReceiptLimitPerMonth: limits.receiptLimit,
      businessUserLimit: limits.userLimit,
    });

    const user = await storage.getUser(userId);
    if (user && user.accountType === 'individual') {
      await storage.upgradeToBusinessAccount(userId, {
        businessName: user.fullName + "'s Business",
        taxId: "",
      });
    }

    console.log(`[Webhook] Updated user ${userId} to plan: ${planType}`);
  }

  private static async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    console.log(`[Webhook] Subscription change: ${subscription.id} - Status: ${subscription.status}`);
    
    const userId = subscription.metadata?.userId;
    const planType = subscription.metadata?.planType as PlanType;
    const billingInterval = subscription.metadata?.billingInterval;

    if (!userId) {
      console.log('[Webhook] No userId in subscription metadata, looking up by customer...');
      const user = await storage.getUserByStripeCustomerId(subscription.customer as string);
      if (!user) {
        console.error('[Webhook] Could not find user for subscription');
        return;
      }
      
      const limits = getPlanLimits(planType || 'free');
      
      await storage.updateUserSubscription(user.id, {
        stripeSubscriptionId: subscription.id,
        planType: planType || user.planType || 'free',
        billingInterval: billingInterval || 'monthly',
        subscriptionStatus: subscription.status,
        subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
        businessReceiptLimitPerMonth: limits.receiptLimit,
        businessUserLimit: limits.userLimit,
      });
      
      console.log(`[Webhook] Updated user ${user.id} subscription status: ${subscription.status}`);
      return;
    }

    const limits = getPlanLimits(planType || 'free');

    await storage.updateUserSubscription(userId, {
      stripeSubscriptionId: subscription.id,
      planType: planType || 'free',
      billingInterval: billingInterval || 'monthly',
      subscriptionStatus: subscription.status,
      subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      businessReceiptLimitPerMonth: limits.receiptLimit,
      businessUserLimit: limits.userLimit,
    });

    console.log(`[Webhook] Updated user ${userId} subscription status: ${subscription.status}`);
  }

  private static async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    console.log(`[Webhook] Subscription deleted: ${subscription.id}`);
    
    const userId = subscription.metadata?.userId;
    
    if (!userId) {
      const user = await storage.getUserByStripeCustomerId(subscription.customer as string);
      if (!user) {
        console.error('[Webhook] Could not find user for deleted subscription');
        return;
      }
      
      await storage.updateUserSubscription(user.id, {
        stripeSubscriptionId: null,
        planType: 'free',
        billingInterval: null,
        subscriptionStatus: 'canceled',
        subscriptionCurrentPeriodEnd: null,
        businessReceiptLimitPerMonth: 0,
        businessUserLimit: 0,
      });
      
      console.log(`[Webhook] Downgraded user ${user.id} to free plan`);
      return;
    }

    await storage.updateUserSubscription(userId, {
      stripeSubscriptionId: null,
      planType: 'free',
      billingInterval: null,
      subscriptionStatus: 'canceled',
      subscriptionCurrentPeriodEnd: null,
      businessReceiptLimitPerMonth: 0,
      businessUserLimit: 0,
    });

    console.log(`[Webhook] Downgraded user ${userId} to free plan`);
  }

  private static async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    console.log(`[Webhook] Payment failed for invoice: ${invoice.id}`);
    
    const subscriptionId = invoice.subscription as string;
    if (!subscriptionId) return;

    const user = await storage.getUserByStripeSubscriptionId(subscriptionId);
    if (!user) {
      console.error('[Webhook] Could not find user for failed payment');
      return;
    }

    await storage.updateUserSubscription(user.id, {
      subscriptionStatus: 'past_due',
    });

    console.log(`[Webhook] Updated user ${user.id} subscription status to past_due`);
  }
}
