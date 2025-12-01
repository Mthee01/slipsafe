import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Search, Calendar, DollarSign, Store, Clock, Tag, ArrowRight, Filter, Sparkles, Info, Download } from "lucide-react";
import { CATEGORIES, type Purchase, type ConfidenceLevel, type MerchantRule } from "@shared/schema";
import { Link } from "wouter";

export default function Receipts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const getMerchantPolicyInfo = (merchantName: string, purchaseDate: string) => {
    // Normalize merchant name to match server-side normalization
    const normalizedName = merchantName.toLowerCase().trim();
    
    // Find matching merchant rule
    const rule = merchantRules.find(r => r.normalizedMerchantName === normalizedName);
    
    if (rule) {
      return {
        hasCustomRule: true,
        returnDays: rule.returnPolicyDays,
        warrantyMonths: rule.warrantyMonths,
        returnLabel: `${rule.returnPolicyDays}-day return`,
        warrantyLabel: `${rule.warrantyMonths}-month warranty`,
      };
    }
    
    // Default values
    return {
      hasCustomRule: false,
      returnDays: 30,
      warrantyMonths: 12,
      returnLabel: "Default 30-day return",
      warrantyLabel: "Default 12-month warranty",
    };
  };

  const getStatusBadge = (returnBy: string, warrantyEnds: string) => {
    const now = new Date();
    const returnDate = new Date(returnBy);
    const warrantyDate = new Date(warrantyEnds);
    
    const returnDaysLeft = Math.ceil((returnDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const warrantyDaysLeft = Math.ceil((warrantyDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (returnDaysLeft > 0 && returnDaysLeft <= 7) {
      return <Badge variant="destructive" className="text-xs" data-testid="badge-return-expiring">Return ending in {returnDaysLeft}d</Badge>;
    }
    if (warrantyDaysLeft > 0 && warrantyDaysLeft <= 30) {
      return <Badge variant="secondary" className="text-xs" data-testid="badge-warranty-expiring">Warranty ends in {warrantyDaysLeft}d</Badge>;
    }
    if (returnDaysLeft > 0) {
      return <Badge variant="outline" className="text-xs" data-testid="badge-active">Active</Badge>;
    }
    return <Badge variant="outline" className="text-xs opacity-50" data-testid="badge-expired">Expired</Badge>;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Electronics: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      Clothing: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      Food: "bg-green-500/10 text-green-500 border-green-500/20",
      Home: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      Health: "bg-red-500/10 text-red-500 border-red-500/20",
      Auto: "bg-gray-500/10 text-gray-500 border-gray-500/20",
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
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat} data-testid={`option-${cat.toLowerCase()}`}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        ) : (
          <div className="space-y-4">
            {purchases.map((purchase) => (
              <Card key={purchase.id} className="hover-elevate transition-all duration-200" data-testid={`card-receipt-${purchase.id}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold flex items-center gap-2" data-testid={`text-merchant-${purchase.id}`}>
                              <Store className="h-5 w-5 text-muted-foreground" />
                              {purchase.merchant}
                            </h3>
                            {getConfidenceBadge((purchase.ocrConfidence || 'low') as ConfidenceLevel)}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1" data-testid={`text-date-${purchase.id}`}>
                              <Calendar className="h-4 w-4" />
                              {new Date(purchase.date).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1" data-testid={`text-total-${purchase.id}`}>
                              <DollarSign className="h-4 w-4" />
                              ${purchase.total}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {getStatusBadge(purchase.returnBy, purchase.warrantyEnds)}
                          <Select
                            value={purchase.category || "Other"}
                            onValueChange={(value) => updateCategoryMutation.mutate({ id: purchase.id, category: value })}
                          >
                            <SelectTrigger className={`w-32 text-xs border ${getCategoryColor(purchase.category || "Other")}`} data-testid={`select-category-${purchase.id}`}>
                              <Tag className="h-3 w-3 mr-1" />
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat} data-testid={`option-${cat.toLowerCase()}-${purchase.id}`}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            Return By
                          </p>
                          <p className="flex items-center gap-1 mb-1" data-testid={`text-return-by-${purchase.id}`}>
                            <Clock className="h-4 w-4" />
                            {new Date(purchase.returnBy).toLocaleDateString()}
                          </p>
                          {(() => {
                            const policy = getMerchantPolicyInfo(purchase.merchant, purchase.date);
                            return (
                              <p className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`text-return-policy-${purchase.id}`}>
                                <Info className="h-3 w-3" />
                                <span className={policy.hasCustomRule ? "text-primary font-medium" : ""}>
                                  {policy.returnLabel}
                                </span>
                              </p>
                            );
                          })()}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            Warranty Until
                          </p>
                          <p className="flex items-center gap-1 mb-1" data-testid={`text-warranty-${purchase.id}`}>
                            <Clock className="h-4 w-4" />
                            {new Date(purchase.warrantyEnds).toLocaleDateString()}
                          </p>
                          {(() => {
                            const policy = getMerchantPolicyInfo(purchase.merchant, purchase.date);
                            return (
                              <p className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`text-warranty-policy-${purchase.id}`}>
                                <Info className="h-3 w-3" />
                                <span className={policy.hasCustomRule ? "text-primary font-medium" : ""}>
                                  {policy.warrantyLabel}
                                </span>
                              </p>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="flex md:flex-col gap-2">
                      <Link href={`/claims?hash=${purchase.hash}`}>
                        <Button variant="default" className="w-full" data-testid={`button-create-claim-${purchase.id}`}>
                          Create Claim
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                      <a href={`/api/purchases/${purchase.id}/pdf`} download>
                        <Button variant="outline" className="w-full" data-testid={`button-download-pdf-${purchase.id}`}>
                          <Download className="mr-2 h-4 w-4" />
                          Download PDF
                        </Button>
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
