import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft, Inbox, Phone } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logoUrl from "@assets/SlipSafe Logo_1762888976121.png";

export default function ForgotUsername() {
  const [recoveryMethod, setRecoveryMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const body = recoveryMethod === "email" 
        ? { recoveryMethod, email }
        : { recoveryMethod, phone };

      const response = await fetch("/api/auth/forgot-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitted(true);
        toast({
          title: "Request Submitted",
          description: data.message,
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to submit request",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <img src={logoUrl} alt="SlipSafe" className="h-20 w-20 object-contain" />
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl">Forgot Username</CardTitle>
            <CardDescription>
              Enter your email address or phone number to recover your username
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {submitted ? (
            <div className="space-y-4">
              <Alert>
                <Inbox className="h-4 w-4" />
                <AlertDescription>
                  {recoveryMethod === "email" 
                    ? "If an account exists with this email, we've sent your username information to your inbox. Please check your email (and spam folder)."
                    : "If an account exists with this phone number, we've sent your username via SMS. Please check your messages."}
                </AlertDescription>
              </Alert>

              <div className="text-center">
                <Link href="/login">
                  <Button variant="ghost" data-testid="button-back-to-login">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Tabs value={recoveryMethod} onValueChange={(v) => setRecoveryMethod(v as "email" | "phone")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="email" data-testid="tab-email">
                    <Mail className="mr-2 h-4 w-4" />
                    Email
                  </TabsTrigger>
                  <TabsTrigger value="phone" data-testid="tab-phone">
                    <Phone className="mr-2 h-4 w-4" />
                    Phone
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="email" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="your.email@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        className="pl-10"
                        required
                        data-testid="input-email"
                      />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="phone" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+27 82 123 4567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        autoComplete="tel"
                        className="pl-10"
                        required
                        data-testid="input-phone"
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                data-testid="button-submit"
              >
                {loading ? "Searching..." : "Find Username"}
              </Button>

              <div className="text-center">
                <Link href="/login">
                  <Button variant="ghost" data-testid="link-back-to-login">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
