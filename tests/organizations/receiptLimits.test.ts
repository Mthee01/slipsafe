import request from "supertest";
import { createTestApp } from "../testApp";
import { createAuthenticatedUser } from "../helpers/auth";
import { 
  createUser, 
  createOrganization,
  addMember,
  createPurchase,
  createManyPurchases,
  setUserActiveOrg,
  getReceiptCount,
  PLAN_CODES 
} from "../helpers/fixtures";
import { db } from "../../server/db";
import { purchases } from "../../shared/schema";
import { eq, and, count, isNull } from "drizzle-orm";

const app = createTestApp();

describe("Receipt Limits", () => {
  describe("Solo Business Receipts Under Limit", () => {
    it("should allow uploading receipts under the Solo plan limit", async () => {
      const { agent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const createRes = await agent
        .post("/api/organizations")
        .send({
          name: "Solo Receipt Test",
          planCode: PLAN_CODES.SOLO,
          billingEmail: "billing@solo-receipt.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      await createManyPurchases(20, {
        userId: owner.id,
        organizationId: orgId,
        context: "business",
      });

      const receiptCount = await getReceiptCount(orgId);
      expect(receiptCount).toBe(20);
      expect(receiptCount).toBeLessThan(1000);
    });
  });

  describe("Solo Business Receipts Hit Limit", () => {
    it("should track receipt count correctly near limit", async () => {
      const { agent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const createRes = await agent
        .post("/api/organizations")
        .send({
          name: "Solo Limit Test",
          planCode: PLAN_CODES.SOLO,
          billingEmail: "billing@solo-limit.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      await createManyPurchases(9, {
        userId: owner.id,
        organizationId: orgId,
        context: "business",
      });

      const receiptCount = await getReceiptCount(orgId);
      expect(receiptCount).toBe(9);

      await createPurchase({
        userId: owner.id,
        organizationId: orgId,
        context: "business",
      });

      const finalCount = await getReceiptCount(orgId);
      expect(finalCount).toBe(10);
    });
  });

  describe("Pro Business Receipts Distributed Across Staff", () => {
    it("should allow multiple users to upload receipts for same organization", async () => {
      const { agent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const createRes = await agent
        .post("/api/organizations")
        .send({
          name: "Pro Multi-User Test",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@pro-multi.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const member1 = await createUser({ email: "staff1@pro-multi.com" });
      const member2 = await createUser({ email: "staff2@pro-multi.com" });

      await addMember({
        organizationId: orgId,
        userId: member1.id,
        role: "member",
        invitedBy: owner.id,
      });

      await addMember({
        organizationId: orgId,
        userId: member2.id,
        role: "member",
        invitedBy: owner.id,
      });

      await createManyPurchases(10, {
        userId: owner.id,
        organizationId: orgId,
        context: "business",
        merchant: "Owner Store",
      });

      await createManyPurchases(15, {
        userId: member1.id,
        organizationId: orgId,
        context: "business",
        merchant: "Staff1 Store",
      });

      await createManyPurchases(20, {
        userId: member2.id,
        organizationId: orgId,
        context: "business",
        merchant: "Staff2 Store",
      });

      const totalReceiptCount = await getReceiptCount(orgId);
      expect(totalReceiptCount).toBe(45);

      const [allPurchases] = await db
        .select({ count: count() })
        .from(purchases)
        .where(eq(purchases.organizationId, orgId));

      expect(allPurchases.count).toBe(45);

      const [businessPurchases] = await db
        .select({ count: count() })
        .from(purchases)
        .where(
          and(
            eq(purchases.organizationId, orgId),
            eq(purchases.context, "business")
          )
        );

      expect(businessPurchases.count).toBe(45);
    });
  });

  describe("Personal Receipts Never Have Organization ID", () => {
    it("should ensure personal receipts have null organizationId", async () => {
      const { user } = await createAuthenticatedUser(app, {
        accountType: "individual",
      });

      await createManyPurchases(5, {
        userId: user.id,
        organizationId: null,
        context: "personal",
      });

      const [personalPurchases] = await db
        .select({ count: count() })
        .from(purchases)
        .where(
          and(
            eq(purchases.userId, user.id),
            eq(purchases.context, "personal"),
            isNull(purchases.organizationId)
          )
        );

      expect(personalPurchases.count).toBe(5);
    });

    it("should keep personal and business receipts separate", async () => {
      const { agent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const createRes = await agent
        .post("/api/organizations")
        .send({
          name: "Mixed Context Test",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@mixed.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      await createManyPurchases(10, {
        userId: owner.id,
        organizationId: orgId,
        context: "business",
      });

      await createManyPurchases(5, {
        userId: owner.id,
        organizationId: null,
        context: "personal",
      });

      const [businessReceipts] = await db
        .select({ count: count() })
        .from(purchases)
        .where(
          and(
            eq(purchases.userId, owner.id),
            eq(purchases.context, "business")
          )
        );

      const [personalReceipts] = await db
        .select({ count: count() })
        .from(purchases)
        .where(
          and(
            eq(purchases.userId, owner.id),
            eq(purchases.context, "personal")
          )
        );

      expect(businessReceipts.count).toBe(10);
      expect(personalReceipts.count).toBe(5);
    });
  });

  describe("Enterprise Has No Receipt Limits", () => {
    it("should allow unlimited receipts for Enterprise plan", async () => {
      const { agent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const createRes = await agent
        .post("/api/organizations")
        .send({
          name: "Enterprise No Limit Test",
          planCode: PLAN_CODES.ENTERPRISE,
          billingEmail: "billing@enterprise.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      await createManyPurchases(50, {
        userId: owner.id,
        organizationId: orgId,
        context: "business",
      });

      const receiptCount = await getReceiptCount(orgId);
      expect(receiptCount).toBe(50);
    });
  });
});
