import { Router, Request, Response } from 'express';
import { isAuthenticated } from './auth';
import { 
  createCheckoutSession, 
  createPortalSession, 
  listInvoices as listStripeInvoices,
  getUpcomingInvoice,
  cancelSubscription,
  resumeSubscription,
  logCrmInteraction
} from './lib/billing/stripeService';
import {
  getEntitlementsForAccount,
  getSubscriptionDetails,
  getAllPlans,
  getPlanByCode,
  ensureCrmAccount
} from './lib/billing/subscriptionService';
import { createBillingCheckoutSchema } from '@shared/schema';
import type { User } from '@shared/schema';

const router = Router();

function getAccountInfo(req: Request): { accountType: 'user' | 'organization'; accountId: string; email: string } {
  const user = req.user as User;
  
  if (user.activeContext === 'business' && user.activeOrganizationId) {
    return {
      accountType: 'organization',
      accountId: user.activeOrganizationId,
      email: user.email,
    };
  }
  
  return {
    accountType: 'user',
    accountId: user.id,
    email: user.email,
  };
}

router.get('/plans', async (_req: Request, res: Response) => {
  try {
    const plans = await getAllPlans();
    res.json(plans);
  } catch (error: any) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

router.get('/subscription', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { accountType, accountId } = getAccountInfo(req);
    
    const details = await getSubscriptionDetails(accountType, accountId);
    const entitlements = await getEntitlementsForAccount(accountType, accountId);
    
    res.json({
      subscription: details?.subscription || null,
      plan: details?.plan || entitlements.plan,
      features: details?.features || entitlements.features,
      usage: details?.usage || entitlements.usage,
      paymentMethod: details?.paymentMethod || null,
      entitlements: {
        canUseBusinessMode: entitlements.canUseBusinessMode,
        canAddReceipts: entitlements.canAddReceipts,
        canAddMembers: entitlements.canAddMembers,
        receiptsRemaining: entitlements.receiptsRemaining,
        membersRemaining: entitlements.membersRemaining,
        subscriptionStatus: entitlements.subscriptionStatus,
      },
    });
  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription details' });
  }
});

router.get('/invoices', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { accountType, accountId } = getAccountInfo(req);
    
    const details = await getSubscriptionDetails(accountType, accountId);
    
    if (!details?.subscription?.stripeCustomerId) {
      return res.json({ invoices: [] });
    }
    
    const stripeInvoices = await listStripeInvoices(details.subscription.stripeCustomerId, 20);
    
    const invoices = stripeInvoices.map((inv) => ({
      id: inv.id,
      amountDue: inv.amount_due,
      amountPaid: inv.amount_paid,
      currency: inv.currency,
      status: inv.status,
      hostedInvoiceUrl: inv.hosted_invoice_url,
      pdfUrl: inv.invoice_pdf,
      periodStart: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
      periodEnd: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
      createdAt: inv.created ? new Date(inv.created * 1000).toISOString() : null,
    }));
    
    res.json({ invoices });
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

router.post('/create-checkout-session', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const parsed = createBillingCheckoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    const { planCode, billingPeriod } = parsed.data;
    const user = req.user as User;
    const { accountType, accountId, email } = getAccountInfo(req);

    const plan = await getPlanByCode(planCode);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (!plan.isBusinessPlan) {
      return res.status(400).json({ error: 'Cannot checkout for free plan' });
    }

    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPLIT_DEPLOYMENT_URL || 'http://localhost:5000';

    const { url, sessionId } = await createCheckoutSession({
      planCode,
      billingPeriod,
      accountType,
      accountId,
      customerEmail: email,
      successUrl: `${baseUrl}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/settings/billing?canceled=true`,
      metadata: {
        userId: user.id,
        userName: user.fullName,
      },
    });

    await ensureCrmAccount(accountType, accountId);

    res.json({ url, sessionId });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

router.post('/portal', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { accountType, accountId } = getAccountInfo(req);
    
    const details = await getSubscriptionDetails(accountType, accountId);
    
    if (!details?.subscription?.stripeCustomerId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPLIT_DEPLOYMENT_URL || 'http://localhost:5000';

    const url = await createPortalSession({
      stripeCustomerId: details.subscription.stripeCustomerId,
      returnUrl: `${baseUrl}/settings/billing`,
    });

    res.json({ url });
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: 'Failed to create billing portal session' });
  }
});

router.post('/cancel', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { accountType, accountId } = getAccountInfo(req);
    const { immediately = false } = req.body;
    
    const details = await getSubscriptionDetails(accountType, accountId);
    
    if (!details?.subscription?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    await cancelSubscription(details.subscription.stripeSubscriptionId, immediately);
    
    await logCrmInteraction(
      accountType,
      accountId,
      'Subscription Cancellation Requested',
      `User requested to cancel subscription${immediately ? ' immediately' : ' at period end'}`,
      'system',
      details.subscription.id
    );

    res.json({ success: true, message: immediately ? 'Subscription canceled' : 'Subscription will be canceled at the end of the billing period' });
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

router.post('/resume', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { accountType, accountId } = getAccountInfo(req);
    
    const details = await getSubscriptionDetails(accountType, accountId);
    
    if (!details?.subscription?.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    await resumeSubscription(details.subscription.stripeSubscriptionId);
    
    await logCrmInteraction(
      accountType,
      accountId,
      'Subscription Resumed',
      'User resumed their subscription',
      'system',
      details.subscription.id
    );

    res.json({ success: true, message: 'Subscription resumed' });
  } catch (error: any) {
    console.error('Error resuming subscription:', error);
    res.status(500).json({ error: 'Failed to resume subscription' });
  }
});

router.get('/entitlements', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { accountType, accountId } = getAccountInfo(req);
    const entitlements = await getEntitlementsForAccount(accountType, accountId);
    res.json(entitlements);
  } catch (error: any) {
    console.error('Error fetching entitlements:', error);
    res.status(500).json({ error: 'Failed to fetch entitlements' });
  }
});

export default router;
