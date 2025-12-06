import { useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { AlertsWidget } from "@/components/alerts-widget";
import { OfflineIndicator } from "@/components/offline-indicator";
import { InstallPrompt } from "@/components/install-prompt";
import { CrispChat } from "@/components/crisp-chat";
import { useAuth } from "@/hooks/use-auth";
import { useWarrantyNotifications } from "@/hooks/use-warranty-notifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { LogOut, Home as HomeIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import Home from "@/pages/home";
import Receipts from "@/pages/receipts";
import Claims from "@/pages/claims";
import Settings from "@/pages/settings";
import Profile from "@/pages/profile";
import Reports from "@/pages/reports";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotUsername from "@/pages/forgot-username";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import RegistrationSuccess from "@/pages/registration-success";
import VerifyEmail from "@/pages/verify-email";
import NotFound from "@/pages/not-found";
import AdminDashboard from "@/pages/admin";
import MerchantPortal from "@/pages/merchant-portal";
import IntegratedMerchantPortal from "@/pages/integrated-merchant-portal";
import ReceiptDetail from "@/pages/receipt-detail";
import UpgradeToBusiness from "@/pages/upgrade-to-business";
import Pricing from "@/pages/pricing";
import BusinessTerms from "@/pages/business-terms";
import LandingPage from "@/pages/landing";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import Team from "@/pages/team";
import logo from "@assets/SlipSafe Logo_1762888976121.png";

function AppHeader() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/logout");
      return response.json();
    },
    onSuccess: () => {
      queryClient.clear();
      setLocation("/landing");
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to log out",
        variant: "destructive",
      });
    }
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <header className="flex items-center justify-between p-3 border-b bg-background gap-2">
      <div className="flex items-center gap-2">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <div className="flex items-center gap-2">
          <img src={logo} alt="SlipSafe" className="h-8 w-8 object-contain" data-testid="img-logo-header" />
          <span className="text-lg font-semibold hidden sm:inline">SlipSafe</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isMobile && (
          <Link href="/landing">
            <Button
              variant="ghost"
              size="icon"
              data-testid="button-home"
              title="Home"
            >
              <HomeIcon className="h-4 w-4" />
            </Button>
          </Link>
        )}
        <AlertsWidget />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          data-testid="button-logout"
          title="Log out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  
  useWarrantyNotifications();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/landing" component={LandingPage} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/registration-success" component={RegistrationSuccess} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/forgot-username" component={ForgotUsername} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/merchant" component={MerchantPortal} />
        <Route path="/verify/:claimCode" component={MerchantPortal} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/terms/business" component={BusinessTerms} />
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/landing" component={LandingPage} />
      <Route>
        <SidebarProvider>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <AppHeader />
              <main className="flex-1 overflow-auto">
                <Switch>
                  <Route path="/" component={Home} />
                  <Route path="/receipts" component={Receipts} />
                  <Route path="/receipt/:id" component={ReceiptDetail} />
                  <Route path="/claims" component={Claims} />
                  <Route path="/reports" component={Reports} />
                  <Route path="/settings" component={Settings} />
                  <Route path="/profile" component={Profile} />
                  <Route path="/team" component={Team} />
                  <Route path="/upgrade-to-business" component={UpgradeToBusiness} />
                  <Route path="/admin" component={AdminDashboard} />
                  <Route path="/admin/users" component={AdminDashboard} />
                  <Route path="/admin/organizations" component={AdminDashboard} />
                  <Route path="/admin/merchant-rules" component={AdminDashboard} />
                  <Route path="/admin/activity" component={AdminDashboard} />
                  <Route path="/merchant" component={MerchantPortal} />
                  <Route path="/merchant-portal" component={IntegratedMerchantPortal} />
                  <Route path="/verify/:claimCode" component={MerchantPortal} />
                  <Route path="/pricing" component={Pricing} />
                  <Route path="/terms/business" component={BusinessTerms} />
                  <Route path="/terms" component={Terms} />
                  <Route path="/privacy" component={Privacy} />
                  <Route path="/login">
                    <Redirect to="/" />
                  </Route>
                  <Route path="/register">
                    <Redirect to="/" />
                  </Route>
                  <Route component={NotFound} />
                </Switch>
              </main>
            </div>
          </div>
        </SidebarProvider>
      </Route>
    </Switch>
  );
}

function App() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_COMPLETE') {
          queryClient.invalidateQueries({ queryKey: ['/api/purchases'], exact: false });
        }
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AppContent />
          <Toaster />
          <OfflineIndicator />
          <InstallPrompt />
          <CrispChat />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
