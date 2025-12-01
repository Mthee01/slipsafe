import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, CheckCircle, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";

import logo from "@assets/SlipSafe Logo_1762888976121.png";

export default function RegistrationSuccess() {
  const [email, setEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setResendMessage({ type: "error", text: "Please enter your email address" });
      return;
    }

    setIsResending(true);
    setResendMessage(null);

    try {
      const response = await apiRequest("POST", "/api/auth/resend-verification", { email });
      const data = await response.json();
      
      if (data.success) {
        setResendMessage({ type: "success", text: data.message });
      } else {
        setResendMessage({ type: "error", text: data.error || "Failed to resend verification email" });
      }
    } catch (error: any) {
      setResendMessage({ type: "error", text: "Failed to resend verification email. Please try again." });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="SlipSafe Logo" className="h-20 w-20 object-contain" data-testid="img-logo" />
          </div>
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <CardTitle className="text-2xl" data-testid="text-title">Registration Successful!</CardTitle>
          <CardDescription>
            Please check your email to verify your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Verification email sent</p>
                <p>We've sent a verification link to your email address. Please click the link to activate your account.</p>
              </div>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>The verification link will expire in 24 hours.</p>
          </div>

          <div className="border-t pt-4 space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Didn't receive the email? Enter your email below to resend.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                data-testid="input-email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            {resendMessage && (
              <Alert variant={resendMessage.type === "error" ? "destructive" : "default"} data-testid="alert-resend-message">
                <AlertDescription>{resendMessage.text}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleResendVerification}
              disabled={isResending}
              variant="outline"
              className="w-full"
              data-testid="button-resend"
            >
              {isResending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Resend Verification Email
                </>
              )}
            </Button>
          </div>

          <div className="text-center">
            <Link href="/login">
              <Button variant="ghost" data-testid="link-login">
                Back to Login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
