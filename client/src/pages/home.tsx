import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useImageQuality, type ImageQualityResult } from "@/hooks/use-image-quality";
import { savePendingUpload, saveReceiptOffline } from "@/lib/indexedDB";
import { Upload, FileText, Clock, DollarSign, Store, Calendar, X, Tag, Camera, Edit, Check, Sparkles, WifiOff, Flashlight, FlashlightOff, Focus, Info, CheckCircle, AlertTriangle, XCircle, Plus, RotateCcw, Mail, AlertCircle } from "lucide-react";
import { CATEGORIES, type Purchase, type ConfidenceLevel, REFUND_TYPES } from "@shared/schema";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Policy data interface
interface PolicyData {
  returnPolicyDays: number | null;
  returnPolicyTerms: string | null;
  refundType: 'full' | 'store_credit' | 'exchange_only' | 'partial' | 'none' | null;
  exchangePolicyDays: number | null;
  exchangePolicyTerms: string | null;
  warrantyMonths: number | null;
  warrantyTerms: string | null;
  policySource: 'extracted' | 'user_entered' | 'merchant_default';
}

const defaultPolicies: PolicyData = {
  returnPolicyDays: null,
  returnPolicyTerms: null,
  refundType: null,
  exchangePolicyDays: null,
  exchangePolicyTerms: null,
  warrantyMonths: null,
  warrantyTerms: null,
  policySource: 'merchant_default',
};

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("Other");
  const [isDragging, setIsDragging] = useState(false);
  const [inputMode, setInputMode] = useState<"scan" | "email">("scan");
  const [emailText, setEmailText] = useState("");
  const [ocrResult, setOcrResult] = useState<{
    merchant: string;
    date: string;
    total: string;
    returnBy: string;
    warrantyEnds: string;
    confidence: ConfidenceLevel;
    rawText: string;
    sourceType?: string;
    policies?: PolicyData;
    vatAmount?: number | null;
    vatSource?: 'extracted' | 'calculated' | 'none';
    invoiceNumber?: string | null;
  } | null>(null);
  const [editedData, setEditedData] = useState<{
    merchant: string;
    date: string;
    total: string;
  } | null>(null);
  const [editedPolicies, setEditedPolicies] = useState<PolicyData>(defaultPolicies);
  const [showPolicyEditor, setShowPolicyEditor] = useState(false);
  const [savedPurchase, setSavedPurchase] = useState<Purchase | null>(null);

  // Compute deadlines based on edited date and policy values
  const computedDeadlines = editedData?.date ? (() => {
    const purchaseDate = new Date(editedData.date);
    const returnDays = editedPolicies.returnPolicyDays || 30;
    const warrantyMonthsValue = editedPolicies.warrantyMonths || 12;
    
    const returnBy = new Date(purchaseDate);
    returnBy.setDate(returnBy.getDate() + returnDays);
    const warrantyEnds = new Date(purchaseDate);
    warrantyEnds.setMonth(warrantyEnds.getMonth() + warrantyMonthsValue);
    return {
      returnBy: returnBy.toISOString().split('T')[0],
      warrantyEnds: warrantyEnds.toISOString().split('T')[0]
    };
  })() : null;
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [flashSupported, setFlashSupported] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [isFocusing, setIsFocusing] = useState(false);
  const [focusLocked, setFocusLocked] = useState(false);
  const [captureMode, setCaptureMode] = useState<"single" | "multi">("single");
  const [multiPartCaptures, setMultiPartCaptures] = useState<{ blob: Blob; section: string }[]>([]);
  const [currentSection, setCurrentSection] = useState<"top" | "middle" | "bottom">("top");
  const [previewQuality, setPreviewQuality] = useState<ImageQualityResult | null>(null);
  const [showQualityPreview, setShowQualityPreview] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const { toast } = useToast();
  const { analyzeImage, resetQuality } = useImageQuality();
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [ocrError, setOcrError] = useState<{
    message: string;
    suggestion: string;
    canRetry: boolean;
    errorType?: string;
  } | null>(null);

  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("receipt", file);
      
      const response = await fetch("/api/receipts/preview", {
        method: "POST",
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw {
          message: data.error || "OCR processing failed",
          suggestion: data.suggestion || "Please try again",
          canRetry: data.canRetry !== false,
          errorType: data.errorType,
          isOcrError: true
        };
      }
      
      return data;
    },
    onSuccess: (data) => {
      setOcrError(null);
      setOcrResult(data.ocrData);
      setEditedData({
        merchant: data.ocrData.merchant || "",
        date: data.ocrData.date || "",
        total: data.ocrData.total || "",
      });
      
      // Set policies from OCR if extracted
      if (data.ocrData.policies) {
        setEditedPolicies(data.ocrData.policies);
      } else {
        setEditedPolicies(defaultPolicies);
      }
      
      if (data.ocrData.hasPartialData) {
        toast({
          title: "Partial scan complete",
          description: data.ocrData.partialDataMessage || "Some fields need manual entry",
        });
      } else {
        toast({
          title: "Receipt scanned",
          description: "Review and edit the extracted data below",
        });
      }
    },
    onError: (error: any) => {
      if (error.isOcrError) {
        setOcrError({
          message: error.message,
          suggestion: error.suggestion,
          canRetry: error.canRetry,
          errorType: error.errorType
        });
      } else {
        setOcrError({
          message: "Something went wrong",
          suggestion: "Please try again or enter details manually",
          canRetry: true
        });
      }
      toast({
        title: "Scan failed",
        description: error.message || "OCR processing failed",
        variant: "destructive",
      });
    },
  });

  const emailParseMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await fetch("/api/receipts/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text, source: "email_paste" }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw {
          message: data.error || "Failed to parse email",
          suggestion: data.suggestion || "Please check the email content",
          canRetry: data.canRetry !== false,
          isOcrError: true
        };
      }
      
      return data;
    },
    onSuccess: (data) => {
      setOcrError(null);
      setOcrResult({
        ...data.ocrData,
        sourceType: 'email_paste'
      });
      setEditedData({
        merchant: data.ocrData.merchant || "",
        date: data.ocrData.date || "",
        total: data.ocrData.total?.toString() || "",
      });
      
      // Set policies from email parsing if extracted
      if (data.ocrData.policies) {
        setEditedPolicies(data.ocrData.policies);
      } else {
        setEditedPolicies(defaultPolicies);
      }
      
      if (data.ocrData.hasPartialData) {
        toast({
          title: "Partial extraction",
          description: data.ocrData.partialDataMessage || "Some fields need manual entry",
        });
      } else {
        toast({
          title: "Email parsed",
          description: "Review and edit the extracted data below",
        });
      }
    },
    onError: (error: any) => {
      if (error.isOcrError) {
        setOcrError({
          message: error.message,
          suggestion: error.suggestion,
          canRetry: error.canRetry,
        });
      } else {
        setOcrError({
          message: "Something went wrong",
          suggestion: "Please check your email content and try again",
          canRetry: true
        });
      }
      toast({
        title: "Parsing failed",
        description: error.message || "Could not parse email content",
        variant: "destructive",
      });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!ocrResult || !editedData) {
        throw new Error("No data to save");
      }
      
      const isEmailReceipt = ocrResult.sourceType === 'email_paste' || !selectedFile;
      
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
        
        if (selectedFile) {
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
        }
        
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
          policies: editedPolicies,
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
          
          if (selectedFile) {
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
          }
          
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
    setOcrError(null);
    setEditedPolicies(defaultPolicies);
    setShowPolicyEditor(false);
    
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
    setOcrError(null);
    setOcrResult(null);
    setEditedData(null);
    setEditedPolicies(defaultPolicies);
    setShowPolicyEditor(false);
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
      const videoConstraints: MediaTrackConstraints & { focusMode?: string } = {
          facingMode: "environment",
          width: { ideal: 3840, min: 1920 },
          height: { ideal: 2160, min: 1080 },
          aspectRatio: { ideal: 4/3 },
        };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });
      
      const videoTrack = mediaStream.getVideoTracks()[0];
      try {
        await videoTrack.applyConstraints({
          advanced: [{ focusMode: 'continuous' } as any]
        });
      } catch {
      }
      
      setStream(mediaStream);
      setShowCamera(true);
      setFlashEnabled(false);
      setFocusPoint(null);
      setFocusLocked(false);
      
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

  const handleTapToFocus = async (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!stream || !videoRef.current) return;
    
    const videoElement = videoRef.current;
    const rect = videoElement.getBoundingClientRect();
    
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    
    setFocusPoint({ x, y });
    setIsFocusing(true);
    setFocusLocked(false);
    
    const videoTrack = stream.getVideoTracks()[0];
    const capabilities = videoTrack.getCapabilities?.() as any;
    
    if (capabilities?.focusMode?.includes('manual') || capabilities?.focusMode?.includes('single-shot')) {
      try {
        const focusX = (clientX - rect.left) / rect.width;
        const focusY = (clientY - rect.top) / rect.height;
        
        await videoTrack.applyConstraints({
          advanced: [{
            focusMode: 'single-shot',
            pointsOfInterest: [{ x: focusX, y: focusY }]
          } as any]
        });
      } catch (err) {
        console.log('Focus point not supported, using continuous focus');
      }
    }
    
    setTimeout(() => {
      setIsFocusing(false);
      setFocusLocked(true);
    }, 800);
    
    setTimeout(() => {
      setFocusPoint(null);
      setFocusLocked(false);
    }, 2500);
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
    setCaptureMode("single");
    setMultiPartCaptures([]);
    setCurrentSection("top");
    setShowQualityPreview(false);
    setCapturedPreview(null);
    setPreviewQuality(null);
    resetQuality();
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
        
        const quality = analyzeImage(canvas);
        setPreviewQuality(quality);
        setCapturedPreview(canvas.toDataURL('image/jpeg', 0.95));
        setShowQualityPreview(true);
      }
    }
  };

  const confirmCapture = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    
    canvas.toBlob((blob) => {
      if (blob) {
        if (captureMode === "multi") {
          const newCapture = { blob, section: currentSection };
          const updatedCaptures = [...multiPartCaptures, newCapture];
          setMultiPartCaptures(updatedCaptures);
          
          if (currentSection === "bottom" || updatedCaptures.length >= 3) {
            finalizeMultiPartCapture(updatedCaptures);
          } else {
            if (currentSection === "top") {
              setCurrentSection("middle");
            } else if (currentSection === "middle") {
              setCurrentSection("bottom");
            }
            
            setShowQualityPreview(false);
            setCapturedPreview(null);
            setPreviewQuality(null);
          }
        } else {
          const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' });
          handleFileSelect(file);
          closeCamera();
        }
      }
    }, 'image/jpeg', 0.95);
  };

  const retakePhoto = () => {
    setShowQualityPreview(false);
    setCapturedPreview(null);
    setPreviewQuality(null);
  };

  const finalizeMultiPartCapture = (captures: { blob: Blob; section: string }[]) => {
    if (captures.length === 0) return;
    
    const firstCapture = captures[0];
    const file = new File([firstCapture.blob], `receipt-multi-${Date.now()}.jpg`, { type: 'image/jpeg' });
    
    if (captures.length > 1) {
      toast({
        title: "Multi-part capture complete",
        description: `Captured ${captures.length} sections. Processing first section for OCR. Full stitching coming soon.`,
      });
    }
    
    handleFileSelect(file);
    closeCamera();
  };

  const resetMultiPartCapture = () => {
    setMultiPartCaptures([]);
    setCurrentSection("top");
    setShowQualityPreview(false);
    setCapturedPreview(null);
    setPreviewQuality(null);
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
              Add Receipt
            </CardTitle>
            <CardDescription>
              Scan a physical receipt or paste from an email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={inputMode} onValueChange={(v) => {
              setInputMode(v as "scan" | "email");
              setOcrError(null);
              setOcrResult(null);
              setEditedData(null);
              setEditedPolicies(defaultPolicies);
              setShowPolicyEditor(false);
            }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="scan" data-testid="tab-scan" className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Scan Receipt
                </TabsTrigger>
                <TabsTrigger value="email" data-testid="tab-email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Receipt
                </TabsTrigger>
              </TabsList>

              <TabsContent value="scan" className="space-y-4 mt-4">
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
              </TabsContent>

              <TabsContent value="email" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="email-text" className="text-sm font-medium">
                    Paste your email receipt
                  </Label>
                  <Textarea
                    id="email-text"
                    placeholder="Copy and paste the entire email content here. This works with order confirmations, digital receipts, and purchase emails..."
                    className="min-h-[200px] resize-y"
                    value={emailText}
                    onChange={(e) => setEmailText(e.target.value)}
                    data-testid="textarea-email"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tip: Select all (Ctrl+A) and copy (Ctrl+C) from your email, then paste here
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email-category" className="text-sm font-medium">
                    Category
                  </Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger id="email-category" data-testid="select-email-category">
                      <Tag className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat} data-testid={`option-email-${cat.toLowerCase()}`}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => emailParseMutation.mutate(emailText)}
                    disabled={emailText.trim().length < 20 || emailParseMutation.isPending || !!ocrResult}
                    className="flex-1"
                    data-testid="button-parse-email"
                  >
                    {emailParseMutation.isPending ? "Processing..." : "Parse Email"}
                  </Button>
                  {emailText && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEmailText("");
                        setOcrError(null);
                      }}
                      data-testid="button-clear-email"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {ocrError && (
              <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg space-y-3" data-testid="container-ocr-error">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium text-destructive" data-testid="text-ocr-error-title">
                      {ocrError.message}
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid="text-ocr-error-suggestion">
                      {ocrError.suggestion}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  {ocrError.canRetry && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setOcrError(null);
                        if (selectedFile) previewMutation.mutate(selectedFile);
                      }}
                      data-testid="button-retry-ocr"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Retry Scan
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOcrError(null);
                      setOcrResult({
                        merchant: "",
                        date: "",
                        total: "",
                        confidence: "low",
                        rawText: "",
                        returnBy: "",
                        warrantyEnds: "",
                      });
                      setEditedData({
                        merchant: "",
                        date: new Date().toISOString().split('T')[0],
                        total: "",
                      });
                    }}
                    data-testid="button-manual-entry"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Enter Manually
                  </Button>
                </div>
              </div>
            )}
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

                {ocrResult?.invoiceNumber ? (
                  <div className="space-y-2">
                    <Label htmlFor="edit-invoice" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Invoice / Receipt Number
                      <Badge variant="secondary" className="text-[10px]">Auto-detected</Badge>
                    </Label>
                    <Input
                      id="edit-invoice"
                      value={ocrResult.invoiceNumber}
                      readOnly
                      className="bg-muted cursor-not-allowed"
                      data-testid="input-edit-invoice"
                    />
                  </div>
                ) : (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md space-y-2" data-testid="alert-no-invoice">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <p className="text-sm font-medium">Invoice/Order Number Required</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      No invoice or order number was detected on this receipt. Please reload the receipt with better lighting or use a clearer image.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setOcrResult(null);
                        setEditedData(null);
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      className="mt-2"
                      data-testid="button-reload-receipt"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reload Receipt
                    </Button>
                  </div>
                )}

                <div className="p-3 bg-muted rounded-md space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Computed Deadlines
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Return By ({editedPolicies.returnPolicyDays || 30} days)</p>
                      <p className="font-medium" data-testid="text-computed-return">
                        {computedDeadlines ? new Date(computedDeadlines.returnBy).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Warranty Ends ({editedPolicies.warrantyMonths || 12} months)</p>
                      <p className="font-medium" data-testid="text-computed-warranty">
                        {computedDeadlines ? new Date(computedDeadlines.warrantyEnds).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Policy Section */}
                <div className="p-3 border rounded-md space-y-3" data-testid="section-policies">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      Store Policies
                      {editedPolicies.policySource === 'extracted' && (
                        <Badge variant="secondary" className="text-[10px]" data-testid="badge-policy-extracted">Auto-detected</Badge>
                      )}
                      {editedPolicies.policySource === 'user_entered' && (
                        <Badge variant="outline" className="text-[10px]" data-testid="badge-policy-user-entered">Edited</Badge>
                      )}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPolicyEditor(!showPolicyEditor)}
                      data-testid="button-toggle-policies"
                    >
                      <Edit className="h-3.5 w-3.5 mr-1" />
                      {showPolicyEditor ? 'Hide' : 'Edit'}
                    </Button>
                  </div>
                  
                  {/* No Policies Detected Message */}
                  {!editedPolicies.returnPolicyDays && !editedPolicies.warrantyMonths && editedPolicies.policySource !== 'user_entered' && (
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2" data-testid="alert-no-policies">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>No policies detected. Click Edit to add return/warranty information.</span>
                    </div>
                  )}
                  
                  {/* Policy Summary */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Return Policy</p>
                      <p className="font-medium" data-testid="text-return-policy">
                        {editedPolicies.returnPolicyDays ? `${editedPolicies.returnPolicyDays} days` : 'Not specified'}
                        {editedPolicies.refundType && ` (${editedPolicies.refundType.replace('_', ' ')})`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Warranty</p>
                      <p className="font-medium" data-testid="text-warranty-policy">
                        {editedPolicies.warrantyMonths ? `${editedPolicies.warrantyMonths} months` : 'Not specified'}
                      </p>
                    </div>
                  </div>

                  {/* Policy Editor (collapsible) */}
                  {showPolicyEditor && (
                    <div className="space-y-3 pt-2 border-t" data-testid="section-policy-editor">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="return-days" className="text-xs">Return Period (days)</Label>
                          <Input
                            id="return-days"
                            type="number"
                            min="0"
                            max="365"
                            value={editedPolicies.returnPolicyDays ?? ''}
                            onChange={(e) => setEditedPolicies({
                              ...editedPolicies,
                              returnPolicyDays: e.target.value ? parseInt(e.target.value) : null,
                              policySource: 'user_entered'
                            })}
                            placeholder="30"
                            data-testid="input-return-days"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="refund-type" className="text-xs">Refund Type</Label>
                          <Select
                            value={editedPolicies.refundType || ''}
                            onValueChange={(value) => setEditedPolicies({
                              ...editedPolicies,
                              refundType: value as PolicyData['refundType'],
                              policySource: 'user_entered'
                            })}
                          >
                            <SelectTrigger id="refund-type" data-testid="select-refund-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full">Full Refund</SelectItem>
                              <SelectItem value="store_credit">Store Credit</SelectItem>
                              <SelectItem value="exchange_only">Exchange Only</SelectItem>
                              <SelectItem value="partial">Partial Refund</SelectItem>
                              <SelectItem value="none">No Refund</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="exchange-days" className="text-xs">Exchange Period (days)</Label>
                          <Input
                            id="exchange-days"
                            type="number"
                            min="0"
                            max="365"
                            value={editedPolicies.exchangePolicyDays ?? ''}
                            onChange={(e) => setEditedPolicies({
                              ...editedPolicies,
                              exchangePolicyDays: e.target.value ? parseInt(e.target.value) : null,
                              policySource: 'user_entered'
                            })}
                            placeholder="30"
                            data-testid="input-exchange-days"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="warranty-months" className="text-xs">Warranty (months)</Label>
                          <Input
                            id="warranty-months"
                            type="number"
                            min="0"
                            max="120"
                            value={editedPolicies.warrantyMonths ?? ''}
                            onChange={(e) => setEditedPolicies({
                              ...editedPolicies,
                              warrantyMonths: e.target.value ? parseInt(e.target.value) : null,
                              policySource: 'user_entered'
                            })}
                            placeholder="12"
                            data-testid="input-warranty-months"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="policy-notes" className="text-xs">Policy Notes (optional)</Label>
                        <Input
                          id="policy-notes"
                          value={editedPolicies.returnPolicyTerms ?? ''}
                          onChange={(e) => setEditedPolicies({
                            ...editedPolicies,
                            returnPolicyTerms: e.target.value || null,
                            policySource: 'user_entered'
                          })}
                          placeholder="e.g., Original packaging required"
                          data-testid="input-policy-notes"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setOcrResult(null);
                    setEditedData(null);
                    setEditedPolicies(defaultPolicies);
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    setOcrError(null);
                  }}
                  className="flex-1"
                  data-testid="button-cancel"
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={confirmMutation.isPending || !editedData.merchant || !editedData.date || !editedData.total || !ocrResult?.invoiceNumber}
                  className="flex-1"
                  data-testid="button-confirm"
                >
                  <Check className="mr-2 h-4 w-4" />
                  {confirmMutation.isPending ? "Saving..." : "Accept & Save"}
                </Button>
              </div>

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
                  {showQualityPreview ? "Review Photo Quality" : "Capture Receipt"}
                </DialogTitle>
                <DialogDescription>
                  {showQualityPreview 
                    ? "Check the image quality before processing" 
                    : captureMode === "multi" 
                      ? `Capture ${currentSection} section of receipt (${multiPartCaptures.length + 1}/3)`
                      : "Position the entire receipt within the frame for best results"
                  }
                </DialogDescription>
              </DialogHeader>
            </div>
            
            {!showQualityPreview && (
              <div className="flex gap-2 p-3 border-b bg-muted/30">
                <Button
                  variant={captureMode === "single" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setCaptureMode("single"); resetMultiPartCapture(); }}
                  data-testid="button-single-mode"
                >
                  Single Photo
                </Button>
                <Button
                  variant={captureMode === "multi" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setCaptureMode("multi"); resetMultiPartCapture(); }}
                  data-testid="button-multi-mode"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Long Receipt (Multi-Part)
                </Button>
                {captureMode === "multi" && multiPartCaptures.length > 0 && (
                  <div className="flex items-center gap-1 ml-auto">
                    {["top", "middle", "bottom"].map((section) => (
                      <Badge 
                        key={section}
                        variant={multiPartCaptures.some(c => c.section === section) ? "default" : "outline"}
                        className="text-xs"
                      >
                        {section}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <div className="relative">
              {showQualityPreview && capturedPreview ? (
                <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>
                  <img 
                    src={capturedPreview} 
                    alt="Captured receipt" 
                    className="w-full h-full object-contain"
                    data-testid="img-preview"
                  />
                </div>
              ) : (
                <div 
                  className="relative bg-black cursor-crosshair" 
                  style={{ aspectRatio: '4/3' }}
                  onClick={handleTapToFocus}
                  onTouchStart={handleTapToFocus}
                  data-testid="container-camera-view"
                >
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
                      {captureMode === "multi" 
                        ? `Capture the ${currentSection.toUpperCase()} of the receipt`
                        : "Tap to focus on receipt"
                      }
                    </div>
                  </div>
                  
                  {focusPoint && (
                    <div 
                      className="absolute pointer-events-none z-10"
                      style={{ 
                        left: `${focusPoint.x}%`, 
                        top: `${focusPoint.y}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                      data-testid="focus-indicator"
                    >
                      <div className={`relative ${isFocusing ? 'animate-pulse' : ''}`}>
                        <div className={`w-16 h-16 border-2 rounded-lg transition-all duration-300 ${
                          focusLocked 
                            ? 'border-green-400 scale-90' 
                            : isFocusing 
                              ? 'border-yellow-400 scale-110' 
                              : 'border-white'
                        }`}>
                          <div className="absolute top-1/2 left-0 w-3 h-0.5 transform -translate-y-1/2" 
                               style={{ backgroundColor: focusLocked ? '#4ade80' : isFocusing ? '#facc15' : 'white' }} />
                          <div className="absolute top-1/2 right-0 w-3 h-0.5 transform -translate-y-1/2" 
                               style={{ backgroundColor: focusLocked ? '#4ade80' : isFocusing ? '#facc15' : 'white' }} />
                          <div className="absolute left-1/2 top-0 w-0.5 h-3 transform -translate-x-1/2" 
                               style={{ backgroundColor: focusLocked ? '#4ade80' : isFocusing ? '#facc15' : 'white' }} />
                          <div className="absolute left-1/2 bottom-0 w-0.5 h-3 transform -translate-x-1/2" 
                               style={{ backgroundColor: focusLocked ? '#4ade80' : isFocusing ? '#facc15' : 'white' }} />
                        </div>
                        {focusLocked && (
                          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap">
                            Focused
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {!focusPoint && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
                      <div className="w-20 h-20 border border-white/30 rounded-lg flex items-center justify-center">
                        <div className="w-1 h-1 bg-white/50 rounded-full" />
                      </div>
                    </div>
                  )}
                  
                  {flashSupported && (
                    <Button
                      onClick={(e) => { e.stopPropagation(); toggleFlash(); }}
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
              )}
              
              {showQualityPreview && previewQuality ? (
                <div className="p-4 bg-muted/50 border-t space-y-3" data-testid="container-quality-feedback">
                  <div className="flex items-center gap-3">
                    {previewQuality.status === "good" ? (
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    ) : previewQuality.status === "acceptable" ? (
                      <AlertTriangle className="h-6 w-6 text-yellow-500" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-500" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium" data-testid="text-quality-status">
                        {previewQuality.status === "good" 
                          ? "Great quality! Ready to scan." 
                          : previewQuality.status === "acceptable"
                            ? "Acceptable quality. May need manual corrections."
                            : "Poor quality. Consider retaking."
                        }
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={previewQuality.overallScore} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground">{previewQuality.overallScore}%</span>
                      </div>
                    </div>
                  </div>
                  
                  {previewQuality.issues.length > 0 && (
                    <div className="text-sm space-y-1">
                      <p className="font-medium text-muted-foreground">Issues detected:</p>
                      <ul className="space-y-1" data-testid="list-quality-issues">
                        {previewQuality.issues.map((issue, i) => (
                          <li key={i} className="flex items-center gap-2 text-muted-foreground">
                            <AlertTriangle className="h-3 w-3 text-yellow-500" />
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {previewQuality.suggestions.length > 0 && previewQuality.status !== "good" && (
                    <div className="text-sm space-y-1">
                      <p className="font-medium text-muted-foreground">Suggestions:</p>
                      <ul className="space-y-1" data-testid="list-quality-suggestions">
                        {previewQuality.suggestions.map((suggestion, i) => (
                          <li key={i} className="flex items-center gap-2 text-muted-foreground">
                            <Info className="h-3 w-3 text-blue-500" />
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
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
              )}
            </div>
            
            <div className="flex gap-2 p-4 border-t bg-background">
              {showQualityPreview ? (
                <>
                  <Button
                    onClick={retakePhoto}
                    variant="outline"
                    size="lg"
                    data-testid="button-retake"
                  >
                    <RotateCcw className="h-5 w-5 mr-2" />
                    Retake
                  </Button>
                  <Button
                    onClick={confirmCapture}
                    className="flex-1"
                    size="lg"
                    data-testid="button-confirm-capture"
                  >
                    {previewQuality?.status === "poor" ? (
                      <>
                        <AlertTriangle className="h-5 w-5 mr-2" />
                        Use Anyway
                      </>
                    ) : (
                      <>
                        <Check className="h-5 w-5 mr-2" />
                        {captureMode === "multi" && currentSection !== "bottom" 
                          ? `Confirm & Capture ${currentSection === "top" ? "Middle" : "Bottom"}`
                          : "Confirm & Scan"
                        }
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
