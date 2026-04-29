"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { toast } from "sonner";

export function AcknowledgeButton({
  changeId,
  acknowledged,
}: {
  changeId: string;
  acknowledged: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const ack = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/changes/${changeId}/ack`, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      toast.success("Change acknowledged");
      router.refresh();
    } catch {
      toast.error("Acknowledge failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (acknowledged) {
    return (
      <Button variant="outline" size="sm" disabled className="text-xs gap-1">
        <Check className="h-3 w-3" />
        Acknowledged
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" disabled={submitting} onClick={ack} className="text-xs gap-1">
      <Check className="h-3 w-3" />
      {submitting ? "…" : "Acknowledge"}
    </Button>
  );
}
