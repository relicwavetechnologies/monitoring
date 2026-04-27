"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface SettingsFormProps {
  userId: string;
  receivesAlerts: boolean;
}

export function SettingsForm({ userId, receivesAlerts: initial }: SettingsFormProps) {
  const [receivesAlerts, setReceivesAlerts] = useState(initial);
  const [loading, setLoading] = useState(false);

  const toggle = async (checked: boolean) => {
    setLoading(true);
    try {
      await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receivesAlerts: checked }),
      });
      setReceivesAlerts(checked);
      toast.success(checked ? "Alerts enabled" : "Alerts disabled");
    } catch {
      toast.error("Failed to save preference");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="alerts-toggle" className="text-sm font-medium">
            Email alerts
          </Label>
          <p className="text-xs text-muted-foreground">
            Receive email when a severity ≥ 3 change is detected
          </p>
        </div>
        <Switch
          id="alerts-toggle"
          checked={receivesAlerts}
          onCheckedChange={toggle}
          disabled={loading}
        />
      </div>

      <div className="p-3 rounded-lg bg-muted/30 border border-border/40 text-xs text-muted-foreground">
        Alerts are sent for: <span className="text-amber-400">Notable</span>,{" "}
        <span className="text-orange-400">Important</span>, and{" "}
        <span className="text-red-400">Critical</span> changes only. Cosmetic/minor
        changes are logged on the dashboard but don&apos;t trigger emails.
      </div>
    </div>
  );
}
