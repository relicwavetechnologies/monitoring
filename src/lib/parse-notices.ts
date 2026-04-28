export interface AiNotice {
  siteId: string;
  siteName: string;
  siteUrl: string;
  text: string;
  severity: 1 | 2 | 3 | 4 | 5;
  label: "Critical" | "Important" | "Notable" | "Info";
  color: string;
  bg: string;
  border: string;
}

const CRITICAL = [
  "suspend", "block", "halt", "clos", "emergency", "invalid", "ban",
  "denied", "rejected", "terminat", "compulsor", "immediately", "urgent",
  "alert", "scam", "fraud", "impersonat",
];
const IMPORTANT = [
  "increased", "fee", "new requirement", "mandatory", "changed", "required",
  "deadline", "extend", "restrict", "delay", "backlog", "temporary",
  "effective", "new policy", "tighten",
];
const NOTABLE = [
  "notice", "reminder", "update", "inform", "aware", "note", "please",
  "ensure", "check", "verify", "confirm",
];

function scoreNotice(text: string): AiNotice["severity"] {
  const t = text.toLowerCase();
  if (CRITICAL.some((kw) => t.includes(kw))) return 5;
  if (IMPORTANT.some((kw) => t.includes(kw))) return 4;
  if (NOTABLE.some((kw) => t.includes(kw))) return 3;
  return 2;
}

function severityMeta(s: AiNotice["severity"]): Pick<AiNotice, "label" | "color" | "bg" | "border"> {
  if (s >= 5) return { label: "Critical",  color: "#dc2626", bg: "#fef2f2", border: "#fecaca" };
  if (s >= 4) return { label: "Important", color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" };
  if (s >= 3) return { label: "Notable",   color: "#d97706", bg: "#fffbeb", border: "#fde68a" };
  return        { label: "Info",      color: "#6C63FF", bg: "rgba(108,99,255,0.06)", border: "rgba(108,99,255,0.20)" };
}

/**
 * Extract bullet-point notices from the ## ⚠️ Important Notices section
 * of an AI analysis markdown string.
 */
export function parseNotices(
  aiAnalysis: string,
  site: { id: string; name: string; url: string }
): AiNotice[] {
  // Find the Important Notices section
  const sectionMatch = aiAnalysis.match(
    /##\s*[⚠️🚨]*\s*Important Notices?\s*\n([\s\S]*?)(?=\n##\s|$)/i
  );
  if (!sectionMatch) return [];

  const sectionText = sectionMatch[1];

  // Extract bullet points: lines starting with - or * or a number
  const bullets = sectionText
    .split("\n")
    .map((l) => l.replace(/^[\s]*[-*•]\s*/, "").replace(/^\d+\.\s*/, "").trim())
    .filter((l) => l.length > 10); // skip empty / header lines

  return bullets
    .map((text): AiNotice => {
      // Strip markdown bold/italic for display
      const clean = text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").trim();
      const severity = scoreNotice(clean);
      return { siteId: site.id, siteName: site.name, siteUrl: site.url, text: clean, severity, ...severityMeta(severity) };
    })
    .sort((a, b) => b.severity - a.severity);
}
