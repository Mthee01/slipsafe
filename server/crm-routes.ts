import { Router, Request, Response } from 'express';
import { isAuthenticated } from './auth';
import { db } from './db';
import { 
  crmAccounts, crmInteractions, crmTasks,
  subscriptions, plans, invoices, users, organizations
} from '@shared/schema';
import type { User, CrmAccount, CrmInteraction, CrmTask } from '@shared/schema';
import { eq, and, or, ilike, desc, count } from 'drizzle-orm';
import { createCrmInteractionSchema, createCrmTaskSchema, updateCrmTaskSchema } from '@shared/schema';

const router = Router();

async function isAdmin(req: Request, res: Response, next: Function) {
  const user = req.user as User;
  if (!user || (user.role !== 'admin' && user.role !== 'support')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

router.get('/accounts', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const planCode = req.query.planCode as string;
    const lifecycleStage = req.query.lifecycleStage as string;

    let query = db.select().from(crmAccounts);

    const conditions = [];
    
    if (search) {
      conditions.push(
        or(
          ilike(crmAccounts.displayName, `%${search}%`),
          ilike(crmAccounts.primaryEmail, `%${search}%`)
        )
      );
    }
    
    if (lifecycleStage) {
      conditions.push(eq(crmAccounts.lifecycleStage, lifecycleStage));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const accounts = await query
      .orderBy(desc(crmAccounts.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(crmAccounts);

    const accountsWithSubscription = await Promise.all(
      accounts.map(async (account) => {
        const [subscription] = await db
          .select()
          .from(subscriptions)
          .where(and(
            eq(subscriptions.accountType, account.accountType),
            eq(subscriptions.accountId, account.accountId)
          ))
          .limit(1);

        let plan = null;
        if (subscription?.planId) {
          [plan] = await db
            .select()
            .from(plans)
            .where(eq(plans.id, subscription.planId))
            .limit(1);
        }

        const [interactionCount] = await db
          .select({ count: count() })
          .from(crmInteractions)
          .where(eq(crmInteractions.crmAccountId, account.id));

        return {
          ...account,
          subscription: subscription || null,
          plan: plan || null,
          interactionCount: interactionCount?.count || 0,
        };
      })
    );

    res.json({
      accounts: accountsWithSubscription,
      pagination: {
        page,
        limit,
        total: totalResult?.count || 0,
        totalPages: Math.ceil((totalResult?.count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching CRM accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

router.get('/accounts/:id', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [account] = await db
      .select()
      .from(crmAccounts)
      .where(eq(crmAccounts.id, id))
      .limit(1);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.accountType, account.accountType),
        eq(subscriptions.accountId, account.accountId)
      ))
      .limit(1);

    let plan = null;
    if (subscription?.planId) {
      [plan] = await db
        .select()
        .from(plans)
        .where(eq(plans.id, subscription.planId))
        .limit(1);
    }

    let accountInvoices: any[] = [];
    if (subscription) {
      accountInvoices = await db
        .select()
        .from(invoices)
        .where(eq(invoices.subscriptionId, subscription.id))
        .orderBy(desc(invoices.createdAt))
        .limit(10);
    }

    const interactions = await db
      .select()
      .from(crmInteractions)
      .where(eq(crmInteractions.crmAccountId, account.id))
      .orderBy(desc(crmInteractions.createdAt))
      .limit(20);

    const tasks = await db
      .select()
      .from(crmTasks)
      .where(eq(crmTasks.crmAccountId, account.id))
      .orderBy(desc(crmTasks.createdAt));

    let accountDetails = null;
    if (account.accountType === 'user') {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, account.accountId))
        .limit(1);
      accountDetails = user ? {
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        accountType: user.accountType,
        createdAt: null,
      } : null;
    } else {
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, account.accountId))
        .limit(1);
      accountDetails = org ? {
        name: org.name,
        billingEmail: org.billingEmail,
        phone: org.phone,
        planCode: org.planCode,
        createdAt: org.createdAt,
      } : null;
    }

    res.json({
      account,
      accountDetails,
      subscription,
      plan,
      invoices: accountInvoices,
      interactions,
      tasks,
    });
  } catch (error: any) {
    console.error('Error fetching CRM account:', error);
    res.status(500).json({ error: 'Failed to fetch account details' });
  }
});

router.patch('/accounts/:id', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes, lifecycleStage, sizeSegment, industry, ownerUserId } = req.body;

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (notes !== undefined) updates.notes = notes;
    if (lifecycleStage) updates.lifecycleStage = lifecycleStage;
    if (sizeSegment) updates.sizeSegment = sizeSegment;
    if (industry !== undefined) updates.industry = industry;
    if (ownerUserId !== undefined) updates.ownerUserId = ownerUserId;

    const [updated] = await db
      .update(crmAccounts)
      .set(updates)
      .where(eq(crmAccounts.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating CRM account:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

router.post('/accounts/:id/interactions', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as User;

    const parsed = createCrmInteractionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    const [account] = await db
      .select()
      .from(crmAccounts)
      .where(eq(crmAccounts.id, id))
      .limit(1);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const [interaction] = await db
      .insert(crmInteractions)
      .values({
        crmAccountId: id,
        type: parsed.data.type,
        direction: parsed.data.direction,
        subject: parsed.data.subject,
        body: parsed.data.body,
        source: 'manual',
        createdByUserId: user.id,
      })
      .returning();

    res.json(interaction);
  } catch (error: any) {
    console.error('Error creating CRM interaction:', error);
    res.status(500).json({ error: 'Failed to create interaction' });
  }
});

router.post('/accounts/:id/tasks', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as User;

    const parsed = createCrmTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    const [account] = await db
      .select()
      .from(crmAccounts)
      .where(eq(crmAccounts.id, id))
      .limit(1);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const [task] = await db
      .insert(crmTasks)
      .values({
        crmAccountId: id,
        title: parsed.data.title,
        description: parsed.data.description,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        assignedToUserId: parsed.data.assignedToUserId || user.id,
        status: 'open',
      })
      .returning();

    res.json(task);
  } catch (error: any) {
    console.error('Error creating CRM task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.patch('/tasks/:taskId', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    const parsed = updateCrmTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (parsed.data.title) updates.title = parsed.data.title;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.dueDate !== undefined) updates.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    if (parsed.data.status) updates.status = parsed.data.status;
    if (parsed.data.assignedToUserId !== undefined) updates.assignedToUserId = parsed.data.assignedToUserId;

    const [updated] = await db
      .update(crmTasks)
      .set(updates)
      .where(eq(crmTasks.id, taskId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating CRM task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.delete('/tasks/:taskId', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    const [deleted] = await db
      .delete(crmTasks)
      .where(eq(crmTasks.id, taskId))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting CRM task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

router.get('/stats', isAuthenticated, isAdmin, async (_req: Request, res: Response) => {
  try {
    const [totalAccounts] = await db
      .select({ count: count() })
      .from(crmAccounts);

    const [customers] = await db
      .select({ count: count() })
      .from(crmAccounts)
      .where(eq(crmAccounts.lifecycleStage, 'customer'));

    const [leads] = await db
      .select({ count: count() })
      .from(crmAccounts)
      .where(eq(crmAccounts.lifecycleStage, 'lead'));

    const [churnRisk] = await db
      .select({ count: count() })
      .from(crmAccounts)
      .where(eq(crmAccounts.lifecycleStage, 'churn_risk'));

    const [openTasks] = await db
      .select({ count: count() })
      .from(crmTasks)
      .where(eq(crmTasks.status, 'open'));

    const [activeSubscriptions] = await db
      .select({ count: count() })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'));

    res.json({
      totalAccounts: totalAccounts?.count || 0,
      customers: customers?.count || 0,
      leads: leads?.count || 0,
      churnRisk: churnRisk?.count || 0,
      openTasks: openTasks?.count || 0,
      activeSubscriptions: activeSubscriptions?.count || 0,
    });
  } catch (error: any) {
    console.error('Error fetching CRM stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
