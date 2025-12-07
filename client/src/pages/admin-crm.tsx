import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  Building2, 
  ChevronLeft, 
  ChevronRight,
  Search,
  Filter,
  Eye,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  ClipboardList,
  Plus,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Link } from "wouter";

interface CrmAccount {
  id: string;
  accountType: "user" | "organization";
  accountId: string;
  displayName: string;
  primaryEmail: string;
  lifecycleStage: string;
  sizeSegment: string | null;
  industry: string | null;
  notes: string | null;
  createdAt: string;
  subscription?: {
    status: string;
    currentPeriodEnd: string | null;
  } | null;
  plan?: {
    name: string;
  } | null;
  interactionCount?: number;
}

interface CrmInteraction {
  id: string;
  type: string;
  direction: string;
  subject: string | null;
  body: string | null;
  source: string;
  createdAt: string;
  createdByUserId: string | null;
}

interface CrmTask {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: string;
  assignedToUserId: string | null;
  createdAt: string;
}

interface CrmStats {
  totalAccounts: number;
  customers: number;
  leads: number;
  churnRisk: number;
  openTasks: number;
  activeSubscriptions: number;
}

const LIFECYCLE_COLORS: Record<string, string> = {
  lead: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  trial: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  customer: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  churned: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  churn_risk: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  enterprise: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

export default function AdminCrmPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isAddInteractionOpen, setIsAddInteractionOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const limit = 20;

  const { data: statsData, isLoading: statsLoading } = useQuery<CrmStats>({
    queryKey: ["/api/crm/stats"],
  });

  const buildAccountsQueryUrl = () => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", limit.toString());
    if (search) params.set("search", search);
    if (lifecycleFilter) params.set("lifecycleStage", lifecycleFilter);
    return `/api/crm/accounts?${params.toString()}`;
  };

  const { data: accountsData, isLoading: accountsLoading } = useQuery<{
    accounts: CrmAccount[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: ["/api/crm/accounts", page, limit, search, lifecycleFilter],
    queryFn: async () => {
      const res = await fetch(buildAccountsQueryUrl(), { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch accounts');
      return res.json();
    },
  });

  const { data: accountDetails, isLoading: detailsLoading } = useQuery<{
    account: CrmAccount;
    accountDetails: any;
    subscription: any;
    plan: any;
    invoices: any[];
    interactions: CrmInteraction[];
    tasks: CrmTask[];
  }>({
    queryKey: ["/api/crm/accounts", selectedAccountId],
    enabled: !!selectedAccountId,
  });

  const addInteractionMutation = useMutation({
    mutationFn: async (data: { type: string; direction: string; subject: string; body: string }) => {
      const res = await apiRequest("POST", `/api/crm/accounts/${selectedAccountId}/interactions`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/accounts", selectedAccountId] });
      setIsAddInteractionOpen(false);
      toast({ title: "Interaction logged successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to log interaction", description: error.message, variant: "destructive" });
    },
  });

  const addTaskMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; dueDate?: string }) => {
      const res = await apiRequest("POST", `/api/crm/accounts/${selectedAccountId}/tasks`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/accounts", selectedAccountId] });
      setIsAddTaskOpen(false);
      toast({ title: "Task created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create task", description: error.message, variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: { status: string } }) => {
      const res = await apiRequest("PATCH", `/api/crm/tasks/${taskId}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/accounts", selectedAccountId] });
      toast({ title: "Task updated" });
    },
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const stats = statsData;
  const accounts = accountsData?.accounts || [];

  if (selectedAccountId && accountDetails) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setSelectedAccountId(null)} data-testid="button-back">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-account-name">
              {accountDetails.account.displayName}
            </h1>
            <p className="text-muted-foreground">{accountDetails.account.primaryEmail}</p>
          </div>
          <Badge className={LIFECYCLE_COLORS[accountDetails.account.lifecycleStage] || ""}>
            {accountDetails.account.lifecycleStage}
          </Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Interactions
                </span>
                <Button size="sm" onClick={() => setIsAddInteractionOpen(true)} data-testid="button-add-interaction">
                  <Plus className="h-4 w-4 mr-1" />
                  Log Interaction
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detailsLoading ? (
                <Skeleton className="h-32" />
              ) : accountDetails.interactions?.length > 0 ? (
                <div className="space-y-3">
                  {accountDetails.interactions.map((interaction: CrmInteraction) => (
                    <div key={interaction.id} className="border rounded-lg p-3" data-testid={`interaction-${interaction.id}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{interaction.type}</Badge>
                          <Badge variant="secondary">{interaction.direction}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(interaction.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      {interaction.subject && <p className="font-medium text-sm">{interaction.subject}</p>}
                      {interaction.body && <p className="text-sm text-muted-foreground">{interaction.body}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <MessageSquare className="mx-auto h-12 w-12 opacity-50" />
                  <p className="mt-2">No interactions logged yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Tasks
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setIsAddTaskOpen(true)} data-testid="button-add-task">
                    <Plus className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {accountDetails.tasks?.length > 0 ? (
                  <div className="space-y-2">
                    {accountDetails.tasks.map((task: CrmTask) => (
                      <div key={task.id} className="flex items-start gap-2 p-2 border rounded" data-testid={`task-${task.id}`}>
                        <Button
                          size="sm"
                          variant={task.status === "completed" ? "default" : "outline"}
                          className="h-5 w-5 p-0 shrink-0"
                          onClick={() => updateTaskMutation.mutate({
                            taskId: task.id,
                            updates: { status: task.status === "completed" ? "open" : "completed" }
                          })}
                        >
                          <CheckCircle className="h-3 w-3" />
                        </Button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                            {task.title}
                          </p>
                          {task.dueDate && (
                            <p className="text-xs text-muted-foreground">
                              Due: {format(new Date(task.dueDate), "MMM d")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No tasks</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Subscription
                </CardTitle>
              </CardHeader>
              <CardContent>
                {accountDetails.subscription ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Plan</span>
                      <span className="font-medium">{accountDetails.plan?.name || "Unknown"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={accountDetails.subscription.status === "active" ? "default" : "secondary"}>
                        {accountDetails.subscription.status}
                      </Badge>
                    </div>
                    {accountDetails.subscription.currentPeriodEnd && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Renews</span>
                        <span>{format(new Date(accountDetails.subscription.currentPeriodEnd), "MMM d, yyyy")}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No subscription</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={isAddInteractionOpen} onOpenChange={setIsAddInteractionOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Interaction</DialogTitle>
              <DialogDescription>Record a customer interaction</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              addInteractionMutation.mutate({
                type: formData.get("type") as string,
                direction: formData.get("direction") as string,
                subject: formData.get("subject") as string,
                body: formData.get("body") as string,
              });
            }}>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Type</label>
                    <Select name="type" defaultValue="email">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="call">Phone Call</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="note">Note</SelectItem>
                        <SelectItem value="chat">Chat</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Direction</label>
                    <Select name="direction" defaultValue="outbound">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="outbound">Outbound</SelectItem>
                        <SelectItem value="inbound">Inbound</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Subject</label>
                  <Input name="subject" placeholder="Brief subject line" />
                </div>
                <div>
                  <label className="text-sm font-medium">Details</label>
                  <Textarea name="body" placeholder="Interaction details..." rows={4} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddInteractionOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addInteractionMutation.isPending}>
                  {addInteractionMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Task</DialogTitle>
              <DialogDescription>Add a follow-up task for this account</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              addTaskMutation.mutate({
                title: formData.get("title") as string,
                description: formData.get("description") as string || undefined,
                dueDate: formData.get("dueDate") as string || undefined,
              });
            }}>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium">Task Title</label>
                  <Input name="title" placeholder="What needs to be done?" required />
                </div>
                <div>
                  <label className="text-sm font-medium">Description (optional)</label>
                  <Textarea name="description" placeholder="Additional details..." rows={3} />
                </div>
                <div>
                  <label className="text-sm font-medium">Due Date (optional)</label>
                  <Input name="dueDate" type="date" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddTaskOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addTaskMutation.isPending}>
                  {addTaskMutation.isPending ? "Creating..." : "Create Task"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-crm-title">Customer Management</h1>
          <p className="text-muted-foreground">Track and manage customer relationships</p>
        </div>
        <Link href="/admin">
          <Button variant="outline" data-testid="button-back-admin">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Admin Dashboard
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Customers</p>
                    <p className="text-2xl font-bold" data-testid="stat-customers">{stats?.customers || 0}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Leads</p>
                    <p className="text-2xl font-bold" data-testid="stat-leads">{stats?.leads || 0}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Churn Risk</p>
                    <p className="text-2xl font-bold" data-testid="stat-churn-risk">{stats?.churnRisk || 0}</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-red-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Open Tasks</p>
                    <p className="text-2xl font-bold" data-testid="stat-open-tasks">{stats?.openTasks || 0}</p>
                  </div>
                  <ClipboardList className="h-8 w-8 text-amber-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Accounts
          </CardTitle>
          <CardDescription>All users and organizations with subscription data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Select value={lifecycleFilter} onValueChange={(value) => { setLifecycleFilter(value === "all" ? "" : value); setPage(1); }}>
              <SelectTrigger className="w-[160px]" data-testid="select-lifecycle">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="churn_risk">Churn Risk</SelectItem>
                <SelectItem value="churned">Churned</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} data-testid="button-search">Search</Button>
          </div>

          {accountsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="hidden md:table-cell">Email</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead className="hidden sm:table-cell">Plan</TableHead>
                      <TableHead className="hidden lg:table-cell">Interactions</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No accounts found
                        </TableCell>
                      </TableRow>
                    ) : (
                      accounts.map((account) => (
                        <TableRow key={account.id} data-testid={`row-account-${account.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {account.accountType === "organization" ? (
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Users className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="font-medium">{account.displayName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {account.primaryEmail}
                          </TableCell>
                          <TableCell>
                            <Badge className={LIFECYCLE_COLORS[account.lifecycleStage] || ""}>
                              {account.lifecycleStage}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {account.plan?.name || "-"}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {account.interactionCount || 0}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedAccountId(account.id)}
                              data-testid={`button-view-${account.id}`}
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

              {accountsData?.pagination && accountsData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {accountsData.pagination.page} of {accountsData.pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= accountsData.pagination.totalPages}
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
  );
}
