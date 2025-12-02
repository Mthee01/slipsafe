import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Store, Calendar, Coins, Clock, Download, AlertTriangle, Shield, FileText, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Purchase } from "@shared/schema";

export default function ReceiptDetail() {
  const [, params] = useRoute("/receipt/:id");
  const receiptId = params?.id;
  const [showImageViewer, setShowImageViewer] = useState(false);

  const { data: purchase, isLoading, error } = useQuery<Purchase>({
    queryKey: ['/api/purchases', receiptId],
    queryFn: async () => {
      const res = await fetch(`/api/purchases/${receiptId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch receipt');
      return res.json();
    },
    enabled: !!receiptId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-10 w-40" />
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Link href="/receipts">
            <Button variant="ghost" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Receipts
            </Button>
          </Link>
          <Card>
            <CardContent className="p-12 text-center">
              <AlertTriangle className="h-16 w-16 mx-auto text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2" data-testid="text-error">Receipt not found</h3>
              <p className="text-muted-foreground">
                This receipt may have been deleted or you don't have access to it.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const returnDaysLeft = purchase.returnBy 
    ? Math.ceil((new Date(purchase.returnBy).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  
  const warrantyDaysLeft = purchase.warrantyEnds
    ? Math.ceil((new Date(purchase.warrantyEnds).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/receipts">
          <Button variant="ghost" data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Receipts
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-merchant">
              <Store className="h-6 w-6 text-primary" />
              {purchase.merchant}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Purchase Date</p>
                <p className="flex items-center gap-2 font-medium" data-testid="text-date">
                  <Calendar className="h-4 w-4" />
                  {new Date(purchase.date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="flex items-center gap-2 font-medium" data-testid="text-total">
                  <Coins className="h-4 w-4" />
                  R{purchase.total}
                </p>
              </div>
            </div>

            {purchase.invoiceNumber && (
              <div>
                <p className="text-sm text-muted-foreground">Invoice Number</p>
                <p className="flex items-center gap-2 font-medium" data-testid="text-invoice">
                  <FileText className="h-4 w-4" />
                  {purchase.invoiceNumber}
                </p>
              </div>
            )}

            {purchase.category && (
              <div>
                <p className="text-sm text-muted-foreground">Category</p>
                <Badge variant="outline" data-testid="badge-category">{purchase.category}</Badge>
              </div>
            )}

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Important Deadlines
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Return By</p>
                  {purchase.refundType === 'none' ? (
                    <p className="text-destructive font-medium" data-testid="text-return-by">No returns accepted</p>
                  ) : purchase.returnBy ? (
                    <div>
                      <p className="font-medium" data-testid="text-return-by">
                        {new Date(purchase.returnBy).toLocaleDateString()}
                      </p>
                      {returnDaysLeft !== null && (
                        <Badge 
                          variant={returnDaysLeft <= 7 ? "destructive" : returnDaysLeft <= 14 ? "secondary" : "outline"}
                          className="mt-1"
                          data-testid="badge-return-days"
                        >
                          {returnDaysLeft > 0 ? `${returnDaysLeft} days left` : 'Expired'}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground" data-testid="text-return-by">Not specified</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Warranty Expires</p>
                  {purchase.warrantyEnds ? (
                    <div>
                      <p className="font-medium" data-testid="text-warranty">
                        {new Date(purchase.warrantyEnds).toLocaleDateString()}
                      </p>
                      {warrantyDaysLeft !== null && (
                        <Badge 
                          variant={warrantyDaysLeft <= 30 ? "destructive" : warrantyDaysLeft <= 90 ? "secondary" : "outline"}
                          className="mt-1"
                          data-testid="badge-warranty-days"
                        >
                          {warrantyDaysLeft > 0 ? `${warrantyDaysLeft} days left` : 'Expired'}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground" data-testid="text-warranty">Not specified</p>
                  )}
                </div>
              </div>
            </div>

            {purchase.imagePath && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold">Receipt Image</h4>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowImageViewer(true)}
                    data-testid="button-view-image"
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    View Full Image
                  </Button>
                </div>
                <img 
                  src={`/api/receipts/image/${purchase.id}`} 
                  alt="Receipt" 
                  className="max-w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setShowImageViewer(true)}
                  data-testid="img-receipt"
                />
              </div>
            )}

            <div className="border-t pt-4 flex flex-col sm:flex-row gap-3">
              <Link href={`/claims?hash=${purchase.hash}`} className="flex-1">
                <Button className="w-full" data-testid="button-create-claim">
                  <Shield className="mr-2 h-4 w-4" />
                  Create Claim
                </Button>
              </Link>
              <a href={`/api/purchases/${purchase.id}/pdf`} download className="flex-1">
                <Button variant="outline" className="w-full" data-testid="button-download-pdf">
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full-screen Image Viewer Modal */}
      {showImageViewer && purchase.imagePath && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowImageViewer(false)}
          data-testid="modal-image-viewer"
        >
          <Button
            variant="outline"
            size="icon"
            className="absolute top-4 right-4 bg-background hover:bg-background/90 z-10"
            onClick={(e) => {
              e.stopPropagation();
              setShowImageViewer(false);
            }}
            data-testid="button-close-image"
          >
            <X className="h-5 w-5" />
          </Button>
          <img
            src={`/api/receipts/image/${purchase.id}`}
            alt="Receipt"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
            data-testid="img-receipt-fullscreen"
          />
        </div>
      )}
    </div>
  );
}
