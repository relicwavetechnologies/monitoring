"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Send, Loader2, CheckCircle2 } from "lucide-react";

interface DigestButtonProps {
  email: string;
}

export function DigestButton({ email }: DigestButtonProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const sendDigest = async () => {
    setLoading(true);
    setSent(false);
    try {
      const res = await fetch("/api/alerts/digest", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        toast.error("Failed to send", { description: data.error ?? "Unknown error" });
        return;
      }

      setSent(true);
      toast.success("Digest sent!", { description: data.message });
      setTimeout(() => setSent(false), 5000);
    } catch {
      toast.error("Network error — could not send digest.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">Send alert digest now</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Emails all significant changes (severity ≥ 3) to{" "}
          <span className="font-medium text-foreground">{email}</span> immediately.
        </p>
      </div>

      <Button
        onClick={sendDigest}
        disabled={loading}
        variant={sent ? "outline" : "default"}
        className={
          sent
            ? "border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-50 gap-2"
            : "gap-2 bg-violet-600 hover:bg-violet-700 text-white"
        }
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" />Sending…</>
        ) : sent ? (
          <><CheckCircle2 className="h-4 w-4" />Sent!</>
        ) : (
          <><Send className="h-4 w-4" />Send Digest</>
        )}
      </Button>
    </div>
  );
}
