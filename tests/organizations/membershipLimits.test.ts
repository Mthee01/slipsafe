import request from "supertest";
import { createTestApp } from "../testApp";
import { createAuthenticatedUser } from "../helpers/auth";
import { 
  createUser, 
  createOrganization,
  addMember,
  setUserActiveOrg,
  getMemberCount,
  PLAN_CODES 
} from "../helpers/fixtures";
import { db } from "../../server/db";
import { organizationMembers } from "../../shared/schema";
import { eq, and, count } from "drizzle-orm";

const app = createTestApp();

describe("Membership Limits", () => {
  describe("Add Members Within Pro Limit", () => {
    it("should allow adding members within Pro plan limit (up to 10)", async () => {
      const { agent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const createRes = await agent
        .post("/api/organizations")
        .send({
          name: "Pro Team Organization",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@pro-team.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const newUser1 = await createUser({ email: "member1@test.com" });
      const newUser2 = await createUser({ email: "member2@test.com" });

      const invite1Res = await agent
        .post("/api/organizations/current/invite")
        .send({
          email: newUser1.email,
          role: "member",
        });

      expect(invite1Res.status).toBe(201);
      expect(invite1Res.body.invitation).toBeDefined();

      const invite2Res = await agent
        .post("/api/organizations/current/invite")
        .send({
          email: newUser2.email,
          role: "admin",
        });

      expect(invite2Res.status).toBe(201);
    });
  });

  describe("Cannot Exceed Pro maxUsers (11th Member)", () => {
    it("should reject the 11th member on a Pro plan", async () => {
      const { agent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const createRes = await agent
        .post("/api/organizations")
        .send({
          name: "Full Pro Organization",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@full-pro.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      for (let i = 1; i <= 9; i++) {
        const member = await createUser({ email: `member${i}@fullpro.com` });
        await addMember({
          organizationId: orgId,
          userId: member.id,
          role: "member",
          invitedBy: owner.id,
        });
      }

      const memberCount = await getMemberCount(orgId);
      expect(memberCount).toBe(10);

      const eleventhUser = await createUser({ email: "eleventh@fullpro.com" });
      const inviteRes = await agent
        .post("/api/organizations/current/invite")
        .send({
          email: eleventhUser.email,
          role: "member",
        });

      expect(inviteRes.status).toBe(400);
      expect(inviteRes.body.reason).toBe("max_users_reached");
      expect(inviteRes.body.recommendation).toBeDefined();
      expect(inviteRes.body.recommendation.recommendedPlanCode).toBe("BUSINESS_ENTERPRISE");

      const finalMemberCount = await getMemberCount(orgId);
      expect(finalMemberCount).toBe(10);
    });
  });

  describe("Solo Organization Cannot Add Second Member", () => {
    it("should reject adding a second member to Solo organization", async () => {
      const { agent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const createRes = await agent
        .post("/api/organizations")
        .send({
          name: "Solo Organization",
          planCode: PLAN_CODES.SOLO,
          billingEmail: "billing@solo.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const memberCount = await getMemberCount(orgId);
      expect(memberCount).toBe(1);

      const secondUser = await createUser({ email: "second@solo.com" });
      const inviteRes = await agent
        .post("/api/organizations/current/invite")
        .send({
          email: secondUser.email,
          role: "member",
        });

      expect(inviteRes.status).toBe(400);
      expect(inviteRes.body.reason).toBe("max_users_reached");
      expect(inviteRes.body.recommendation).toBeDefined();
      expect(inviteRes.body.recommendation.recommendedPlanCode).toBe("BUSINESS_PRO");

      const finalMemberCount = await getMemberCount(orgId);
      expect(finalMemberCount).toBe(1);
    });
  });

  describe("Non-Owner Cannot Add Member", () => {
    it("should reject member invitation from non-admin user", async () => {
      const { agent: ownerAgent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
        username: "test_org_owner",
      });

      const createRes = await ownerAgent
        .post("/api/organizations")
        .send({
          name: "Permission Test Organization",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@permission-test.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const { agent: memberAgent, user: memberUser } = await createAuthenticatedUser(app, {
        accountType: "individual",
        username: "test_regular_member",
      });

      await addMember({
        organizationId: orgId,
        userId: memberUser.id,
        role: "member",
        invitedBy: owner.id,
      });

      await setUserActiveOrg(memberUser.id, orgId);

      const thirdUser = await createUser({ email: "third@permission.com" });
      const inviteRes = await memberAgent
        .post("/api/organizations/current/invite")
        .send({
          email: thirdUser.email,
          role: "member",
        });

      expect(inviteRes.status).toBe(403);

      const memberCount = await getMemberCount(orgId);
      expect(memberCount).toBe(2);
    });

    it("should allow admin to add members", async () => {
      const { agent: ownerAgent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
        username: "test_admin_test_owner",
      });

      const createRes = await ownerAgent
        .post("/api/organizations")
        .send({
          name: "Admin Permission Test",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@admin-permission.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const { agent: adminAgent, user: adminUser } = await createAuthenticatedUser(app, {
        accountType: "individual",
        username: "test_admin_user",
      });

      await addMember({
        organizationId: orgId,
        userId: adminUser.id,
        role: "admin",
        invitedBy: owner.id,
      });

      await setUserActiveOrg(adminUser.id, orgId);

      const newMember = await createUser({ email: "newmember@admin.com" });
      const inviteRes = await adminAgent
        .post("/api/organizations/current/invite")
        .send({
          email: newMember.email,
          role: "member",
        });

      expect(inviteRes.status).toBe(201);

      const memberCount = await getMemberCount(orgId);
      expect(memberCount).toBe(2);
    });
  });

  describe("Remove Member", () => {
    it("should allow owner to remove a member", async () => {
      const { agent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const createRes = await agent
        .post("/api/organizations")
        .send({
          name: "Remove Member Test",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@remove-test.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const memberToRemove = await createUser({ email: "toremove@test.com" });
      await addMember({
        organizationId: orgId,
        userId: memberToRemove.id,
        role: "member",
        invitedBy: owner.id,
      });

      const beforeCount = await getMemberCount(orgId);
      expect(beforeCount).toBe(2);

      const removeRes = await agent
        .delete(`/api/organizations/${orgId}/members/${memberToRemove.id}`);

      expect(removeRes.status).toBe(200);

      const afterCount = await getMemberCount(orgId);
      expect(afterCount).toBe(1);
    });

    it("should not allow removing the owner", async () => {
      const { agent, user: owner } = await createAuthenticatedUser(app, {
        accountType: "business",
      });

      const createRes = await agent
        .post("/api/organizations")
        .send({
          name: "Cannot Remove Owner",
          planCode: PLAN_CODES.PRO,
          billingEmail: "billing@owner-test.com",
        });

      expect(createRes.status).toBe(201);
      const orgId = createRes.body.organization.id;

      const removeRes = await agent
        .delete(`/api/organizations/${orgId}/members/${owner.id}`);

      expect(removeRes.status).toBe(400);
      expect(removeRes.body.error).toContain("owner");
    });
  });
});
