import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Search, Calendar, Store, Clock, Tag, ArrowRight, Filter, Sparkles, Info, Download, Coins, Eye, X, FileText, LayoutGrid, List } from "lucide-react";
import { CATEGORIES, BUSINESS_CATEGORIES, type Purchase, type ConfidenceLevel, type MerchantRule } from "@shared/schema";
import { Link } from "wouter";

export default function Receipts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewingPdfId, setViewingPdfId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const { toast } = useToast();
  const { user } = useAuth();
  const isBusinessMode = user?.activeContext === 'business';
  const activeCategories = isBusinessMode ? BUSINESS_CATEGORIES : CATEGORIES;
  const queryClient = useQueryClient();
  
  // Reset category filter to "all" when switching between personal/business modes
  useEffect(() => {
    setSelectedCategory("all");
  }, [isBusinessMode]);

  const { data, isLoading } = useQuery<{ purchases: Purchase[] }>({
    queryKey: ["/api/purchases", { category: selectedCategory !== "all" ? selectedCategory : undefined, search: searchQuery || undefined }],
  });

  const { data: merchantRulesData } = useQuery<{ rules: MerchantRule[] }>({
    queryKey: ["/api/merchant-rules"],
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const res = await apiRequest("PATCH", `/api/purchases/${id}`, { category });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"], exact: false });
      toast({ title: "Category updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const purchases = data?.purchases || [];
  const merchantRules = merchantRulesData?.rules || [];

  // Get policy info from the purchase itself (or merchant rules as fallback for display label)
  const getPurchasePolicyInfo = (purchase: Purchase) => {
    const normalizedName = purchase.merchant.toLowerCase().trim();
    const rule = merchantRules.find(r => r.normalizedMerchantName === normalizedName);
    
    // Check if returns are explicitly disallowed
    if (purchase.refundType === 'none') {
      return {
        hasReturnPolicy: false,
        hasWarrantyPolicy: !!purchase.warrantyMonths,
        returnLabel: 'No returns accepted',
        warrantyLabel: purchase.warrantyMonths 
          ? `${purchase.warrantyMonths}-month warranty`
          : 'Not specified',
        isCustom: true,
      };
    }
    
    // Use purchase's own policy data if available
    if (purchase.returnPolicyDays || purchase.warrantyMonths) {
      return {
        hasReturnPolicy: !!purchase.returnPolicyDays,
        hasWarrantyPolicy: !!purchase.warrantyMonths,
        returnLabel: purchase.returnPolicyDays 
          ? `${purchase.returnPolicyDays}-day return` 
          : 'Not specified',
        warrantyLabel: purchase.warrantyMonths 
          ? `${purchase.warrantyMonths}-month warranty`
          : 'Not specified',
        isCustom: true,
      };
    }
    
    // Fall back to merchant rule if available
    if (rule) {
      return {
        hasReturnPolicy: true,
        hasWarrantyPolicy: true,
        returnLabel: `${rule.returnPolicyDays}-day return (store default)`,
        warrantyLabel: `${rule.warrantyMonths}-month warranty (store default)`,
        isCustom: false,
      };
    }
    
    // No policy info available
    return {
      hasReturnPolicy: false,
      hasWarrantyPolicy: false,
      returnLabel: 'Not specified',
      warrantyLabel: 'Not specified',
      isCustom: false,
    };
  };

  const getStatusBadge = (returnBy: string | null, warrantyEnds: string | null, refundType?: string | null, hasReturnPolicy?: boolean, hasWarrantyPolicy?: boolean) => {
    const now = new Date();
    
    // Check if returns are not allowed
    const noReturnsAllowed = refundType === 'none';
    
    // Handle null/missing dates
    const hasValidReturnBy = returnBy && !isNaN(new Date(returnBy).getTime());
    const hasValidWarrantyEnds = warrantyEnds && !isNaN(new Date(warrantyEnds).getTime());
    
    if (noReturnsAllowed) {
      if (hasValidWarrantyEnds) {
        const warrantyDate = new Date(warrantyEnds);
        const warrantyDaysLeft = Math.ceil((warrantyDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (warrantyDaysLeft > 0 && warrantyDaysLeft <= 30) {
          return <Badge variant="secondary" className="text-xs" data-testid="badge-warranty-expiring">Warranty ends in {warrantyDaysLeft}d</Badge>;
        }
        if (warrantyDaysLeft > 0) {
          return <Badge variant="outline" className="text-xs" data-testid="badge-warranty-only">Warranty active</Badge>;
        }
      }
      return <Badge variant="outline" className="text-xs opacity-50" data-testid="badge-no-returns">No returns</Badge>;
    }
    
    const returnDaysLeft = hasValidReturnBy 
      ? Math.ceil((new Date(returnBy).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : -1;
    const warrantyDaysLeft = hasValidWarrantyEnds 
      ? Math.ceil((new Date(warrantyEnds).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : -1;

    // Active return period with urgency
    if (returnDaysLeft > 0 && returnDaysLeft <= 7) {
      return <Badge variant="destructive" className="text-xs" data-testid="badge-return-expiring">Return ending in {returnDaysLeft}d</Badge>;
    }
    // Active warranty with urgency
    if (warrantyDaysLeft > 0 && warrantyDaysLeft <= 30) {
      return <Badge variant="secondary" className="text-xs" data-testid="badge-warranty-expiring">Warranty ends in {warrantyDaysLeft}d</Badge>;
    }
    // Active return period
    if (returnDaysLeft > 0) {
      return <Badge variant="outline" className="text-xs" data-testid="badge-active">Active</Badge>;
    }
    // Active warranty only
    if (warrantyDaysLeft > 0) {
      return <Badge variant="outline" className="text-xs" data-testid="badge-warranty-only">Warranty active</Badge>;
    }
    
    // Both dates missing - check if any policy was specified
    if (!hasValidReturnBy && !hasValidWarrantyEnds) {
      // No policies detected at all - show "Policy unspecified"
      if (hasReturnPolicy === false && hasWarrantyPolicy === false) {
        return <Badge variant="outline" className="text-xs opacity-50" data-testid="badge-unspecified">Policy unspecified</Badge>;
      }
      // Policy exists but dates are missing (shouldn't happen normally, but handle it)
      // This means returnPolicyDays or warrantyMonths was set but dates weren't computed
      return <Badge variant="outline" className="text-xs opacity-50" data-testid="badge-unspecified">Not specified</Badge>;
    }
    
    // Return date missing but warranty date exists (and expired since we got here)
    if (!hasValidReturnBy && hasValidWarrantyEnds) {
      // Warranty expired, return date never existed - check if return policy was detected
      if (hasReturnPolicy === false) {
        return <Badge variant="outline" className="text-xs opacity-50" data-testid="badge-expired">Expired</Badge>;
      }
      // Return policy exists but date missing - shouldn't happen normally
      return <Badge variant="outline" className="text-xs opacity-50" data-testid="badge-expired">Expired</Badge>;
    }
    
    // Both dates exist but are expired (we got here because both daysLeft <= 0)
    return <Badge variant="outline" className="text-xs opacity-50" data-testid="badge-expired">Expired</Badge>;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      // Personal categories
      Electronics: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      Clothing: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      Food: "bg-green-500/10 text-green-500 border-green-500/20",
      Home: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      Health: "bg-red-500/10 text-red-500 border-red-500/20",
      Auto: "bg-gray-500/10 text-gray-500 border-gray-500/20",
      "Work Expense Claim": "bg-amber-500/10 text-amber-500 border-amber-500/20",
      // Business categories
      "Rent & Utilities": "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
      "Professional Services": "bg-violet-500/10 text-violet-500 border-violet-500/20",
      "Office Supplies": "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
      "Technology & Software": "bg-blue-600/10 text-blue-600 border-blue-600/20",
      "Marketing & Advertising": "bg-pink-500/10 text-pink-500 border-pink-500/20",
      "Travel & Transport": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      "Maintenance & Repairs": "bg-orange-600/10 text-orange-600 border-orange-600/20",
      "Entertainment": "bg-rose-500/10 text-rose-500 border-rose-500/20",
      Other: "bg-gray-400/10 text-gray-400 border-gray-400/20",
    };
    return colors[category] || colors.Other;
  };

  const getConfidenceBadge = (confidence: ConfidenceLevel) => {
    const config = {
      high: {
        variant: "default" as const,
        label: "High",
        title: "High confidence OCR result",
      },
      medium: {
        variant: "secondary" as const,
        label: "Medium",
        title: "Medium confidence OCR result - verify accuracy",
      },
      low: {
        variant: "outline" as const,
        label: "Low",
        title: "Low confidence OCR result - please review",
      },
    };

    const cfg = config[confidence] || config.low;
    
    return (
      <Badge 
        variant={cfg.variant} 
        className="text-xs"
        title={cfg.title}
        data-testid={`badge-confidence-${confidence}`}
      >
        <Sparkles className="h-3 w-3 mr-1" />
        {cfg.label}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2" data-testid="text-page-title">Receipt History</h1>
          <p className="text-muted-foreground">
            View, search, and manage all your receipts
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by merchant, amount, or date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48" data-testid="select-category-filter">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-all">All Categories</SelectItem>
                {activeCategories.map((cat) => (
                  <SelectItem key={cat} value={cat} data-testid={`option-${cat.toLowerCase().replace(/\s+/g, '-')}`}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("cards")}
              title="Card view"
              data-testid="button-view-cards"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("table")}
              title="Table view"
              data-testid="button-view-table"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-10 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : purchases.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Store className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2" data-testid="text-no-receipts">No receipts found</h3>
              <p className="text-sm text-muted-foreground mb-6">
                {searchQuery || selectedCategory !== "all"
                  ? "Try adjusting your search or filters"
                  : "Upload your first receipt to get started"}
              </p>
              <Link href="/">
                <Button data-testid="button-upload-receipt">
                  Upload Receipt
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : viewMode === "table" ? (
          <Card data-testid="table-view-container">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((purchase) => {
                    const policy = getPurchasePolicyInfo(purchase);
                    return (
                      <TableRow key={purchase.id} data-testid={`row-receipt-${purchase.id}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate max-w-[200px]" data-testid={`text-merchant-${purchase.id}`}>
                              {purchase.merchant}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-date-${purchase.id}`}>
                          {new Date(purchase.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right font-medium" data-testid={`text-total-${purchase.id}`}>
                          R{purchase.total}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${getCategoryColor(purchase.category || "Other")}`}>
                            {purchase.category || "Other"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(purchase.returnBy, purchase.warrantyEnds, purchase.refundType, policy.hasReturnPolicy, policy.hasWarrantyPolicy)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/receipt/${purchase.id}`}>
                              <Button variant="ghost" size="icon" title="View details" data-testid={`button-view-receipt-${purchase.id}`}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <a href={`/api/purchases/${purchase.id}/pdf`} download>
                              <Button variant="ghost" size="icon" title="Download PDF" data-testid={`button-download-pdf-${purchase.id}`}>
                                <Download className="h-4 w-4" />
                              </Button>
                            </a>
                            <Link href={`/claims?hash=${purchase.hash}`}>
                              <Button variant="ghost" size="icon" title="Create claim" data-testid={`button-create-claim-${purchase.id}`}>
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {purchases.map((purchase) => (
              <Card key={purchase.id} className="hover-elevate transition-all duration-200" data-testid={`card-receipt-${purchase.id}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="text-lg font-semibold flex items-center gap-2 truncate" data-testid={`text-merchant-${purchase.id}`}>
                                <Store className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">{purchase.merchant}</span>
                              </h3>
                              {getConfidenceBadge((purchase.ocrConfidence || 'low') as ConfidenceLevel)}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1" data-testid={`text-date-${purchase.id}`}>
                                <Calendar className="h-4 w-4" />
                                {new Date(purchase.date).toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-1" data-testid={`text-total-${purchase.id}`}>
                                <Coins className="h-4 w-4" />
                                R{purchase.total}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:flex-col sm:items-end">
                            {(() => {
                              const policy = getPurchasePolicyInfo(purchase);
                              return getStatusBadge(purchase.returnBy, purchase.warrantyEnds, purchase.refundType, policy.hasReturnPolicy, policy.hasWarrantyPolicy);
                            })()}
                            <Select
                              value={purchase.category || "Other"}
                              onValueChange={(value) => updateCategoryMutation.mutate({ id: purchase.id, category: value })}
                            >
                              <SelectTrigger className={`w-28 text-xs border ${getCategoryColor(purchase.category || "Other")}`} data-testid={`select-category-${purchase.id}`}>
                                <Tag className="h-3 w-3 mr-1" />
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {activeCategories.map((cat) => (
                                  <SelectItem key={cat} value={cat} data-testid={`option-${cat.toLowerCase().replace(/\s+/g, '-')}-${purchase.id}`}>
                                    {cat}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {(() => {
                        const policy = getPurchasePolicyInfo(purchase);
                        return (
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                {purchase.refundType === 'none' ? 'Returns' : 'Return By'}
                              </p>
                              <p className="flex items-center gap-1 mb-1" data-testid={`text-return-by-${purchase.id}`}>
                                <Clock className="h-4 w-4" />
                                {purchase.refundType === 'none' 
                                  ? 'No returns accepted'
                                  : purchase.returnBy 
                                    ? new Date(purchase.returnBy).toLocaleDateString()
                                    : 'Not specified'}
                              </p>
                              <p className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`text-return-policy-${purchase.id}`}>
                                <Info className="h-3 w-3" />
                                <span className={policy.isCustom ? "text-primary font-medium" : ""}>
                                  {policy.returnLabel}
                                </span>
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                Warranty Until
                              </p>
                              <p className="flex items-center gap-1 mb-1" data-testid={`text-warranty-${purchase.id}`}>
                                <Clock className="h-4 w-4" />
                                {purchase.warrantyEnds 
                                  ? new Date(purchase.warrantyEnds).toLocaleDateString()
                                  : 'Not specified'}
                              </p>
                              <p className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`text-warranty-policy-${purchase.id}`}>
                                <Info className="h-3 w-3" />
                                <span className={policy.isCustom ? "text-primary font-medium" : ""}>
                                  {policy.warrantyLabel}
                                </span>
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-2 w-full md:w-auto md:min-w-[120px]">
                      <Link href={`/receipt/${purchase.id}`} className="w-full">
                        <Button variant="outline" className="w-full text-sm" data-testid={`button-view-receipt-${purchase.id}`}>
                          <Eye className="mr-1 h-4 w-4" />
                          View
                        </Button>
                      </Link>
                      <Link href={`/claims?hash=${purchase.hash}`} className="w-full">
                        <Button variant="default" className="w-full text-sm" data-testid={`button-create-claim-${purchase.id}`}>
                          Claim
                          <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </Link>
                      <a href={`/api/purchases/${purchase.id}/pdf`} download className="w-full">
                        <Button variant="outline" className="w-full text-sm" data-testid={`button-download-pdf-${purchase.id}`}>
                          <Download className="mr-1 h-4 w-4" />
                          Download
                        </Button>
                      </a>
                      <Button 
                        variant="outline" 
                        className="w-full text-sm" 
                        onClick={() => setViewingPdfId(purchase.id)}
                        data-testid={`button-view-pdf-${purchase.id}`}
                      >
                        <FileText className="mr-1 h-4 w-4" />
                        View PDF
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* PDF Viewer Section */}
        {viewingPdfId && (
          <Card className="mt-6" data-testid="pdf-viewer-container">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-lg">PDF Report</CardTitle>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setViewingPdfId(null)}
                data-testid="button-close-pdf"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <iframe
                src={`/api/purchases/${viewingPdfId}/pdf`}
                className="w-full h-[600px] border rounded-md"
                title="Receipt PDF"
                data-testid="iframe-pdf-viewer"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
