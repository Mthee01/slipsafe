import { getUncachableStripeClient, getStripePublishableKey } from '../stripeClient';
import { db } from '../../db';
import { plans, subscriptions, crmAccounts, crmInteractions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type Stripe from 'stripe';

export interface CreateCheckoutOptions {
  planCode: string;
  billingPeriod: 'monthly' | 'annual';
  accountType: 'user' | 'organization';
  accountId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface PortalSessionOptions {
  stripeCustomerId: string;
  returnUrl: string;
}

export async function getOrCreateStripeCustomer(
  email: string,
  name: string,
  metadata: Record<string, string>
): Promise<string> {
  const stripe = await getUncachableStripeClient();
  
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0].id;
  }

  const customer = await stripe.customers.create({
    email,
    name,
    metadata,
  });

  return customer.id;
}

export async function createCheckoutSession(options: CreateCheckoutOptions): Promise<{ url: string; sessionId: string }> {
  const stripe = await getUncachableStripeClient();

  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.code, options.planCode), eq(plans.isActive, true)))
    .limit(1);

  if (!plan) {
    throw new Error(`Plan not found: ${options.planCode}`);
  }

  const priceId = options.billingPeriod === 'annual' 
    ? plan.stripeAnnualPriceId 
    : plan.stripeMonthlyPriceId;

  if (!priceId) {
    throw new Error(`No Stripe price configured for ${options.planCode} ${options.billingPeriod}`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: options.customerEmail,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    metadata: {
      planCode: options.planCode,
      planId: plan.id,
      billingPeriod: options.billingPeriod,
      accountType: options.accountType,
      accountId: options.accountId,
      ...options.metadata,
    },
    subscription_data: {
      metadata: {
        planCode: options.planCode,
        planId: plan.id,
        billingPeriod: options.billingPeriod,
        accountType: options.accountType,
        accountId: options.accountId,
        ...options.metadata,
      },
    },
  });

  return {
    url: session.url!,
    sessionId: session.id,
  };
}

export async function createPortalSession(options: PortalSessionOptions): Promise<string> {
  const stripe = await getUncachableStripeClient();

  const session = await stripe.billingPortal.sessions.create({
    customer: options.stripeCustomerId,
    return_url: options.returnUrl,
  });

  return session.url;
}

export async function cancelSubscription(stripeSubscriptionId: string, cancelImmediately = false): Promise<Stripe.Subscription> {
  const stripe = await getUncachableStripeClient();

  if (cancelImmediately) {
    return await stripe.subscriptions.cancel(stripeSubscriptionId);
  }

  return await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
}

export async function resumeSubscription(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
  const stripe = await getUncachableStripeClient();

  return await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
  });
}

export async function updateSubscriptionPlan(
  stripeSubscriptionId: string,
  newPriceId: string
): Promise<Stripe.Subscription> {
  const stripe = await getUncachableStripeClient();

  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  
  return await stripe.subscriptions.update(stripeSubscriptionId, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: newPriceId,
      },
    ],
    proration_behavior: 'create_prorations',
  });
}

export async function getStripeSubscription(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
  const stripe = await getUncachableStripeClient();
  return await stripe.subscriptions.retrieve(stripeSubscriptionId);
}

export async function listInvoices(stripeCustomerId: string, limit = 10): Promise<Stripe.Invoice[]> {
  const stripe = await getUncachableStripeClient();
  
  const invoices = await stripe.invoices.list({
    customer: stripeCustomerId,
    limit,
  });

  return invoices.data;
}

export async function getUpcomingInvoice(stripeCustomerId: string): Promise<any | null> {
  const stripe = await getUncachableStripeClient();
  
  try {
    const stripeAny = stripe as any;
    if (stripeAny.invoices.retrieveUpcoming) {
      return await stripeAny.invoices.retrieveUpcoming({ customer: stripeCustomerId });
    }
    return null;
  } catch {
    return null;
  }
}

export async function logCrmInteraction(
  accountType: 'user' | 'organization',
  accountId: string,
  subject: string,
  body: string,
  source: 'stripe_webhook' | 'system' | 'manual' = 'stripe_webhook',
  subscriptionId?: string
): Promise<void> {
  const [crmAccount] = await db
    .select()
    .from(crmAccounts)
    .where(and(
      eq(crmAccounts.accountType, accountType),
      eq(crmAccounts.accountId, accountId)
    ))
    .limit(1);

  if (crmAccount) {
    await db.insert(crmInteractions).values({
      crmAccountId: crmAccount.id,
      type: 'system_event',
      subject,
      body,
      source,
      relatedSubscriptionId: subscriptionId,
    });
  }
}

export { getStripePublishableKey };
