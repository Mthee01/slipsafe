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
import { BarChart3, PieChart, TrendingUp, Receipt, DollarSign, Percent, Download, Calendar, Building2, UserCircle, Store } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell, PieChart as RechartsPieChart, Pie } from "recharts";

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

export default function Reports() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data, isLoading, refetch } = useQuery<ReportsResponse>({
    queryKey: ["/api/reports/summary", { startDate, endDate }],
  });

  const isBusinessContext = data?.context === "business";

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
              <Badge variant={isBusinessContext ? "default" : "secondary"} data-testid="badge-context">
                {isBusinessContext ? (
                  <><Building2 className="h-3 w-3 mr-1" /> Business</>
                ) : (
                  <><UserCircle className="h-3 w-3 mr-1" /> Personal</>
                )}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              View your spending summaries, tax deductions, and VAT reports
            </p>
          </div>
          <Button onClick={handleExport} disabled={!data} data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
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
              <DollarSign className="h-4 w-4 text-muted-foreground" />
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
