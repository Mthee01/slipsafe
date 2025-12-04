import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { isAuthenticated, getCurrentUserId } from "./auth";
import { 
  insertOrganizationSchema, 
  updateOrganizationSchema, 
  inviteMemberSchema, 
  changePlanSchema,
  type PlanCode,
  type OrgMemberRole,
  getPlanLimitsByCode
} from "@shared/schema";
import { randomBytes } from "crypto";
import { 
  checkPlanLimit, 
  canAddMember, 
  validatePlanDowngrade, 
  getOrganizationUsage 
} from "./lib/planLimits";
import { sendEmail } from "./lib/email";

async function requireOrgAccess(req: Request, res: Response, next: NextFunction) {
  const userId = getCurrentUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const organizationId = req.params.organizationId;
  if (!organizationId) {
    return res.status(400).json({ error: "Organization ID required" });
  }

  const member = await storage.getOrganizationMember(organizationId, userId);
  if (!member || !member.isActive) {
    return res.status(403).json({ error: "You are not a member of this organization" });
  }

  (req as any).orgMember = member;
  (req as any).organizationId = organizationId;
  next();
}

async function requireOrgAdmin(req: Request, res: Response, next: NextFunction) {
  const member = (req as any).orgMember;
  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    return res.status(403).json({ error: "Admin or owner access required" });
  }
  next();
}

async function requireOrgOwner(req: Request, res: Response, next: NextFunction) {
  const member = (req as any).orgMember;
  if (!member || member.role !== "owner") {
    return res.status(403).json({ error: "Owner access required" });
  }
  next();
}

