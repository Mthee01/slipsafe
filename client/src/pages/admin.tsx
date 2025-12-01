import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
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
  Filter
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
  email: string | null;
  phone: string | null;
  accountType: string;
  role: string;
  activeContext: string;
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
}

const activityTypeLabels: Record<string, { label: string; color: string }> = {
  login: { label: "Login", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  logout: { label: "Logout", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
  receipt_upload: { label: "Receipt Upload", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  claim_create: { label: "Claim Created", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  context_switch: { label: "Context Switch", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  password_change: { label: "Password Change", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  profile_update: { label: "Profile Update", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
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

export default function AdminDashboard() {
  const [page, setPage] = useState(1);
  const [userFilter, setUserFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const limit = 20;

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<UsersResponse>({
    queryKey: ["/api/admin/users"],
  });

  const { data: activityData, isLoading: activityLoading, refetch: refetchActivity } = useQuery<ActivityResponse>({
    queryKey: ["/api/admin/activity", page, limit, userFilter, actionFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (userFilter) params.append("userId", userFilter);
      if (actionFilter) params.append("action", actionFilter);
      
      const response = await fetch(`/api/admin/activity?${params}`);
      if (!response.ok) throw new Error("Failed to fetch activity");
      return response.json();
    },
  });

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-admin-title">Admin Dashboard</h1>
          <p className="text-muted-foreground">Monitor user activity and system statistics</p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetchActivity()}
          data-testid="button-refresh-activity"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

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
              <Select value={userFilter} onValueChange={(value) => { setUserFilter(value === "all" ? "" : value); setPage(1); }}>
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
              <Select value={actionFilter} onValueChange={(value) => { setActionFilter(value === "all" ? "" : value); setPage(1); }}>
                <SelectTrigger className="w-[180px]" data-testid="select-action-filter">
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
                  Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, activityData?.total || 0)} of {activityData?.total || 0} activities
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {activityData?.totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= (activityData?.totalPages || 1)}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Users
          </CardTitle>
          <CardDescription>Registered users in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead>Account Type</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersData?.users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    usersData?.users.map((user) => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {user.email || "-"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {user.phone || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {user.accountType === "business" ? "Business" : "Individual"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                            {user.role === "admin" ? "Admin" : "User"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
