import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, Building2, Crown, Loader2, Mail, Plus, Receipt, Sparkles, Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import { Redirect } from "wouter";

interface OrganizationMember {
  id: string;
  userId: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
    username: string;
  };
}

interface OrganizationInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  acceptedAt: string | null;
}

interface OrganizationUsage {
  memberCount: number;
  monthlyReceiptCount: number;
  planCode: string;
  planName: string;
  limits: {
    maxUsers: number | null;
    maxReceiptsPerMonth: number | null;
  };
}

interface Organization {
  id: string;
  name: string;
  planCode: string;
  ownerUserId: string;
}

export default function TeamPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [createOrgDialogOpen, setCreateOrgDialogOpen] = useState(false);
  const [orgName, setOrgName] = useState("");

  const isBusiness = user?.accountType === "business";
  const isBusinessContext = user?.activeContext === "business";

  const { data: organization, isLoading: orgLoading, error: orgError } = useQuery<Organization>({
    queryKey: ["/api/organizations/current"],
    enabled: isBusiness && isBusinessContext,
    retry: false,
  });

  const createOrgMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const response = await apiRequest("POST", "/api/organizations", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/current/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/current/usage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      setOrgName("");
      setCreateOrgDialogOpen(false);
      toast({
        title: "Organization created",
        description: "Your organization has been set up successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create organization",
        description: error.message || "Could not create organization",
        variant: "destructive",
      });
    },
  });

  const noOrganization = !orgLoading && !organization;

  const { data: members, isLoading: membersLoading } = useQuery<OrganizationMember[]>({
    queryKey: ["/api/organizations/current/members"],
    enabled: isBusiness && isBusinessContext && !!organization,
  });

  const { data: invitations } = useQuery<OrganizationInvitation[]>({
    queryKey: ["/api/organizations/current/invitations"],
    enabled: isBusiness && isBusinessContext && !!organization,
  });

  const { data: usage } = useQuery<OrganizationUsage>({
    queryKey: ["/api/organizations/current/usage"],
    enabled: isBusiness && isBusinessContext && !!organization,
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const response = await apiRequest("POST", "/api/organizations/current/invite", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/current/invitations"] });
      setInviteEmail("");
      setInviteRole("member");
      setInviteDialogOpen(false);
      toast({
        title: "Invitation sent",
        description: `An invitation has been sent to ${inviteEmail}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send invitation",
        description: error.message || "Could not send invitation",
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/organizations/current/members/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/current/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/current/usage"] });
      toast({
        title: "Member removed",
        description: "The team member has been removed from the organization",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove member",
        description: error.message || "Could not remove member",
        variant: "destructive",
      });
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await apiRequest("DELETE", `/api/organizations/current/invitations/${invitationId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/current/invitations"] });
      toast({
        title: "Invitation cancelled",
        description: "The invitation has been cancelled",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to cancel invitation",
        description: error.message || "Could not cancel invitation",
        variant: "destructive",
      });
    },
  });

  if (!isBusiness || !isBusinessContext) {
    return <Redirect to="/" />;
  }

  const handleCreateOrg = () => {
    if (!orgName.trim()) return;
    createOrgMutation.mutate({ name: orgName.trim() });
  };

  if (noOrganization) {
    return (
      <div className="container max-w-2xl py-12">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Create Your Organization</CardTitle>
            <CardDescription className="text-base">
              Set up an organization to start collaborating with your team and managing receipts together.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-sm mx-auto space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  placeholder="e.g., My Company Ltd"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  data-testid="input-org-name"
                />
              </div>
              <Button 
                className="w-full" 
                onClick={handleCreateOrg}
                disabled={!orgName.trim() || createOrgMutation.isPending}
                data-testid="button-create-org"
              >
                {createOrgMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Organization
                  </>
                )}
              </Button>
            </div>
            <Separator className="my-6" />
            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>Solo Plan</strong> - Free to start</p>
              <p>1 team member, 1,000 receipts/month</p>
              <p className="text-xs">Upgrade anytime as your team grows</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOwnerOrAdmin = members?.some(
    m => m.userId === user?.id && (m.role === "owner" || m.role === "admin")
  );

  const memberUsagePercent = usage?.limits.maxUsers 
    ? Math.min((usage.memberCount / usage.limits.maxUsers) * 100, 100)
    : 0;
  
  const receiptUsagePercent = usage?.limits.maxReceiptsPerMonth
    ? Math.min((usage.monthlyReceiptCount / usage.limits.maxReceiptsPerMonth) * 100, 100)
    : 0;

  const canInviteMore = !usage?.limits.maxUsers || usage.memberCount < usage.limits.maxUsers;

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner": return "default";
      case "admin": return "secondary";
      default: return "outline";
    }
  };

  const pendingInvitations = invitations?.filter(inv => !inv.acceptedAt) || [];

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-team-title">Team & Plan</h1>
          <p className="text-muted-foreground">
            Manage your organization's team members and subscription
          </p>
        </div>
        {organization && (
          <Badge variant="outline" className="text-sm">
            <Building2 className="h-3 w-3 mr-1" />
            {organization.name}
          </Badge>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Members
            </CardTitle>
            <CardDescription>
              {usage?.limits.maxUsers 
                ? `${usage.memberCount} of ${usage.limits.maxUsers} seats used`
                : `${usage?.memberCount || 0} members`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usage?.limits.maxUsers && (
              <Progress value={memberUsagePercent} className="h-2" />
            )}
            {memberUsagePercent >= 80 && usage?.limits.maxUsers && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {memberUsagePercent >= 100 ? "Team limit reached" : "Approaching team limit"}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Monthly Receipts
            </CardTitle>
            <CardDescription>
              {usage?.limits.maxReceiptsPerMonth
                ? `${usage.monthlyReceiptCount} of ${usage.limits.maxReceiptsPerMonth.toLocaleString()} used`
                : `${usage?.monthlyReceiptCount || 0} receipts this month`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usage?.limits.maxReceiptsPerMonth && (
              <Progress value={receiptUsagePercent} className="h-2" />
            )}
            {receiptUsagePercent >= 80 && usage?.limits.maxReceiptsPerMonth && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {receiptUsagePercent >= 100 ? "Monthly limit reached" : "Approaching monthly limit"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Current Plan: {usage?.planName || "Loading..."}</CardTitle>
            <CardDescription>
              {usage?.planCode === "BUSINESS_SOLO" && "Perfect for solo entrepreneurs"}
              {usage?.planCode === "BUSINESS_PRO" && "For growing teams up to 10 members"}
              {usage?.planCode === "BUSINESS_ENTERPRISE" && "Unlimited access for large organizations"}
            </CardDescription>
          </div>
          {usage?.planCode !== "BUSINESS_ENTERPRISE" && (
            <Button variant="outline" size="sm" data-testid="button-upgrade-plan">
              <Sparkles className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
          )}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>People who have access to this organization</CardDescription>
          </div>
          {isOwnerOrAdmin && (
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!canInviteMore} data-testid="button-invite-member">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join your organization. They'll receive an email with instructions.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      data-testid="input-invite-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger data-testid="select-invite-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Admins can invite and remove members. Members can only upload receipts.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleInvite} 
                    disabled={!inviteEmail.trim() || inviteMutation.isPending}
                    data-testid="button-send-invitation"
                  >
                    {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading team members...</div>
          ) : (
            <div className="space-y-3">
              {members?.map((member) => (
                <div 
                  key={member.id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  data-testid={`member-row-${member.userId}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      {member.role === "owner" ? (
                        <Crown className="h-4 w-4 text-amber-500" />
                      ) : (
                        <span className="text-sm font-medium">
                          {(member.user?.fullName || member.user?.email || "?")[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {member.user?.fullName || member.user?.username || "Unknown User"}
                        {member.userId === user?.id && (
                          <span className="text-muted-foreground ml-1">(you)</span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">{member.user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getRoleBadgeVariant(member.role)}>
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </Badge>
                    {isOwnerOrAdmin && member.role !== "owner" && member.userId !== user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMemberMutation.mutate(member.userId)}
                        disabled={removeMemberMutation.isPending}
                        data-testid={`button-remove-member-${member.userId}`}
                      >
                        <UserMinus className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {pendingInvitations.length > 0 && (
            <>
              <Separator className="my-4" />
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Pending Invitations
                </h4>
                <div className="space-y-2">
                  {pendingInvitations.map((invitation) => (
                    <div 
                      key={invitation.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-dashed bg-muted/30"
                      data-testid={`invitation-row-${invitation.id}`}
                    >
                      <div>
                        <p className="font-medium">{invitation.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{invitation.role}</Badge>
                        {isOwnerOrAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => cancelInvitationMutation.mutate(invitation.id)}
                            disabled={cancelInvitationMutation.isPending}
                            data-testid={`button-cancel-invitation-${invitation.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {!canInviteMore && (
            <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                You've reached the maximum number of team members for your plan.
                <a href="/pricing" className="underline hover:no-underline">
                  Upgrade to add more
                </a>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