function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function registerOrganizationRoutes(app: Express) {
  
  app.post("/api/organizations", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const validation = insertOrganizationSchema.safeParse({
        ...req.body,
        ownerUserId: userId,
        billingEmail: req.body.billingEmail || user.email
      });

      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid organization data", 
          details: validation.error.flatten() 
        });
      }

      const org = await storage.createOrganization(validation.data);
      console.log("[Organizations] Created org:", org.id);

      const memberResult = await storage.addOrganizationMember({
        organizationId: org.id,
        userId: userId,
        role: "owner",
        invitedBy: userId,
        isActive: true
      });
      console.log("[Organizations] Added member:", memberResult);

      const userResult = await storage.updateUserActiveOrganization(userId, org.id);
      console.log("[Organizations] Updated user activeOrganizationId:", userResult?.activeOrganizationId);

      res.status(201).json({ organization: org });
    } catch (error: any) {
      console.error("[Organizations] Create error:", error);
      res.status(500).json({ error: "Failed to create organization" });
    }
  });

  app.get("/api/organizations", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userOrgs = await storage.getUserOrganizations(userId);
      
      const orgsWithUsage = await Promise.all(
        userOrgs.map(async ({ organization, member }) => {
          try {
            const usage = await getOrganizationUsage(organization.id);
            return {
              ...organization,
              role: member.role,
              usage: {
                memberCount: usage.memberCount,
                monthlyReceiptCount: usage.monthlyReceiptCount,
                limits: usage.limits
              }
            };
          } catch {
            return {
              ...organization,
              role: member.role,
              usage: null
            };
          }
        })
      );

      res.json({ organizations: orgsWithUsage });
    } catch (error: any) {
      console.error("[Organizations] List error:", error);
      res.status(500).json({ error: "Failed to fetch organizations" });
    }
  });

  // ========================
  // CURRENT ORGANIZATION ROUTES - must be defined before parameterized :organizationId routes
  // ========================

  // Helper to verify user is an active member of their activeOrganizationId
  async function verifyCurrentOrgMembership(userId: string): Promise<{ organizationId: string; member: any } | null> {
    const user = await storage.getUser(userId);
    if (!user || !user.activeOrganizationId) {
      return null;
    }
    
    const member = await storage.getOrganizationMember(user.activeOrganizationId, userId);
    if (!member || !member.isActive) {
      return null;
    }
    
    return { organizationId: user.activeOrganizationId, member };
  }

  app.get("/api/organizations/current", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const membership = await verifyCurrentOrgMembership(userId);
      if (!membership) {
        return res.status(404).json({ error: "No active organization or not a member" });
      }

      const org = await storage.getOrganizationById(membership.organizationId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      res.json(org);
    } catch (error: any) {
      console.error("[Organizations] Get current error:", error);
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });

  app.get("/api/organizations/current/members", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const membership = await verifyCurrentOrgMembership(userId);
      if (!membership) {
        return res.status(404).json({ error: "No active organization or not a member" });
      }

      const members = await storage.getOrganizationMembers(membership.organizationId);

      const memberDetails = await Promise.all(
        members.map(async (member) => {
          const memberUser = await storage.getUser(member.userId);
          return {
            ...member,
            user: memberUser ? {
              id: memberUser.id,
              fullName: memberUser.fullName,
              email: memberUser.email,
              username: memberUser.username
            } : null
          };
        })
      );

      res.json(memberDetails);
    } catch (error: any) {
      console.error("[Organizations] Get current members error:", error);
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });

  app.get("/api/organizations/current/invitations", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const membership = await verifyCurrentOrgMembership(userId);
      if (!membership) {
        return res.status(404).json({ error: "No active organization or not a member" });
      }

      // Only admins and owners should see invitations
      if (membership.member.role !== "owner" && membership.member.role !== "admin") {
        return res.status(403).json({ error: "Admin or owner access required" });
      }

      const invitations = await storage.getOrganizationInvitationsByOrg(membership.organizationId);
      const pendingInvitations = invitations.filter(inv => !inv.acceptedAt && new Date(inv.expiresAt) > new Date());

      res.json(pendingInvitations);
    } catch (error: any) {
      console.error("[Organizations] Get current invitations error:", error);
      res.status(500).json({ error: "Failed to fetch invitations" });
    }
  });

  app.get("/api/organizations/current/usage", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const membership = await verifyCurrentOrgMembership(userId);
      if (!membership) {
        return res.status(404).json({ error: "No active organization or not a member" });
      }

      const usage = await getOrganizationUsage(membership.organizationId);
      res.json(usage);
    } catch (error: any) {
      console.error("[Organizations] Get current usage error:", error);
      res.status(500).json({ error: "Failed to fetch usage data" });
    }
  });

  app.post("/api/organizations/current/invite", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const membership = await verifyCurrentOrgMembership(userId);
      if (!membership) {
        return res.status(404).json({ error: "No active organization or not a member" });
      }

      const organizationId = membership.organizationId;
      
      // Check if user is admin or owner
      if (membership.member.role !== "owner" && membership.member.role !== "admin") {
        return res.status(403).json({ error: "Admin or owner access required" });
      }

      const validation = inviteMemberSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid invitation data", 
          details: validation.error.flatten() 
        });
      }

      const { email, role } = validation.data;

      const limitCheck = await canAddMember(organizationId);
      if (!limitCheck.ok) {
        return res.status(400).json({
          error: limitCheck.message,
          reason: limitCheck.reason,
          recommendation: limitCheck.recommendation
        });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        const existingMember = await storage.getOrganizationMember(organizationId, existingUser.id);
        if (existingMember && existingMember.isActive) {
          return res.status(400).json({ error: "This user is already a member of this organization" });
        }
      }

      const existingInvite = await storage.getOrganizationInvitationByEmail(organizationId, email);
      if (existingInvite && !existingInvite.acceptedAt && new Date(existingInvite.expiresAt) > new Date()) {
        return res.status(400).json({ error: "An invitation has already been sent to this email" });
      }

      const token = generateInviteToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invitation = await storage.createOrganizationInvitation(
        {
          organizationId,
          email,
          role: role as OrgMemberRole,
          invitedBy: userId
        },
        token,
        expiresAt
      );

      const org = await storage.getOrganizationById(organizationId);
      const inviter = await storage.getUser(userId);

      try {
        const baseUrl = process.env.BASE_URL || "https://slip-safe.net";
        const inviteLink = `${baseUrl}/invite/${token}`;
        
        await sendEmail(
          email,
          `You've been invited to join ${org?.name} on SlipSafe`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>You're invited to join ${org?.name}!</h2>
              <p>${inviter?.fullName || "A team member"} has invited you to join their organization on SlipSafe.</p>
              <p>SlipSafe helps businesses manage receipts, track warranties, and streamline VAT reporting.</p>
              <p style="margin: 30px 0;">
                <a href="${inviteLink}" style="background: linear-gradient(to right, #4f46e5, #0d9488); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Accept Invitation
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">
                This invitation expires in 7 days. If you didn't expect this invitation, you can safely ignore it.
              </p>
            </div>
          `
        );
      } catch (emailError) {
        console.error("[Organizations] Failed to send invitation email:", emailError);
      }

      res.status(201).json({ invitation });
    } catch (error: any) {
      console.error("[Organizations] Current invite error:", error);
      res.status(500).json({ error: "Failed to create invitation" });
    }
  });

  app.delete("/api/organizations/current/members/:userId", isAuthenticated, async (req, res) => {
    try {
      const currentUserId = getCurrentUserId(req);
      if (!currentUserId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const membership = await verifyCurrentOrgMembership(currentUserId);
      if (!membership) {
        return res.status(404).json({ error: "No active organization or not a member" });
      }

      const organizationId = membership.organizationId;
      const targetUserId = req.params.userId;

      // Check if current user is admin or owner
      if (membership.member.role !== "owner" && membership.member.role !== "admin") {
        return res.status(403).json({ error: "Admin or owner access required" });
      }

      const targetMember = await storage.getOrganizationMember(organizationId, targetUserId);
      if (!targetMember) {
        return res.status(404).json({ error: "Member not found" });
      }

      if (targetMember.role === "owner") {
        return res.status(400).json({ error: "Cannot remove the organization owner" });
      }

      // Only owners can remove admins
      if (targetMember.role === "admin" && membership.member.role !== "owner") {
        return res.status(403).json({ error: "Only owners can remove admins" });
      }

      await storage.removeOrganizationMember(organizationId, targetUserId);

      const targetUser = await storage.getUser(targetUserId);
      if (targetUser?.activeOrganizationId === organizationId) {
        await storage.updateUserActiveOrganization(targetUserId, null);
      }

      res.json({ message: "Member removed successfully" });
    } catch (error: any) {
      console.error("[Organizations] Remove member error:", error);
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  app.delete("/api/organizations/current/invitations/:invitationId", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const membership = await verifyCurrentOrgMembership(userId);
      if (!membership) {
        return res.status(404).json({ error: "No active organization or not a member" });
      }

      const invitationId = req.params.invitationId;

      // Check if user is admin or owner
      if (membership.member.role !== "owner" && membership.member.role !== "admin") {
        return res.status(403).json({ error: "Admin or owner access required" });
      }

      await storage.deleteOrganizationInvitation(invitationId);

      res.json({ message: "Invitation cancelled successfully" });
    } catch (error: any) {
      console.error("[Organizations] Cancel invitation error:", error);
      res.status(500).json({ error: "Failed to cancel invitation" });
    }
  });

  // ========================
  // PARAMETERIZED ORGANIZATION ROUTES - :organizationId routes
  // ========================

  app.get("/api/organizations/:organizationId", isAuthenticated, requireOrgAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const org = await storage.getOrganizationById(organizationId);
      
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const usage = await getOrganizationUsage(organizationId);
      const members = await storage.getOrganizationMembers(organizationId);
      const invitations = await storage.getOrganizationInvitationsByOrg(organizationId);

      const memberDetails = await Promise.all(
        members.map(async (member) => {
          const user = await storage.getUser(member.userId);
          return {
            ...member,
            user: user ? {
              id: user.id,
              fullName: user.fullName,
              email: user.email,
              profilePicture: user.profilePicture
            } : null
          };
        })
      );

      res.json({
        organization: org,
        usage,
        members: memberDetails,
        invitations: invitations.filter(inv => !inv.acceptedAt && new Date(inv.expiresAt) > new Date())
      });
    } catch (error: any) {
      console.error("[Organizations] Get error:", error);
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });

  app.patch("/api/organizations/:organizationId", isAuthenticated, requireOrgAccess, requireOrgAdmin, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      
      const validation = updateOrganizationSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid update data", 
          details: validation.error.flatten() 
        });
      }

      const updated = await storage.updateOrganization(organizationId, validation.data);
      if (!updated) {
        return res.status(404).json({ error: "Organization not found" });
      }

      res.json({ organization: updated });
    } catch (error: any) {
      console.error("[Organizations] Update error:", error);
      res.status(500).json({ error: "Failed to update organization" });
    }
  });

  app.post("/api/organizations/:organizationId/invite", isAuthenticated, requireOrgAccess, requireOrgAdmin, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const organizationId = (req as any).organizationId;
      
      const validation = inviteMemberSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid invitation data", 
          details: validation.error.flatten() 
        });
      }

      const { email, role } = validation.data;

      const limitCheck = await canAddMember(organizationId);
      if (!limitCheck.ok) {
        return res.status(400).json({
          error: limitCheck.message,
          reason: limitCheck.reason,
          recommendation: limitCheck.recommendation
        });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        const existingMember = await storage.getOrganizationMember(organizationId, existingUser.id);
        if (existingMember && existingMember.isActive) {
          return res.status(400).json({ error: "This user is already a member of this organization" });
        }
      }

      const existingInvite = await storage.getOrganizationInvitationByEmail(organizationId, email);
      if (existingInvite && !existingInvite.acceptedAt && new Date(existingInvite.expiresAt) > new Date()) {
        return res.status(400).json({ error: "An invitation has already been sent to this email" });
      }

      const token = generateInviteToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invitation = await storage.createOrganizationInvitation(
        {
          organizationId,
          email,
          role: role as OrgMemberRole,
          invitedBy: userId!
        },
        token,
        expiresAt
      );

      const org = await storage.getOrganizationById(organizationId);
      const inviter = await storage.getUser(userId!);

      try {
        const baseUrl = process.env.BASE_URL || "https://slip-safe.net";
        const inviteLink = `${baseUrl}/invite/${token}`;
        
        await sendEmail(
          email,
          `You've been invited to join ${org?.name} on SlipSafe`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>You're invited to join ${org?.name}!</h2>
              <p>${inviter?.fullName || "A team member"} has invited you to join their organization on SlipSafe.</p>
              <p>SlipSafe helps businesses manage receipts, track warranties, and streamline VAT reporting.</p>
              <p style="margin: 30px 0;">
                <a href="${inviteLink}" style="background: linear-gradient(to right, #4f46e5, #0d9488); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Accept Invitation
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">
                This invitation expires in 7 days. If you didn't expect this invitation, you can safely ignore it.
              </p>
            </div>
          `
        );
      } catch (emailError) {
        console.error("[Organizations] Failed to send invitation email:", emailError);
      }

      res.status(201).json({ invitation });
    } catch (error: any) {
      console.error("[Organizations] Invite error:", error);
      res.status(500).json({ error: "Failed to create invitation" });
    }
  });

  app.post("/api/organizations/accept-invite/:token", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { token } = req.params;
      const invitation = await storage.getOrganizationInvitation(token);

      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found" });
      }

      if (invitation.acceptedAt) {
        return res.status(400).json({ error: "This invitation has already been accepted" });
      }

      if (new Date(invitation.expiresAt) < new Date()) {
        return res.status(400).json({ error: "This invitation has expired" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        return res.status(403).json({ error: "This invitation was sent to a different email address" });
      }

      const limitCheck = await canAddMember(invitation.organizationId);
      if (!limitCheck.ok) {
        return res.status(400).json({
          error: "This organization has reached its member limit",
          recommendation: limitCheck.recommendation
        });
      }

      const existingMember = await storage.getOrganizationMember(invitation.organizationId, userId);
      if (existingMember && existingMember.isActive) {
        return res.status(400).json({ error: "You are already a member of this organization" });
      }

      if (existingMember) {
        await storage.updateOrganizationMember(invitation.organizationId, userId, {
          isActive: true,
          role: invitation.role as OrgMemberRole
        });
      } else {
        await storage.addOrganizationMember({
          organizationId: invitation.organizationId,
          userId,
          role: invitation.role as OrgMemberRole,
          invitedBy: invitation.invitedBy,
          isActive: true
        });
      }

      await storage.acceptOrganizationInvitation(token);

      await storage.updateUserActiveOrganization(userId, invitation.organizationId);

      const org = await storage.getOrganizationById(invitation.organizationId);

      res.json({ 
        message: "Successfully joined organization",
        organization: org
      });
    } catch (error: any) {
      console.error("[Organizations] Accept invite error:", error);
      res.status(500).json({ error: "Failed to accept invitation" });
    }
  });

  app.get("/api/organizations/invite/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const invitation = await storage.getOrganizationInvitation(token);

      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found" });
      }

      if (invitation.acceptedAt) {
        return res.status(400).json({ error: "This invitation has already been accepted" });
      }

      if (new Date(invitation.expiresAt) < new Date()) {
        return res.status(400).json({ error: "This invitation has expired" });
      }

      const org = await storage.getOrganizationById(invitation.organizationId);
      const inviter = await storage.getUser(invitation.invitedBy);

      res.json({
        invitation: {
          email: invitation.email,
          role: invitation.role,
          organizationName: org?.name,
          inviterName: inviter?.fullName,
          expiresAt: invitation.expiresAt
        }
      });
    } catch (error: any) {
      console.error("[Organizations] Get invite error:", error);
      res.status(500).json({ error: "Failed to fetch invitation" });
    }
  });

  app.delete("/api/organizations/:organizationId/members/:userId", isAuthenticated, requireOrgAccess, requireOrgAdmin, async (req, res) => {
    try {
      const currentUserId = getCurrentUserId(req);
      const organizationId = (req as any).organizationId;
      const targetUserId = req.params.userId;
      const currentMember = (req as any).orgMember;

      const targetMember = await storage.getOrganizationMember(organizationId, targetUserId);
      if (!targetMember) {
        return res.status(404).json({ error: "Member not found" });
      }

      if (targetMember.role === "owner") {
        return res.status(400).json({ error: "Cannot remove the organization owner" });
      }

      if (targetMember.role === "admin" && currentMember.role !== "owner") {
        return res.status(403).json({ error: "Only owners can remove admins" });
      }

      await storage.removeOrganizationMember(organizationId, targetUserId);

      const targetUser = await storage.getUser(targetUserId);
      if (targetUser?.activeOrganizationId === organizationId) {
        await storage.updateUserActiveOrganization(targetUserId, null);
      }

      res.json({ message: "Member removed successfully" });
    } catch (error: any) {
      console.error("[Organizations] Remove member error:", error);
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  app.patch("/api/organizations/:organizationId/members/:userId/role", isAuthenticated, requireOrgAccess, requireOrgOwner, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const targetUserId = req.params.userId;
      const { role } = req.body;

      if (!["admin", "member"].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be 'admin' or 'member'" });
      }

      const targetMember = await storage.getOrganizationMember(organizationId, targetUserId);
      if (!targetMember) {
        return res.status(404).json({ error: "Member not found" });
      }

      if (targetMember.role === "owner") {
        return res.status(400).json({ error: "Cannot change the owner's role" });
      }

      const updated = await storage.updateOrganizationMember(organizationId, targetUserId, { role });

      res.json({ member: updated });
    } catch (error: any) {
      console.error("[Organizations] Update role error:", error);
      res.status(500).json({ error: "Failed to update member role" });
    }
  });

  app.post("/api/organizations/:organizationId/change-plan", isAuthenticated, requireOrgAccess, requireOrgOwner, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      
      const validation = changePlanSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid plan code", 
          details: validation.error.flatten() 
        });
      }

      const { planCode } = validation.data;
      const org = await storage.getOrganizationById(organizationId);
      
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const currentPlanOrder = ["BUSINESS_SOLO", "BUSINESS_PRO", "BUSINESS_ENTERPRISE"];
      const currentIndex = currentPlanOrder.indexOf(org.planCode);
      const targetIndex = currentPlanOrder.indexOf(planCode);

      if (targetIndex < currentIndex) {
        const downgradeCheck = await validatePlanDowngrade(organizationId, planCode);
        if (!downgradeCheck.ok) {
          return res.status(400).json({ error: downgradeCheck.message });
        }
      }

      const updated = await storage.updateOrganizationPlan(organizationId, planCode);
      const planLimits = getPlanLimitsByCode(planCode);

      res.json({ 
        organization: updated,
        planName: planLimits.name,
        limits: {
          maxUsers: planLimits.maxUsers,
          maxReceiptsPerMonth: planLimits.maxReceiptsPerMonth
        }
      });
    } catch (error: any) {
      console.error("[Organizations] Change plan error:", error);
      res.status(500).json({ error: "Failed to change plan" });
    }
  });

  app.get("/api/organizations/:organizationId/usage", isAuthenticated, requireOrgAccess, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      const usage = await getOrganizationUsage(organizationId);
      
      res.json({ usage });
    } catch (error: any) {
      console.error("[Organizations] Get usage error:", error);
      res.status(500).json({ error: "Failed to fetch usage data" });
    }
  });

  app.post("/api/organizations/:organizationId/switch", isAuthenticated, requireOrgAccess, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const organizationId = (req as any).organizationId;

      await storage.updateUserActiveOrganization(userId!, organizationId);
      await storage.updateUserContext(userId!, "business");

      const org = await storage.getOrganizationById(organizationId);

      res.json({ 
        message: "Switched to organization",
        organization: org
      });
    } catch (error: any) {
      console.error("[Organizations] Switch error:", error);
      res.status(500).json({ error: "Failed to switch organization" });
    }
  });

  app.post("/api/organizations/:organizationId/leave", isAuthenticated, requireOrgAccess, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const organizationId = (req as any).organizationId;
      const member = (req as any).orgMember;

      if (member.role === "owner") {
        return res.status(400).json({ 
          error: "Organization owners cannot leave. Transfer ownership first or delete the organization." 
        });
      }

      await storage.removeOrganizationMember(organizationId, userId!);

      const user = await storage.getUser(userId!);
      if (user?.activeOrganizationId === organizationId) {
        await storage.updateUserActiveOrganization(userId!, null);
      }

      res.json({ message: "Successfully left organization" });
    } catch (error: any) {
      console.error("[Organizations] Leave error:", error);
      res.status(500).json({ error: "Failed to leave organization" });
    }
  });

  app.delete("/api/organizations/:organizationId", isAuthenticated, requireOrgAccess, requireOrgOwner, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;
      
      const members = await storage.getOrganizationMembers(organizationId);
      for (const member of members) {
        const user = await storage.getUser(member.userId);
        if (user?.activeOrganizationId === organizationId) {
          await storage.updateUserActiveOrganization(member.userId, null);
        }
      }

      await storage.deleteOrganization(organizationId);

      res.json({ message: "Organization deleted successfully" });
    } catch (error: any) {
      console.error("[Organizations] Delete error:", error);
      res.status(500).json({ error: "Failed to delete organization" });
    }
  });

}
