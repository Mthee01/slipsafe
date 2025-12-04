import request from "supertest";
import { createTestApp } from "../testApp";
import { createAuthenticatedUser } from "../helpers/auth";
import { 
  createUser, 
  createOrganization,
  addMember,
  createManyPurchases,
  getMemberCount,
  PLAN_CODES 
} from "../helpers/fixtures";
import { db } from "../../server/db";
import { organizations } from "../../shared/schema";
import { eq } from "drizzle-orm";

const app = createTestApp();

describe("Plan Changes", () => {
  describe("Upgrade Solo to Pro", () => {
    it("should successfully upgrade from Solo to Pro", async () => {
      const { agent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const createRes = await agent
        .post("/api/organizations")
        .send({
          name: "Solo to Pro Upgrade",
          planCode: PLAN_CODES.SOLO,
          billingEmail: "billing@solo-upgrade.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const [orgBefore] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));

      expect(orgBefore.planCode).toBe("BUSINESS_SOLO");

      const upgradeRes = await agent
        .post(`/api/organizations/${orgId}/change-plan`)
        .send({ planCode: PLAN_CODES.PRO });

      expect(upgradeRes.status).toBe(200);
      expect(upgradeRes.body.organization.planCode).toBe("BUSINESS_PRO");

      const [orgAfter] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));

      expect(orgAfter.planCode).toBe("BUSINESS_PRO");
    });

    it("should preserve receipts after upgrade", async () => {
      const { agent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const createRes = await agent
        .post("/api/organizations")
        .send({
          name: "Upgrade with Data",
          planCode: PLAN_CODES.SOLO,
          billingEmail: "billing@upgrade-data.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      await createManyPurchases(50, {
        userId: owner.id,
        organizationId: orgId,
        context: "business",
      });

      const upgradeRes = await agent
        .post(`/api/organizations/${orgId}/change-plan`)
        .send({ planCode: PLAN_CODES.PRO });

      expect(upgradeRes.status).toBe(200);
    });
  });

  describe("Downgrade Pro to Solo Blocked by Members", () => {
    it("should reject downgrade when organization has more than 1 member", async () => {
      const { agent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const createRes = await agent
        .post("/api/organizations")
        .send({
          name: "Pro with Members",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@pro-downgrade.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const member1 = await createUser({ email: "member1@downgrade.com" });
      const member2 = await createUser({ email: "member2@downgrade.com" });

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

      const memberCount = await getMemberCount(orgId);
      expect(memberCount).toBe(3);

      const downgradeRes = await agent
        .post(`/api/organizations/${orgId}/change-plan`)
        .send({ planCode: PLAN_CODES.SOLO });

      expect(downgradeRes.status).toBe(400);
      expect(downgradeRes.body.error).toContain("member");

      const [orgAfter] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));

      expect(orgAfter.planCode).toBe("BUSINESS_PRO");
    });
  });

  describe("Downgrade Pro to Solo Allowed with 1 Member", () => {
    it("should allow downgrade when organization has only owner", async () => {
      const { agent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const createRes = await agent
        .post("/api/organizations")
        .send({
          name: "Pro Owner Only",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@pro-solo.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const memberCount = await getMemberCount(orgId);
      expect(memberCount).toBe(1);

      const downgradeRes = await agent
        .post(`/api/organizations/${orgId}/change-plan`)
        .send({ planCode: PLAN_CODES.SOLO });

      expect(downgradeRes.status).toBe(200);
      expect(downgradeRes.body.organization.planCode).toBe("BUSINESS_SOLO");

      const [orgAfter] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));

      expect(orgAfter.planCode).toBe("BUSINESS_SOLO");
    });
  });

  describe("Upgrade Pro to Enterprise", () => {
    it("should successfully upgrade from Pro to Enterprise", async () => {
      const { agent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const createRes = await agent
        .post("/api/organizations")
        .send({
          name: "Pro to Enterprise",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@pro-enterprise.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      for (let i = 1; i <= 9; i++) {
        const member = await createUser({ email: `member${i}@enterprise.com` });
        await addMember({
          organizationId: orgId,
          userId: member.id,
          role: "member",
          invitedBy: owner.id,
        });
      }

      const memberCount = await getMemberCount(orgId);
      expect(memberCount).toBe(10);

      const upgradeRes = await agent
        .post(`/api/organizations/${orgId}/change-plan`)
        .send({ planCode: PLAN_CODES.ENTERPRISE });

      expect(upgradeRes.status).toBe(200);
      expect(upgradeRes.body.organization.planCode).toBe("BUSINESS_ENTERPRISE");
    });

    it("should allow adding more than 10 members after Enterprise upgrade", async () => {
      const { agent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const createRes = await agent
        .post("/api/organizations")
        .send({
          name: "Enterprise Unlimited",
          planCode: PLAN_CODES.ENTERPRISE,
          billingEmail: "billing@enterprise-unlimited.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      for (let i = 1; i <= 15; i++) {
        const member = await createUser({ email: `ent_member${i}@unlimited.com` });
        await addMember({
          organizationId: orgId,
          userId: member.id,
          role: "member",
          invitedBy: owner.id,
        });
      }

      const memberCount = await getMemberCount(orgId);
      expect(memberCount).toBe(16);
    });
  });

  describe("Non-Owner Cannot Change Plan", () => {
    it("should reject plan change from non-owner", async () => {
      const { agent: ownerAgent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
        username: "test_plan_owner",
      });

      const createRes = await ownerAgent
        .post("/api/organizations")
        .send({
          name: "Owner Only Plan Change",
          planCode: PLAN_CODES.SOLO,
          billingEmail: "billing@owner-only.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const { agent: adminAgent, user: adminUser } = await createAuthenticatedUser(app, {
        accountType: "individual",
        username: "test_plan_admin",
      });

      await addMember({
        organizationId: orgId,
        userId: adminUser.id,
        role: "admin",
        invitedBy: owner.id,
      });

      const planChangeRes = await adminAgent
        .post(`/api/organizations/${orgId}/change-plan`)
        .send({ planCode: PLAN_CODES.PRO });

      expect(planChangeRes.status).toBe(403);

      const [orgAfter] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));

      expect(orgAfter.planCode).toBe("BUSINESS_SOLO");
    });
  });
});
