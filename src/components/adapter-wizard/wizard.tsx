"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Globe,
  Wand2,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["URL", "AI Analysis", "Review & Save"] as const;

interface DraftAdapter {
  name: string;
  contentSelector: string;
  stripPatterns: string[];
  pollIntervalMin: number;
  renderMode: "STATIC" | "JS";
  reasoning: string;
}

export function AdapterWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<DraftAdapter | null>(null);
  const [preview, setPreview] = useState("");
  const [suggestJs, setSuggestJs] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [selector, setSelector] = useState("");
  const [stripText, setStripText] = useState("");
  const [pollInterval, setPollInterval] = useState("60");
  const [renderMode, setRenderMode] = useState<"STATIC" | "JS">("STATIC");
  const [isActive, setIsActive] = useState(true);

  const analyse = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/sites/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      setDraft(data.draft);
      setPreview(data.preview);
      setSuggestJs(data.suggestJs);

      // Pre-populate editable fields
      setName(data.draft.name);
      setSelector(data.draft.contentSelector);
      setStripText(data.draft.stripPatterns.join("\n"));
      setPollInterval(String(data.draft.pollIntervalMin));
      setRenderMode(data.draft.renderMode);

      setStep(2);
      toast.success("Analysis complete", { description: "Review and adjust the settings below." });
    } catch (err) {
      toast.error("Analysis failed", { description: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const patterns = stripText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          url: url.trim(),
          contentSelector: selector.trim() || "body",
          stripPatterns: patterns,
          pollIntervalMin: parseInt(pollInterval) || 60,
          renderMode,
          isActive,
        }),
      });

      if (!res.ok) throw new Error("Failed to save site");

      const site = await res.json();
      toast.success("Site added!", { description: `${name} is now being monitored.` });
      router.push(`/sites/${site.id}`);
      router.refresh();
    } catch (err) {
      toast.error("Failed to save", { description: String(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
                i < step
                  ? "bg-emerald-600 text-white"
                  : i === step
                    ? "bg-blue-600 text-white"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-sm",
                i === step ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Step 0 + 1: URL input and analysis */}
      {step <= 1 && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Enter the URL to monitor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://in.usembassy.gov/mumbai/"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="font-mono text-sm bg-muted/30 border-border/50"
                onKeyDown={(e) => e.key === "Enter" && step === 0 && setStep(1)}
              />
              <p className="text-xs text-muted-foreground">
                Must be a public page — AI will fetch and analyse it to suggest optimal settings.
              </p>
            </div>

            {step === 0 && (
              <Button
                className="w-full gap-2"
                onClick={() => setStep(1)}
                disabled={!url.trim()}
              >
                <Wand2 className="h-4 w-4" />
                Analyse with AI
              </Button>
            )}

            {step === 1 && (
              <Button
                className="w-full gap-2"
                onClick={analyse}
                disabled={loading || !url.trim()}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Analysing…</>
                ) : (
                  <><Wand2 className="h-4 w-4" />Start Analysis</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review */}
      {step === 2 && draft && (
        <>
          {suggestJs && (
            <div className="flex items-start gap-2.5 p-3 bg-amber-950/40 border border-amber-900/60 rounded-lg text-sm text-amber-300">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                The page HTML looks sparse — it may be JavaScript-rendered. Consider switching
                to <strong>JS mode</strong> below.
              </span>
            </div>
          )}

          {draft.reasoning && (
            <Card className="bg-muted/20 border-border/40">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground italic">
                  <span className="font-medium text-foreground not-italic">AI reasoning: </span>
                  {draft.reasoning}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name">Site Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-muted/30 border-border/50"
                placeholder="US Embassy Mumbai"
              />
            </div>

            {/* Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="selector">
                Content Selector
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  CSS selector for the relevant region
                </span>
              </Label>
              <Input
                id="selector"
                value={selector}
                onChange={(e) => setSelector(e.target.value)}
                className="font-mono text-sm bg-muted/30 border-border/50"
                placeholder="main"
              />
            </div>

            {/* Strip patterns */}
            <div className="space-y-1.5">
              <Label htmlFor="strip">
                Strip Patterns
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  One regex per line — noise to remove before hashing
                </span>
              </Label>
              <Textarea
                id="strip"
                value={stripText}
                onChange={(e) => setStripText(e.target.value)}
                className="font-mono text-xs bg-muted/30 border-border/50 resize-none"
                rows={5}
                placeholder={`\\d{1,2}:\\d{2}:\\d{2}\nLast updated .*?\\n`}
              />
            </div>

            {/* Poll interval + Render mode */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="poll">Poll Interval (minutes)</Label>
                <Input
                  id="poll"
                  type="number"
                  min="15"
                  max="1440"
                  value={pollInterval}
                  onChange={(e) => setPollInterval(e.target.value)}
                  className="bg-muted/30 border-border/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Render Mode</Label>
                <Select value={renderMode} onValueChange={(v) => setRenderMode(v as "STATIC" | "JS")}>
                  <SelectTrigger className="bg-muted/30 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STATIC">Static (fast)</SelectItem>
                    <SelectItem value="JS">JS / SPA (slower)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Activate monitoring immediately</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  First poll will run within 5 minutes of saving.
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          <Separator />

          {/* Preview */}
          {preview && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Extracted Text Preview (first 2000 chars)
              </Label>
              <ScrollArea className="h-48 rounded-lg border border-border/50 bg-[#0d0d0d]">
                <pre className="p-4 text-xs font-mono text-zinc-400 whitespace-pre-wrap break-all">
                  {preview}
                </pre>
              </ScrollArea>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="border-border/50"
              onClick={() => { setStep(0); setDraft(null); }}
            >
              Start over
            </Button>
            <Button className="flex-1 gap-2" onClick={save} disabled={saving || !name.trim()}>
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" />Save & Start Monitoring</>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
