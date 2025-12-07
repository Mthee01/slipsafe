import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  CreditCard, 
  Calendar, 
  FileText, 
  ExternalLink, 
  Sparkles, 
  ChevronRight,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Receipt
} from "lucide-react";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";

interface BillingInfo {
  planType: string;
  billingInterval: string | null;
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  businessReceiptLimitPerMonth: number | null;
  businessUserLimit: number | null;
  termsVersionAccepted: string | null;
  termsAcceptedAt: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
}

interface UsageInfo {
  receiptsUsed: number;
  usersCount: number;
}

const PLAN_DISPLAY_NAMES: Record<string, string> = {
  free: "Free",
  business_solo: "Solo",
  business_pro: "Business Pro",
  enterprise: "Enterprise",
};

const PLAN_COLORS: Record<string, string> = {
  free: "bg-secondary text-secondary-foreground",
  business_solo: "bg-primary text-primary-foreground",
  business_pro: "bg-gradient-to-r from-indigo-500 to-purple-500 text-white",
  enterprise: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
};

const STATUS_VARIANTS: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  active: { variant: "default", icon: CheckCircle },
  trialing: { variant: "secondary", icon: Clock },
  past_due: { variant: "destructive", icon: AlertCircle },
  canceled: { variant: "destructive", icon: AlertCircle },
  incomplete: { variant: "outline", icon: Clock },
};

function formatCurrency(amountInCents: number, currency: string = "ZAR"): string {
  const amountInRands = amountInCents / 100;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountInRands);
}

export default function BillingPage() {
  const { toast } = useToast();

  const { data: billingData, isLoading: billingLoading } = useQuery<BillingInfo>({
    queryKey: ["/api/billing/subscription"],
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ["/api/billing/invoices"],
    enabled: !!billingData && billingData.planType !== "free",
  });

  const { data: usageData, isLoading: usageLoading } = useQuery<{ usage: UsageInfo }>({
    queryKey: ["/api/billing/usage"],
    enabled: !!billingData && billingData.planType !== "free",
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/billing/portal-session");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to open billing portal",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isLoading = billingLoading || invoicesLoading || usageLoading;
  const billing = billingData;
  const invoices = invoicesData?.invoices || [];
  const usage = usageData?.usage;

  const isPaidPlan = billing?.planType && billing.planType !== "free";
  const planDisplayName = PLAN_DISPLAY_NAMES[billing?.planType || "free"] || billing?.planType;
  const planColor = PLAN_COLORS[billing?.planType || "free"] || PLAN_COLORS.free;

  const receiptUsagePercent = usage && billing?.businessReceiptLimitPerMonth 
    ? Math.min((usage.receiptsUsed / billing.businessReceiptLimitPerMonth) * 100, 100) 
    : 0;

  const userUsagePercent = usage && billing?.businessUserLimit 
    ? Math.min((usage.usersCount / billing.businessUserLimit) * 100, 100) 
    : 0;

  if (billingLoading) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-billing-title">
            Billing & Subscription
          </h1>
          <p className="text-muted-foreground">
            Manage your plan, payment methods, and invoices
          </p>
        </div>
        {isPaidPlan && (
          <Button 
            onClick={() => portalMutation.mutate()} 
            disabled={portalMutation.isPending}
            variant="outline"
            data-testid="button-manage-billing"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Manage Billing
            <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span data-testid="text-current-plan">Current Plan</span>
                <Badge className={`${planColor} px-3 py-1`} data-testid="badge-plan-name">
                  {planDisplayName}
                </Badge>
                {billing?.subscriptionStatus && (
                  <Badge 
                    variant={STATUS_VARIANTS[billing.subscriptionStatus]?.variant || "outline"}
                    data-testid="badge-subscription-status"
                  >
                    {billing.subscriptionStatus}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                {isPaidPlan ? (
                  <>
                    Billed {billing?.billingInterval === "year" ? "annually" : "monthly"}
                    {billing?.subscriptionCurrentPeriodEnd && (
                      <> · Renews on {format(new Date(billing.subscriptionCurrentPeriodEnd), "MMM d, yyyy")}</>
                    )}
                  </>
                ) : (
                  "Upgrade to unlock business features"
                )}
              </CardDescription>
            </div>
            {!isPaidPlan && (
              <Link href="/pricing">
                <Button className="group" data-testid="button-upgrade">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Upgrade Plan
                  <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isPaidPlan && billing?.businessReceiptLimitPerMonth ? (
            <div className="space-y-4">
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Receipt className="h-4 w-4" />
                      Receipt Usage
                    </span>
                    <span className="font-medium" data-testid="text-receipt-usage">
                      {usage?.receiptsUsed?.toLocaleString() || 0} / {billing.businessReceiptLimitPerMonth.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={receiptUsagePercent} className="h-2" />
                </div>
                {billing.businessUserLimit && billing.businessUserLimit > 1 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <TrendingUp className="h-4 w-4" />
                        Team Members
                      </span>
                      <span className="font-medium" data-testid="text-user-usage">
                        {usage?.usersCount || 1} / {billing.businessUserLimit}
                      </span>
                    </div>
                    <Progress value={userUsagePercent} className="h-2" />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-muted-foreground">
              <p>You're on the free plan with limited features.</p>
              <p className="mt-1 text-sm">Upgrade to unlock unlimited receipt storage and team features.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {isPaidPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoices
            </CardTitle>
            <CardDescription>
              View and download your past invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : invoices.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                      <TableCell className="font-medium">
                        {invoice.invoiceNumber || invoice.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(invoice.amountDue, invoice.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {invoice.hostedInvoiceUrl && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => window.open(invoice.hostedInvoiceUrl!, "_blank")}
                              data-testid={`button-view-invoice-${invoice.id}`}
                            >
                              View
                            </Button>
                          )}
                          {invoice.invoicePdfUrl && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => window.open(invoice.invoicePdfUrl!, "_blank")}
                              data-testid={`button-download-invoice-${invoice.id}`}
                            >
                              Download
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 opacity-50" />
                <p className="mt-2">No invoices yet</p>
                <p className="text-sm">Your invoices will appear here after your first payment</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {billing?.termsVersionAccepted && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Legal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Business Pricing & Subscription Terms
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" data-testid="text-terms-version">
                  {billing.termsVersionAccepted}
                </Badge>
                {billing.termsAcceptedAt && (
                  <span className="text-muted-foreground">
                    Accepted {format(new Date(billing.termsAcceptedAt), "MMM d, yyyy")}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Link href="/business-terms">
                <Button variant="ghost" size="sm">
                  View Terms
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
