"use client";

import { useState } from "react";
import { Trash2, Plus, Bell } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "./empty-state";

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

const CHANNEL_TONE: Record<Channel, string> = {
  EMAIL: "pill-blue",
  SLACK: "pill-indigo",
  WEBHOOK: "pill-muted",
};

const CHANNEL_LABEL: Record<Channel, string> = {
  EMAIL: "Email",
  SLACK: "Slack",
  WEBHOOK: "Webhook",
};

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

  const inputStyle: React.CSSProperties = {
    background: "var(--background-2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: "8px 12px",
    fontSize: 14,
    letterSpacing: "-0.011em",
    color: "var(--foreground)",
    width: "100%",
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <p
          className="text-subhead"
          style={{ color: "var(--foreground-3)" }}
        >
          {subs.length} active{" "}
          {subs.length === 1 ? "subscription" : "subscriptions"}
        </p>
        {!open && (
          <button onClick={() => setOpen(true)} className="btn-pill">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
            New subscription
          </button>
        )}
      </div>

      {open && (
        <form
          onSubmit={create}
          className="surface animate-fade-up"
          style={{ padding: 20 }}
        >
          <h3 className="text-headline mb-4" style={{ color: "var(--foreground)" }}>
            New subscription
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="space-y-1.5">
              <label className="text-footnote-em" style={{ color: "var(--foreground)" }}>
                Site
              </label>
              <select
                required
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Pick a site…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-footnote-em" style={{ color: "var(--foreground)" }}>
                Channel
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as Channel)}
                style={inputStyle}
              >
                <option value="EMAIL">Email</option>
                <option value="SLACK">Slack webhook</option>
                <option value="WEBHOOK">Generic webhook</option>
              </select>
            </div>
          </div>

          {(channel === "SLACK" || channel === "WEBHOOK") && (
            <div className="space-y-1.5 mb-4">
              <label className="text-footnote-em" style={{ color: "var(--foreground)" }}>
                Webhook URL
              </label>
              <input
                type="url"
                required
                placeholder="https://hooks.slack.com/services/…"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                style={{ ...inputStyle, fontFamily: 'ui-monospace, "SF Mono", monospace', fontSize: 13 }}
              />
            </div>
          )}

          <div className="space-y-1.5 max-w-[260px] mb-5">
            <label className="text-footnote-em" style={{ color: "var(--foreground)" }}>
              Minimum severity
            </label>
            <input
              type="number"
              min={1}
              max={5}
              placeholder="leave blank to use site default"
              value={minSeverity}
              onChange={(e) =>
                setMinSeverity(e.target.value === "" ? "" : Number(e.target.value))
              }
              style={inputStyle}
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn-pill" disabled={submitting}>
              {submitting ? "Adding…" : "Add subscription"}
            </button>
            <button
              type="button"
              className="btn-pill-ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {subs.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No subscriptions yet"
          description="Add one above to start receiving alerts on email, Slack, or any custom webhook."
        />
      ) : (
        <div className="surface-flat overflow-hidden">
          {subs.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`pill ${CHANNEL_TONE[s.channel]}`}>
                    {CHANNEL_LABEL[s.channel]}
                  </span>
                  {s.minSeverity != null && (
                    <span className="pill pill-muted tabular">
                      severity ≥ {s.minSeverity}
                    </span>
                  )}
                  {s.paused && <span className="pill pill-muted">Paused</span>}
                </div>
                <div className="text-footnote" style={{ color: "var(--foreground-3)" }}>
                  <span style={{ color: "var(--foreground-2)" }}>
                    {sites.find((x) => x.id === s.siteId)?.name ??
                      s.siteId ??
                      s.monitoredUrlId}
                  </span>
                  {s.webhookUrl && (
                    <span className="ml-2 mono opacity-80">
                      → {s.webhookUrl.slice(0, 40)}
                      {s.webhookUrl.length > 40 ? "…" : ""}
                    </span>
                  )}
                </div>
              </div>
              <button
                className="btn-pill-ghost"
                onClick={() => togglePause(s)}
              >
                {s.paused ? "Resume" : "Pause"}
              </button>
              <button
                className="h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors"
                style={{ color: "var(--red-ink)" }}
                onClick={() => remove(s.id)}
                aria-label="Delete subscription"
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--red-soft)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
