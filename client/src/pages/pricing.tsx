import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TermsModal } from "@/components/terms-modal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { 
  Check, 
  Crown, 
  Users, 
  Building2, 
  Sparkles, 
  ArrowRight, 
  Loader2, 
  ShieldCheck,
  Home,
  PlayCircle,
  Briefcase,
  Store,
  Tag,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Mail,
  Phone,
  User,
  MessageSquare
} from "lucide-react";
import logo from "@assets/SlipSafe Logo_1762888976121.png";

type PlanId = "solo-monthly" | "solo-annual" | "pro-monthly" | "pro-annual";
type PlanType = "free" | "business_solo" | "business_pro" | "enterprise" | null;

interface SubscriptionData {
  planType: PlanType;
  subscriptionStatus: string | null;
  billingInterval: "monthly" | "annual" | null;
}

const TERMS_VERSION = "v1.0";

interface PricingSidebarProps {
  isAuthenticated: boolean;
  user: {
    fullName?: string;
    businessName?: string | null;
    activeContext?: string;
    accountType?: string;
  } | null;
  onLogout: () => void;
}

function PricingSidebar({ isAuthenticated, user, onLogout }: PricingSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  
  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const navItems = [
    { icon: Home, label: "Home", href: "/" },
    { icon: PlayCircle, label: "How it works", href: "/" },
    { icon: Users, label: "For Individuals", href: "/" },
    { icon: Briefcase, label: "For Businesses", href: "/" },
    { icon: Store, label: "For Retailers", href: "/" },
    { icon: Tag, label: "Pricing", href: "/pricing", active: true },
    { icon: HelpCircle, label: "Help", href: "/" },
  ];

  const getDisplayName = () => {
    if (user?.activeContext === "business" && user?.businessName) {
      return user.businessName;
    }
    return user?.fullName || "User";
  };

  const getInitials = () => {
    const name = getDisplayName();
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Sidebar collapsible="icon" data-testid="pricing-sidebar">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center justify-center">
          <img src={logo} alt="SlipSafe" className="h-20 w-20 sm:h-24 sm:w-24 object-contain" data-testid="img-sidebar-logo" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item, index) => (
                <SidebarMenuItem key={index}>
                  <SidebarMenuButton asChild tooltip={item.label} isActive={item.active}>
                    <Link href={item.href} onClick={closeMobileSidebar} data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        {isAuthenticated ? (
          <>
            <div className="flex items-center gap-3 mb-3 px-2 group-data-[collapsible=icon]:justify-center">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-medium" data-testid="text-user-name">{getDisplayName()}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.activeContext === "business" ? "Business" : "Personal"}
                </p>
              </div>
            </div>
            <Link href="/" onClick={closeMobileSidebar}>
              <Button className="w-full justify-start gap-2" data-testid="button-sidebar-dashboard">
                <LayoutDashboard className="h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden">Go to Dashboard</span>
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2" 
              onClick={() => { closeMobileSidebar(); onLogout(); }}
              data-testid="button-sidebar-logout"
            >
              <LogOut className="h-4 w-4" />
              <span className="group-data-[collapsible=icon]:hidden">Sign Out</span>
            </Button>
          </>
        ) : (
          <>
            <Link href="/login" onClick={closeMobileSidebar}>
              <Button variant="ghost" className="w-full justify-start gap-2" data-testid="button-sidebar-sign-in">
                <Users className="h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden">Sign In</span>
              </Button>
            </Link>
            <Link href="/register" onClick={closeMobileSidebar}>
              <Button className="w-full justify-start gap-2" data-testid="button-sidebar-get-started">
                <ArrowRight className="h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden">Get Started Free</span>
              </Button>
            </Link>
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function PricingContent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<PlanId | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  
  // Enterprise modal state
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);
  const [isSubmittingEnterprise, setIsSubmittingEnterprise] = useState(false);
  const [enterpriseContact, setEnterpriseContact] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    teamSize: "",
    message: "",
  });

  const searchParams = new URLSearchParams(window.location.search);
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");
  const initCheckout = searchParams.get("initCheckout");
  const planIdFromUrl = searchParams.get("planId") as PlanId | null;
  const [checkoutInitiated, setCheckoutInitiated] = useState(false);

  useEffect(() => {
    if (success) {
      toast({
        title: "Subscription activated!",
        description: "Welcome to SlipSafe Business. Your subscription is now active.",
      });
      window.history.replaceState({}, "", "/pricing");
    }
    if (canceled) {
      toast({
        title: "Subscription canceled",
        description: "Your subscription process was canceled. No charges were made.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/pricing");
    }
  }, [success, canceled, toast]);

  // Auto-initiate checkout for newly registered business users
  // The user object should be available immediately after registration as the mutation sets it in cache
  useEffect(() => {
    if (initCheckout === "true" && planIdFromUrl && !checkoutInitiated) {
      // Wait for user to be available (should happen immediately after redirect from registration)
      if (user) {
        setCheckoutInitiated(true);
        window.history.replaceState({}, "", "/pricing");
        // Show T&C modal for checkout
        setPendingPlanId(planIdFromUrl);
        setShowTermsModal(true);
      }
    }
  }, [initCheckout, planIdFromUrl, user, checkoutInitiated]);

  const { data: subscription } = useQuery<SubscriptionData>({
    queryKey: ["/api/billing/subscription"],
    enabled: !!user,
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({ planId, termsAccepted: accepted }: { planId: PlanId; termsAccepted: boolean }) => {
      const response = await apiRequest("POST", "/api/billing/create-checkout-session", {
        planId,
        termsAccepted: accepted,
        termsVersion: TERMS_VERSION,
      });
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
        description: error.message || "Failed to start subscription process",
        variant: "destructive",
      });
    },
  });

  const handleSubscribe = (planId: PlanId) => {
    if (!user) {
      // Map pricing plan IDs to registration plan codes and billing intervals
      const planMapping: Record<PlanId, { plan: string; interval: string }> = {
        "solo-monthly": { plan: "BUSINESS_SOLO", interval: "monthly" },
        "solo-annual": { plan: "BUSINESS_SOLO", interval: "annual" },
        "pro-monthly": { plan: "BUSINESS_PRO", interval: "monthly" },
        "pro-annual": { plan: "BUSINESS_PRO", interval: "annual" },
      };
      const { plan, interval } = planMapping[planId];
      setLocation(`/register?accountType=business&plan=${plan}&interval=${interval}`);
      return;
    }
    
    // For authenticated users, show T&C modal before checkout
    setPendingPlanId(planId);
    setShowTermsModal(true);
  };

  const handleTermsAccepted = () => {
    if (pendingPlanId) {
      setShowTermsModal(false);
      setSelectedPlan(pendingPlanId);
      checkoutMutation.mutate({ planId: pendingPlanId, termsAccepted: true });
    }
  };

  const handleEnterpriseClick = () => {
    // Pre-fill with user data if available
    if (user) {
      setEnterpriseContact({
        name: user.fullName || "",
        email: user.email || "",
        company: user.businessName || "",
        phone: user.phone || "",
        teamSize: "",
        message: "",
      });
    }
    setShowEnterpriseModal(true);
  };

  const handleEnterpriseSubmit = async () => {
    if (!enterpriseContact.name || !enterpriseContact.email || !enterpriseContact.company) {
      toast({
        title: "Missing information",
        description: "Please fill in your name, email, and company name.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingEnterprise(true);
    
    try {
      const response = await fetch("/api/enterprise-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enterpriseContact),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Inquiry submitted",
          description: "Thank you! Our team will contact you within 1-2 business days.",
        });
        setShowEnterpriseModal(false);
        setEnterpriseContact({ name: "", email: "", company: "", phone: "", teamSize: "", message: "" });
      } else {
        // Show error if the server rejected the request - keep modal open for retry
        toast({
          title: "Submission failed",
          description: data.error || "Unable to submit your inquiry. Please try again.",
          variant: "destructive",
        });
        // Modal stays open so user can fix and retry
      }
    } catch {
      // Network error - keep modal open for retry
      toast({
        title: "Connection error",
        description: "Unable to reach the server. Please check your connection and try again.",
        variant: "destructive",
      });
      // Modal stays open so user can retry when connection is restored
    } finally {
      setIsSubmittingEnterprise(false);
    }
  };

  const currentPlan = subscription?.planType;

  const plans = [
    {
      id: "free",
      name: "SlipSafe Free",
      description: "For individuals managing personal receipts",
      price: "R0",
      period: "forever",
      features: [
        "Unlimited personal receipts",
        "OCR-based receipt scanning",
        "Return & warranty tracking",
        "Claim generation with QR codes",
        "PWA with offline support",
      ],
      cta: user ? (currentPlan === "free" ? "Current Plan" : null) : "Sign Up Free",
      ctaVariant: "outline" as const,
      icon: ShieldCheck,
      popular: false,
    },
    {
      id: "solo",
      name: "Business Solo",
      description: "For sole traders and freelancers",
      monthlyPrice: 99,
      annualPrice: 80,
      features: [
        "Everything in Free",
        "Business profile & dashboard",
        "Up to 1,000 business receipts/month",
        "Tax & VAT reporting",
        "CSV & PDF exports",
        "Email support",
      ],
      icon: Crown,
      popular: false,
      userLimit: 1,
    },
    {
      id: "pro",
      name: "Business Pro",
      description: "For teams of 2-10 people",
      monthlyPrice: 269,
      annualPrice: 229,
      features: [
        "Everything in Solo",
        "Up to 5,000 business receipts/month",
        "Team workspace with shared access",
        "Owner/manager roles",
        "Team reports & analytics",
        "Priority email support",
      ],
      icon: Users,
      popular: true,
      userLimit: 10,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      description: "Custom solutions for larger organisations",
      price: "Custom",
      features: [
        "Everything in Pro",
        "Unlimited receipts",
        "Unlimited users",
        "Custom integrations",
        "Dedicated account manager",
        "SLA with guaranteed uptime",
        "On-premise deployment options",
      ],
      cta: "Contact Us",
      ctaVariant: "outline" as const,
      icon: Building2,
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <Badge className="mb-4" variant="secondary">
            <Sparkles className="h-3 w-3 mr-1" />
            Simple, transparent pricing
          </Badge>
          <h1 className="text-4xl font-bold mb-4" data-testid="text-pricing-title">Choose Your Plan</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free for personal use. Upgrade to Business when you need professional features, 
            team collaboration, and advanced reporting for your SMME.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative flex flex-col ${plan.popular ? "border-primary shadow-lg ring-2 ring-primary/20" : ""}`}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                </div>
              )}
              
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <plan.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="flex-1">
                <div className="mb-6">
                  {plan.price ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      {plan.period && <span className="text-muted-foreground">/{plan.period}</span>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold">R{plan.monthlyPrice}</span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        or R{plan.annualPrice}/month billed annually
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Save {Math.round((1 - plan.annualPrice! / plan.monthlyPrice!) * 100)}%
                        </Badge>
                      </div>
                    </div>
                  )}
                  {plan.userLimit && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {plan.userLimit === 1 ? "1 user" : `Up to ${plan.userLimit} users`}
                    </p>
                  )}
                </div>
                
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              
              <CardFooter className="flex flex-col gap-2 pt-4">
                {plan.id === "free" && (
                  plan.cta === "Current Plan" ? (
                    <Button variant="outline" disabled className="w-full" data-testid="button-current-plan">
                      Current Plan
                    </Button>
                  ) : (
                    <Link href="/register" className="w-full">
                      <Button variant="outline" className="w-full" data-testid="button-signup-free">
                        {plan.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  )
                )}
                
                {plan.id === "solo" && (
                  <div className="w-full space-y-2">
                    <Button 
                      className="w-full"
                      onClick={() => handleSubscribe("solo-monthly")}
                      disabled={checkoutMutation.isPending || (currentPlan === "business_solo")}
                      data-testid="button-solo-monthly"
                    >
                      {checkoutMutation.isPending && selectedPlan === "solo-monthly" ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {currentPlan === "business_solo" ? "Current Plan" : "Start Solo - Monthly"}
                    </Button>
                    <Button 
                      variant="outline"
                      className="w-full"
                      onClick={() => handleSubscribe("solo-annual")}
                      disabled={checkoutMutation.isPending || (currentPlan === "business_solo")}
                      data-testid="button-solo-annual"
                    >
                      {checkoutMutation.isPending && selectedPlan === "solo-annual" ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Start Solo - Annual (Save 19%)
                    </Button>
                  </div>
                )}
                
                {plan.id === "pro" && (
                  <div className="w-full space-y-2">
                    <Button 
                      className="w-full"
                      onClick={() => handleSubscribe("pro-monthly")}
                      disabled={checkoutMutation.isPending || (currentPlan === "business_pro")}
                      data-testid="button-pro-monthly"
                    >
                      {checkoutMutation.isPending && selectedPlan === "pro-monthly" ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {currentPlan === "business_pro" ? "Current Plan" : "Start Pro - Monthly"}
                    </Button>
                    <Button 
                      variant="outline"
                      className="w-full"
                      onClick={() => handleSubscribe("pro-annual")}
                      disabled={checkoutMutation.isPending || (currentPlan === "business_pro")}
                      data-testid="button-pro-annual"
                    >
                      {checkoutMutation.isPending && selectedPlan === "pro-annual" ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Start Pro - Annual (Save 15%)
                    </Button>
                  </div>
                )}
                
                {plan.id === "enterprise" && (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleEnterpriseClick}
                    data-testid="button-enterprise-contact"
                  >
                    Contact Us
                    <Mail className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12 space-y-4">
          <h3 className="text-lg font-semibold">Questions about our plans?</h3>
          <p className="text-muted-foreground">
            Contact us at{" "}
            <a href="mailto:Support@slip-safe.net" className="text-primary hover:underline">
              Support@slip-safe.net
            </a>
          </p>
        </div>
      </div>

      <TermsModal
        open={showTermsModal}
        onOpenChange={setShowTermsModal}
        onAccept={handleTermsAccepted}
        isLoading={checkoutMutation.isPending}
      />

      {/* Enterprise Contact Modal */}
      <Dialog open={showEnterpriseModal} onOpenChange={setShowEnterpriseModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Enterprise Inquiry
            </DialogTitle>
            <DialogDescription>
              Tell us about your organisation and we'll get back to you within 1-2 business days.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="enterprise-name" className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="enterprise-name"
                placeholder="Your name"
                value={enterpriseContact.name}
                onChange={(e) => setEnterpriseContact({ ...enterpriseContact, name: e.target.value })}
                data-testid="input-enterprise-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="enterprise-email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="enterprise-email"
                type="email"
                placeholder="your.email@company.com"
                value={enterpriseContact.email}
                onChange={(e) => setEnterpriseContact({ ...enterpriseContact, email: e.target.value })}
                data-testid="input-enterprise-email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="enterprise-company" className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Company Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="enterprise-company"
                placeholder="Your company name"
                value={enterpriseContact.company}
                onChange={(e) => setEnterpriseContact({ ...enterpriseContact, company: e.target.value })}
                data-testid="input-enterprise-company"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="enterprise-phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Phone
                </Label>
                <Input
                  id="enterprise-phone"
                  placeholder="+27 XX XXX XXXX"
                  value={enterpriseContact.phone}
                  onChange={(e) => setEnterpriseContact({ ...enterpriseContact, phone: e.target.value })}
                  data-testid="input-enterprise-phone"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="enterprise-team-size" className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Team Size
                </Label>
                <Input
                  id="enterprise-team-size"
                  placeholder="e.g. 50-100"
                  value={enterpriseContact.teamSize}
                  onChange={(e) => setEnterpriseContact({ ...enterpriseContact, teamSize: e.target.value })}
                  data-testid="input-enterprise-team-size"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="enterprise-message" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Message
              </Label>
              <Textarea
                id="enterprise-message"
                placeholder="Tell us about your needs..."
                value={enterpriseContact.message}
                onChange={(e) => setEnterpriseContact({ ...enterpriseContact, message: e.target.value })}
                className="min-h-[100px]"
                data-testid="input-enterprise-message"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEnterpriseModal(false)}
              disabled={isSubmittingEnterprise}
              data-testid="button-enterprise-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEnterpriseSubmit}
              disabled={isSubmittingEnterprise}
              data-testid="button-enterprise-submit"
            >
              {isSubmittingEnterprise ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                "Submit Inquiry"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Pricing() {
  const { user, isAuthenticated, logout } = useAuth();
  
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  } as React.CSSProperties;

  const getDisplayName = () => {
    if (user?.activeContext === "business" && user?.businessName) {
      return user.businessName;
    }
    return user?.fullName || "User";
  };

  const getInitials = () => {
    const name = getDisplayName();
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex min-h-screen w-full" data-testid="page-pricing">
        <PricingSidebar 
          isAuthenticated={isAuthenticated} 
          user={user || null} 
          onLogout={logout}
        />
        <SidebarInset className="flex flex-col">
          <header className="sticky top-0 z-40 flex h-auto items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3">
            <div className="flex items-center gap-3 md:hidden">
              <SidebarTrigger data-testid="button-mobile-menu" />
            </div>
            
            <div className={`flex items-center justify-center md:hidden ${isAuthenticated ? '' : 'flex-1 -ml-8'}`}>
              <img src={logo} alt="SlipSafe" className="h-20 w-20 sm:h-24 sm:w-24 object-contain" data-testid="img-header-logo" />
            </div>
            
            {isAuthenticated && (
              <div className="flex items-center gap-3 ml-auto" data-testid="header-user-info">
                <span className="text-sm hidden sm:block">
                  Hi, <span className="font-medium">{getDisplayName()}</span>
                </span>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
          </header>
          <div className="flex-1 overflow-auto">
            <PricingContent />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
