import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Store, 
  QrCode, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Shield, 
  Scan,
  KeyRound,
  AlertTriangle,
  Building2,
  Loader2
} from "lucide-react";
import type { User } from "@shared/schema";

interface MerchantDashboardData {
  merchant: {
    id: string;
    businessName: string;
    email: string;
    returnPolicyDays: number | null;
    warrantyMonths: number | null;
  };
  recentVerifications: any[];
  staffCount: number;
}

interface ClaimInfo {
  claimCode: string;
  claimType: string;
  state: string;
  merchantName: string;
  originalAmount: string;
  purchaseDate: string;
  expiresAt: string;
  isExpired: boolean;
  isUsed: boolean;
}

export default function IntegratedMerchantPortal() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("verify");

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/users/me"],
  });

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<MerchantDashboardData>({
    queryKey: ["/api/merchant-portal/dashboard"],
    enabled: !!user && (user.role === "merchant_admin" || user.role === "merchant_staff"),
    refetchInterval: 30000,
  });

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || (user.role !== "merchant_admin" && user.role !== "merchant_staff")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
        <p className="text-muted-foreground max-w-md">
          You need merchant admin or staff permissions to access this portal.
          Contact your administrator if you believe you should have access.
        </p>
      </div>
    );
  }

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">
            {dashboardData?.merchant?.businessName || "Merchant Portal"}
          </h1>
        </div>
        <p className="text-muted-foreground">
          Verify customer claims and process returns
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline">
            {user.role === "merchant_admin" ? "Admin" : "Staff"}
          </Badge>
          {dashboardData?.staffCount && (
            <Badge variant="secondary">{dashboardData.staffCount} staff members</Badge>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 w-full max-w-sm mb-6">
          <TabsTrigger value="verify" data-testid="tab-integrated-verify">
            <Scan className="h-4 w-4 mr-2" />
            Verify Claims
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-integrated-history">
            <Clock className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="verify">
          <IntegratedClaimVerifier />
        </TabsContent>

        <TabsContent value="history">
          <IntegratedVerificationHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IntegratedClaimVerifier() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [claimCode, setClaimCode] = useState("");
  const [pin, setPin] = useState("");
  const [verifiedClaim, setVerifiedClaim] = useState<ClaimInfo | null>(null);
  const [step, setStep] = useState<"input" | "verified" | "complete">("input");
  const [refundAmount, setRefundAmount] = useState("");
  const [isPartial, setIsPartial] = useState(false);
  const [notes, setNotes] = useState("");

  const lookupMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("GET", `/api/merchant-portal/lookup/${code}`);
      return response.json();
    },
    onSuccess: (data) => {
      if (!data.valid) {
        toast({
          title: "Invalid claim",
          description: data.claim?.isExpired ? "This claim has expired" : 
                       data.claim?.isUsed ? "This claim has already been used" : 
                       "This claim is not valid",
          variant: "destructive",
        });
        return;
      }
      setVerifiedClaim(data.claim);
    },
    onError: (error: any) => {
      const message = error.message || "Lookup failed";
      const isAccessError = message.includes("403") || message.includes("401") || 
                            message.includes("access") || message.includes("permission");
      toast({
        title: isAccessError ? "Access Denied" : "Error",
        description: isAccessError 
          ? "You don't have permission to access this resource. Please contact your administrator."
          : message,
        variant: "destructive",
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/merchant-portal/verify", { claimCode, pin });
      return response.json();
    },
    onSuccess: (data: any) => {
      setStep("verified");
      setRefundAmount(data.claim.originalAmount);
      toast({
        title: "PIN verified",
        description: "You may now process the return/exchange",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const redeemMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/merchant-portal/redeem", { 
        claimCode, 
        pin, 
        refundAmount: parseFloat(refundAmount),
        isPartial,
        notes,
      });
      return response.json();
    },
    onSuccess: () => {
      setStep("complete");
      queryClient.invalidateQueries({ queryKey: ["/api/merchant-portal/verifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchant-portal/dashboard"] });
      toast({
        title: "Success",
        description: isPartial ? "Partial refund processed" : "Claim redeemed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const reset = () => {
    setClaimCode("");
    setPin("");
    setVerifiedClaim(null);
    setStep("input");
    setRefundAmount("");
    setIsPartial(false);
    setNotes("");
  };

  if (step === "complete") {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Transaction Complete</h3>
          <p className="text-muted-foreground mb-6">
            The claim has been processed successfully.
          </p>
          <Button onClick={reset} data-testid="button-new-integrated-verification">
            Start New Verification
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Verify Customer Claim
          </CardTitle>
          <CardDescription>
            Enter the claim code from the customer's receipt or scan their QR code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="claimCode">Claim Code</Label>
            <Input
              id="claimCode"
              data-testid="input-integrated-claim-code"
              placeholder="e.g., ABCD1234"
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
              maxLength={8}
              disabled={step !== "input"}
            />
          </div>

          {!verifiedClaim && (
            <Button 
              onClick={() => lookupMutation.mutate(claimCode)}
              disabled={claimCode.length < 8 || lookupMutation.isPending}
              className="w-full"
              data-testid="button-integrated-lookup-claim"
            >
              {lookupMutation.isPending ? "Looking up..." : "Look Up Claim"}
            </Button>
          )}

          {verifiedClaim && step === "input" && (
            <>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <Badge variant={
                    verifiedClaim.claimType === "return" ? "default" :
                    verifiedClaim.claimType === "warranty" ? "secondary" : "outline"
                  }>
                    {verifiedClaim.claimType}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Store:</span>
                  <span className="font-medium">{verifiedClaim.merchantName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">R{verifiedClaim.originalAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Purchase Date:</span>
                  <span>{verifiedClaim.purchaseDate}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pin">Customer PIN</Label>
                <div className="flex gap-2">
                  <Input
                    id="pin"
                    data-testid="input-integrated-claim-pin"
                    placeholder="6-digit PIN"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    inputMode="numeric"
                  />
                  <Button 
                    onClick={() => verifyMutation.mutate()}
                    disabled={pin.length !== 6 || verifyMutation.isPending}
                    data-testid="button-integrated-verify-pin"
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    Verify
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === "verified" && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center gap-2 text-green-600">
                <Shield className="h-5 w-5" />
                <span className="font-medium">PIN Verified - Process Refund</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="refundAmount">Refund Amount (R)</Label>
                <Input
                  id="refundAmount"
                  data-testid="input-integrated-refund-amount"
                  type="number"
                  value={refundAmount}
                  onChange={(e) => {
                    setRefundAmount(e.target.value);
                    setIsPartial(parseFloat(e.target.value) < parseFloat(verifiedClaim?.originalAmount || "0"));
                  }}
                />
                {isPartial && (
                  <p className="text-sm text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    This is a partial refund
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  data-testid="input-integrated-notes"
                  placeholder="Any additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline"
                  onClick={reset}
                  data-testid="button-integrated-cancel"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  onClick={() => redeemMutation.mutate()}
                  disabled={redeemMutation.isPending || !refundAmount}
                  data-testid="button-integrated-approve"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {step !== "input" && step !== "verified" && (
        <Button variant="outline" onClick={reset} className="w-full" data-testid="button-integrated-reset">
          Start Over
        </Button>
      )}
    </div>
  );
}

interface VerificationsData {
  verifications: any[];
}

function IntegratedVerificationHistory() {
  const { data, isLoading } = useQuery<VerificationsData>({
    queryKey: ["/api/merchant-portal/verifications"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const verifications = data?.verifications || [];

  if (verifications.length === 0) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium mb-2">No verification history</h3>
          <p className="text-sm text-muted-foreground">
            Completed verifications will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      {verifications.map((v: any) => (
        <Card key={v.id}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {v.result === "approved" || v.result === "partial_approved" ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="font-medium">Claim verified</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(v.createdAt).toLocaleDateString()} at{" "}
                    {new Date(v.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={
                  v.result === "approved" ? "default" :
                  v.result === "partial_approved" ? "secondary" : "destructive"
                }>
                  {v.result === "approved" ? "Approved" :
                   v.result === "partial_approved" ? "Partial" : "Rejected"}
                </Badge>
                {v.refundAmount && (
                  <p className="text-sm text-muted-foreground mt-1">
                    R{v.refundAmount}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
