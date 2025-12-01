import { Home, FileText, QrCode, Settings, User, Building2, UserCircle, RefreshCw } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import logo from "@assets/SlipSafe Logo_1762888976121.png";

const menuItems = [
  {
    title: "Upload",
    url: "/",
    icon: Home,
    testId: "nav-upload",
  },
  {
    title: "Receipts",
    url: "/receipts",
    icon: FileText,
    testId: "nav-receipts",
  },
  {
    title: "Claims",
    url: "/claims",
    icon: QrCode,
    testId: "nav-claims",
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    testId: "nav-settings",
  },
  {
    title: "Profile",
    url: "/profile",
    icon: User,
    testId: "nav-profile",
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { toast } = useToast();

  const { data: user } = useQuery<{ 
    id: string; 
    username: string; 
    accountType: string;
    activeContext: string;
  } | null>({
    queryKey: ["/api/users/me"],
  });

  const switchContextMutation = useMutation({
    mutationFn: async (context: string) => {
      const response = await apiRequest("POST", "/api/users/context", { context });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/users/me"], data.user);
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      toast({
        title: "Context switched",
        description: `Switched to ${data.user.activeContext === "business" ? "Business" : "Personal"} mode`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to switch context",
        variant: "destructive",
      });
    }
  });

  const isBusiness = user?.accountType === "business";
  const isBusinessContext = user?.activeContext === "business";

  const handleContextSwitch = () => {
    const newContext = isBusinessContext ? "personal" : "business";
    switchContextMutation.mutate(newContext);
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="SlipSafe Logo" className="h-10 w-10 object-contain" data-testid="img-logo-sidebar" />
          <span className="text-lg font-bold">SlipSafe</span>
        </div>
      </SidebarHeader>

      {isBusiness && (
        <div className="border-b p-3 bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              {isBusinessContext ? (
                <>
                  <Building2 className="h-4 w-4 text-primary" />
                  <span>Business Mode</span>
                </>
              ) : (
                <>
                  <UserCircle className="h-4 w-4 text-primary" />
                  <span>Personal Mode</span>
                </>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleContextSwitch}
            disabled={switchContextMutation.isPending}
            data-testid="button-switch-context"
          >
            <RefreshCw className={`h-3 w-3 mr-2 ${switchContextMutation.isPending ? 'animate-spin' : ''}`} />
            Switch to {isBusinessContext ? "Personal" : "Business"}
          </Button>
        </div>
      )}

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={item.testId}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
