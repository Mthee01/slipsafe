import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Bell, Calendar, Palette, Save, Store, Plus, Pencil, Trash2 } from "lucide-react";
import type { Settings, MerchantRule } from "@shared/schema";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ settings: Settings }>({
    queryKey: ["/api/settings"],
  });

  const [formData, setFormData] = useState({
    theme: "light",
    notifyReturnDeadline: true,
    notifyWarrantyExpiry: true,
    returnAlertDays: "7",
    warrantyAlertDays: "30",
  });

  useEffect(() => {
    if (data?.settings) {
      setFormData({
        theme: data.settings.theme,
        notifyReturnDeadline: data.settings.notifyReturnDeadline,
        notifyWarrantyExpiry: data.settings.notifyWarrantyExpiry,
        returnAlertDays: data.settings.returnAlertDays,
        warrantyAlertDays: data.settings.warrantyAlertDays,
      });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Settings>) => {
      const res = await apiRequest("PATCH", "/api/settings", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Merchant Rules Management
  const { data: merchantRulesData } = useQuery<{ rules: MerchantRule[] }>({
    queryKey: ["/api/merchant-rules"],
  });

  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MerchantRule | null>(null);
  const [ruleFormData, setRuleFormData] = useState({
    merchantName: "",
    returnPolicyDays: "",
    warrantyMonths: "",
  });

  const createRuleMutation = useMutation({
    mutationFn: async (ruleData: { merchantName: string; returnPolicyDays: number; warrantyMonths: number }) => {
      const res = await apiRequest("POST", "/api/merchant-rules", ruleData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant-rules"], exact: false });
      toast({ title: "Merchant rule created successfully" });
      setIsRuleDialogOpen(false);
      setRuleFormData({ merchantName: "", returnPolicyDays: "", warrantyMonths: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create rule",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MerchantRule> }) => {
      const res = await apiRequest("PATCH", `/api/merchant-rules/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant-rules"], exact: false });
      toast({ title: "Merchant rule updated successfully" });
      setIsRuleDialogOpen(false);
      setEditingRule(null);
      setRuleFormData({ merchantName: "", returnPolicyDays: "", warrantyMonths: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update rule",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/merchant-rules/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant-rules"], exact: false });
      toast({ title: "Merchant rule deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete rule",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRuleSave = () => {
    if (!ruleFormData.merchantName || !ruleFormData.returnPolicyDays || !ruleFormData.warrantyMonths) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (editingRule) {
      updateRuleMutation.mutate({
        id: editingRule.id,
        updates: {
          merchantName: ruleFormData.merchantName,
          returnPolicyDays: parseInt(ruleFormData.returnPolicyDays),
          warrantyMonths: parseInt(ruleFormData.warrantyMonths),
        },
      });
    } else {
      createRuleMutation.mutate({
        merchantName: ruleFormData.merchantName,
        returnPolicyDays: parseInt(ruleFormData.returnPolicyDays),
        warrantyMonths: parseInt(ruleFormData.warrantyMonths),
      });
    }
  };

  const handleEditRule = (rule: MerchantRule) => {
    setEditingRule(rule);
    setRuleFormData({
      merchantName: rule.merchantName,
      returnPolicyDays: rule.returnPolicyDays.toString(),
      warrantyMonths: rule.warrantyMonths.toString(),
    });
    setIsRuleDialogOpen(true);
  };

  const handleAddRule = () => {
    setEditingRule(null);
    setRuleFormData({ merchantName: "", returnPolicyDays: "", warrantyMonths: "" });
    setIsRuleDialogOpen(true);
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2" data-testid="text-page-title">Settings</h1>
          <p className="text-muted-foreground">
            Customize your SlipSafe experience
          </p>
        </div>

        <Card data-testid="card-theme-settings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize the look and feel of SlipSafe
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="theme" className="text-sm font-medium">
                  Theme
                </Label>
                <p className="text-xs text-muted-foreground">
                  Choose your preferred color scheme
                </p>
              </div>
              <Switch
                id="theme"
                checked={formData.theme === "dark"}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, theme: checked ? "dark" : "light" })
                }
                data-testid="switch-theme"
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-notification-settings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Manage alerts for return deadlines and warranty expiration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="return-notify" className="text-sm font-medium">
                  Return Deadline Alerts
                </Label>
                <p className="text-xs text-muted-foreground">
                  Get notified before return windows close
                </p>
              </div>
              <Switch
                id="return-notify"
                checked={formData.notifyReturnDeadline}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, notifyReturnDeadline: checked })
                }
                data-testid="switch-return-notify"
              />
            </div>

            {formData.notifyReturnDeadline && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="return-days" className="text-sm">
                  Alert me this many days before return deadline:
                </Label>
                <Input
                  id="return-days"
                  type="number"
                  min="1"
                  max="30"
                  value={formData.returnAlertDays}
                  onChange={(e) =>
                    setFormData({ ...formData, returnAlertDays: e.target.value })
                  }
                  className="w-24"
                  data-testid="input-return-days"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <Label htmlFor="warranty-notify" className="text-sm font-medium">
                  Warranty Expiration Alerts
                </Label>
                <p className="text-xs text-muted-foreground">
                  Get notified before warranties expire
                </p>
              </div>
              <Switch
                id="warranty-notify"
                checked={formData.notifyWarrantyExpiry}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, notifyWarrantyExpiry: checked })
                }
                data-testid="switch-warranty-notify"
              />
            </div>

            {formData.notifyWarrantyExpiry && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="warranty-days" className="text-sm">
                  Alert me this many days before warranty expires:
                </Label>
                <Input
                  id="warranty-days"
                  type="number"
                  min="1"
                  max="365"
                  value={formData.warrantyAlertDays}
                  onChange={(e) =>
                    setFormData({ ...formData, warrantyAlertDays: e.target.value })
                  }
                  className="w-24"
                  data-testid="input-warranty-days"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-merchant-rules">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Merchant Rules
                </CardTitle>
                <CardDescription>
                  Set custom return and warranty periods for specific merchants
                </CardDescription>
              </div>
              <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleAddRule} data-testid="button-add-rule">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Rule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingRule ? "Edit Merchant Rule" : "Add Merchant Rule"}</DialogTitle>
                    <DialogDescription>
                      {editingRule
                        ? "Update the return and warranty periods for this merchant"
                        : "Create custom return and warranty periods for a specific merchant"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="merchant-name">Merchant Name</Label>
                      <Input
                        id="merchant-name"
                        placeholder="e.g., Best Buy, Walmart"
                        value={ruleFormData.merchantName}
                        onChange={(e) =>
                          setRuleFormData({ ...ruleFormData, merchantName: e.target.value })
                        }
                        data-testid="input-merchant-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="return-days">Return Period (days)</Label>
                      <Input
                        id="return-days"
                        type="number"
                        min="0"
                        placeholder="e.g., 30"
                        value={ruleFormData.returnPolicyDays}
                        onChange={(e) =>
                          setRuleFormData({ ...ruleFormData, returnPolicyDays: e.target.value })
                        }
                        data-testid="input-return-days"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="warranty-months">Warranty Period (months)</Label>
                      <Input
                        id="warranty-months"
                        type="number"
                        min="0"
                        placeholder="e.g., 12"
                        value={ruleFormData.warrantyMonths}
                        onChange={(e) =>
                          setRuleFormData({ ...ruleFormData, warrantyMonths: e.target.value })
                        }
                        data-testid="input-warranty-months"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsRuleDialogOpen(false);
                        setEditingRule(null);
                        setRuleFormData({ merchantName: "", returnPolicyDays: "", warrantyMonths: "" });
                      }}
                      data-testid="button-cancel-rule"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleRuleSave}
                      disabled={createRuleMutation.isPending || updateRuleMutation.isPending}
                      data-testid="button-save-rule"
                    >
                      {createRuleMutation.isPending || updateRuleMutation.isPending
                        ? "Saving..."
                        : "Save Rule"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {!merchantRulesData?.rules || merchantRulesData.rules.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No merchant rules defined yet. Click "Add Rule" to create one.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Return Period</TableHead>
                    <TableHead>Warranty Period</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {merchantRulesData.rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.merchantName}</TableCell>
                      <TableCell>{rule.returnPolicyDays} days</TableCell>
                      <TableCell>{rule.warrantyMonths} months</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditRule(rule)}
                            data-testid={`button-edit-rule-${rule.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteRuleMutation.mutate(rule.id)}
                            data-testid={`button-delete-rule-${rule.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="min-w-32"
            data-testid="button-save-settings"
          >
            <Save className="mr-2 h-4 w-4" />
            {updateMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
