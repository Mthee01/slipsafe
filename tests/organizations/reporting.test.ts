import request from "supertest";
import { createTestApp } from "../testApp";
import { createAuthenticatedUser } from "../helpers/auth";
import { 
  createUser, 
  createOrganization,
  addMember,
  createPurchase,
  setUserActiveOrg,
  PLAN_CODES 
} from "../helpers/fixtures";

const app = createTestApp();

describe("Organization Reporting", () => {
  describe("Multi-User Receipts Consolidated Detail Report", () => {
    it("should return all receipts from multiple users in organization", async () => {
      const { agent: ownerAgent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
        username: "test_report_owner",
      });

      const createRes = await ownerAgent
        .post("/api/organizations")
        .send({
          name: "Report Test Organization",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@report-test.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const member1 = await createUser({ email: "staff1@report.com" });
      const member2 = await createUser({ email: "staff2@report.com" });

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

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];

      await createPurchase({
        userId: owner.id,
        organizationId: orgId,
        context: "business",
        merchant: "Office Depot",
        category: "Office Supplies",
        total: "250.00",
        date: dateStr,
      });

      await createPurchase({
        userId: member1.id,
        organizationId: orgId,
        context: "business",
        merchant: "Tech Store",
        category: "Electronics",
        total: "500.00",
        date: dateStr,
      });

      await createPurchase({
        userId: member1.id,
        organizationId: orgId,
        context: "business",
        merchant: "Office Depot",
        category: "Office Supplies",
        total: "100.00",
        date: dateStr,
      });

      await createPurchase({
        userId: member2.id,
        organizationId: orgId,
        context: "business",
        merchant: "Travel Agency",
        category: "Travel",
        total: "1500.00",
        date: dateStr,
      });

      await createPurchase({
        userId: member2.id,
        organizationId: orgId,
        context: "business",
        merchant: "Restaurant",
        category: "Other",
        total: "75.00",
        date: dateStr,
      });

      const usageRes = await ownerAgent
        .get("/api/organizations/current/usage");

      expect(usageRes.status).toBe(200);
      expect(usageRes.body.monthlyReceiptCount).toBe(5);
      expect(usageRes.body.memberCount).toBe(3);
    });
  });

  describe("Organization Usage Statistics", () => {
    it("should return correct usage data", async () => {
      const { agent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const createRes = await agent
        .post("/api/organizations")
        .send({
          name: "Usage Stats Test",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@usage-stats.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const usageRes = await agent
        .get(`/api/organizations/${orgId}/usage`);

      expect(usageRes.status).toBe(200);
      expect(usageRes.body.usage).toBeDefined();
      expect(usageRes.body.usage.memberCount).toBe(1);
      expect(usageRes.body.usage.monthlyReceiptCount).toBe(0);
      expect(usageRes.body.usage.planCode).toBe("BUSINESS_PRO");
      expect(usageRes.body.usage.limits.maxUsers).toBe(10);
      expect(usageRes.body.usage.limits.maxReceiptsPerMonth).toBe(5000);
    });

    it("should return correct limits for each plan type", async () => {
      const { agent: soloAgent } = await createAuthenticatedUser(app, {
        accountType: "business",
        username: "test_solo_usage",
      });

      const soloRes = await soloAgent
        .post("/api/organizations")
        .send({
          name: "Solo Usage Test",
          planCode: PLAN_CODES.SOLO,
          billingEmail: "billing@solo-usage.com",
        });

      const soloUsageRes = await soloAgent
        .get(`/api/organizations/${soloRes.body.organization.id}/usage`);

      expect(soloUsageRes.body.usage.limits.maxUsers).toBe(1);
      expect(soloUsageRes.body.usage.limits.maxReceiptsPerMonth).toBe(1000);

      const { agent: entAgent } = await createAuthenticatedUser(app, {
        accountType: "business",
        username: "test_ent_usage",
      });

      const entRes = await entAgent
        .post("/api/organizations")
        .send({
          name: "Enterprise Usage Test",
          planCode: PLAN_CODES.ENTERPRISE,
          billingEmail: "billing@ent-usage.com",
        });

      const entUsageRes = await entAgent
        .get(`/api/organizations/${entRes.body.organization.id}/usage`);

      expect(entUsageRes.body.usage.limits.maxUsers).toBeNull();
      expect(entUsageRes.body.usage.limits.maxReceiptsPerMonth).toBeNull();
    });
  });

  describe("Non-Member Cannot Access Organization Reports", () => {
    it("should deny access to non-member users", async () => {
      const { agent: ownerAgent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
        username: "test_access_owner",
      });

      const createRes = await ownerAgent
        .post("/api/organizations")
        .send({
          name: "Private Organization",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@private.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const { agent: nonMemberAgent, user: nonMember } = await createAuthenticatedUser(app, {
        accountType: "individual",
        username: "test_non_member",
      });

      const usageRes = await nonMemberAgent
        .get(`/api/organizations/${orgId}/usage`);

      expect(usageRes.status).toBe(403);
    });

    it("should allow member access to organization data", async () => {
      const { agent: ownerAgent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
        username: "test_member_access_owner",
      });

      const createRes = await ownerAgent
        .post("/api/organizations")
        .send({
          name: "Accessible Organization",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@accessible.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const { agent: memberAgent, user: memberUser } = await createAuthenticatedUser(app, {
        accountType: "individual",
        username: "test_member_access_member",
      });

      await addMember({
        organizationId: orgId,
        userId: memberUser.id,
        role: "member",
        invitedBy: owner.id,
      });

      const usageRes = await memberAgent
        .get(`/api/organizations/${orgId}/usage`);

      expect(usageRes.status).toBe(200);
      expect(usageRes.body.usage).toBeDefined();
    });
  });

  describe("List User Organizations", () => {
    it("should list all organizations user belongs to", async () => {
      const { agent, user } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      await agent
        .post("/api/organizations")
        .send({
          name: "First Organization",
          planCode: PLAN_CODES.SOLO,
          billingEmail: "billing@first.com",
        });

      const listRes = await agent
        .get("/api/organizations");

      expect(listRes.status).toBe(200);
      expect(listRes.body.organizations).toBeDefined();
      expect(Array.isArray(listRes.body.organizations)).toBe(true);
      expect(listRes.body.organizations.length).toBeGreaterThanOrEqual(1);
    });
  });
});
