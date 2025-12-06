import { useState } from "react";
import { Link, useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Building2, User, ArrowLeft, Check, Mail, Phone, Building, MessageSquare } from "lucide-react";
import { TermsModal } from "@/components/terms-modal";
import { useToast } from "@/hooks/use-toast";

import logo from "@assets/SlipSafe Logo_1762888976121.png";

type PlanCode = "BUSINESS_SOLO" | "BUSINESS_PRO";
type BillingInterval = "monthly" | "annual";

// Consolidated plan configuration with both monthly and annual pricing
const BUSINESS_PLANS = [
  {
    code: "BUSINESS_SOLO" as PlanCode,
    name: "Solo",
    monthlyPrice: 99,
    annualPrice: 80,
    annualTotal: 960,
    savings: 19,
    features: ["1 user", "1,000 receipts/month", "Email support"],
  },
  {
    code: "BUSINESS_PRO" as PlanCode,
    name: "Pro",
    monthlyPrice: 269,
    annualPrice: 229,
    annualTotal: 2748,
    savings: 15,
    features: ["Up to 10 users", "5,000 receipts/month", "Priority support", "Team management"],
    popular: true,
  },
];

const ENTERPRISE_PLAN = {
  name: "Enterprise",
  features: ["Unlimited users", "Unlimited receipts", "Dedicated support", "Custom integrations"],
};

