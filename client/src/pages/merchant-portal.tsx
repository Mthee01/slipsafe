import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Store, 
  QrCode, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Users, 
  Shield, 
  LogOut,
  Scan,
  KeyRound,
  AlertTriangle,
  Coins
} from "lucide-react";
import logo from "@assets/SlipSafe Logo_1762888976121.png";

interface MerchantSession {
  sessionToken: string;
  expiresAt: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
  merchant: {
    id: string;
    businessName: string;
  };
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

export default function MerchantPortal() {
  const { toast } = useToast();
  const [, params] = useRoute("/verify/:claimCode");
  const initialClaimCode = params?.claimCode || "";
  
  const [session, setSession] = useState<MerchantSession | null>(() => {
    try {
      const stored = localStorage.getItem("merchantSession");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expiresAt > Date.now()) {
          return parsed;
        }
        localStorage.removeItem("merchantSession");
      }
    } catch (e) {
      localStorage.removeItem("merchantSession");
    }
    return null;
  });

  useEffect(() => {
    if (session && session.expiresAt <= Date.now()) {
      clearSession();
      toast({
        title: "Session expired",
        description: "Please log in again",
        variant: "destructive",
      });
    }
  }, [session]);

  const saveSession = (newSession: MerchantSession) => {
    try {
      localStorage.setItem("merchantSession", JSON.stringify(newSession));
      setSession(newSession);
    } catch (e) {
      toast({
        title: "Storage error",
        description: "Could not save session",
        variant: "destructive",
      });
    }
  };

  const clearSession = () => {
    localStorage.removeItem("merchantSession");
    setSession(null);
  };

  if (!session) {
    return <MerchantLogin onLogin={saveSession} />;
  }

  return (
    <MerchantDashboard 
      session={session} 
      onLogout={clearSession}
      initialClaimCode={initialClaimCode}
    />
  );
}

