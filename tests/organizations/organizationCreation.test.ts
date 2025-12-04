import request from "supertest";
import { createTestApp } from "../testApp";
import { createAuthenticatedUser } from "../helpers/auth";
import { 
  createUser, 
  PLAN_CODES, 
  addMember, 
  getMemberCount 
} from "../helpers/fixtures";
import { db } from "../../server/db";
import { organizations, organizationMembers, users } from "../../shared/schema";
import { eq } from "drizzle-orm";

const app = createTestApp();

describe("Organization Creation", () => {
  describe("Create Solo Organization", () => {
    it("should create a Solo organization successfully", async () => {
      const { agent, user } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const res = await agent
        .post("/api/organizations")
        .send({
          name: "Solo Test Organization",
          planCode: PLAN_CODES.SOLO,
          billingEmail: "billing@solo-test.com",
        });

      expect(res.status).toBe(201);
      expect(res.body.organization).toBeDefined();
      expect(res.body.organization.name).toBe("Solo Test Organization");
      expect(res.body.organization.planCode).toBe(PLAN_CODES.SOLO);

      const [dbOrg] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, res.body.organization.id));

      expect(dbOrg).toBeDefined();
      expect(dbOrg.planCode).toBe("BUSINESS_SOLO");
      expect(dbOrg.ownerUserId).toBe(user.id);

      const memberCount = await getMemberCount(res.body.organization.id);
      expect(memberCount).toBe(1);

      const [owner] = await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, res.body.organization.id));

      expect(owner).toBeDefined();
      expect(owner.userId).toBe(user.id);
      expect(owner.role).toBe("owner");
      expect(owner.isActive).toBe(true);

      const [updatedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id));

      expect(updatedUser.activeOrganizationId).toBe(res.body.organization.id);
    });

    it("should fail with invalid organization data", async () => {
      const { agent } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const res = await agent
        .post("/api/organizations")
        .send({
          name: "",
          planCode: PLAN_CODES.SOLO,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe("Create Pro Organization", () => {
    it("should create a Pro organization successfully", async () => {
      const { agent, user } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const res = await agent
        .post("/api/organizations")
        .send({
          name: "Pro Test Organization",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@pro-test.com",
          vatNumber: "VAT123456",
        });

      expect(res.status).toBe(201);
      expect(res.body.organization).toBeDefined();
      expect(res.body.organization.planCode).toBe(PLAN_CODES.PRO);

      const [dbOrg] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, res.body.organization.id));

      expect(dbOrg).toBeDefined();
      expect(dbOrg.planCode).toBe("BUSINESS_PRO");
      expect(dbOrg.vatNumber).toBe("VAT123456");

      const memberCount = await getMemberCount(res.body.organization.id);
      expect(memberCount).toBe(1);
    });
  });

  describe("Create Enterprise Organization", () => {
    it("should create an Enterprise organization successfully", async () => {
      const { agent, user } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const res = await agent
        .post("/api/organizations")
        .send({
          name: "Enterprise Test Organization",
          planCode: PLAN_CODES.ENTERPRISE,
          billingEmail: "billing@enterprise-test.com",
          taxId: "TAX123456",
          registrationNumber: "REG789",
        });

      expect(res.status).toBe(201);
      expect(res.body.organization).toBeDefined();
      expect(res.body.organization.planCode).toBe(PLAN_CODES.ENTERPRISE);

      const [dbOrg] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, res.body.organization.id));

      expect(dbOrg).toBeDefined();
      expect(dbOrg.planCode).toBe("BUSINESS_ENTERPRISE");
      expect(dbOrg.taxId).toBe("TAX123456");
      expect(dbOrg.registrationNumber).toBe("REG789");

      const [owner] = await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, res.body.organization.id));

      expect(owner.role).toBe("owner");
    });
  });

  describe("Unauthenticated Access", () => {
    it("should fail to create organization without authentication", async () => {
      const res = await request(app)
        .post("/api/organizations")
        .send({
          name: "Unauthenticated Organization",
          planCode: PLAN_CODES.SOLO,
          billingEmail: "billing@test.com",
        });

      expect(res.status).toBe(401);
    });
  });
});
