import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { savePendingUpload, saveReceiptOffline } from "@/lib/indexedDB";
import { Upload, FileText, Clock, DollarSign, Store, Calendar, X, Tag, Camera, Edit, Check, Sparkles, WifiOff, Flashlight, FlashlightOff, Focus, Info } from "lucide-react";
import { CATEGORIES, type Purchase, type ConfidenceLevel } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("Other");
  const [isDragging, setIsDragging] = useState(false);
  const [ocrResult, setOcrResult] = useState<{
    merchant: string;
    date: string;
    total: string;
    returnBy: string;
    warrantyEnds: string;
    confidence: ConfidenceLevel;
    rawText: string;
  } | null>(null);
  const [editedData, setEditedData] = useState<{
    merchant: string;
    date: string;
    total: string;
  } | null>(null);
  const [savedPurchase, setSavedPurchase] = useState<Purchase | null>(null);

  // Compute deadlines based on edited date
  const computedDeadlines = editedData?.date ? (() => {
    const purchaseDate = new Date(editedData.date);
    const returnBy = new Date(purchaseDate);
    returnBy.setDate(returnBy.getDate() + 30);
    const warrantyEnds = new Date(purchaseDate);
    warrantyEnds.setMonth(warrantyEnds.getMonth() + 12);
    return {
      returnBy: returnBy.toISOString().split('T')[0],
      warrantyEnds: warrantyEnds.toISOString().split('T')[0]
    };
  })() : null;
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [flashSupported, setFlashSupported] = useState(false);
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("receipt", file);
      
      const response = await fetch("/api/receipts/preview", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "OCR processing failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setOcrResult(data.ocrData);
      setEditedData({
        merchant: data.ocrData.merchant,
        date: data.ocrData.date,
        total: data.ocrData.total,
      });
      toast({
        title: "Receipt scanned",
        description: "Review and edit the extracted data below",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "OCR failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!ocrResult || !editedData || !selectedFile) {
        throw new Error("No data to save");
      }
      
      // Validate edited data
      if (!editedData.merchant.trim()) {
        throw new Error("Merchant name is required");
      }
      if (!editedData.date) {
        throw new Error("Purchase date is required");
      }
      const totalNum = parseFloat(editedData.total);
      if (isNaN(totalNum) || totalNum <= 0) {
        throw new Error("Total must be a positive number");
      }
      
      // If offline, queue the upload
      if (!isOnline) {
        const tempId = `offline-${Date.now()}`;
        const deadlines = computedDeadlines || { returnBy: '', warrantyEnds: '' };
        
        await saveReceiptOffline({
          id: tempId,
          merchant: editedData.merchant.trim(),
          date: editedData.date,
          total: editedData.total,
          returnBy: deadlines.returnBy || null,
          warrantyEnds: deadlines.warrantyEnds || null,
          confidence: ocrResult.confidence,
          createdAt: new Date().toISOString(),
          synced: false,
        });
        
        await savePendingUpload({
          merchant: editedData.merchant.trim(),
          date: editedData.date,
          total: editedData.total,
          category: selectedCategory,
          receiptId: tempId,
          fileBlob: selectedFile,
          fileName: selectedFile.name,
          createdAt: new Date().toISOString(),
        });
        
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((registration) => {
            if ('sync' in registration) {
              return (registration as any).sync.register('sync-receipts');
            }
          }).catch((error) => {
            console.error('Background sync registration failed:', error);
          });
        }
        
        return { queued: true, receipt: { id: tempId } };
      }
      
      // If online, try API request
      try {
        return await apiRequest("POST", "/api/receipts/confirm", {
          merchant: editedData.merchant.trim(),
          date: editedData.date,
          total: editedData.total,
          category: selectedCategory,
        });
      } catch (error: any) {
        // If network error, queue for later
        if (error.message?.includes('Failed to fetch') || error.message?.includes('Network')) {
          const tempId = `offline-${Date.now()}`;
          const deadlines = computedDeadlines || { returnBy: '', warrantyEnds: '' };
          
          await saveReceiptOffline({
            id: tempId,
            merchant: editedData.merchant.trim(),
            date: editedData.date,
            total: editedData.total,
            returnBy: deadlines.returnBy || null,
            warrantyEnds: deadlines.warrantyEnds || null,
            confidence: ocrResult.confidence,
            createdAt: new Date().toISOString(),
            synced: false,
          });
          
          await savePendingUpload({
            merchant: editedData.merchant.trim(),
            date: editedData.date,
            total: editedData.total,
            category: selectedCategory,
            receiptId: tempId,
            fileBlob: selectedFile,
            fileName: selectedFile.name,
            createdAt: new Date().toISOString(),
          });
          
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
              if ('sync' in registration) {
                return (registration as any).sync.register('sync-receipts');
              }
            }).catch((error) => {
              console.error('Background sync registration failed:', error);
            });
          }
          
          return { queued: true, receipt: { id: tempId } };
        }
        throw error;
      }
    },
    onSuccess: (data: any) => {
      if (data.queued) {
        toast({
          title: "Receipt queued",
          description: "Will upload when connection is restored",
          action: <WifiOff className="h-4 w-4" />,
        });
      } else {
        setSavedPurchase(data.purchase);
        queryClient.invalidateQueries({ queryKey: ["/api/purchases"], exact: false });
        toast({
          title: "Receipt saved",
          description: "Your receipt has been saved successfully",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select a file smaller than 10MB",
        variant: "destructive",
      });
      return;
    }
    setSelectedFile(file);
    setOcrResult(null);
    setEditedData(null);
    setSavedPurchase(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      handleFileSelect(file);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload an image (JPEG, PNG) or PDF",
        variant: "destructive",
      });
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handlePreview = () => {
    if (selectedFile) {
      previewMutation.mutate(selectedFile);
    }
  };

  const handleConfirm = () => {
    confirmMutation.mutate();
  };

  const handleCreateClaim = () => {
    if (savedPurchase) {
      window.location.href = `/claims?hash=${savedPurchase.hash}`;
    }
  };

  const openCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 3840, min: 1920 },
          height: { ideal: 2160, min: 1080 },
          aspectRatio: { ideal: 4/3 },
        },
        audio: false,
      });
      
      setStream(mediaStream);
      setShowCamera(true);
      setFlashEnabled(false);
      
      const videoTrack = mediaStream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities?.() as any;
      setFlashSupported(!!capabilities?.torch);
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
        }
      }, 100);
    } catch (error) {
      toast({
        title: "Camera access denied",
        description: "Please enable camera permissions to take photos",
        variant: "destructive",
      });
    }
  };

  const toggleFlash = async () => {
    if (!stream) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    try {
      await videoTrack.applyConstraints({
        advanced: [{ torch: !flashEnabled } as any]
      });
      setFlashEnabled(!flashEnabled);
    } catch (error) {
      toast({
        title: "Flash unavailable",
        description: "Could not toggle flash on this device",
        variant: "destructive",
      });
    }
  };

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' });
            handleFileSelect(file);
            closeCamera();
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">SlipSafe</h1>
          <p className="text-muted-foreground">
            Digitize your receipts and manage return claims with ease
          </p>
        </div>

        <Card data-testid="card-upload">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Receipt
            </CardTitle>
            <CardDescription>
              Take a photo, drag and drop, or browse files
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedFile && (
              <Button
                onClick={openCamera}
                variant="outline"
                className="w-full"
                data-testid="button-camera"
              >
                <Camera className="h-4 w-4 mr-2" />
                Take Photo
              </Button>
            )}
            
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-accent/5"
              }`}
              data-testid="dropzone-receipt"
            >
              <input
                type="file"
                onChange={handleFileChange}
                accept="image/jpeg,image/png,image/jpg,application/pdf"
                className="hidden"
                id="receipt-upload"
                data-testid="input-receipt"
              />
              
              {previewUrl ? (
                <div className="space-y-4">
                  <div className="relative inline-block">
                    <img
                      src={previewUrl}
                      alt="Receipt preview"
                      className="max-h-48 rounded-lg border"
                      data-testid="img-preview"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      onClick={handleClearFile}
                      data-testid="button-clear-file"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm font-medium" data-testid="text-file-name">
                    {selectedFile?.name}
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid="text-file-size">
                    {selectedFile && (selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <label htmlFor="receipt-upload" className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm font-medium mb-1">
                    Drop your receipt here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports JPEG, PNG, and PDF files (max 10MB)
                  </p>
                </label>
              )}
            </div>

            {selectedFile && (
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium">
                  Category
                </Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger id="category" data-testid="select-category">
                    <Tag className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat} data-testid={`option-${cat.toLowerCase()}`}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={handlePreview}
              disabled={!selectedFile || previewMutation.isPending || !!ocrResult}
              className="w-full"
              data-testid="button-preview"
            >
              {previewMutation.isPending ? "Processing..." : "Scan Receipt"}
            </Button>
          </CardContent>
        </Card>

        {ocrResult && editedData && !savedPurchase && (
          <Card data-testid="card-ocr-review">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Edit className="h-5 w-5" />
                  Review & Edit OCR Results
                </CardTitle>
                <Badge 
                  variant={ocrResult.confidence === 'high' ? 'default' : ocrResult.confidence === 'medium' ? 'secondary' : 'outline'}
                  className="text-xs"
                  title={`OCR confidence: ${ocrResult.confidence}`}
                  data-testid="badge-ocr-confidence"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  {ocrResult.confidence} confidence
                </Badge>
              </div>
              <CardDescription>
                Verify the extracted information and make corrections if needed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-merchant" className="flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    Merchant
                  </Label>
                  <Input
                    id="edit-merchant"
                    value={editedData.merchant}
                    onChange={(e) => setEditedData({ ...editedData, merchant: e.target.value })}
                    placeholder="Merchant name"
                    data-testid="input-edit-merchant"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-date" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Purchase Date
                    </Label>
                    <Input
                      id="edit-date"
                      type="date"
                      value={editedData.date}
                      onChange={(e) => setEditedData({ ...editedData, date: e.target.value })}
                      data-testid="input-edit-date"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-total" className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Total Amount
                    </Label>
                    <Input
                      id="edit-total"
                      type="number"
                      step="0.01"
                      value={editedData.total}
                      onChange={(e) => setEditedData({ ...editedData, total: e.target.value })}
                      placeholder="0.00"
                      data-testid="input-edit-total"
                    />
                  </div>
                </div>

                <div className="p-3 bg-muted rounded-md space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Computed Deadlines
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Return By (30 days)</p>
                      <p className="font-medium" data-testid="text-computed-return">
                        {computedDeadlines ? new Date(computedDeadlines.returnBy).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Warranty Ends (12 months)</p>
                      <p className="font-medium" data-testid="text-computed-warranty">
                        {computedDeadlines ? new Date(computedDeadlines.warrantyEnds).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleConfirm}
                disabled={confirmMutation.isPending || !editedData.merchant || !editedData.date || !editedData.total}
                className="w-full"
                data-testid="button-confirm"
              >
                <Check className="mr-2 h-4 w-4" />
                {confirmMutation.isPending ? "Saving..." : "Save Receipt"}
              </Button>

              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  View Raw OCR Text
                </summary>
                <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-auto max-h-40" data-testid="text-raw-ocr">
                  {ocrResult.rawText}
                </pre>
              </details>
            </CardContent>
          </Card>
        )}

        {savedPurchase && (
          <Card data-testid="card-saved">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <FileText className="h-5 w-5" />
                Receipt Saved
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Store className="h-4 w-4" />
                    Merchant
                  </div>
                  <p className="font-medium" data-testid="text-saved-merchant">
                    {savedPurchase.merchant}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Purchase Date
                  </div>
                  <p className="font-medium" data-testid="text-saved-date">
                    {new Date(savedPurchase.date).toLocaleDateString()}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    Total
                  </div>
                  <p className="font-medium" data-testid="text-saved-total">
                    ${savedPurchase.total}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Return By
                  </div>
                  <p className="font-medium" data-testid="text-saved-return">
                    {new Date(savedPurchase.returnBy).toLocaleDateString()}
                  </p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Warranty Ends
                  </div>
                  <p className="font-medium" data-testid="text-saved-warranty">
                    {new Date(savedPurchase.warrantyEnds).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <Button
                onClick={handleCreateClaim}
                className="w-full"
                data-testid="button-create-claim"
              >
                Create Return Claim
              </Button>
            </CardContent>
          </Card>
        )}

        <Dialog open={showCamera} onOpenChange={(open) => !open && closeCamera()}>
          <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
            <div className="p-4 border-b bg-background">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Capture Receipt
                </DialogTitle>
                <DialogDescription>
                  Position the entire receipt within the frame for best results
                </DialogDescription>
              </DialogHeader>
            </div>
            
            <div className="relative">
              <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  data-testid="video-camera"
                />
                
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-4 sm:inset-8 border-2 border-white/60 rounded-lg">
                    <div className="absolute -top-px -left-px w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
                    <div className="absolute -top-px -right-px w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
                    <div className="absolute -bottom-px -left-px w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
                    <div className="absolute -bottom-px -right-px w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
                  </div>
                  
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5" data-testid="text-camera-guidance">
                    <Focus className="h-3 w-3" />
                    Align receipt edges with the frame
                  </div>
                </div>
                
                {flashSupported && (
                  <Button
                    onClick={toggleFlash}
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                    data-testid="button-flash"
                  >
                    {flashEnabled ? (
                      <Flashlight className="h-5 w-5 text-yellow-400" />
                    ) : (
                      <FlashlightOff className="h-5 w-5" />
                    )}
                  </Button>
                )}
              </div>
              
              <div className="p-3 bg-muted/50 border-t" data-testid="container-camera-tips">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium text-foreground" data-testid="text-tips-title">Tips for best results:</p>
                    <ul className="space-y-0.5" data-testid="list-camera-tips">
                      <li>Place receipt on a flat, contrasting surface</li>
                      <li>Ensure good lighting (use flash if needed)</li>
                      <li>Keep camera steady and parallel to receipt</li>
                      <li>Make sure all text is readable and not blurry</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 p-4 border-t bg-background">
              <Button
                onClick={capturePhoto}
                className="flex-1"
                size="lg"
                data-testid="button-capture"
              >
                <Camera className="h-5 w-5 mr-2" />
                Capture Photo
              </Button>
              <Button
                onClick={closeCamera}
                variant="outline"
                size="lg"
                data-testid="button-cancel-camera"
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