function MerchantLogin({ onLogin }: { onLogin: (session: MerchantSession) => void }) {
  const { toast } = useToast();
  const [merchantId, setMerchantId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/merchant/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId, email, password }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Login failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      onLogin(data);
      toast({
        title: "Welcome back!",
        description: `Logged in as ${data.user.fullName}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-teal-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="SlipSafe" className="h-16 w-16" />
          </div>
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <Store className="h-6 w-6" />
            Merchant Portal
          </CardTitle>
          <CardDescription>
            Verify customer claims and process returns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="merchantId">Merchant ID</Label>
              <Input
                id="merchantId"
                data-testid="input-merchant-id"
                placeholder="Your merchant ID"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                data-testid="input-merchant-email"
                placeholder="staff@store.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                data-testid="input-merchant-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={loginMutation.isPending}
              data-testid="button-merchant-login"
            >
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function MerchantDashboard({ 
  session, 
  onLogout,
  initialClaimCode = ""
}: { 
  session: MerchantSession; 
  onLogout: () => void;
  initialClaimCode?: string;
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("verify");

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/merchant/logout", {
        method: "POST",
        headers: { "X-Merchant-Session": session.sessionToken },
      });
      if (!response.ok) {
        throw new Error("Logout failed");
      }
    },
    onSuccess: () => {
      onLogout();
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
    },
    onError: () => {
      onLogout();
    },
  });

  const { data: dashboardData } = useQuery({
    queryKey: ["/api/merchant/dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/merchant/dashboard", {
        headers: { "X-Merchant-Session": session.sessionToken },
      });
      if (!response.ok) throw new Error("Failed to fetch dashboard");
      return response.json();
    },
    refetchInterval: 30000,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="SlipSafe" className="h-10 w-10" />
            <div>
              <h1 className="font-semibold text-lg">{session.merchant.businessName}</h1>
              <p className="text-sm text-muted-foreground">{session.user.fullName}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => logoutMutation.mutate()}
            data-testid="button-merchant-logout"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto mb-6">
            <TabsTrigger value="verify" data-testid="tab-verify">
              <Scan className="h-4 w-4 mr-2" />
              Verify
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <Clock className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger value="staff" data-testid="tab-staff">
              <Users className="h-4 w-4 mr-2" />
              Staff
            </TabsTrigger>
          </TabsList>

          <TabsContent value="verify">
            <ClaimVerifier session={session} initialClaimCode={initialClaimCode} />
          </TabsContent>

          <TabsContent value="history">
            <VerificationHistory session={session} />
          </TabsContent>

          <TabsContent value="staff">
            <StaffManagement session={session} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function ClaimVerifier({ session, initialClaimCode = "" }: { session: MerchantSession; initialClaimCode?: string }) {
  const { toast } = useToast();
  const [claimCode, setClaimCode] = useState(initialClaimCode);
  const [pin, setPin] = useState("");
  const [verifiedClaim, setVerifiedClaim] = useState<ClaimInfo | null>(null);
  const [step, setStep] = useState<"input" | "verified" | "complete">("input");
  const [refundAmount, setRefundAmount] = useState("");
  const [isPartial, setIsPartial] = useState(false);
  const [notes, setNotes] = useState("");
  const [shouldAutoLookup, setShouldAutoLookup] = useState(!!initialClaimCode);

  const lookupClaimAsync = async (code: string) => {
    const response = await fetch(`/api/verify/${code}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Claim not found");
    }
    return response.json();
  };

  const lookupMutation = useMutation({
    mutationFn: (code: string) => lookupClaimAsync(code),
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
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (initialClaimCode && initialClaimCode.length >= 8) {
      setClaimCode(initialClaimCode);
      setVerifiedClaim(null);
      setStep("input");
      setPin("");
      setRefundAmount("");
      setNotes("");
      setIsPartial(false);
      setShouldAutoLookup(true);
    }
  }, [initialClaimCode]);

  useEffect(() => {
    if (shouldAutoLookup && claimCode && claimCode.length >= 8 && !lookupMutation.isPending) {
      setShouldAutoLookup(false);
      lookupMutation.mutate(claimCode);
    }
  }, [shouldAutoLookup, claimCode, lookupMutation.isPending]);

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/merchant/verify", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Merchant-Session": session.sessionToken,
        },
        body: JSON.stringify({ claimCode, pin }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Verification failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
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
      const response = await fetch("/api/merchant/redeem", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Merchant-Session": session.sessionToken,
        },
        body: JSON.stringify({ 
          claimCode, 
          pin, 
          refundAmount: parseFloat(refundAmount),
          isPartial,
          notes,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Redemption failed");
      }
      return response.json();
    },
    onSuccess: () => {
      setStep("complete");
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

  const refuseMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/merchant/refuse", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Merchant-Session": session.sessionToken,
        },
        body: JSON.stringify({ claimCode, pin, reason: notes }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Refusal failed");
      }
      return response.json();
    },
    onSuccess: () => {
      setStep("complete");
      toast({
        title: "Claim refused",
        description: "The customer has been notified",
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
          <Button onClick={reset} data-testid="button-new-verification">
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
              data-testid="input-claim-code"
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
              data-testid="button-lookup-claim"
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
                    data-testid="input-claim-pin"
                    placeholder="6-digit PIN"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    inputMode="numeric"
                  />
                  <Button 
                    onClick={() => verifyMutation.mutate()}
                    disabled={pin.length !== 6 || verifyMutation.isPending}
                    data-testid="button-verify-pin"
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
                  data-testid="input-refund-amount"
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
                  data-testid="input-notes"
                  placeholder="Any additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="destructive"
                  onClick={() => refuseMutation.mutate()}
                  disabled={refuseMutation.isPending}
                  data-testid="button-refuse"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Refuse
                </Button>
                <Button 
                  onClick={() => redeemMutation.mutate()}
                  disabled={redeemMutation.isPending || !refundAmount}
                  data-testid="button-approve"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {step !== "input" && (
        <Button variant="outline" onClick={reset} className="w-full" data-testid="button-cancel">
          Cancel & Start Over
        </Button>
      )}
    </div>
  );
}

function VerificationHistory({ session }: { session: MerchantSession }) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/merchant/verifications"],
    queryFn: async () => {
      const response = await fetch("/api/merchant/verifications?limit=50", {
        headers: { "X-Merchant-Session": session.sessionToken },
      });
      if (!response.ok) throw new Error("Failed to fetch verifications");
      return response.json();
    },
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  const verifications = data?.verifications || [];

  if (verifications.length === 0) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No verification history yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h3 className="font-semibold text-lg">Recent Verifications</h3>
      {verifications.map((v: any) => (
        <Card key={v.id}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {v.result === "approved" ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : v.result === "partial_approved" ? (
                  <Coins className="h-5 w-5 text-amber-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="font-medium">Claim verified</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(v.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {v.refundAmount && (
                  <p className="font-medium">R{v.refundAmount}</p>
                )}
                <Badge variant={
                  v.result === "approved" ? "default" :
                  v.result === "partial_approved" ? "secondary" : "destructive"
                }>
                  {v.result.replace("_", " ")}
                </Badge>
              </div>
            </div>
            {v.notes && (
              <p className="text-sm text-muted-foreground mt-2 pl-8">
                {v.notes}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StaffManagement({ session }: { session: MerchantSession }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStaff, setNewStaff] = useState({ fullName: "", email: "", password: "", role: "staff" });

  const { data, isLoading } = useQuery({
    queryKey: ["/api/merchant/staff"],
    queryFn: async () => {
      const response = await fetch("/api/merchant/staff", {
        headers: { "X-Merchant-Session": session.sessionToken },
      });
      if (!response.ok) throw new Error("Failed to fetch staff");
      return response.json();
    },
  });

  const addStaffMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/merchant/staff", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Merchant-Session": session.sessionToken,
        },
        body: JSON.stringify(newStaff),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add staff");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/staff"] });
      setShowAddForm(false);
      setNewStaff({ fullName: "", email: "", password: "", role: "staff" });
      toast({
        title: "Staff added",
        description: "The new staff member has been added successfully",
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

  const canManageStaff = session.user.role === "owner" || session.user.role === "manager";

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  const staff = data?.staff || [];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Staff Members</h3>
        {canManageStaff && (
          <Button 
            size="sm"
            onClick={() => setShowAddForm(true)}
            data-testid="button-add-staff"
          >
            Add Staff
          </Button>
        )}
      </div>

      {showAddForm && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="staffName">Full Name</Label>
                <Input
                  id="staffName"
                  data-testid="input-staff-name"
                  value={newStaff.fullName}
                  onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staffEmail">Email</Label>
                <Input
                  id="staffEmail"
                  type="email"
                  data-testid="input-staff-email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="staffPassword">Password</Label>
                <Input
                  id="staffPassword"
                  type="password"
                  data-testid="input-staff-password"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staffRole">Role</Label>
                <select
                  id="staffRole"
                  className="w-full h-10 rounded-md border border-input bg-background px-3"
                  data-testid="select-staff-role"
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowAddForm(false)}
                data-testid="button-cancel-add-staff"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => addStaffMutation.mutate()}
                disabled={addStaffMutation.isPending || !newStaff.fullName || !newStaff.email || !newStaff.password}
                data-testid="button-save-staff"
              >
                Add Staff Member
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {staff.map((s: any) => (
        <Card key={s.id}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{s.fullName}</p>
                  <p className="text-sm text-muted-foreground">{s.email}</p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={s.role === "owner" ? "default" : s.role === "manager" ? "secondary" : "outline"}>
                  {s.role}
                </Badge>
                {s.lastLoginAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last login: {new Date(s.lastLoginAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {staff.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No staff members yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
