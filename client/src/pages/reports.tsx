import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, PieChart, TrendingUp, Receipt, Coins, Percent, Download, Calendar, Building2, UserCircle, Store, FileText, Loader2, RotateCcw, Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Progress } from "@/components/ui/progress";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell, PieChart as RechartsPieChart, Pie } from "recharts";

interface PersonalReportSummary {
  totalReceipts: number;
  totalSpent: string;
  pendingReturns: number;
  expiredReturns: number;
  activeWarranties: number;
  expiredWarranties: number;
}

interface UpcomingItem {
  merchant: string;
  date: string;
  returnBy?: string;
  warrantyEnds?: string;
  total: string;
  daysLeft: number;
}

interface PersonalCategoryData {
  name: string;
  count: number;
  total: string;
}

interface PersonalMonthData {
  month: string;
  count: number;
  total: string;
}

interface PersonalReportsResponse {
  summary: PersonalReportSummary;
  upcomingReturns: UpcomingItem[];
  upcomingWarrantyExpiries: UpcomingItem[];
  warrantyStatus: { active: number; expiringSoon: number; expired: number };
  byCategory: PersonalCategoryData[];
  byMonth: PersonalMonthData[];
}

interface ReportSummary {
  totalReceipts: number;
  totalSpent: string;
  totalTax: string;
  totalVat: string;
}

interface CategoryData {
  name: string;
  count: number;
  total: string;
  tax: string;
  vat: string;
}

interface MerchantData {
  name: string;
  count: number;
  total: string;
  tax: string;
  vat: string;
}

interface MonthData {
  month: string;
  count: number;
  total: string;
  tax: string;
  vat: string;
}

interface ReportsResponse {
  summary: ReportSummary;
  byCategory: CategoryData[];
  byMerchant: MerchantData[];
  byMonth: MonthData[];
  context: string;
}

const PERSONAL_COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

function PersonalReportsDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery<PersonalReportsResponse>({
    queryKey: ["/api/reports/personal"],
  });
  
  // Check if user already has a business account (dual user)
  const isAlreadyBusinessAccount = user?.accountType === "business";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
            <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto text-center">
          <Card>
            <CardContent className="p-6">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No report data available. Start by scanning some receipts!</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const categoryChartData = data.byCategory.map((cat, index) => ({
    name: cat.name,
    value: parseFloat(cat.total),
    fill: PERSONAL_COLORS[index % PERSONAL_COLORS.length],
  }));

  const monthlyChartData = data.byMonth.map((month) => ({
    month: month.month,
    spent: parseFloat(month.total),
    receipts: month.count,
  }));

  const warrantyChartData = [
    { name: "Active", value: data.warrantyStatus.active, fill: "#10b981" },
    { name: "Expiring Soon", value: data.warrantyStatus.expiringSoon, fill: "#f59e0b" },
    { name: "Expired", value: data.warrantyStatus.expired, fill: "#ef4444" },
  ].filter(item => item.value > 0);

  const totalWarranties = data.summary.activeWarranties + data.summary.expiredWarranties;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">My Reports</h1>
            <p className="text-muted-foreground mt-1">Track your spending, returns, and warranties</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Receipts</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-receipts">{data.summary.totalReceipts}</div>
              <p className="text-xs text-muted-foreground mt-1">Slips stored</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-spent">R{data.summary.totalSpent}</div>
              <p className="text-xs text-muted-foreground mt-1">All purchases</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Returns</CardTitle>
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-pending-returns">{data.summary.pendingReturns}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.summary.expiredReturns > 0 ? `${data.summary.expiredReturns} expired` : "Still returnable"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Warranties</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-active-warranties">{data.summary.activeWarranties}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.summary.expiredWarranties > 0 ? `${data.summary.expiredWarranties} expired` : "Under warranty"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Returns & Warranties Alerts */}
        {(data.upcomingReturns.length > 0 || data.upcomingWarrantyExpiries.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Returns */}
            {data.upcomingReturns.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Returns Expiring Soon
                  </CardTitle>
                  <CardDescription>Items with return deadlines in the next 14 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.upcomingReturns.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{item.merchant}</p>
                          <p className="text-sm text-muted-foreground">${item.total}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={item.daysLeft <= 3 ? "destructive" : "secondary"}>
                            {item.daysLeft} days left
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            Return by {new Date(item.returnBy!).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Warranties Expiring Soon */}
            {data.upcomingWarrantyExpiries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="h-5 w-5 text-amber-500" />
                    Warranties Expiring Soon
                  </CardTitle>
                  <CardDescription>Items with warranties ending in the next 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.upcomingWarrantyExpiries.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{item.merchant}</p>
                          <p className="text-sm text-muted-foreground">${item.total}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={item.daysLeft <= 7 ? "destructive" : "secondary"}>
                            {item.daysLeft} days left
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            Expires {new Date(item.warrantyEnds!).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spending by Category */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Spending by Category
              </CardTitle>
              <CardDescription>Where your money goes</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryChartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={categoryChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {categoryChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, "Amount"]} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No category data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Warranty Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Warranty Status
              </CardTitle>
              <CardDescription>Overview of your warranty coverage</CardDescription>
            </CardHeader>
            <CardContent>
              {totalWarranties > 0 ? (
                <div className="space-y-6">
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={warrantyChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {warrantyChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span>Active ({data.warrantyStatus.active})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span>Expiring ({data.warrantyStatus.expiringSoon})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span>Expired ({data.warrantyStatus.expired})</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No warranty data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Monthly Spending Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Monthly Spending Trends
            </CardTitle>
            <CardDescription>Your spending patterns over time</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChartData}>
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `R${value}`} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === "spent" ? `R${value.toFixed(2)}` : value,
                        name === "spent" ? "Amount" : "Receipts"
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="spent" name="Amount Spent" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No monthly data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Category Breakdown
            </CardTitle>
            <CardDescription>Detailed spending by category</CardDescription>
          </CardHeader>
          <CardContent>
            {data.byCategory.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Receipts</TableHead>
                    <TableHead className="text-right">Total Spent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byCategory.map((cat, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: PERSONAL_COLORS[index % PERSONAL_COLORS.length] }}
                          />
                          {cat.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{cat.count}</TableCell>
                      <TableCell className="text-right font-medium">R{cat.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No category data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upgrade CTA - Only show for individual accounts (not for dual users who already have business) */}
        {!isAlreadyBusinessAccount && (
          <Card className="bg-gradient-to-r from-indigo-500/10 to-cyan-500/10 border-indigo-500/20">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Need Tax & VAT Reports?</h3>
                    <p className="text-sm text-muted-foreground">
                      Upgrade to a business account for comprehensive tax reporting, VAT summaries, and PDF exports.
                    </p>
                  </div>
                </div>
                <Button asChild>
                  <a href="/upgrade-to-business" data-testid="button-upgrade-account">
                    Upgrade Account
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const isBusinessAccount = user?.accountType === "business";
  const isBusinessContext = user?.activeContext === "business";

  const { data, isLoading, refetch } = useQuery<ReportsResponse>({
    queryKey: ["/api/reports/summary", { startDate, endDate }],
    enabled: isBusinessAccount && isBusinessContext,
  });

  // Show personal dashboard for:
  // 1. Individual account users (always personal)
  // 2. Business account users who are in personal context mode
  if (!isBusinessAccount || !isBusinessContext) {
    return <PersonalReportsDashboard />;
  }

  const handleFilter = () => {
    refetch();
  };

  const handleExport = () => {
    if (!data) return;
    
    const csvContent = [
      ["Tax & Expense Report"],
      ["Generated:", new Date().toLocaleDateString()],
      ["Context:", isBusinessContext ? "Business" : "Personal"],
      ["Date Range:", startDate || "All", "to", endDate || "All"],
      [],
      ["Summary"],
      ["Total Receipts:", data.summary.totalReceipts],
      ["Total Spent:", data.summary.totalSpent],
      ["Total Tax:", data.summary.totalTax],
      ["Total VAT:", data.summary.totalVat],
      [],
      ["By Category"],
      ["Category", "Count", "Total", "Tax", "VAT"],
      ...data.byCategory.map(c => [c.name, c.count, c.total, c.tax, c.vat]),
      [],
      ["By Vendor"],
      ["Vendor", "Count", "Total", "Tax", "VAT"],
      ...data.byMerchant.map(m => [m.name, m.count, m.total, m.tax, m.vat]),
      [],
      ["By Month"],
      ["Month", "Count", "Total", "Tax", "VAT"],
      ...data.byMonth.map(m => [m.month, m.count, m.total, m.tax, m.vat]),
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `slipsafe-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async (includeTransactions: boolean = false) => {
    setIsDownloadingPdf(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (includeTransactions) params.append("includeTransactions", "true");
      
      const response = await fetch(`/api/reports/pdf?${params.toString()}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to generate PDF report");
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `slipsafe-expense-report-${new Date().toISOString().split("T")[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Report downloaded",
        description: "Your PDF expense report has been downloaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to generate PDF report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const formatCurrency = (value: string) => {
    return `R ${parseFloat(value).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-ZA", { year: "numeric", month: "long" });
  };

  const formatShortMonth = (monthStr: string) => {
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-ZA", { month: "short", year: "2-digit" });
  };

  const COLORS = ["#4f46e5", "#7c3aed", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  const categoryChartData = data?.byCategory?.map(cat => ({
    name: cat.name,
    value: parseFloat(cat.total),
    count: cat.count,
  })) || [];

  const monthlyChartData = data?.byMonth?.map(m => ({
    month: formatShortMonth(m.month),
    total: parseFloat(m.total),
    tax: parseFloat(m.tax),
    vat: parseFloat(m.vat),
  })) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-semibold text-foreground" data-testid="text-page-title">
                Tax & Reports
              </h1>
              <Badge variant="default" data-testid="badge-context">
                <Building2 className="h-3 w-3 mr-1" /> {user?.businessName || user?.businessProfile?.businessName || "Business"}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              View your spending summaries, tax deductions, and VAT reports
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleExport} disabled={!data} variant="outline" data-testid="button-export">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              onClick={() => handleDownloadPdf(false)} 
              disabled={!data || isDownloadingPdf}
              data-testid="button-download-pdf"
            >
              {isDownloadingPdf ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Download PDF Report
            </Button>
            <Button 
              onClick={() => handleDownloadPdf(true)} 
              disabled={!data || isDownloadingPdf}
              variant="secondary"
              data-testid="button-download-pdf-detailed"
            >
              {isDownloadingPdf ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Full Report with Transactions
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Date Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="space-y-2 flex-1">
                <Label htmlFor="startDate">From</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2 flex-1">
                <Label htmlFor="endDate">To</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-end-date"
                />
              </div>
              <Button onClick={handleFilter} data-testid="button-filter">
                Apply Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-receipts">
                {data?.summary.totalReceipts || 0}
              </div>
              <p className="text-xs text-muted-foreground">Receipts in this period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-spent">
                {formatCurrency(data?.summary.totalSpent || "0")}
              </div>
              <p className="text-xs text-muted-foreground">Total expenditure</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total Tax</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600" data-testid="text-total-tax">
                {formatCurrency(data?.summary.totalTax || "0")}
              </div>
              <p className="text-xs text-muted-foreground">Income tax deductible</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total VAT</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-total-vat">
                {formatCurrency(data?.summary.totalVat || "0")}
              </div>
              <p className="text-xs text-muted-foreground">VAT claimable</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="category" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="category" data-testid="tab-category">
              <PieChart className="h-4 w-4 mr-2" />
              By Category
            </TabsTrigger>
            <TabsTrigger value="vendor" data-testid="tab-vendor">
              <Store className="h-4 w-4 mr-2" />
              By Vendor
            </TabsTrigger>
            <TabsTrigger value="month" data-testid="tab-month">
              <BarChart3 className="h-4 w-4 mr-2" />
              By Month
            </TabsTrigger>
          </TabsList>

          <TabsContent value="category">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Category Distribution</CardTitle>
                  <CardDescription>Visual breakdown of spending by category</CardDescription>
                </CardHeader>
                <CardContent>
                  {categoryChartData.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={categoryChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {categoryChartData.map((_entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`} />
                          <Legend />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No category data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Category Details</CardTitle>
                  <CardDescription>Detailed breakdown with tax information</CardDescription>
                </CardHeader>
                <CardContent>
                  {data?.byCategory && data.byCategory.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Receipts</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Tax</TableHead>
                          <TableHead className="text-right">VAT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.byCategory.map((cat) => (
                          <TableRow key={cat.name} data-testid={`row-category-${cat.name}`}>
                            <TableCell className="font-medium">
                              <Badge variant="outline">{cat.name}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{cat.count}</TableCell>
                            <TableCell className="text-right">{formatCurrency(cat.total)}</TableCell>
                            <TableCell className="text-right text-orange-600">{formatCurrency(cat.tax)}</TableCell>
                            <TableCell className="text-right text-green-600">{formatCurrency(cat.vat)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No category data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="vendor">
            <Card>
              <CardHeader>
                <CardTitle>Spending by Vendor</CardTitle>
                <CardDescription>Your expenses grouped by merchant/vendor</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.byMerchant && data.byMerchant.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead className="text-right">Receipts</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Tax</TableHead>
                        <TableHead className="text-right">VAT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byMerchant.map((merchant) => (
                        <TableRow key={merchant.name} data-testid={`row-vendor-${merchant.name}`}>
                          <TableCell className="font-medium">{merchant.name}</TableCell>
                          <TableCell className="text-right">{merchant.count}</TableCell>
                          <TableCell className="text-right">{formatCurrency(merchant.total)}</TableCell>
                          <TableCell className="text-right text-orange-600">{formatCurrency(merchant.tax)}</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(merchant.vat)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No vendor data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="month">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Spending Trends</CardTitle>
                  <CardDescription>Monthly spending patterns with tax breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  {monthlyChartData.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyChartData}>
                          <XAxis dataKey="month" />
                          <YAxis tickFormatter={(value) => `R${(value / 1000).toFixed(0)}k`} />
                          <Tooltip formatter={(value: number) => `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`} />
                          <Legend />
                          <Bar dataKey="total" name="Total Spent" fill="#4f46e5" />
                          <Bar dataKey="tax" name="Tax" fill="#f59e0b" />
                          <Bar dataKey="vat" name="VAT" fill="#10b981" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-72 flex items-center justify-center text-muted-foreground">
                      No monthly data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Monthly Details</CardTitle>
                  <CardDescription>Detailed breakdown by month</CardDescription>
                </CardHeader>
                <CardContent>
                  {data?.byMonth && data.byMonth.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead className="text-right">Receipts</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Tax</TableHead>
                          <TableHead className="text-right">VAT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.byMonth.map((month) => (
                          <TableRow key={month.month} data-testid={`row-month-${month.month}`}>
                            <TableCell className="font-medium">{formatMonth(month.month)}</TableCell>
                            <TableCell className="text-right">{month.count}</TableCell>
                            <TableCell className="text-right">{formatCurrency(month.total)}</TableCell>
                            <TableCell className="text-right text-orange-600">{formatCurrency(month.tax)}</TableCell>
                            <TableCell className="text-right text-green-600">{formatCurrency(month.vat)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No monthly data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
