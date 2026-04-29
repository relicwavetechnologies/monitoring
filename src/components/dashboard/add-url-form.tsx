"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export function AddUrlForm({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [selector, setSelector] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/urls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          ...(selector ? { contentSelector: selector } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.fieldErrors?.url?.[0] ?? "Failed");
      }
      toast.success("URL added");
      setUrl("");
      setSelector("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error("Could not add URL", {
        description: err instanceof Error ? err.message : "unknown",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3 w-3" />
        Add URL
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="border rounded-md p-3 space-y-2 bg-muted/20">
      <div className="space-y-1">
        <Label htmlFor="url" className="text-xs">URL</Label>
        <Input
          id="url"
          type="url"
          required
          placeholder="https://example.com/visa"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="selector" className="text-xs">Content selector (optional)</Label>
        <Input
          id="selector"
          placeholder="main"
          value={selector}
          onChange={(e) => setSelector(e.target.value)}
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
          className="text-xs"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
