import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Key, ExternalLink, ArrowLeft, Copy, CheckCircle2, Download, Share2, Mail, MessageSquare } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";

interface ClaimData {
  token: string;
  pin: string;
  verifierUrl: string;
  qrCodeDataUrl: string;
  purchase: {
    merchant: string;
    date: string;
    total: string;
    returnBy: string;
    warrantyEnds: string;
  };
}

export default function Claims() {
  const [, navigate] = useLocation();
  const [hash, setHash] = useState<string>("");
  const [claimData, setClaimData] = useState<ClaimData | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParam = params.get("hash");
    if (hashParam) {
      setHash(hashParam);
      createClaimMutation.mutate(hashParam);
    }
  }, []);

  const createClaimMutation = useMutation({
    mutationFn: async (purchaseHash: string) => {
      const response = await apiRequest("POST", "/api/claims/create", { hash: purchaseHash });
      return await response.json();
    },
    onSuccess: (data: ClaimData) => {
      setClaimData(data);
      toast({
        title: "Claim created successfully",
        description: "Your claim QR code and PIN are ready",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Claim creation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied to clipboard",
    });
  };

  const downloadQRCode = () => {
    if (!claimData) return;
    
    const link = document.createElement('a');
    link.download = `claim-qr-${claimData.purchase.merchant}-${claimData.purchase.date}.png`;
    link.href = claimData.qrCodeDataUrl;
    link.click();
    
    toast({
      title: "QR Code downloaded",
    });
  };

  const shareViaWhatsApp = () => {
    if (!claimData) return;
    
    const message = encodeURIComponent(
      `Here's my return claim for ${claimData.purchase.merchant}:\n\n` +
      `Merchant: ${claimData.purchase.merchant}\n` +
      `Date: ${claimData.purchase.date}\n` +
      `Total: $${claimData.purchase.total}\n` +
      `PIN: ${claimData.pin}\n\n` +
      `Verify: ${claimData.verifierUrl}`
    );
    
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const shareViaEmail = () => {
    if (!claimData) return;
    
    const subject = encodeURIComponent(`Return Claim - ${claimData.purchase.merchant}`);
    const body = encodeURIComponent(
      `Please find my return claim details below:\n\n` +
      `Merchant: ${claimData.purchase.merchant}\n` +
      `Purchase Date: ${claimData.purchase.date}\n` +
      `Amount: $${claimData.purchase.total}\n` +
      `Return Deadline: ${claimData.purchase.returnBy}\n\n` +
      `Verification PIN: ${claimData.pin}\n` +
      `Verification Link: ${claimData.verifierUrl}\n\n` +
      `This claim is valid until ${claimData.purchase.warrantyEnds}.`
    );
    
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const shareViaSMS = () => {
    if (!claimData) return;
    
    const message = encodeURIComponent(
      `Return claim for ${claimData.purchase.merchant} - PIN: ${claimData.pin} - Verify: ${claimData.verifierUrl}`
    );
    
    window.location.href = `sms:?body=${message}`;
  };

  if (createClaimMutation.isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Creating your claim...</p>
        </div>
      </div>
    );
  }

  if (!claimData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>No Claim Data</CardTitle>
            <CardDescription>
              Please upload a receipt first to create a claim
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Your Claim</h1>
            <p className="text-muted-foreground">
              Present this to the merchant for return verification
            </p>
          </div>
        </div>

        <Card data-testid="card-qr-code" className="animate-in fade-in-50 slide-in-from-bottom-4 duration-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code
            </CardTitle>
            <CardDescription>
              Show this QR code to the merchant staff
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <div className="bg-white p-6 rounded-lg border-4 border-border animate-in zoom-in-95 duration-700 delay-150">
              <img
                src={claimData.qrCodeDataUrl}
                alt="Claim QR Code"
                className="w-64 h-64"
                data-testid="img-qr-code"
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Scan this code at the store to verify your purchase
            </p>
            <Button
              variant="outline"
              onClick={downloadQRCode}
              className="w-full"
              data-testid="button-download-qr"
            >
              <Download className="h-4 w-4 mr-2" />
              Download QR Code
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="card-pin">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Verification PIN
            </CardTitle>
            <CardDescription>
              Alternative verification method if QR code cannot be scanned
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <span className="text-4xl font-bold font-mono tracking-wider" data-testid="text-pin">
                {claimData.pin}
              </span>
              <Button
                variant="outline"
                onClick={() => copyToClipboard(claimData.pin)}
                data-testid="button-copy-pin"
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-purchase-details">
          <CardHeader>
            <CardTitle>Purchase Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Merchant:</span>
              <span className="font-medium" data-testid="text-merchant">
                {claimData.purchase.merchant}
              </span>

              <span className="text-muted-foreground">Date:</span>
              <span className="font-medium" data-testid="text-date">
                {claimData.purchase.date}
              </span>

              <span className="text-muted-foreground">Total:</span>
              <span className="font-medium" data-testid="text-total">
                ${claimData.purchase.total}
              </span>

              <span className="text-muted-foreground">Return By:</span>
              <span className="font-medium" data-testid="text-return-by">
                {claimData.purchase.returnBy}
              </span>

              <span className="text-muted-foreground">Warranty Ends:</span>
              <span className="font-medium" data-testid="text-warranty-ends">
                {claimData.purchase.warrantyEnds}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-share-options">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Claim
            </CardTitle>
            <CardDescription>
              Send your claim via WhatsApp, email, or SMS
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={shareViaWhatsApp}
                className="w-full"
                data-testid="button-share-whatsapp"
              >
                <SiWhatsapp className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={shareViaEmail}
                className="w-full"
                data-testid="button-share-email"
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              <Button
                variant="outline"
                onClick={shareViaSMS}
                className="w-full col-span-2"
                data-testid="button-share-sms"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                SMS
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Verifier Link
            </CardTitle>
            <CardDescription>
              Direct link for merchant verification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={claimData.verifierUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono"
                data-testid="input-verifier-url"
              />
              <Button
                variant="outline"
                onClick={() => copyToClipboard(claimData.verifierUrl)}
                data-testid="button-copy-url"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(claimData.verifierUrl, "_blank")}
              data-testid="button-open-verifier"
            >
              Open Verifier Page
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
