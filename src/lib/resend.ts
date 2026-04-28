import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function severityMeta(severity: number) {
  if (severity >= 5) return { label: "Critical",   color: "#dc2626", bg: "#fef2f2", border: "#fecaca" };
  if (severity >= 4) return { label: "Important",  color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" };
  if (severity >= 3) return { label: "Notable",    color: "#d97706", bg: "#fffbeb", border: "#fde68a" };
  if (severity >= 2) return { label: "Minor",      color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" };
  return                     { label: "Minimal",   color: "#94a3b8", bg: "#f8fafc", border: "#e2e8f0" };
}

function renderDiff(diff: string, maxLines = 25) {
  return diff
    .split("\n")
    .slice(0, maxLines)
    .map((line) => {
      if (line.startsWith("+"))
        return `<div style="color:#065F46;background:#D1FAE5;padding:1px 8px;margin:1px 0;border-radius:3px;font-size:11px;font-family:'IBM Plex Mono',monospace;">${esc(line)}</div>`;
      if (line.startsWith("-"))
        return `<div style="color:#991B1B;background:#FEE2E2;padding:1px 8px;margin:1px 0;border-radius:3px;font-size:11px;font-family:'IBM Plex Mono',monospace;">${esc(line)}</div>`;
      return `<div style="color:#9494B0;padding:1px 8px;font-size:11px;font-family:'IBM Plex Mono',monospace;">${esc(line)}</div>`;
    })
    .join("");
}

/* ── Doc design tokens for email ──
   --bg: #EFEFF7  --bg-1: #F5F5FC  --accent: #6C63FF
   --ink: #0D0D1C  --ink-2: #5A5A7A  --ink-3: #9494B0
   --line: #E8E8F2  --line-2: #D4D4E8
*/
function changeCard(change: {
  id: string;
  siteName: string;
  siteUrl: string;
  severity: number;
  category: string;
  summary: string;
  detail?: string | null;
  diffText: string;
  detectedAt: Date;
}, baseUrl: string) {
  const { label, color, bg, border } = severityMeta(change.severity);
  const catLabel = change.category.replace(/_/g, " ");
  const ago = Math.round((Date.now() - change.detectedAt.getTime()) / 3600000);
  const agoStr = ago < 1 ? "< 1 hour ago" : ago === 1 ? "1 hour ago" : ago < 24 ? `${ago} hours ago` : `${Math.round(ago / 24)} days ago`;

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5FC;border:1px solid #E8E8F2;border-left:3px solid ${color};border-radius:6px;margin-bottom:12px;overflow:hidden;">
    <tr><td style="padding:18px 22px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <!-- Severity badge — doc pill style -->
            <span style="display:inline-block;background:${bg};color:${color};border:1px solid ${border};padding:2px 9px;border-radius:100px;font-family:'IBM Plex Mono',monospace;font-size:9.5px;font-weight:500;letter-spacing:0.04em;">${label}</span>
            <!-- Category — accent pill -->
            <span style="display:inline-block;background:rgba(108,99,255,0.08);color:#6C63FF;border:1px solid rgba(108,99,255,0.20);padding:2px 9px;border-radius:100px;font-family:'IBM Plex Mono',monospace;font-size:9.5px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;margin-left:6px;">${catLabel}</span>
          </td>
          <td align="right">
            <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#9494B0;">${agoStr}</span>
          </td>
        </tr>
      </table>

      <div style="font-size:15px;font-weight:600;color:#0D0D1C;margin-top:10px;line-height:1.4;">${esc(change.summary)}</div>
      ${change.detail ? `<div style="font-size:13px;color:#5A5A7A;margin-top:6px;line-height:1.6;">${esc(change.detail)}</div>` : ""}

      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#9494B0;margin-top:8px;">
        <a href="${esc(change.siteUrl)}" style="color:#6C63FF;text-decoration:none;">${esc(change.siteName)}</a>
      </div>
    </td></tr>

    <tr><td style="padding:14px 22px 0;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9.5px;font-weight:600;color:#9494B0;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">What Changed</div>
      <div style="background:#EFEFF7;border:1px solid #E8E8F2;border-radius:6px;padding:14px;overflow:hidden;">
        ${renderDiff(change.diffText, 20)}
      </div>
    </td></tr>

    <tr><td style="padding:16px 22px 18px;">
      <a href="${baseUrl}/changes/${change.id}" style="display:inline-block;background:#6C63FF;color:#ffffff;text-decoration:none;padding:7px 16px;border-radius:6px;font-size:12px;font-weight:600;letter-spacing:0.01em;">View full diff →</a>
    </td></tr>
  </table>`;
}

function buildDigestHtml(changes: Parameters<typeof changeCard>[0][], baseUrl: string) {
  const count = changes.length;
  const critCount = changes.filter((c) => c.severity >= 4).length;
  const notableCount = changes.filter((c) => c.severity === 3).length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VisaWatch Alert Digest</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#EFEFF7;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;font-size:15px;line-height:1.65;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#EFEFF7;padding:36px 0 48px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0">

      <!-- Brand bar -->
      <tr><td style="padding-bottom:24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:middle;">
              <!-- Brand icon — accent-dim bg, accent-line border -->
              <div style="display:inline-block;background:rgba(108,99,255,0.08);border:1px solid rgba(108,99,255,0.20);border-radius:7px;width:28px;height:28px;text-align:center;line-height:28px;vertical-align:middle;">
                <span style="color:#6C63FF;font-size:14px;font-weight:700;">V</span>
              </div>
              <!-- Instrument Serif brand name -->
              <span style="font-family:'Instrument Serif',Georgia,serif;font-size:17px;color:#0D0D1C;vertical-align:middle;margin-left:8px;letter-spacing:-0.01em;">VisaWatch</span>
            </td>
            <td align="right" style="vertical-align:middle;">
              <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#9494B0;letter-spacing:0.05em;">${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Hero card — bg-1 surface, accent left accent-line top border -->
      <tr><td style="background:#F5F5FC;border:1px solid #E8E8F2;border-top:3px solid #6C63FF;border-radius:6px;padding:32px;margin-bottom:0;">
        <!-- Eyebrow -->
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;color:#6C63FF;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:16px;display:inline-flex;align-items:center;gap:8px;padding:5px 12px;border:1px solid rgba(108,99,255,0.20);border-radius:100px;background:rgba(108,99,255,0.08);">
          <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#6C63FF;"></span>
          Visa Policy Alert Digest
        </div>

        <!-- Serif headline -->
        <div style="font-family:'Instrument Serif',Georgia,serif;font-size:36px;font-weight:400;color:#0D0D1C;line-height:1.05;letter-spacing:-0.025em;margin-bottom:12px;">
          <em style="font-style:italic;color:#6C63FF;">${count}</em> significant change${count !== 1 ? "s" : ""} detected
        </div>

        <!-- Sub stats -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">
          ${critCount > 0 ? `<span style="display:inline-block;background:#FEE2E2;color:#991B1B;border:1px solid #FECACA;padding:2px 10px;border-radius:100px;font-family:'IBM Plex Mono',monospace;font-size:9.5px;font-weight:500;">${critCount} Critical / Important</span>` : ""}
          ${notableCount > 0 ? `<span style="display:inline-block;background:#FEF3C7;color:#92400E;border:1px solid #FDE68A;padding:2px 10px;border-radius:100px;font-family:'IBM Plex Mono',monospace;font-size:9.5px;font-weight:500;">${notableCount} Notable</span>` : ""}
        </div>
      </td></tr>

      <!-- Hairline spacer -->
      <tr><td style="height:1px;background:#E8E8F2;"></td></tr>

      <!-- Change cards -->
      <tr><td style="background:#EFEFF7;padding:20px 0;">
        ${changes.map((c) => changeCard(c, baseUrl)).join("")}
      </td></tr>

      <!-- Dashboard CTA -->
      <tr><td style="background:#F5F5FC;border:1px solid #E8E8F2;border-radius:6px;padding:28px;text-align:center;">
        <div style="font-family:'Instrument Serif',Georgia,serif;font-size:22px;color:#0D0D1C;margin-bottom:6px;">Open your dashboard</div>
        <div style="font-size:13px;color:#5A5A7A;margin-bottom:20px;">Filter by site, severity, or category.</div>
        <a href="${baseUrl}" style="display:inline-block;background:#6C63FF;color:#ffffff;text-decoration:none;padding:10px 28px;border-radius:6px;font-size:13px;font-weight:600;letter-spacing:0.01em;">Open Dashboard →</a>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:24px 0 0;text-align:center;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#9494B0;line-height:1.8;letter-spacing:0.02em;">
          You're receiving this because alerts are enabled on your VisaWatch account.<br>
          <a href="${baseUrl}/settings" style="color:#6C63FF;text-decoration:none;">Manage preferences</a>
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/* ── Single change alert (used by the cron pipeline) ── */
export async function sendChangeAlert(params: {
  siteName: string;
  siteUrl: string;
  changeId: string;
  severity: number;
  category: string;
  summary: string;
  detail?: string | null;
  diffSnippet: string;
}) {
  const recipients = await import("@/lib/db").then(({ db }) =>
    db.user.findMany({ where: { receivesAlerts: true }, select: { email: true } })
  );
  const emails = recipients.map((u) => u.email).filter(Boolean) as string[];
  if (emails.length === 0) return;

  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";
  const { label } = severityMeta(params.severity);

  // Build a minimal single-change digest
  const html = buildDigestHtml(
    [{
      id: params.changeId,
      siteName: params.siteName,
      siteUrl: params.siteUrl,
      severity: params.severity,
      category: params.category,
      summary: params.summary,
      detail: params.detail,
      diffText: params.diffSnippet,
      detectedAt: new Date(),
    }],
    baseUrl
  );

  await resend.emails.send({
    from: process.env.RESEND_FROM ?? "onboarding@resend.dev",
    to: emails,
    subject: `[${label}] ${params.siteName}: ${params.summary.slice(0, 80)}`,
    html,
  });
}

/* ── Digest of all recent significant changes (used by the Settings button) ── */
export async function sendDigest(recipientEmail: string): Promise<{ count: number }> {
  const { db } = await import("@/lib/db");

  const changes = await db.change.findMany({
    where: { severity: { gte: 3 } },
    orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
    take: 10,
    include: { site: { select: { name: true, url: true } } },
  });

  if (changes.length === 0) return { count: 0 };

  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";

  const payload = changes.map((c) => ({
    id: c.id,
    siteName: c.site.name,
    siteUrl: c.site.url,
    severity: c.severity,
    category: c.category,
    summary: c.summary,
    detail: c.detail,
    diffText: c.diffText,
    detectedAt: c.detectedAt,
  }));

  const html = buildDigestHtml(payload, baseUrl);

  await resend.emails.send({
    from: process.env.RESEND_FROM ?? "onboarding@resend.dev",
    to: [recipientEmail],
    subject: `VisaWatch digest — ${changes.length} important visa change${changes.length !== 1 ? "s" : ""}`,
    html,
  });

  return { count: changes.length };
}
