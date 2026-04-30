"use client";

/**
 * Phase 8 wizard: paste a root URL, the LLM crawls + classifies sub-pages,
 * and the user sees a grid of topic cards. They check the ones they want
 * to monitor, choose a default polling cadence, click Save.
 *
 * Replaces the old "selector + strip-patterns" form. Users no longer see
 * any CSS or regex.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Globe,
  Wand2,
  CheckCircle2,
  ChevronRight,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";

const STEPS = ["URL", "Crawling", "Review & Save"] as const;

const CATEGORIES = ["POLICY", "FEES", "APPOINTMENTS", "DOCUMENTS", "NEWS", "OTHER", "SKIP"] as const;
type Category = (typeof CATEGORIES)[number];

interface TopicCard {
  title: string;
  summary: string;
  category: Category;
  importantFields: string[];
  contentSelector: string | null;
}

interface BootstrapPage {
  url: string;
  path: string;
  title: string;
  depth: number;
  skipped: boolean;
  card: TopicCard | null;
  textPreview: string;
}

interface BootstrapResponse {
  siteName: string;
  rootOrigin: string;
  fetchModeUsed: string;
  totalDiscovered: number;
  pages: BootstrapPage[];
  errors: Array<{ url: string; reason: string }>;
}

const CATEGORY_COLORS: Record<Category, { bg: string; ink: string }> = {
  POLICY: { bg: "rgba(99,102,241,0.10)", ink: "#4338CA" },
  FEES: { bg: "rgba(34,197,94,0.10)", ink: "#15803D" },
  APPOINTMENTS: { bg: "rgba(234,88,12,0.10)", ink: "#C2410C" },
  DOCUMENTS: { bg: "rgba(14,165,233,0.10)", ink: "#0369A1" },
  NEWS: { bg: "rgba(168,85,247,0.10)", ink: "#7E22CE" },
  OTHER: { bg: "rgba(115,115,115,0.10)", ink: "#525252" },
  SKIP: { bg: "rgba(115,115,115,0.06)", ink: "#737373" },
};

export function AdapterWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);

  // Per-page state on review screen
  const [siteName, setSiteName] = useState("");
  const [pollDefault, setPollDefault] = useState(60);
  const [keptByUrl, setKeptByUrl] = useState<Record<string, boolean>>({});
  const [showSkipped, setShowSkipped] = useState(false);

  const startCrawl = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setStep(1);
    try {
      const res = await fetch("/api/sites/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as BootstrapResponse;
      setBootstrap(data);
      setSiteName(data.siteName);
      // Pre-check all visa-relevant pages, leave SKIP unchecked.
      const initial: Record<string, boolean> = {};
      for (const p of data.pages) {
        initial[p.url] = !p.skipped && p.card !== null;
      }
      setKeptByUrl(initial);
      setStep(2);
      const kept = Object.values(initial).filter(Boolean).length;
      toast.success("Crawl complete", {
        description: `${data.pages.length} pages found, ${kept} look visa-relevant.`,
      });
    } catch (err) {
      toast.error("Crawl failed", { description: String(err) });
      setStep(0);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!bootstrap) return;
    const urlsToSave = bootstrap.pages
      .filter((p) => keptByUrl[p.url])
      .map((p) => ({
        url: p.url,
        card: p.card,
      }));
    if (urlsToSave.length === 0) {
      toast.error("Pick at least one page", { description: "Select cards to monitor." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: siteName.trim() || bootstrap.siteName,
          rootUrl: url.trim(),
          pollIntervalDefault: pollDefault,
          isActive: true,
          urls: urlsToSave,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const site = await res.json();
      toast.success("Site added", {
        description: `${siteName} is now monitoring ${urlsToSave.length} pages.`,
      });
      router.push(`/sites/${site.id}`);
      router.refresh();
    } catch (err) {
      toast.error("Failed to save", { description: String(err) });
    } finally {
      setSaving(false);
    }
  };

  const visiblePages = (bootstrap?.pages ?? []).filter((p) => showSkipped || !p.skipped);
  const keptCount = Object.values(keptByUrl).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular transition-colors"
              style={{
                background: i < step ? "var(--green)" : i === step ? "var(--foreground)" : "var(--background-2)",
                color: i <= step ? "white" : "var(--foreground-3)",
              }}
            >
              {i < step ? <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.4} /> : i + 1}
            </div>
            <span
              className="text-footnote-em"
              style={{
                color: i === step ? "var(--foreground)" : "var(--foreground-3)",
                fontWeight: i === step ? 600 : 500,
              }}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <ChevronRight
                className="h-4 w-4 mx-1"
                strokeWidth={2}
                style={{ color: "var(--foreground-4)" }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: URL input */}
      {step === 0 && (
        <div className="surface" style={{ padding: 24 }}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url" className="flex items-center gap-2">
                <Globe className="h-4 w-4" strokeWidth={1.8} />
                Root URL
              </Label>
              <Input
                id="url"
                type="url"
                placeholder="https://in.usembassy.gov/mumbai/"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="font-mono text-sm"
                onKeyDown={(e) => e.key === "Enter" && url.trim() && startCrawl()}
              />
              <p className="text-footnote" style={{ color: "var(--foreground-3)" }}>
                We&apos;ll crawl up to 25 same-origin pages and ask AI to identify which ones are
                visa-relevant. You&apos;ll review the cards before saving — no CSS or regex needed.
              </p>
            </div>
            <Button
              className="w-full gap-2"
              onClick={startCrawl}
              disabled={loading || !url.trim()}
            >
              <Wand2 className="h-4 w-4" />
              Crawl & analyse
            </Button>
          </div>
        </div>
      )}

      {/* Step 1: Crawling */}
      {step === 1 && (
        <div
          className="surface flex flex-col items-center justify-center text-center"
          style={{ padding: "48px 24px", minHeight: 240 }}
        >
          <Loader2
            className="h-7 w-7 animate-spin mb-4"
            style={{ color: "var(--foreground-3)" }}
            strokeWidth={1.6}
          />
          <p className="text-headline mb-1" style={{ color: "var(--foreground)" }}>
            Crawling {url ? new URL(url).hostname : "site"}…
          </p>
          <p className="text-footnote" style={{ color: "var(--foreground-3)" }}>
            Discovering pages, classifying topics. This usually takes 20-90 seconds.
          </p>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 2 && bootstrap && (
        <>
          {/* Site-level controls */}
          <div className="surface" style={{ padding: 20 }}>
            <div className="grid sm:grid-cols-[1fr_180px] gap-4 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="siteName">Site name</Label>
                <Input
                  id="siteName"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="US Embassy Mumbai"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="poll">Default polling (min)</Label>
                <Input
                  id="poll"
                  type="number"
                  min={15}
                  max={1440}
                  value={pollDefault}
                  onChange={(e) => setPollDefault(parseInt(e.target.value || "60") || 60)}
                />
              </div>
            </div>
            <p
              className="text-footnote mt-3"
              style={{ color: "var(--foreground-3)" }}
            >
              Polling cadence per page can be tweaked later. Categories like Appointments default
              to a tighter interval automatically.
            </p>
          </div>

          {/* Stats + filter */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 text-footnote" style={{ color: "var(--foreground-3)" }}>
              <span>
                <strong style={{ color: "var(--foreground)" }}>{bootstrap.pages.length}</strong> pages crawled
              </span>
              <span>·</span>
              <span>
                <strong style={{ color: "var(--foreground)" }}>{keptCount}</strong> selected
              </span>
              <span>·</span>
              <span className="mono">tier: {bootstrap.fetchModeUsed}</span>
              {bootstrap.errors.length > 0 && (
                <>
                  <span>·</span>
                  <span style={{ color: "var(--orange-ink)" }}>
                    {bootstrap.errors.length} fetch errors
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowSkipped((s) => !s)}
              className="subtle-link inline-flex items-center gap-1.5"
              style={{ fontSize: 12 }}
            >
              {showSkipped ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showSkipped ? "Hide" : "Show"} skipped
            </button>
          </div>

          {/* Card grid */}
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
          >
            {visiblePages.map((p) => {
              const isKept = !!keptByUrl[p.url];
              const cat = (p.card?.category ?? "OTHER") as Category;
              const palette = CATEGORY_COLORS[cat];
              return (
                <label
                  key={p.url}
                  className="cursor-pointer group"
                  style={{
                    background: "var(--background-1)",
                    border: `1px solid ${
                      isKept ? "var(--foreground)" : "var(--border)"
                    }`,
                    borderRadius: 12,
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    transition: "border-color 120ms ease, transform 120ms ease",
                    opacity: p.skipped ? 0.55 : 1,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={isKept}
                        onChange={(e) =>
                          setKeptByUrl((prev) => ({ ...prev, [p.url]: e.target.checked }))
                        }
                        className="shrink-0"
                      />
                      <span
                        className="pill shrink-0"
                        style={{
                          background: palette.bg,
                          color: palette.ink,
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {cat}
                      </span>
                    </div>
                    {p.skipped && (
                      <span className="pill pill-muted shrink-0" style={{ fontSize: 10 }}>
                        skip
                      </span>
                    )}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        letterSpacing: "-0.012em",
                        color: "var(--foreground)",
                        lineHeight: 1.35,
                      }}
                    >
                      {p.card?.title ?? p.title ?? p.path}
                    </div>
                    <div
                      className="mono mt-1 truncate"
                      style={{ fontSize: 11, color: "var(--foreground-4)" }}
                      title={p.url}
                    >
                      {p.path}
                    </div>
                  </div>
                  {p.card?.summary && (
                    <p
                      className="line-clamp-3"
                      style={{
                        fontSize: 12.5,
                        color: "var(--foreground-2)",
                        lineHeight: 1.5,
                      }}
                    >
                      {p.card.summary}
                    </p>
                  )}
                  {p.card && p.card.importantFields.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.card.importantFields.slice(0, 3).map((f) => (
                        <span
                          key={f}
                          className="pill pill-muted"
                          style={{ fontSize: 10, padding: "2px 6px" }}
                        >
                          {f}
                        </span>
                      ))}
                      {p.card.importantFields.length > 3 && (
                        <span
                          className="pill pill-muted"
                          style={{ fontSize: 10, padding: "2px 6px" }}
                        >
                          +{p.card.importantFields.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </label>
              );
            })}
          </div>

          {/* Errors block */}
          {bootstrap.errors.length > 0 && (
            <details className="surface" style={{ padding: 14 }}>
              <summary
                className="cursor-pointer flex items-center gap-2 text-footnote"
                style={{ color: "var(--foreground-3)" }}
              >
                <AlertCircle
                  className="h-3.5 w-3.5"
                  strokeWidth={2}
                  style={{ color: "var(--orange-ink)" }}
                />
                {bootstrap.errors.length} pages failed to fetch
              </summary>
              <ul className="mt-2 space-y-1 text-footnote mono" style={{ color: "var(--foreground-3)" }}>
                {bootstrap.errors.slice(0, 30).map((e) => (
                  <li key={e.url} className="truncate">
                    <span style={{ color: "var(--orange-ink)" }}>{e.reason}</span> — {e.url}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setStep(0);
                setBootstrap(null);
                setKeptByUrl({});
              }}
            >
              Start over
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={save}
              disabled={saving || keptCount === 0}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Monitor {keptCount} page{keptCount !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
