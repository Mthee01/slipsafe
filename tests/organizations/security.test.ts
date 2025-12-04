import request from "supertest";
import { createTestApp } from "../testApp";
import { createAuthenticatedUser, loginAsUser } from "../helpers/auth";
import { 
  createUser, 
  createOrganization,
  addMember,
  createPurchase,
  setUserActiveOrg,
  getMemberCount,
  PLAN_CODES 
} from "../helpers/fixtures";
import { db } from "../../server/db";
import { purchases, organizations } from "../../shared/schema";
import { eq, and, count } from "drizzle-orm";

const app = createTestApp();

describe("Organization Security", () => {
  describe("User Cannot Upload Business Receipts for Unrelated Organization", () => {
    it("should prevent non-member from creating receipts for an org", async () => {
      const { agent: ownerAgent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
        username: "test_sec_owner",
      });

      const createRes = await ownerAgent
        .post("/api/organizations")
        .send({
          name: "Secure Organization",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@secure.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const { agent: outsiderAgent, user: outsider } = await createAuthenticatedUser(app, {
        accountType: "individual",
        username: "test_outsider",
      });

      const [receiptsBefore] = await db
        .select({ count: count() })
        .from(purchases)
        .where(eq(purchases.organizationId, orgId));

      expect(receiptsBefore.count).toBe(0);

      const [receiptsAfter] = await db
        .select({ count: count() })
        .from(purchases)
        .where(eq(purchases.organizationId, orgId));

      expect(receiptsAfter.count).toBe(0);
    });
  });

  describe("Owner vs Member Permissions", () => {
    it("owner can change plan, member cannot", async () => {
      const { agent: ownerAgent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
        username: "test_perm_owner",
      });

      const createRes = await ownerAgent
        .post("/api/organizations")
        .send({
          name: "Permission Test Org",
          planCode: PLAN_CODES.SOLO,
          billingEmail: "billing@perm-test.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const ownerChangeRes = await ownerAgent
        .post(`/api/organizations/${orgId}/change-plan`)
        .send({ planCode: PLAN_CODES.PRO });

      expect(ownerChangeRes.status).toBe(200);
      expect(ownerChangeRes.body.organization.planCode).toBe("BUSINESS_PRO");

      const { agent: memberAgent, user: memberUser } = await createAuthenticatedUser(app, {
        accountType: "individual",
        username: "test_perm_member",
      });

      await addMember({
        organizationId: orgId,
        userId: memberUser.id,
        role: "member",
        invitedBy: owner.id,
      });

      const memberChangeRes = await memberAgent
        .post(`/api/organizations/${orgId}/change-plan`)
        .send({ planCode: PLAN_CODES.ENTERPRISE });

      expect(memberChangeRes.status).toBe(403);

      const [orgAfter] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));

      expect(orgAfter.planCode).toBe("BUSINESS_PRO");
    });

    it("owner can invite members, regular member cannot", async () => {
      const { agent: ownerAgent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
        username: "test_invite_owner",
      });

      const createRes = await ownerAgent
        .post("/api/organizations")
        .send({
          name: "Invite Permission Test",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@invite-perm.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const user1 = await createUser({ email: "invited1@perm.com" });
      const ownerInviteRes = await ownerAgent
        .post("/api/organizations/current/invite")
        .send({
          email: user1.email,
          role: "member",
        });

      expect(ownerInviteRes.status).toBe(201);

      const { agent: memberAgent, user: memberUser } = await createAuthenticatedUser(app, {
        accountType: "individual",
        username: "test_invite_member",
      });

      await addMember({
        organizationId: orgId,
        userId: memberUser.id,
        role: "member",
        invitedBy: owner.id,
      });

      await setUserActiveOrg(memberUser.id, orgId);

      const user2 = await createUser({ email: "invited2@perm.com" });
      const memberInviteRes = await memberAgent
        .post("/api/organizations/current/invite")
        .send({
          email: user2.email,
          role: "member",
        });

      expect(memberInviteRes.status).toBe(403);
    });

    it("admin can invite members", async () => {
      const { agent: ownerAgent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
        username: "test_admin_invite_owner",
      });

      const createRes = await ownerAgent
        .post("/api/organizations")
        .send({
          name: "Admin Invite Test",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@admin-invite.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const { agent: adminAgent, user: adminUser } = await createAuthenticatedUser(app, {
        accountType: "individual",
        username: "test_admin_inviter",
      });

      await addMember({
        organizationId: orgId,
        userId: adminUser.id,
        role: "admin",
        invitedBy: owner.id,
      });

      await setUserActiveOrg(adminUser.id, orgId);

      const newUser = await createUser({ email: "newmember@admin-invite.com" });
      const adminInviteRes = await adminAgent
        .post("/api/organizations/current/invite")
        .send({
          email: newUser.email,
          role: "member",
        });

      expect(adminInviteRes.status).toBe(201);
    });
  });

  describe("Only Owners Can Remove Admins", () => {
    it("should allow owner to remove admin", async () => {
      const { agent: ownerAgent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
        username: "test_remove_admin_owner",
      });

      const createRes = await ownerAgent
        .post("/api/organizations")
        .send({
          name: "Remove Admin Test",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@remove-admin.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const adminUser = await createUser({ email: "admin@remove.com" });
      await addMember({
        organizationId: orgId,
        userId: adminUser.id,
        role: "admin",
        invitedBy: owner.id,
      });

      const memberCountBefore = await getMemberCount(orgId);
      expect(memberCountBefore).toBe(2);

      const removeRes = await ownerAgent
        .delete(`/api/organizations/${orgId}/members/${adminUser.id}`);

      expect(removeRes.status).toBe(200);

      const memberCountAfter = await getMemberCount(orgId);
      expect(memberCountAfter).toBe(1);
    });

    it("should prevent admin from removing another admin", async () => {
      const { agent: ownerAgent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
        username: "test_admin_remove_owner",
      });

      const createRes = await ownerAgent
        .post("/api/organizations")
        .send({
          name: "Admin Remove Admin Test",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@admin-remove-admin.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const admin1 = await createUser({ email: "admin1@remove.com" });
      await addMember({
        organizationId: orgId,
        userId: admin1.id,
        role: "admin",
        invitedBy: owner.id,
      });

      const admin2 = await createUser({ email: "admin2@remove.com" });
      await addMember({
        organizationId: orgId,
        userId: admin2.id,
        role: "admin",
        invitedBy: owner.id,
      });

      const { agent: admin1Agent } = await loginAsUser(app, admin1.username, "password123");

      const removeRes = await admin1Agent
        .delete(`/api/organizations/${orgId}/members/${admin2.id}`);

      expect(removeRes.status).toBe(403);

      const memberCount = await getMemberCount(orgId);
      expect(memberCount).toBe(3);
    });
  });

  describe("Non-Member Cannot Access Organization", () => {
    it("should deny organization access to non-members", async () => {
      const { agent: ownerAgent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
        username: "test_access_control_owner",
      });

      const createRes = await ownerAgent
        .post("/api/organizations")
        .send({
          name: "Access Control Test",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@access-control.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const { agent: nonMemberAgent } = await createAuthenticatedUser(app, {
        accountType: "individual",
        username: "test_non_member_access",
      });

      const getOrgRes = await nonMemberAgent
        .get(`/api/organizations/${orgId}/usage`);

      expect(getOrgRes.status).toBe(403);
    });
  });

  describe("Unauthenticated Access Blocked", () => {
    it("should block all organization endpoints for unauthenticated users", async () => {
      const listRes = await request(app).get("/api/organizations");
      expect(listRes.status).toBe(401);

      const createRes = await request(app)
        .post("/api/organizations")
        .send({
          name: "Unauthenticated Org",
          planCode: PLAN_CODES.SOLO,
          billingEmail: "billing@unauth.com",
        });
      expect(createRes.status).toBe(401);

      const currentRes = await request(app).get("/api/organizations/current");
      expect(currentRes.status).toBe(401);

      const currentMembersRes = await request(app).get("/api/organizations/current/members");
      expect(currentMembersRes.status).toBe(401);
    });
  });
});
