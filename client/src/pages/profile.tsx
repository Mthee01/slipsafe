import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { User, LogOut, Upload, Lock, Save, Building2, CreditCard, Sparkles, ExternalLink } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import type { UpdateUserProfile, ChangePassword, BusinessProfile, UpdateBusinessProfile } from "@shared/schema";

interface SubscriptionData {
  planType: "free" | "business_solo" | "business_pro" | "enterprise" | null;
  subscriptionStatus: string | null;
  billingInterval: "monthly" | "annual" | null;
  subscriptionCurrentPeriodEnd: string | null;
  businessReceiptLimitPerMonth: number | null;
  businessUserLimit: number | null;
}

export default function Profile() {
  const { user, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isBusiness = (user as any)?.accountType === "business";

  const [profileData, setProfileData] = useState<UpdateUserProfile>({
    email: "",
    phone: "",
    homeAddress: "",
    idNumber: "",
  });

  const [businessData, setBusinessData] = useState<UpdateBusinessProfile>({
    businessName: "",
    taxId: "",
    vatNumber: "",
    registrationNumber: "",
    address: "",
    phone: "",
    email: "",
    invoicePrefix: "INV",
  });

  const { data: businessProfileData, isLoading: isLoadingBusinessProfile } = useQuery<{ profile: BusinessProfile | null }>({
    queryKey: ["/api/users/business-profile"],
    enabled: isBusiness,
  });

  const { data: subscription } = useQuery<SubscriptionData>({
    queryKey: ["/api/billing/subscription"],
    enabled: !!user,
  });

  const billingPortalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/billing/portal-session");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        email: (user as any)?.email || "",
        phone: (user as any)?.phone || "",
        homeAddress: (user as any)?.homeAddress || "",
        idNumber: (user as any)?.idNumber || "",
      });
    }
  }, [user]);

  useEffect(() => {
    if (businessProfileData?.profile) {
      const bp = businessProfileData.profile;
      setBusinessData({
        businessName: bp.businessName || "",
        taxId: bp.taxId || "",
        vatNumber: bp.vatNumber || "",
        registrationNumber: bp.registrationNumber || "",
        address: bp.address || "",
        phone: bp.phone || "",
        email: bp.email || "",
        invoicePrefix: bp.invoicePrefix || "INV",
      });
    }
  }, [businessProfileData]);

  const [passwordData, setPasswordData] = useState<ChangePassword>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateUserProfile) => {
      return apiRequest("PUT", "/api/users/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const uploadPictureMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("picture", file);
      const res = await fetch("/api/users/profile/picture", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Upload failed");
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      toast({
        title: "Picture uploaded",
        description: "Your profile picture has been updated successfully",
      });
      setSelectedFile(null);
      setPreviewUrl(null);
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload profile picture",
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePassword) => {
      return apiRequest("POST", "/api/users/change-password", data);
    },
    onSuccess: () => {
      toast({
        title: "Password changed",
        description: "Your password has been changed successfully",
      });
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Password change failed",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  const updateBusinessProfileMutation = useMutation({
    mutationFn: async (data: UpdateBusinessProfile) => {
      return apiRequest("PUT", "/api/users/business-profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/business-profile"] });
      toast({
        title: "Business profile updated",
        description: "Your business information has been saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update business profile",
        variant: "destructive",
      });
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileData);
  };

  const handleBusinessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateBusinessProfileMutation.mutate(businessData);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your new passwords match",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate(passwordData);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePictureUpload = () => {
    if (selectedFile) {
      uploadPictureMutation.mutate(selectedFile);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const userInitials = user.username?.substring(0, 2).toUpperCase() || "??";

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and personal information
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20" data-testid="avatar-profile">
              <AvatarImage src={previewUrl || (user as any).profilePicture || undefined} alt={user.username} />
              <AvatarFallback className="text-2xl">{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle>Profile Picture</CardTitle>
              <CardDescription>Upload a profile picture to personalize your account</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              data-testid="input-profile-picture"
              className="flex-1"
            />
            <Button
              onClick={handlePictureUpload}
              disabled={!selectedFile || uploadPictureMutation.isPending}
              data-testid="button-upload-picture"
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploadPictureMutation.isPending ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={user.username}
                  disabled
                  data-testid="input-username"
                />
                <p className="text-xs text-muted-foreground">Username cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={profileData.email || ""}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  autoComplete="email"
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={profileData.phone || ""}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  autoComplete="tel"
                  data-testid="input-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="idNumber">ID Number</Label>
                <Input
                  id="idNumber"
                  placeholder="National ID or Passport Number"
                  value={profileData.idNumber || ""}
                  onChange={(e) => setProfileData({ ...profileData, idNumber: e.target.value })}
                  autoComplete="off"
                  data-testid="input-id-number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="homeAddress">Home Address</Label>
              <Textarea
                id="homeAddress"
                placeholder="123 Main Street, City, State, ZIP"
                value={profileData.homeAddress || ""}
                onChange={(e) => setProfileData({ ...profileData, homeAddress: e.target.value })}
                autoComplete="street-address"
                rows={3}
                data-testid="textarea-home-address"
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                <Save className="mr-2 h-4 w-4" />
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isBusiness && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>Manage your business details for receipts and invoices</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingBusinessProfile ? (
              <div className="space-y-4">
                <div className="h-10 bg-muted animate-pulse rounded" />
                <div className="h-10 bg-muted animate-pulse rounded" />
                <div className="h-10 bg-muted animate-pulse rounded" />
              </div>
            ) : (
              <form onSubmit={handleBusinessSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name *</Label>
                    <Input
                      id="businessName"
                      placeholder="Your Business Name"
                      value={businessData.businessName || ""}
                      onChange={(e) => setBusinessData({ ...businessData, businessName: e.target.value })}
                      autoComplete="organization"
                      data-testid="input-business-name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessTaxId">Tax ID</Label>
                    <Input
                      id="businessTaxId"
                      placeholder="Tax identification number"
                      value={businessData.taxId || ""}
                      onChange={(e) => setBusinessData({ ...businessData, taxId: e.target.value })}
                      autoComplete="off"
                      data-testid="input-business-tax-id"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessVatNumber">VAT Number</Label>
                    <Input
                      id="businessVatNumber"
                      placeholder="VAT registration number"
                      value={businessData.vatNumber || ""}
                      onChange={(e) => setBusinessData({ ...businessData, vatNumber: e.target.value })}
                      autoComplete="off"
                      data-testid="input-business-vat"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessRegNumber">Registration Number</Label>
                    <Input
                      id="businessRegNumber"
                      placeholder="Company registration number"
                      value={businessData.registrationNumber || ""}
                      onChange={(e) => setBusinessData({ ...businessData, registrationNumber: e.target.value })}
                      autoComplete="off"
                      data-testid="input-business-reg"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessPhone">Business Phone</Label>
                    <Input
                      id="businessPhone"
                      type="tel"
                      placeholder="Business phone number"
                      value={businessData.phone || ""}
                      onChange={(e) => setBusinessData({ ...businessData, phone: e.target.value })}
                      autoComplete="tel"
                      data-testid="input-business-phone"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessEmail">Business Email</Label>
                    <Input
                      id="businessEmail"
                      type="email"
                      placeholder="business@example.com"
                      value={businessData.email || ""}
                      onChange={(e) => setBusinessData({ ...businessData, email: e.target.value })}
                      autoComplete="email"
                      data-testid="input-business-email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invoicePrefix">Invoice Prefix</Label>
                    <Input
                      id="invoicePrefix"
                      placeholder="INV"
                      value={businessData.invoicePrefix || "INV"}
                      onChange={(e) => setBusinessData({ ...businessData, invoicePrefix: e.target.value })}
                      autoComplete="off"
                      data-testid="input-invoice-prefix"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessAddress">Business Address</Label>
                  <Textarea
                    id="businessAddress"
                    placeholder="Business street address"
                    value={businessData.address || ""}
                    onChange={(e) => setBusinessData({ ...businessData, address: e.target.value })}
                    autoComplete="street-address"
                    rows={3}
                    data-testid="textarea-business-address"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={updateBusinessProfileMutation.isPending}
                    data-testid="button-save-business"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {updateBusinessProfileMutation.isPending ? "Saving..." : "Save Business Info"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password to keep your account secure</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="Enter your current password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                autoComplete="current-password"
                data-testid="input-current-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter your new password (minimum 6 characters)"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                autoComplete="new-password"
                data-testid="input-new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your new password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                autoComplete="new-password"
                data-testid="input-confirm-password"
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={changePasswordMutation.isPending}
                data-testid="button-change-password"
              >
                <Lock className="mr-2 h-4 w-4" />
                {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Subscription & Billing</CardTitle>
              <CardDescription>Manage your plan and payment method</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-lg" data-testid="text-current-plan">
                  {subscription?.planType === "free" && "SlipSafe Free"}
                  {subscription?.planType === "business_solo" && "Business Solo"}
                  {subscription?.planType === "business_pro" && "Business Pro"}
                  {subscription?.planType === "enterprise" && "Enterprise"}
                  {!subscription?.planType && "SlipSafe Free"}
                </span>
                {subscription?.subscriptionStatus === "active" && (
                  <Badge variant="default" className="bg-green-600">Active</Badge>
                )}
                {subscription?.subscriptionStatus === "past_due" && (
                  <Badge variant="destructive">Past Due</Badge>
                )}
                {subscription?.subscriptionStatus === "canceled" && (
                  <Badge variant="secondary">Canceled</Badge>
                )}
                {subscription?.subscriptionStatus === "trialing" && (
                  <Badge variant="secondary">Trial</Badge>
                )}
              </div>
              {subscription?.planType && subscription.planType !== "free" && (
                <div className="text-sm text-muted-foreground">
                  {subscription.billingInterval === "monthly" ? "Monthly" : "Annual"} billing
                  {subscription.subscriptionCurrentPeriodEnd && (
                    <> - Renews {new Date(subscription.subscriptionCurrentPeriodEnd).toLocaleDateString()}</>
                  )}
                </div>
              )}
              {subscription?.businessReceiptLimitPerMonth && subscription.businessReceiptLimitPerMonth > 0 && (
                <div className="text-sm text-muted-foreground">
                  {subscription.businessReceiptLimitPerMonth.toLocaleString()} business receipts/month
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {subscription?.planType && subscription.planType !== "free" ? (
                <Button
                  variant="outline"
                  onClick={() => billingPortalMutation.mutate()}
                  disabled={billingPortalMutation.isPending}
                  data-testid="button-manage-billing"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {billingPortalMutation.isPending ? "Opening..." : "Manage Billing"}
                </Button>
              ) : (
                <Link href="/pricing">
                  <Button data-testid="button-upgrade">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Upgrade to Business
                  </Button>
                </Link>
              )}
            </div>
          </div>
          {subscription?.planType === "free" && (
            <p className="text-sm text-muted-foreground">
              Upgrade to a Business plan to unlock team workspaces, advanced reporting, 
              tax/VAT summaries, and more.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Actions</CardTitle>
          <CardDescription>Manage your session</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => logout()}
            disabled={isLoggingOut}
            data-testid="button-logout-profile"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isLoggingOut ? "Logging out..." : "Log Out"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
