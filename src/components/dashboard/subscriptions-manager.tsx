"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

type Channel = "EMAIL" | "SLACK" | "WEBHOOK";

interface Subscription {
  id: string;
  siteId: string | null;
  monitoredUrlId: string | null;
  channel: Channel;
  minSeverity: number | null;
  webhookUrl: string | null;
  paused: boolean;
}

interface SiteOption {
  id: string;
  name: string;
}

interface Props {
  initial: Subscription[];
  sites: SiteOption[];
}

export function SubscriptionsManager({ initial, sites }: Props) {
  const [subs, setSubs] = useState<Subscription[]>(initial);
  const [open, setOpen] = useState(false);

  const [siteId, setSiteId] = useState<string>("");
  const [channel, setChannel] = useState<Channel>("EMAIL");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [minSeverity, setMinSeverity] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    const res = await fetch("/api/subscriptions");
    if (res.ok) setSubs(await res.json());
  };

  useEffect(() => {
    if (subs !== initial) return;
  }, [subs, initial]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { channel };
      if (siteId) body.siteId = siteId;
      if (webhookUrl) body.webhookUrl = webhookUrl;
      if (minSeverity !== "") body.minSeverity = minSeverity;
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(data.error ?? "failed"));
      }
      toast.success("Subscription added");
      setOpen(false);
      setWebhookUrl("");
      setMinSeverity("");
      await refresh();
    } catch (err) {
      toast.error("Could not add", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this subscription?")) return;
    const res = await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Removed");
      await refresh();
    } else {
      toast.error("Remove failed");
    }
  };

  const togglePause = async (s: Subscription) => {
    const res = await fetch(`/api/subscriptions/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: !s.paused }),
    });
    if (res.ok) {
      toast.success(s.paused ? "Resumed" : "Paused");
      await refresh();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {subs.length} active {subs.length === 1 ? "subscription" : "subscriptions"}
        </p>
        {!open && (
          <Button size="sm" onClick={() => setOpen(true)} className="gap-1 text-xs h-8">
            <Plus className="h-3 w-3" />
            New subscription
          </Button>
        )}
      </div>

      {open && (
        <form onSubmit={create} className="border rounded-md p-4 space-y-3 bg-muted/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Site</Label>
              <select
                required
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="w-full text-sm rounded-md border px-3 py-1.5 bg-background"
                style={{ borderColor: "var(--border, #E8E8F2)" }}
              >
                <option value="">Pick a site…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Channel</Label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as Channel)}
                className="w-full text-sm rounded-md border px-3 py-1.5 bg-background"
                style={{ borderColor: "var(--border, #E8E8F2)" }}
              >
                <option value="EMAIL">Email</option>
                <option value="SLACK">Slack webhook</option>
                <option value="WEBHOOK">Generic webhook</option>
              </select>
            </div>
          </div>

          {(channel === "SLACK" || channel === "WEBHOOK") && (
            <div className="space-y-1">
              <Label className="text-xs">Webhook URL</Label>
              <Input
                type="url"
                required
                placeholder="https://hooks.slack.com/services/…"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="text-sm"
              />
            </div>
          )}

          <div className="space-y-1 max-w-[220px]">
            <Label className="text-xs">Minimum severity (optional)</Label>
            <Input
              type="number"
              min={1}
              max={5}
              placeholder="leave blank to use site default"
              value={minSeverity}
              onChange={(e) => setMinSeverity(e.target.value === "" ? "" : Number(e.target.value))}
              className="text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting} className="text-xs">
              {submitting ? "Adding…" : "Add"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {subs.length === 0 ? (
        <div className="border border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
          No subscriptions yet. Add one above to start receiving alerts.
        </div>
      ) : (
        <div className="rounded-md overflow-hidden" style={{ border: "1px solid var(--border, #E8E8F2)" }}>
          {subs.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
              style={{ borderColor: "var(--border, #E8E8F2)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">
                    {s.channel}
                  </Badge>
                  {s.minSeverity != null && (
                    <Badge variant="outline" className="text-[10px]">
                      sev ≥ {s.minSeverity}
                    </Badge>
                  )}
                  {s.paused && (
                    <Badge variant="outline" className="text-[10px] bg-muted/50 text-muted-foreground">
                      Paused
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Site: <span className="font-mono">{
                    sites.find((x) => x.id === s.siteId)?.name ?? s.siteId ?? s.monitoredUrlId
                  }</span>
                  {s.webhookUrl && (
                    <span className="ml-2">
                      → <span className="font-mono">{s.webhookUrl.slice(0, 40)}…</span>
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => togglePause(s)}
              >
                {s.paused ? "Resume" : "Pause"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                onClick={() => remove(s.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
