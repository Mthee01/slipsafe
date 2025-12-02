import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Building2, ArrowLeft, CheckCircle, Briefcase, FileText, Receipt } from "lucide-react";
import { Link } from "wouter";

const upgradeToBusinessSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  taxId: z.string().min(1, "Tax ID is required for business accounts"),
  vatNumber: z.string().optional(),
  registrationNumber: z.string().optional(),
  businessAddress: z.string().optional(),
  businessPhone: z.string().optional(),
  businessEmail: z.string().email("Please enter a valid business email").optional().or(z.literal("")),
  invoicePrefix: z.string().min(1).max(10).default("INV"),
});

type UpgradeFormData = z.infer<typeof upgradeToBusinessSchema>;

export default function UpgradeToBusiness() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const form = useForm<UpgradeFormData>({
    resolver: zodResolver(upgradeToBusinessSchema),
    defaultValues: {
      businessName: "",
      taxId: "",
      vatNumber: "",
      registrationNumber: "",
      businessAddress: user?.homeAddress || "",
      businessPhone: user?.phone || "",
      businessEmail: user?.email || "",
      invoicePrefix: "INV",
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: async (data: UpgradeFormData) => {
      const response = await apiRequest("POST", "/api/users/upgrade-to-business", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upgrade account");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/users/me"], data.user);
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      toast({
        title: "Account Upgraded!",
        description: "Your business account is now active. You can switch between personal and business modes anytime.",
      });
      setLocation("/reports");
    },
    onError: (error: Error) => {
      toast({
        title: "Upgrade Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UpgradeFormData) => {
    upgradeMutation.mutate(data);
  };

  if (user?.accountType === "business") {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
              <h2 className="text-2xl font-bold mb-2">You're Already a Business Account</h2>
              <p className="text-muted-foreground mb-6">
                Your account is already set up for business use. You can access all business features including tax reports and VAT summaries.
              </p>
              <div className="flex gap-4 justify-center">
                <Link href="/reports">
                  <Button data-testid="button-go-to-reports">Go to Reports</Button>
                </Link>
                <Link href="/profile">
                  <Button variant="outline" data-testid="button-edit-business-profile">Edit Business Profile</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/reports">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Upgrade to Business</h1>
            <p className="text-muted-foreground">Unlock tax reports, VAT summaries, and more</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 border-indigo-500/20">
            <CardContent className="p-4 text-center">
              <Receipt className="h-8 w-8 mx-auto text-indigo-500 mb-2" />
              <h3 className="font-medium">Tax Reports</h3>
              <p className="text-xs text-muted-foreground">Track expenses for SARS</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 border-indigo-500/20">
            <CardContent className="p-4 text-center">
              <FileText className="h-8 w-8 mx-auto text-cyan-500 mb-2" />
              <h3 className="font-medium">VAT Summaries</h3>
              <p className="text-xs text-muted-foreground">Auto-extract 15% VAT</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 border-indigo-500/20">
            <CardContent className="p-4 text-center">
              <Briefcase className="h-8 w-8 mx-auto text-purple-500 mb-2" />
              <h3 className="font-medium">Separate Data</h3>
              <p className="text-xs text-muted-foreground">Personal & business receipts</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Business Details
            </CardTitle>
            <CardDescription>
              Enter your business information below. Your personal details ({user?.fullName}, {user?.email}) will remain linked to your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Business Name *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Your Company (Pty) Ltd" 
                            {...field}
                            data-testid="input-business-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="taxId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax ID / Income Tax Number *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., 9123456789" 
                            {...field}
                            data-testid="input-tax-id"
                          />
                        </FormControl>
                        <FormDescription>Required for SARS tax reporting</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vatNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>VAT Number</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., 4123456789" 
                            {...field}
                            data-testid="input-vat-number"
                          />
                        </FormControl>
                        <FormDescription>If registered for VAT</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="registrationNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Registration Number</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., 2020/123456/07" 
                            {...field}
                            data-testid="input-registration-number"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="invoicePrefix"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoice Prefix</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="INV" 
                            maxLength={10}
                            {...field}
                            data-testid="input-invoice-prefix"
                          />
                        </FormControl>
                        <FormDescription>For generated invoices</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessAddress"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Business Address</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="123 Business St, City, Province" 
                            {...field}
                            data-testid="input-business-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Phone</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="011 123 4567" 
                            {...field}
                            data-testid="input-business-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Email</FormLabel>
                        <FormControl>
                          <Input 
                            type="email"
                            placeholder="accounts@company.co.za" 
                            {...field}
                            data-testid="input-business-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={upgradeMutation.isPending}
                    data-testid="button-upgrade"
                  >
                    {upgradeMutation.isPending ? "Upgrading..." : "Upgrade to Business Account"}
                  </Button>
                  <Link href="/reports">
                    <Button type="button" variant="outline" data-testid="button-cancel">
                      Cancel
                    </Button>
                  </Link>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          After upgrading, you can switch between Personal and Business modes anytime.
          Each mode keeps its receipts and reports separate.
        </p>
      </div>
    </div>
  );
}
