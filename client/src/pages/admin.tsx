import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  FileText, 
  QrCode, 
  Activity, 
  LogIn, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  Search,
  Filter,
  Building2,
  Eye,
  Mail,
  KeyRound,
  Unlock,
  UserCog,
  Shield,
  MoreHorizontal,
  ExternalLink,
  BookOpen,
  Plus,
  Edit,
  Trash2
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserActivity {
  id: string;
  userId: string;
  action: string;
  metadata: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AdminStats {
  totalUsers: number;
  totalReceipts: number;
  totalClaims: number;
  recentLogins: number;
  activeUsersToday: number;
  newUsersThisWeek: number;
}

interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  emailVerified: boolean;
  phone: string | null;
  accountType: string;
  role: string;
  activeContext: string;
  planType: string;
  createdAt?: string;
}

interface UserDetails extends User {
  homeAddress: string | null;
  idNumber: string | null;
  profilePicture: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  termsVersionAccepted: string | null;
  termsAcceptedAt: string | null;
  businessProfile?: {
    businessName: string;
    vatNumber: string | null;
    taxId: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
  } | null;
  recentActivity: UserActivity[];
  receiptsCount: number;
  claimsCount: number;
}

interface Organization {
  id: string;
  name: string;
  ownerUserId: string;
  ownerEmail?: string;
  ownerName?: string;
  planCode: string;
  billingEmail: string;
  billingStatus: string;
  memberCount?: number;
  createdAt: string;
}

interface OrganizationDetails extends Organization {
  vatNumber: string | null;
  taxId: string | null;
  registrationNumber: string | null;
  address: string | null;
  phone: string | null;
  members: Array<{
    id: string;
    userId: string;
    email?: string;
    fullName?: string;
    username?: string;
    role: string;
    isActive: boolean;
    createdAt: string;
  }>;
}

