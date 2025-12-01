import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Link, useSearch } from "wouter";

import logo from "@assets/SlipSafe Logo_1762888976121.png";

export default function VerifyEmail() {
  const searchParams = useSearch();
  const token = new URLSearchParams(searchParams).get("token");
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus("error");
        setMessage("Invalid verification link. Please check your email for the correct link.");
        return;
      }

      try {
        const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (response.ok && data.success) {
          setStatus("success");
          setMessage(data.message || "Email verified successfully! You can now log in.");
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed. Please try again or request a new link.");
        }
      } catch (error) {
        setStatus("error");
        setMessage("An error occurred during verification. Please try again.");
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="SlipSafe Logo" className="h-20 w-20 object-contain" data-testid="img-logo" />
          </div>
          
          {status === "loading" && (
            <>
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-muted p-4">
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                </div>
              </div>
              <CardTitle className="text-2xl" data-testid="text-title">Verifying Your Email</CardTitle>
              <CardDescription>Please wait while we verify your email address...</CardDescription>
            </>
          )}

          {status === "success" && (
            <>
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
                  <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <CardTitle className="text-2xl" data-testid="text-title">Email Verified!</CardTitle>
              <CardDescription>Your account is now active</CardDescription>
            </>
          )}

          {status === "error" && (
            <>
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4">
                  <XCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <CardTitle className="text-2xl" data-testid="text-title">Verification Failed</CardTitle>
              <CardDescription>We couldn't verify your email</CardDescription>
            </>
          )}
        </CardHeader>
        
        <CardContent className="space-y-6">
          {status !== "loading" && (
            <Alert variant={status === "success" ? "default" : "destructive"} data-testid="alert-status">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {status === "success" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                You should have received a welcome email with your account details. You can now log in to start managing your receipts.
              </p>
              <Link href="/login">
                <Button className="w-full" data-testid="button-login">
                  Go to Login
                </Button>
              </Link>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                The verification link may have expired or is invalid. You can request a new verification email from the registration page.
              </p>
              <div className="flex flex-col gap-2">
                <Link href="/registration-success">
                  <Button variant="outline" className="w-full" data-testid="button-resend">
                    Request New Verification Email
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="ghost" className="w-full" data-testid="link-login">
                    Back to Login
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
