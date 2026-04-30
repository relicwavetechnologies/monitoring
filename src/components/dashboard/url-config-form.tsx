"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type FetchMode = "STATIC" | "PLAYWRIGHT" | "STEALTH" | "CAMOUFOX" | "EXTERNAL";

interface UrlConfigFormProps {
  url: {
    id: string;
    url: string;
    contentSelector: string;
    stripPatterns: string[];
    fetchMode: FetchMode;
    autoEscalate: boolean;
    escalateAfterFailures: number;
    mutePatterns: string[];
  };
}

export function UrlConfigForm({ url }: UrlConfigFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [contentSelector, setContentSelector] = useState(url.contentSelector);
  const [stripPatterns, setStripPatterns] = useState(url.stripPatterns.join("\n"));
  const [fetchMode, setFetchMode] = useState<FetchMode>(url.fetchMode);
  const [autoEscalate, setAutoEscalate] = useState(url.autoEscalate);
  const [escalateAfterFailures, setEscalateAfterFailures] = useState(url.escalateAfterFailures);
  const [mutePatterns, setMutePatterns] = useState(url.mutePatterns.join("\n"));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/urls/${url.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentSelector,
          stripPatterns: stripPatterns.split("\n").map((s) => s.trim()).filter(Boolean),
          fetchMode,
          autoEscalate,
          escalateAfterFailures,
          mutePatterns: mutePatterns.split("\n").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success("URL config saved");
      router.refresh();
    } catch (err) {
      toast.error("Save failed", {
        description: err instanceof Error ? err.message : "unknown",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetFailures = async () => {
    setSubmitting(true);
    try {
      await fetch(`/api/urls/${url.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetFailures: true }),
      });
      toast.success("Failure streak reset");
      router.refresh();
    } catch {
      toast.error("Reset failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="selector" className="text-xs">Content selector</Label>
        <Input
          id="selector"
          value={contentSelector}
          onChange={(e) => setContentSelector(e.target.value)}
          placeholder="main"
          className="text-sm"
        />
        <p className="text-[11px] text-muted-foreground">
          CSS selector — falls back to <code>body</code> if not matched.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="strip" className="text-xs">Strip patterns (one regex per line)</Label>
        <Textarea
          id="strip"
          rows={3}
          value={stripPatterns}
          onChange={(e) => setStripPatterns(e.target.value)}
          placeholder={"\\d{4}-\\d{2}-\\d{2}T[\\d:]+Z\nLast updated:.*"}
          className="text-xs font-mono"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fetchMode" className="text-xs">Fetch tier</Label>
        <select
          id="fetchMode"
          value={fetchMode}
          onChange={(e) => setFetchMode(e.target.value as FetchMode)}
          className="w-full text-sm rounded-md border px-3 py-1.5 bg-background"
          style={{ borderColor: "var(--border, #E8E8F2)" }}
        >
          <option value="STATIC">STATIC — undici, fast/free</option>
          <option value="PLAYWRIGHT">PLAYWRIGHT — vanilla headless</option>
          <option value="STEALTH">STEALTH — patchright (anti-Cloudflare)</option>
          <option value="CAMOUFOX">CAMOUFOX — patched Firefox (alt fingerprint)</option>
          <option value="EXTERNAL">EXTERNAL — third-party scraper API</option>
        </select>
      </div>

      <div className="flex items-center justify-between border rounded-md p-3" style={{ borderColor: "var(--border, #E8E8F2)" }}>
        <div>
          <Label htmlFor="autoEscalate" className="text-sm">Auto-escalate</Label>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Promote to the next tier after N consecutive BLOCKED failures.
          </p>
        </div>
        <Switch id="autoEscalate" checked={autoEscalate} onCheckedChange={setAutoEscalate} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="escalateAfter" className="text-xs">Escalate after N failures</Label>
        <Input
          id="escalateAfter"
          type="number"
          min={1}
          max={20}
          value={escalateAfterFailures}
          onChange={(e) => setEscalateAfterFailures(Number(e.target.value))}
          className="text-sm w-24"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="mute" className="text-xs">Mute patterns (one regex per line)</Label>
        <Textarea
          id="mute"
          rows={3}
          value={mutePatterns}
          onChange={(e) => setMutePatterns(e.target.value)}
          placeholder={"weekly news roundup\\nworld cup update"}
          className="text-xs font-mono"
        />
        <p className="text-[11px] text-muted-foreground">
          Changes whose summary or detail matches any pattern are auto-muted (no alerts; still recorded).
        </p>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting} size="sm">
          {submitting ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={resetFailures}
          disabled={submitting}
        >
          Reset failure streak
        </Button>
      </div>
    </form>
  );
}
