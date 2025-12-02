import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Building2, User } from "lucide-react";

import logo from "@assets/SlipSafe Logo_1762888976121.png";

export default function Register() {
  const { register, isRegistering, registerError } = useAuth();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountType, setAccountType] = useState<"individual" | "business">("individual");
  const [idNumber, setIdNumber] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [error, setError] = useState("");

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

    register({ 
      username,
      fullName,
      email,
      phone,
      password, 
      accountType,
      idNumber: accountType === "individual" ? idNumber : undefined,
      homeAddress: accountType === "individual" ? homeAddress : undefined,
      businessName: accountType === "business" ? businessName : undefined,
      taxId: accountType === "business" ? taxId : undefined,
      vatNumber: accountType === "business" ? vatNumber : undefined,
    });
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
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
