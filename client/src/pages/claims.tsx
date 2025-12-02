import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  QrCode, 
  Key, 
  ArrowLeft, 
  Copy, 
  CheckCircle2, 
  Download, 
  Share2, 
  Mail, 
  MessageSquare,
  Plus,
  Clock,
  AlertTriangle,
  XCircle,
  Receipt,
  Shield
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";

interface Claim {
  id: string;
  claimCode: string;
  pin?: string;
  qrCodeData?: string;
  claimType: string;
  state: string;
  merchantName: string;
  originalAmount: string;
  redeemedAmount?: string;
  purchaseDate: string;
  expiresAt: string;
  redeemedAt?: string;
  createdAt: string;
}

interface Purchase {
  id: string;
  merchant: string;
  date: string;
  total: string;
  returnBy: string;
  warrantyEnds: string;
  category: string;
}

export default function Claims() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<string>("");
  const [claimType, setClaimType] = useState<"return" | "warranty" | "exchange">("return");
  const [copied, setCopied] = useState(false);

  const { data: claimsData, isLoading: claimsLoading } = useQuery({
    queryKey: ["/api/claims"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/claims");
      return response.json();
    },
  });

  const { data: purchasesData } = useQuery({
    queryKey: ["/api/purchases"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/purchases");
      return response.json();
    },
  });

  const createClaimMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPurchase) {
        throw new Error("Please select a receipt first");
      }
      const response = await apiRequest("POST", "/api/claims", {
        purchaseId: selectedPurchase,
        claimType,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create claim");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/claims"] });
      setShowCreateDialog(false);
      setSelectedPurchase("");
      setSelectedClaim(data.claim);
      toast({
        title: "Claim created",
        description: "Your claim is ready to present at the store",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create claim",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [loadingDetails, setLoadingDetails] = useState(false);
  
  const fetchClaimDetails = async (claimCode: string) => {
    try {
      setLoadingDetails(true);
      const response = await apiRequest("GET", `/api/claims/${claimCode}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch claim details");
      }
      const data = await response.json();
      setSelectedClaim(data.claim);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load claim details",
        variant: "destructive",
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const downloadQRCode = () => {
    if (!selectedClaim?.qrCodeData) return;
    const link = document.createElement("a");
    link.download = `claim-${selectedClaim.claimCode}.png`;
    link.href = selectedClaim.qrCodeData;
    link.click();
    toast({ title: "QR Code downloaded" });
  };

  const shareViaWhatsApp = () => {
    if (!selectedClaim) return;
    const message = encodeURIComponent(
      `Return claim for ${selectedClaim.merchantName}:\n` +
      `Code: ${selectedClaim.claimCode}\n` +
      `PIN: ${selectedClaim.pin}\n` +
      `Amount: R${selectedClaim.originalAmount}`
    );
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  const shareViaEmail = () => {
    if (!selectedClaim) return;
    const subject = encodeURIComponent(`Return Claim - ${selectedClaim.merchantName}`);
    const body = encodeURIComponent(
      `Claim Code: ${selectedClaim.claimCode}\n` +
      `PIN: ${selectedClaim.pin}\n` +
      `Store: ${selectedClaim.merchantName}\n` +
      `Amount: R${selectedClaim.originalAmount}\n` +
      `Valid until: ${new Date(selectedClaim.expiresAt).toLocaleDateString()}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const shareViaSMS = () => {
    if (!selectedClaim) return;
    const message = encodeURIComponent(
      `Claim ${selectedClaim.claimCode} PIN: ${selectedClaim.pin} for ${selectedClaim.merchantName} R${selectedClaim.originalAmount}`
    );
    window.location.href = `sms:?body=${message}`;
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case "issued": return "default";
      case "pending": return "secondary";
      case "redeemed": return "outline";
      case "partial": return "secondary";
      case "refused": return "destructive";
      case "expired": return "outline";
      default: return "default";
    }
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case "issued": return <Clock className="h-4 w-4" />;
      case "pending": return <Clock className="h-4 w-4 animate-pulse" />;
      case "redeemed": return <CheckCircle2 className="h-4 w-4" />;
      case "partial": return <AlertTriangle className="h-4 w-4" />;
      case "refused": return <XCircle className="h-4 w-4" />;
      case "expired": return <XCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  const claims: Claim[] = claimsData?.claims || [];
  const purchases: Purchase[] = purchasesData?.purchases || purchasesData || [];

  const eligiblePurchases = purchases.filter(p => {
    const hasActiveClaim = claims.some(
      c => c.merchantName === p.merchant && 
           c.purchaseDate === p.date &&
           (c.state === "issued" || c.state === "pending" || c.state === "partial")
    );
    return !hasActiveClaim;
  });

  if (selectedClaim) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setSelectedClaim(null)}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Claim Details</h1>
            <p className="text-muted-foreground">
              Present this to the merchant for verification
            </p>
          </div>
        </div>

        <Card data-testid="card-qr-code">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code
            </CardTitle>
            <CardDescription>
              Show this to the store staff
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            {selectedClaim.qrCodeData && (
              <div className="bg-white p-4 rounded-lg">
                <img
                  src={selectedClaim.qrCodeData}
                  alt="Claim QR Code"
                  className="w-48 h-48"
                  data-testid="img-qr-code"
                />
              </div>
            )}
            <div className="text-center">
              <p className="text-lg font-mono font-bold">{selectedClaim.claimCode}</p>
              <p className="text-sm text-muted-foreground">Claim Code</p>
            </div>
            {selectedClaim.qrCodeData && (
              <Button variant="outline" onClick={downloadQRCode} className="w-full" data-testid="button-download-qr">
                <Download className="h-4 w-4 mr-2" />
                Download QR Code
              </Button>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-pin">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Verification PIN
            </CardTitle>
            <CardDescription>
              Give this PIN to the store staff
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <span className="text-4xl font-bold font-mono tracking-wider" data-testid="text-pin">
                {selectedClaim.pin}
              </span>
              <Button
                variant="outline"
                onClick={() => copyToClipboard(selectedClaim.pin || "")}
                data-testid="button-copy-pin"
              >
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-details">
          <CardHeader>
            <CardTitle>Claim Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Store:</span>
              <span className="font-medium">{selectedClaim.merchantName}</span>
              
              <span className="text-muted-foreground">Type:</span>
              <Badge variant={getStateColor(selectedClaim.claimType)}>
                {selectedClaim.claimType}
              </Badge>
              
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-medium">R{selectedClaim.originalAmount}</span>
              
              <span className="text-muted-foreground">Purchase Date:</span>
              <span>{selectedClaim.purchaseDate}</span>
              
              <span className="text-muted-foreground">Valid Until:</span>
              <span>{new Date(selectedClaim.expiresAt).toLocaleDateString()}</span>
              
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={getStateColor(selectedClaim.state)} className="flex items-center gap-1 w-fit">
                {getStateIcon(selectedClaim.state)}
                {selectedClaim.state}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-share">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Claim
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={shareViaWhatsApp} data-testid="button-share-whatsapp">
                <SiWhatsapp className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
              <Button variant="outline" onClick={shareViaEmail} data-testid="button-share-email">
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              <Button variant="outline" onClick={shareViaSMS} data-testid="button-share-sms">
                <MessageSquare className="h-4 w-4 mr-2" />
                SMS
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Claims</h1>
          <p className="text-muted-foreground">
            Create and manage return/warranty claims
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-claim">
              <Plus className="h-4 w-4 mr-2" />
              New Claim
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Claim</DialogTitle>
              <DialogDescription>
                Select a receipt and claim type to generate a verifiable claim
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Receipt</label>
                <Select value={selectedPurchase} onValueChange={setSelectedPurchase}>
                  <SelectTrigger data-testid="select-purchase">
                    <SelectValue placeholder="Choose a receipt" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligiblePurchases.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.merchant} - R{p.total} ({p.date})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Claim Type</label>
                <Select value={claimType} onValueChange={(v) => setClaimType(v as any)}>
                  <SelectTrigger data-testid="select-claim-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="return">Return</SelectItem>
                    <SelectItem value="warranty">Warranty</SelectItem>
                    <SelectItem value="exchange">Exchange</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                className="w-full" 
                onClick={() => createClaimMutation.mutate()}
                disabled={!selectedPurchase || createClaimMutation.isPending}
                data-testid="button-create-claim"
              >
                {createClaimMutation.isPending ? "Creating..." : "Create Claim"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {claimsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : claims.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Claims Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first claim from a receipt to get started
            </p>
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Claim
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {claims.map((claim) => (
            <Card 
              key={claim.id} 
              className="cursor-pointer hover-elevate"
              onClick={() => fetchClaimDetails(claim.claimCode)}
              data-testid={`card-claim-${claim.id}`}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                      {claim.claimType === "warranty" ? (
                        <Shield className="h-6 w-6 text-muted-foreground" />
                      ) : (
                        <Receipt className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{claim.merchantName}</p>
                      <p className="text-sm text-muted-foreground">
                        {claim.claimCode} · R{claim.originalAmount}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={getStateColor(claim.state)} className="flex items-center gap-1">
                      {getStateIcon(claim.state)}
                      {claim.state}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(claim.expiresAt) < new Date() 
                        ? "Expired" 
                        : `Valid until ${new Date(claim.expiresAt).toLocaleDateString()}`
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