interface ActivityResponse {
  activities: UserActivity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface OrganizationsResponse {
  organizations: Organization[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const activityTypeLabels: Record<string, { label: string; color: string }> = {
  login: { label: "Login", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  logout: { label: "Logout", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
  receipt_upload: { label: "Receipt Upload", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  claim_create: { label: "Claim Created", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  context_switch: { label: "Context Switch", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  password_change: { label: "Password Change", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  profile_update: { label: "Profile Update", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  admin_password_reset_triggered: { label: "Password Reset Triggered", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  admin_account_unlocked: { label: "Account Unlocked", color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" },
  admin_email_verified: { label: "Email Verified (Admin)", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200" },
  admin_account_type_changed: { label: "Account Type Changed", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200" },
  admin_org_ownership_transferred: { label: "Org Ownership Transferred", color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200" },
  admin_org_member_removed: { label: "Org Member Removed", color: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200" },
  admin_org_member_role_changed: { label: "Org Role Changed", color: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200" },
};

function StatCard({ title, value, icon: Icon, description }: { 
  title: string; 
  value: number | string; 
  icon: typeof Users;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`stat-${title.toLowerCase().replace(/\s/g, '-')}`}>{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}

function UserDetailsDialog({ 
  userId, 
  open, 
  onOpenChange 
}: { 
  userId: string | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const { data: userDetails, isLoading } = useQuery<UserDetails>({
    queryKey: ["/api/admin/users", userId],
    enabled: !!userId && open,
  });

  const passwordResetMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/users/${userId}/password-reset`);
    },
    onSuccess: () => {
      toast({ title: "Password reset email sent", description: "The user will receive an email with reset instructions." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/activity"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/users/${userId}/unlock`);
    },
    onSuccess: () => {
      toast({ title: "Account unlocked", description: "The user can now attempt to log in again." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/activity"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const verifyEmailMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/users/${userId}/verify-email`);
    },
    onSuccess: () => {
      toast({ title: "Email verified", description: "The user's email has been manually verified." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/activity"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleConfirmAction = () => {
    if (confirmAction === "password-reset") {
      passwordResetMutation.mutate();
    } else if (confirmAction === "unlock") {
      unlockMutation.mutate();
    } else if (confirmAction === "verify-email") {
      verifyEmailMutation.mutate();
    }
    setConfirmAction(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              User Details
            </DialogTitle>
            <DialogDescription>
              View and manage user account
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-32" />
              <Skeleton className="h-24" />
            </div>
          ) : userDetails ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Username</p>
                  <p className="font-medium" data-testid="text-user-username">{userDetails.username}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                  <p className="font-medium" data-testid="text-user-fullname">{userDetails.fullName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium" data-testid="text-user-email">{userDetails.email}</p>
                    {userDetails.emailVerified ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Verified</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Unverified</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Phone</p>
                  <p className="font-medium">{userDetails.phone || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Account Type</p>
                  <Badge variant="outline">{userDetails.accountType === "business" ? "Business" : "Individual"}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Role</p>
                  <Badge variant={userDetails.role === "admin" || userDetails.role === "support" ? "default" : "secondary"}>
                    {userDetails.role}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Plan</p>
                  <Badge variant="outline">{userDetails.planType}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Subscription Status</p>
                  <Badge variant="outline">{userDetails.subscriptionStatus || "None"}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Receipts</p>
                  <p className="text-2xl font-bold">{userDetails.receiptsCount}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Claims</p>
                  <p className="text-2xl font-bold">{userDetails.claimsCount}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Context</p>
                  <p className="text-sm font-medium">{userDetails.activeContext}</p>
                </Card>
              </div>

              {userDetails.businessProfile && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Business Profile</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Business Name:</span>{" "}
                      {userDetails.businessProfile.businessName}
                    </div>
                    <div>
                      <span className="text-muted-foreground">VAT Number:</span>{" "}
                      {userDetails.businessProfile.vatNumber || "Not set"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tax ID:</span>{" "}
                      {userDetails.businessProfile.taxId || "Not set"}
                    </div>
                  </CardContent>
                </Card>
              )}

              {userDetails.recentActivity && userDetails.recentActivity.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {userDetails.recentActivity.slice(0, 5).map((activity) => {
                        const typeInfo = activityTypeLabels[activity.action] || { label: activity.action, color: "bg-gray-100 text-gray-800" };
                        return (
                          <div key={activity.id} className="flex items-center justify-between text-sm">
                            <Badge variant="secondary" className={typeInfo.color}>{typeInfo.label}</Badge>
                            <span className="text-muted-foreground">
                              {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">User not found</p>
          )}

          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmAction("password-reset")}
              disabled={passwordResetMutation.isPending}
              data-testid="button-trigger-password-reset"
            >
              <KeyRound className="h-4 w-4 mr-2" />
              Send Password Reset
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmAction("unlock")}
              disabled={unlockMutation.isPending}
              data-testid="button-unlock-account"
            >
              <Unlock className="h-4 w-4 mr-2" />
              Unlock Account
            </Button>
            {userDetails && !userDetails.emailVerified && (
              <Button
                variant="outline"
                onClick={() => setConfirmAction("verify-email")}
                disabled={verifyEmailMutation.isPending}
                data-testid="button-verify-email"
              >
                <Mail className="h-4 w-4 mr-2" />
                Verify Email
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "password-reset" && "This will send a password reset email to the user. They will need to click the link to set a new password."}
              {confirmAction === "unlock" && "This will clear any rate limits for this user, allowing them to attempt login again."}
              {confirmAction === "verify-email" && "This will mark the user's email as verified without requiring email confirmation."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction} data-testid="button-confirm-action">
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function OrganizationDetailsDialog({
  organizationId,
  open,
  onOpenChange
}: {
  organizationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<string | null>(null);

  const { data: orgDetails, isLoading } = useQuery<{ organization: OrganizationDetails; members: OrganizationDetails["members"] }>({
    queryKey: ["/api/admin/organizations", organizationId],
    enabled: !!organizationId && open,
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/admin/organizations/${organizationId}/members/${userId}`);
    },
    onSuccess: () => {
      toast({ title: "Member removed", description: "The member has been removed from the organization." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleRemoveMember = () => {
    if (confirmRemoveMember) {
      removeMemberMutation.mutate(confirmRemoveMember);
      setConfirmRemoveMember(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization Details
            </DialogTitle>
            <DialogDescription>
              View and manage organization
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-32" />
            </div>
          ) : orgDetails ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Organization Name</p>
                  <p className="font-medium" data-testid="text-org-name">{orgDetails.organization.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Plan</p>
                  <Badge variant="outline">{orgDetails.organization.planCode}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Owner</p>
                  <p className="font-medium">{orgDetails.organization.ownerName || orgDetails.organization.ownerEmail}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Billing Email</p>
                  <p className="font-medium">{orgDetails.organization.billingEmail}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Billing Status</p>
                  <Badge variant={orgDetails.organization.billingStatus === "active" ? "default" : "secondary"}>
                    {orgDetails.organization.billingStatus}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created</p>
                  <p className="text-sm">{format(new Date(orgDetails.organization.createdAt), "PPP")}</p>
                </div>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Members ({orgDetails.members.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orgDetails.members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>{member.fullName || member.username}</TableCell>
                          <TableCell>{member.email}</TableCell>
                          <TableCell>
                            <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                              {member.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {member.role !== "owner" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmRemoveMember(member.userId)}
                                data-testid={`button-remove-member-${member.userId}`}
                              >
                                Remove
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-muted-foreground">Organization not found</p>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmRemoveMember} onOpenChange={(open) => !open && setConfirmRemoveMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this member from the organization? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} data-testid="button-confirm-remove-member">
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface MerchantRule {
  id: string;
  merchantName: string;
  returnPolicyDays: number | null;
  warrantyDays: number | null;
  refundType: string | null;
  exchangePolicyDays: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MerchantRulesResponse {
  rules: MerchantRule[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AdminDashboard() {
  const [location] = useLocation();
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [userSearchInput, setUserSearchInput] = useState("");
  const [activityPage, setActivityPage] = useState(1);
  const [userFilter, setUserFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [orgPage, setOrgPage] = useState(1);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgSearchInput, setOrgSearchInput] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [merchantRulesPage, setMerchantRulesPage] = useState(1);
  const [merchantSearch, setMerchantSearch] = useState("");
  const [merchantSearchInput, setMerchantSearchInput] = useState("");
  const [editingRule, setEditingRule] = useState<MerchantRule | null>(null);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);
  const { toast } = useToast();
  const limit = 20;

  const currentView = location === "/admin" ? "overview" 
    : location === "/admin/users" ? "users"
    : location === "/admin/organizations" ? "organizations"
    : location === "/admin/merchant-rules" ? "merchant-rules"
    : location === "/admin/activity" ? "activity"
    : "overview";

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery<UsersResponse>({
    queryKey: ["/api/admin/users", userPage, userSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: userPage.toString(),
        limit: limit.toString(),
      });
      if (userSearch) params.append("search", userSearch);
      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  const { data: activityData, isLoading: activityLoading, refetch: refetchActivity } = useQuery<ActivityResponse>({
    queryKey: ["/api/admin/activity", activityPage, limit, userFilter, actionFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: activityPage.toString(),
        limit: limit.toString(),
      });
      if (userFilter) params.append("userId", userFilter);
      if (actionFilter) params.append("action", actionFilter);
      
      const response = await fetch(`/api/admin/activity?${params}`);
      if (!response.ok) throw new Error("Failed to fetch activity");
      return response.json();
    },
  });

  const { data: orgsData, isLoading: orgsLoading } = useQuery<OrganizationsResponse>({
    queryKey: ["/api/admin/organizations", orgPage, orgSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: orgPage.toString(),
        limit: limit.toString(),
      });
      if (orgSearch) params.append("search", orgSearch);
      const response = await fetch(`/api/admin/organizations?${params}`);
      if (!response.ok) throw new Error("Failed to fetch organizations");
      return response.json();
    },
  });

  const { data: merchantRulesData, isLoading: merchantRulesLoading, refetch: refetchMerchantRules } = useQuery<MerchantRulesResponse>({
    queryKey: ["/api/merchant-rules", merchantRulesPage, merchantSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: merchantRulesPage.toString(),
        limit: limit.toString(),
      });
      if (merchantSearch) params.append("search", merchantSearch);
      const response = await fetch(`/api/merchant-rules?${params}`);
      if (!response.ok) throw new Error("Failed to fetch merchant rules");
      return response.json();
    },
    enabled: currentView === "merchant-rules",
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      await apiRequest("DELETE", `/api/merchant-rules/${ruleId}`);
    },
    onSuccess: () => {
      toast({ title: "Rule deleted", description: "The merchant rule has been deleted." });
      queryClient.invalidateQueries({ queryKey: ["/api/merchant-rules"] });
      setDeleteRuleId(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleMerchantSearch = () => {
    setMerchantSearch(merchantSearchInput);
    setMerchantRulesPage(1);
  };

  const formatMetadata = (metadata: string | null) => {
    if (!metadata) return null;
    try {
      const parsed = JSON.parse(metadata);
      return Object.entries(parsed)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
    } catch {
      return metadata;
    }
  };

  const getUserName = (userId: string) => {
    const user = usersData?.users.find(u => u.id === userId);
    return user?.username || userId.slice(0, 8) + "...";
  };

  const handleUserSearch = () => {
    setUserSearch(userSearchInput);
    setUserPage(1);
  };

  const handleOrgSearch = () => {
    setOrgSearch(orgSearchInput);
    setOrgPage(1);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-admin-title">Admin Dashboard</h1>
          <p className="text-muted-foreground">Support tools and system monitoring</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            refetchUsers();
            refetchActivity();
            if (currentView === "merchant-rules") {
              refetchMerchantRules();
            }
          }}
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {currentView === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statsLoading ? (
              <>
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </>
            ) : (
              <>
                <StatCard
                  title="Total Users"
                  value={stats?.totalUsers || 0}
                  icon={Users}
                  description="Registered accounts"
                />
                <StatCard
                  title="Total Receipts"
                  value={stats?.totalReceipts || 0}
                  icon={FileText}
                  description="Uploaded receipts"
                />
                <StatCard
                  title="Total Claims"
                  value={stats?.totalClaims || 0}
                  icon={QrCode}
                  description="Generated claims"
                />
                <StatCard
                  title="Active Today"
                  value={stats?.activeUsersToday || 0}
                  icon={Activity}
                  description="Users active in last 24h"
                />
              </>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Link href="/admin/users">
                  <Button variant="outline" className="justify-start w-full" data-testid="button-goto-users">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Users
                  </Button>
                </Link>
                <Link href="/admin/organizations">
                  <Button variant="outline" className="justify-start w-full" data-testid="button-goto-orgs">
                    <Building2 className="h-4 w-4 mr-2" />
                    Manage Organizations
                  </Button>
                </Link>
                <Link href="/admin/merchant-rules">
                  <Button variant="outline" className="justify-start w-full" data-testid="button-goto-merchant-rules">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Merchant Rules
                  </Button>
                </Link>
                <Link href="/admin/activity">
                  <Button variant="outline" className="justify-start w-full" data-testid="button-goto-activity">
                    <LogIn className="h-4 w-4 mr-2" />
                    View Activity Log
                  </Button>
                </Link>
                <Link href="/admin/crm">
                  <Button variant="outline" className="justify-start w-full" data-testid="button-goto-crm">
                    <Users className="h-4 w-4 mr-2" />
                    Customer Management (CRM)
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Database</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Connected
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Email Service</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">OCR Service</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Gemini AI
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {currentView === "users" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>Search and manage user accounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by username, email, or phone..."
                    value={userSearchInput}
                    onChange={(e) => setUserSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUserSearch()}
                    className="pl-10"
                    data-testid="input-user-search"
                  />
                </div>
                <Button onClick={handleUserSearch} data-testid="button-search-users">
                  Search
                </Button>
              </div>

              {usersLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead className="hidden md:table-cell">Email</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="hidden sm:table-cell">Email Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usersData?.users.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              No users found
                            </TableCell>
                          </TableRow>
                        ) : (
                          usersData?.users.map((user) => (
                            <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{user.username}</p>
                                  <p className="text-xs text-muted-foreground md:hidden">{user.email}</p>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-muted-foreground">
                                {user.email}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {user.accountType === "business" ? "Business" : "Individual"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={user.role === "admin" || user.role === "support" ? "default" : "secondary"}>
                                  {user.role}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {user.emailVerified ? (
                                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                    Verified
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                    Pending
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" data-testid={`button-user-actions-${user.id}`}>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setSelectedUserId(user.id)} data-testid={`menuitem-view-user-${user.id}`}>
                                      <Eye className="h-4 w-4 mr-2" />
                                      View Details
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {usersData && usersData.totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Showing {((userPage - 1) * limit) + 1} to {Math.min(userPage * limit, usersData.total)} of {usersData.total} users
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUserPage(p => Math.max(1, p - 1))}
                          disabled={userPage === 1}
                          data-testid="button-users-prev-page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Page {userPage} of {usersData.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUserPage(p => p + 1)}
                          disabled={userPage >= usersData.totalPages}
                          data-testid="button-users-next-page"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {currentView === "organizations" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization Management
              </CardTitle>
              <CardDescription>View and manage business organizations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by organization name or billing email..."
                    value={orgSearchInput}
                    onChange={(e) => setOrgSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleOrgSearch()}
                    className="pl-10"
                    data-testid="input-org-search"
                  />
                </div>
                <Button onClick={handleOrgSearch} data-testid="button-search-orgs">
                  Search
                </Button>
              </div>

              {orgsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Organization</TableHead>
                          <TableHead className="hidden md:table-cell">Owner</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead className="hidden sm:table-cell">Members</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orgsData?.organizations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              No organizations found
                            </TableCell>
                          </TableRow>
                        ) : (
                          orgsData?.organizations.map((org) => (
                            <TableRow key={org.id} data-testid={`row-org-${org.id}`}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{org.name}</p>
                                  <p className="text-xs text-muted-foreground">{org.billingEmail}</p>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-muted-foreground">
                                {org.ownerName || org.ownerEmail}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{org.planCode}</Badge>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {org.memberCount}
                              </TableCell>
                              <TableCell>
                                <Badge variant={org.billingStatus === "active" ? "default" : "secondary"}>
                                  {org.billingStatus}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setSelectedOrgId(org.id)}
                                  data-testid={`button-view-org-${org.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {orgsData && orgsData.totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Showing {((orgPage - 1) * limit) + 1} to {Math.min(orgPage * limit, orgsData.total)} of {orgsData.total} organizations
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOrgPage(p => Math.max(1, p - 1))}
                          disabled={orgPage === 1}
                          data-testid="button-orgs-prev-page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Page {orgPage} of {orgsData.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOrgPage(p => p + 1)}
                          disabled={orgPage >= orgsData.totalPages}
                          data-testid="button-orgs-next-page"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {currentView === "activity" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="h-5 w-5" />
                User Activity Log
              </CardTitle>
              <CardDescription>Recent system activity across all users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={userFilter} onValueChange={(value) => { setUserFilter(value === "all" ? "" : value); setActivityPage(1); }}>
                    <SelectTrigger className="w-[180px]" data-testid="select-user-filter">
                      <SelectValue placeholder="All users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All users</SelectItem>
                      {usersData?.users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={actionFilter} onValueChange={(value) => { setActionFilter(value === "all" ? "" : value); setActivityPage(1); }}>
                    <SelectTrigger className="w-[200px]" data-testid="select-action-filter">
                      <SelectValue placeholder="All actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All actions</SelectItem>
                      <SelectItem value="login">Login</SelectItem>
                      <SelectItem value="logout">Logout</SelectItem>
                      <SelectItem value="receipt_upload">Receipt Upload</SelectItem>
                      <SelectItem value="claim_create">Claim Create</SelectItem>
                      <SelectItem value="context_switch">Context Switch</SelectItem>
                      <SelectItem value="password_change">Password Change</SelectItem>
                      <SelectItem value="profile_update">Profile Update</SelectItem>
                      <SelectItem value="admin_password_reset_triggered">Password Reset (Admin)</SelectItem>
                      <SelectItem value="admin_account_unlocked">Account Unlock (Admin)</SelectItem>
                      <SelectItem value="admin_email_verified">Email Verify (Admin)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {activityLoading || usersLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead className="hidden md:table-cell">Details</TableHead>
                          <TableHead className="hidden lg:table-cell">IP Address</TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activityData?.activities.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              No activity found
                            </TableCell>
                          </TableRow>
                        ) : (
                          activityData?.activities.map((activity) => {
                            const typeInfo = activityTypeLabels[activity.action] || { 
                              label: activity.action, 
                              color: "bg-gray-100 text-gray-800" 
                            };
                            return (
                              <TableRow key={activity.id} data-testid={`row-activity-${activity.id}`}>
                                <TableCell className="font-medium">
                                  {getUserName(activity.userId)}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className={typeInfo.color}>
                                    {typeInfo.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-muted-foreground text-sm max-w-[200px] truncate">
                                  {formatMetadata(activity.metadata) || "-"}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                                  {activity.ipAddress || "-"}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing {((activityPage - 1) * limit) + 1} to {Math.min(activityPage * limit, activityData?.total || 0)} of {activityData?.total || 0} activities
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                        disabled={activityPage === 1}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {activityPage} of {activityData?.totalPages || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActivityPage(p => p + 1)}
                        disabled={activityPage >= (activityData?.totalPages || 1)}
                        data-testid="button-next-page"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {currentView === "merchant-rules" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Merchant Rules
                  </CardTitle>
                  <CardDescription>Default return/warranty policies for merchants</CardDescription>
                </div>
                <Button onClick={() => setIsAddingRule(true)} data-testid="button-add-merchant-rule">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by merchant name..."
                    value={merchantSearchInput}
                    onChange={(e) => setMerchantSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleMerchantSearch()}
                    className="pl-10"
                    data-testid="input-merchant-search"
                  />
                </div>
                <Button onClick={handleMerchantSearch} data-testid="button-search-merchant">
                  Search
                </Button>
              </div>

              {merchantRulesLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Merchant Name</TableHead>
                          <TableHead>Return Days</TableHead>
                          <TableHead className="hidden sm:table-cell">Warranty Days</TableHead>
                          <TableHead className="hidden md:table-cell">Refund Type</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {merchantRulesData?.rules.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              No merchant rules found
                            </TableCell>
                          </TableRow>
                        ) : (
                          merchantRulesData?.rules.map((rule) => (
                            <TableRow key={rule.id} data-testid={`row-rule-${rule.id}`}>
                              <TableCell className="font-medium">{rule.merchantName}</TableCell>
                              <TableCell>{rule.returnPolicyDays ?? "N/A"}</TableCell>
                              <TableCell className="hidden sm:table-cell">{rule.warrantyDays ?? "N/A"}</TableCell>
                              <TableCell className="hidden md:table-cell">{rule.refundType || "N/A"}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditingRule(rule)}
                                    data-testid={`button-edit-rule-${rule.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeleteRuleId(rule.id)}
                                    data-testid={`button-delete-rule-${rule.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {merchantRulesData && merchantRulesData.totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Showing {((merchantRulesPage - 1) * limit) + 1} to {Math.min(merchantRulesPage * limit, merchantRulesData.total)} of {merchantRulesData.total} rules
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMerchantRulesPage(p => Math.max(1, p - 1))}
                          disabled={merchantRulesPage === 1}
                          data-testid="button-rules-prev-page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Page {merchantRulesPage} of {merchantRulesData.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMerchantRulesPage(p => p + 1)}
                          disabled={merchantRulesPage >= merchantRulesData.totalPages}
                          data-testid="button-rules-next-page"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <AlertDialog open={!!deleteRuleId} onOpenChange={(open) => !open && setDeleteRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Merchant Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this merchant rule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteRuleId && deleteRuleMutation.mutate(deleteRuleId)}
              data-testid="button-confirm-delete-rule"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UserDetailsDialog
        userId={selectedUserId}
        open={!!selectedUserId}
        onOpenChange={(open) => !open && setSelectedUserId(null)}
      />

      <OrganizationDetailsDialog
        organizationId={selectedOrgId}
        open={!!selectedOrgId}
        onOpenChange={(open) => !open && setSelectedOrgId(null)}
      />
    </div>
  );
}