export default function Register() {
  const { register, isRegistering, registerError } = useAuth();
  const { toast } = useToast();
  const searchString = useSearch();
  
  // Parse URL params to pre-select account type, plan, and billing interval
  const urlParams = new URLSearchParams(searchString);
  const urlAccountType = urlParams.get("accountType");
  const urlPlan = urlParams.get("plan");
  const urlInterval = urlParams.get("interval");
  
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountType, setAccountType] = useState<"individual" | "business">(
    urlAccountType === "business" ? "business" : "individual"
  );
  const [idNumber, setIdNumber] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanCode | "">(
    urlPlan && ["BUSINESS_SOLO", "BUSINESS_PRO"].includes(urlPlan) 
      ? urlPlan as PlanCode 
      : ""
  );
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(
    urlInterval === "annual" ? "annual" : "monthly"
  );
  
  const [error, setError] = useState("");
  const [showTermsModal, setShowTermsModal] = useState(false);
  
  // Enterprise contact modal state
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);
  const [enterpriseContact, setEnterpriseContact] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    teamSize: "",
    message: "",
  });
  const [isSubmittingEnterprise, setIsSubmittingEnterprise] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Full name is required");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    if (!phone || phone.length < 10) {
      setError("Please enter a valid phone number (at least 10 digits)");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (accountType === "business" && !businessName) {
      setError("Business name is required for business accounts");
      return;
    }

    if (accountType === "business" && !selectedPlan) {
      setError("Please select a subscription plan (Solo or Pro)");
      return;
    }

    // For business accounts, show T&C modal before registration
    if (accountType === "business") {
      setShowTermsModal(true);
      return;
    }

    // For individual accounts, register directly
    doRegister();
  };

  const doRegister = () => {
    register({ 
      username,
      fullName,
      email,
      phone,
      password, 
      accountType,
      idNumber: accountType === "individual" && idNumber.trim() ? idNumber.trim() : undefined,
      homeAddress: accountType === "individual" && homeAddress.trim() ? homeAddress.trim() : undefined,
      businessName: accountType === "business" && businessName.trim() ? businessName.trim() : undefined,
      taxId: accountType === "business" && taxId.trim() ? taxId.trim() : undefined,
      vatNumber: accountType === "business" && vatNumber.trim() ? vatNumber.trim() : undefined,
      selectedPlan: accountType === "business" && selectedPlan ? selectedPlan : undefined,
      billingInterval: accountType === "business" ? billingInterval : undefined,
    });
  };

  const handleTermsAccepted = () => {
    setShowTermsModal(false);
    doRegister();
  };

  const handleEnterpriseClick = () => {
    // Pre-fill with form data if available
    setEnterpriseContact({
      name: fullName,
      email: email,
      company: businessName,
      phone: phone,
      teamSize: "",
      message: "",
    });
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="SlipSafe Logo" className="h-20 w-20 object-contain" data-testid="img-logo" />
          </div>
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>
            Sign up for SlipSafe to manage receipts and invoices
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {(error || registerError) && (
              <Alert variant="destructive" data-testid="alert-register-error">
                <AlertDescription>
                  {error || registerError?.message || "Registration failed"}
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-3">
              <Label>Account Type</Label>
              <RadioGroup 
                value={accountType} 
                onValueChange={(value) => setAccountType(value as "individual" | "business")}
                className="grid grid-cols-2 gap-4"
                data-testid="radio-group-account-type"
              >
                <div>
                  <RadioGroupItem 
                    value="individual" 
                    id="individual" 
                    className="peer sr-only" 
                    data-testid="radio-individual"
                  />
                  <Label
                    htmlFor="individual"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-card p-4 hover-elevate cursor-pointer peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <User className="mb-2 h-6 w-6" />
                    <span className="text-sm font-medium">Individual</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem 
                    value="business" 
                    id="business" 
                    className="peer sr-only"
                    data-testid="radio-business"
                  />
                  <Label
                    htmlFor="business"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-card p-4 hover-elevate cursor-pointer peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <Building2 className="mb-2 h-6 w-6" />
                    <span className="text-sm font-medium">Business</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                data-testid="input-full-name"
                type="text"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
                disabled={isRegistering}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                data-testid="input-username"
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                disabled={isRegistering}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Cellphone Number *</Label>
              <Input
                id="phone"
                data-testid="input-phone"
                type="tel"
                placeholder="+27 82 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                required
                disabled={isRegistering}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                data-testid="input-email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={isRegistering}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                data-testid="input-password"
                type="password"
                placeholder="Choose a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                disabled={isRegistering}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                data-testid="input-confirm-password"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                disabled={isRegistering}
              />
            </div>

            {accountType === "individual" && (
              <>
                <div className="border-t pt-4 space-y-4">
                  <h3 className="text-sm font-semibold">Personal Information</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="idNumber">ID Number <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                    <Input
                      id="idNumber"
                      data-testid="input-id-number"
                      type="text"
                      placeholder="Your ID/Passport number"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      autoComplete="off"
                      disabled={isRegistering}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="homeAddress">Home Address <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                    <Input
                      id="homeAddress"
                      data-testid="input-home-address"
                      type="text"
                      placeholder="Your home address"
                      value={homeAddress}
                      onChange={(e) => setHomeAddress(e.target.value)}
                      autoComplete="street-address"
                      disabled={isRegistering}
                    />
                  </div>
                </div>
              </>
            )}

            {accountType === "business" && (
              <>
                <div className="border-t pt-4 space-y-4">
                  <h3 className="text-sm font-semibold">Business Information</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name *</Label>
                    <Input
                      id="businessName"
                      data-testid="input-business-name"
                      type="text"
                      placeholder="Your Business Name"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      autoComplete="organization"
                      required
                      disabled={isRegistering}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="taxId">Tax ID</Label>
                    <Input
                      id="taxId"
                      data-testid="input-tax-id"
                      type="text"
                      placeholder="Tax identification number"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      autoComplete="off"
                      disabled={isRegistering}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vatNumber">VAT Number</Label>
                    <Input
                      id="vatNumber"
                      data-testid="input-vat-number"
                      type="text"
                      placeholder="VAT registration number"
                      value={vatNumber}
                      onChange={(e) => setVatNumber(e.target.value)}
                      autoComplete="off"
                      disabled={isRegistering}
                    />
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <Label>Select Subscription Plan *</Label>
                        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                          <button
                            type="button"
                            onClick={() => setBillingInterval("monthly")}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                              billingInterval === "monthly"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            data-testid="button-billing-monthly"
                          >
                            Monthly
                          </button>
                          <button
                            type="button"
                            onClick={() => setBillingInterval("annual")}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                              billingInterval === "annual"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            data-testid="button-billing-annual"
                          >
                            Annual
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Toggle applies to all plans below
                      </p>
                    </div>
                    
                    <div className="grid gap-3">
                      {/* Solo and Pro Plans */}
                      {BUSINESS_PLANS.map((plan) => {
                        const currentPrice = billingInterval === "monthly" ? plan.monthlyPrice : plan.annualPrice;
                        const altPrice = billingInterval === "monthly" ? plan.annualPrice : plan.monthlyPrice;
                        
                        return (
                          <div
                            key={plan.code}
                            data-testid={`plan-${plan.code.toLowerCase()}`}
                            onClick={() => setSelectedPlan(plan.code)}
                            className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all hover-elevate ${
                              selectedPlan === plan.code
                                ? "border-primary bg-primary/5"
                                : "border-muted"
                            } ${plan.popular ? "ring-1 ring-primary/20" : ""}`}
                          >
                            {plan.popular && (
                              <span className="absolute -top-2 right-4 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                                Popular
                              </span>
                            )}
                            {billingInterval === "annual" && (
                              <span className="absolute -top-2 left-4 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                                Save {plan.savings}%
                              </span>
                            )}
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-semibold">{plan.name}</div>
                                <div className="text-lg font-bold text-primary">
                                  R{currentPrice}
                                  <span className="text-sm font-normal text-muted-foreground">
                                    /month{billingInterval === "annual" ? " billed annually" : ""}
                                  </span>
                                </div>
                                {billingInterval === "annual" ? (
                                  <div className="text-xs text-muted-foreground">
                                    R{plan.annualTotal}/year total
                                  </div>
                                ) : (
                                  <div className="text-xs text-muted-foreground">
                                    or R{altPrice}/mo billed annually (save {plan.savings}%)
                                  </div>
                                )}
                              </div>
                              {selectedPlan === plan.code && (
                                <Check className="h-5 w-5 text-primary" />
                              )}
                            </div>
                            <ul className="mt-2 space-y-1">
                              {plan.features.map((feature, idx) => (
                                <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                                  <Check className="h-3 w-3 text-primary" />
                                  {feature}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}

                      {/* Enterprise Card - Opens contact modal instead of selecting */}
                      <div
                        data-testid="plan-enterprise"
                        onClick={handleEnterpriseClick}
                        className="relative cursor-pointer rounded-lg border-2 border-dashed border-muted p-4 transition-all hover-elevate hover:border-primary/50"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{ENTERPRISE_PLAN.name}</div>
                            <div className="text-lg font-bold text-primary">
                              Custom
                              <span className="text-sm font-normal text-muted-foreground">
                                {" "}pricing
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Contact us for a tailored solution
                            </div>
                          </div>
                          <Mail className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <ul className="mt-2 space-y-1">
                          {ENTERPRISE_PLAN.features.map((feature, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                              <Check className="h-3 w-3 text-primary" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isRegistering}
              data-testid="button-register"
            >
              {isRegistering ? "Creating account..." : "Create Account"}
            </Button>
            <div className="text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline" data-testid="link-login">
                Sign in
              </Link>
            </div>
            <div className="text-center pt-2">
              <Link href="/landing">
                <Button variant="ghost" data-testid="link-back-to-home">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>

      <TermsModal
        open={showTermsModal}
        onOpenChange={setShowTermsModal}
        onAccept={handleTermsAccepted}
        isLoading={isRegistering}
      />

      {/* Enterprise Contact Modal */}
      <Dialog open={showEnterpriseModal} onOpenChange={setShowEnterpriseModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Enterprise Inquiry
            </DialogTitle>
            <DialogDescription>
              Tell us about your organisation and we'll create a custom plan for your needs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="enterprise-name">Your Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="enterprise-name"
                  data-testid="input-enterprise-name"
                  className="pl-9"
                  placeholder="Full name"
                  value={enterpriseContact.name}
                  onChange={(e) => setEnterpriseContact(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="enterprise-email">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="enterprise-email"
                  data-testid="input-enterprise-email"
                  type="email"
                  className="pl-9"
                  placeholder="your@company.com"
                  value={enterpriseContact.email}
                  onChange={(e) => setEnterpriseContact(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="enterprise-company">Company Name *</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="enterprise-company"
                  data-testid="input-enterprise-company"
                  className="pl-9"
                  placeholder="Your company name"
                  value={enterpriseContact.company}
                  onChange={(e) => setEnterpriseContact(prev => ({ ...prev, company: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="enterprise-phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="enterprise-phone"
                  data-testid="input-enterprise-phone"
                  type="tel"
                  className="pl-9"
                  placeholder="+27 82 123 4567"
                  value={enterpriseContact.phone}
                  onChange={(e) => setEnterpriseContact(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="enterprise-team-size">Expected Team Size</Label>
              <Input
                id="enterprise-team-size"
                data-testid="input-enterprise-team-size"
                placeholder="e.g., 20-50 users"
                value={enterpriseContact.teamSize}
                onChange={(e) => setEnterpriseContact(prev => ({ ...prev, teamSize: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enterprise-message">Additional Information</Label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="enterprise-message"
                  data-testid="input-enterprise-message"
                  className="pl-9 min-h-[80px]"
                  placeholder="Tell us about your specific requirements..."
                  value={enterpriseContact.message}
                  onChange={(e) => setEnterpriseContact(prev => ({ ...prev, message: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEnterpriseModal(false)}
              data-testid="button-enterprise-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEnterpriseSubmit}
              disabled={isSubmittingEnterprise}
              data-testid="button-enterprise-submit"
            >
              {isSubmittingEnterprise ? "Submitting..." : "Submit Inquiry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
