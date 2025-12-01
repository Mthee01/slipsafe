import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import type { Purchase, Settings } from "@shared/schema";

export function AlertsWidget() {
  const { data: purchasesData } = useQuery<{ purchases: Purchase[] }>({
    queryKey: ["/api/purchases"],
  });

  const { data: settingsData } = useQuery<{ settings: Settings }>({
    queryKey: ["/api/settings"],
  });

  const purchases = purchasesData?.purchases || [];
  const settings = settingsData?.settings;

  const defaultSettings = {
    notifyReturnDeadline: true,
    notifyWarrantyExpiry: true,
    returnAlertDays: "7",
    warrantyAlertDays: "30",
  };

  const activeSettings = settings || defaultSettings;
  const notifyReturn = activeSettings.notifyReturnDeadline;
  const notifyWarranty = activeSettings.notifyWarrantyExpiry;
  const returnAlertDays = parseInt(activeSettings.returnAlertDays);
  const warrantyAlertDays = parseInt(activeSettings.warrantyAlertDays);

  const now = new Date();
  const alerts = purchases
    .map((purchase) => {
      const returnDate = new Date(purchase.returnBy);
      const warrantyDate = new Date(purchase.warrantyEnds);
      
      const returnDaysLeft = Math.ceil((returnDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const warrantyDaysLeft = Math.ceil((warrantyDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (notifyReturn && returnDaysLeft >= 0 && returnDaysLeft <= returnAlertDays) {
        return {
          id: purchase.id,
          type: 'return' as const,
          merchant: purchase.merchant,
          daysLeft: returnDaysLeft,
          date: purchase.returnBy,
          priority: returnDaysLeft <= 3 ? 'high' : 'medium',
        };
      }

      if (notifyWarranty && warrantyDaysLeft >= 0 && warrantyDaysLeft <= warrantyAlertDays) {
        return {
          id: purchase.id,
          type: 'warranty' as const,
          merchant: purchase.merchant,
          daysLeft: warrantyDaysLeft,
          date: purchase.warrantyEnds,
          priority: warrantyDaysLeft <= 7 ? 'high' : 'low',
        };
      }

      return null;
    })
    .filter(Boolean) as Array<{
      id: string;
      type: 'return' | 'warranty';
      merchant: string;
      daysLeft: number;
      date: string;
      priority: 'high' | 'medium' | 'low';
    }>;

  const alertCount = alerts.length;

  if (!notifyReturn && !notifyWarranty) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="button-alerts">
          <Bell className="h-5 w-5" />
          {alertCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
              data-testid="badge-alert-count"
            >
              {alertCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" data-testid="popover-alerts">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Alerts</h3>
            {alertCount > 0 && (
              <Badge variant="secondary" data-testid="text-alert-total">
                {alertCount} alert{alertCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {alertCount === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-alerts">
              No alerts at this time
            </p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {alerts.map((alert) => (
                <Link key={alert.id} href="/receipts">
                  <div
                    className="p-3 rounded-lg border hover-elevate transition-all cursor-pointer"
                    data-testid={`alert-item-${alert.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{alert.merchant}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {alert.type === 'return' ? 'Return window' : 'Warranty'} expires in{' '}
                          <span className={`font-semibold ${alert.priority === 'high' ? 'text-destructive' : ''}`}>
                            {alert.daysLeft} day{alert.daysLeft > 1 ? 's' : ''}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(alert.date).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge
                        variant={alert.priority === 'high' ? 'destructive' : 'secondary'}
                        className="text-xs"
                        data-testid={`badge-priority-${alert.id}`}
                      >
                        {alert.priority === 'high' ? 'Urgent' : alert.priority === 'medium' ? 'Soon' : 'Notice'}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="pt-2 border-t">
            <Link href="/settings">
              <Button variant="outline" size="sm" className="w-full" data-testid="button-alert-settings">
                Notification Settings
              </Button>
            </Link>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
