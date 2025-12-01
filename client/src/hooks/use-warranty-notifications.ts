import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Purchase, Settings } from "@shared/schema";

export function useWarrantyNotifications() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const hasShownNotifications = useRef(false);

  const { data: purchasesData } = useQuery<{ purchases: Purchase[] }>({
    queryKey: ["/api/purchases"],
    enabled: isAuthenticated,
  });

  const { data: settingsData } = useQuery<{ settings: Settings }>({
    queryKey: ["/api/settings"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated || !purchasesData?.purchases || hasShownNotifications.current) {
      return;
    }

    const settings = settingsData?.settings;
    const notifyWarranty = settings?.notifyWarrantyExpiry ?? true;
    const notifyReturn = settings?.notifyReturnDeadline ?? true;
    const warrantyAlertDays = parseInt(settings?.warrantyAlertDays || "30");
    const returnAlertDays = parseInt(settings?.returnAlertDays || "7");

    if (!notifyWarranty && !notifyReturn) {
      return;
    }

    const now = new Date();
    const purchases = purchasesData.purchases;

    const urgentWarranties = purchases.filter((purchase) => {
      if (!purchase.warrantyEnds || !notifyWarranty) return false;
      const warrantyDate = new Date(purchase.warrantyEnds);
      const daysLeft = Math.ceil((warrantyDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysLeft >= 0 && daysLeft <= 7;
    });

    const urgentReturns = purchases.filter((purchase) => {
      if (!purchase.returnBy || !notifyReturn) return false;
      const returnDate = new Date(purchase.returnBy);
      const daysLeft = Math.ceil((returnDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysLeft >= 0 && daysLeft <= 3;
    });

    if (urgentWarranties.length > 0) {
      const count = urgentWarranties.length;
      toast({
        title: "Warranty Alert",
        description: `${count} ${count === 1 ? 'warranty is' : 'warranties are'} expiring within 7 days. Check your notifications for details.`,
        variant: "default",
      });
    }

    if (urgentReturns.length > 0) {
      const count = urgentReturns.length;
      setTimeout(() => {
        toast({
          title: "Return Deadline Alert",
          description: `${count} return ${count === 1 ? 'deadline is' : 'deadlines are'} within 3 days. Don't miss your chance to return!`,
          variant: "destructive",
        });
      }, 1000);
    }

    hasShownNotifications.current = true;
  }, [isAuthenticated, purchasesData, settingsData, toast]);

  useEffect(() => {
    if (!isAuthenticated) {
      hasShownNotifications.current = false;
    }
  }, [isAuthenticated]);

  return null;
}
