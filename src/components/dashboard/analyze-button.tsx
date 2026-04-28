"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MODELS = [
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    description: "Smarter · large context",
  },
  {
    id: "gemini-3-flash-lite-preview",
    label: "Gemini 3 Flash Lite",
    description: "Faster · cheaper",
  },
  {
    id: "gpt-5.4",
    label: "GPT-5.4",
    description: "OpenAI · best",
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 Mini",
    description: "OpenAI · fast",
  },
] as const;

export function AnalyzeButton({ siteId }: { siteId: string }) {
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(MODELS[0].id);
  const router = useRouter();

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error("Analysis failed", { description: data.error });
        return;
      }

      const modelLabel = MODELS.find((m) => m.id === model)?.label ?? model;
      toast.success("Analysis complete", {
        description: `${data.pagesCrawled ?? "?"} pages · ${modelLabel}`,
      });
      router.refresh();
    } catch {
      toast.error("Analysis failed", { description: "Could not reach the server." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Select value={model} onValueChange={(v) => v && setModel(v as typeof model)} disabled={loading}>
        <SelectTrigger className="h-8 text-xs w-44 border-border/50 bg-background focus:ring-violet-400/30">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MODELS.map((m) => (
            <SelectItem key={m.id} value={m.id} className="text-xs">
              <div className="flex flex-col gap-0.5 py-0.5">
                <span className="font-medium">{m.label}</span>
                <span className="text-muted-foreground text-[11px]">{m.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        size="sm"
        variant="outline"
        className={cn(
          "gap-1.5 h-8 text-xs border-violet-200 text-violet-700 hover:bg-violet-50 hover:border-violet-300",
          loading && "opacity-70 cursor-not-allowed"
        )}
        onClick={handleAnalyze}
        disabled={loading}
      >
        <Sparkles className={cn("h-3.5 w-3.5", loading && "animate-pulse")} />
        {loading ? "Analyzing…" : "Analyze"}
      </Button>
    </div>
  );
}
