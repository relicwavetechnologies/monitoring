import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendChangeAlert({
  siteName,
  siteUrl,
  changeId,
  severity,
  category,
  summary,
  detail,
  diffSnippet,
}: {
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
    db.user.findMany({
      where: { receivesAlerts: true },
      select: { email: true },
    })
  );

  const emails = recipients.map((u) => u.email).filter(Boolean) as string[];
  if (emails.length === 0) return;

  const dashboardUrl = `${process.env.AUTH_URL}/changes/${changeId}`;
  const severityColor = severity >= 4 ? "#ef4444" : severity === 3 ? "#f59e0b" : "#6b7280";
  const severityLabel = severity >= 4 ? "CRITICAL" : severity === 3 ? "IMPORTANT" : "MINOR";
  const categoryLabel = category.replace(/_/g, " ");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Visa Monitor Alert</title></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;border:1px solid #2a2a2a;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:#111111;padding:24px 32px;border-bottom:1px solid #2a2a2a;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="font-size:13px;font-weight:600;color:#6b7280;letter-spacing:0.1em;text-transform:uppercase;">Visa Monitor</span>
                <div style="font-size:22px;font-weight:700;color:#ffffff;margin-top:4px;">${siteName}</div>
                <div style="font-size:13px;color:#6b7280;margin-top:2px;">${siteUrl}</div>
              </td>
              <td align="right" valign="top">
                <span style="display:inline-block;background:${severityColor}22;color:${severityColor};border:1px solid ${severityColor}44;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600;letter-spacing:0.08em;">${severityLabel}</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Category + Summary -->
        <tr><td style="padding:28px 32px 0;">
          <div style="font-size:11px;font-weight:600;color:#6b7280;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">${categoryLabel}</div>
          <div style="font-size:18px;font-weight:600;color:#ffffff;line-height:1.4;">${summary}</div>
          ${detail ? `<div style="font-size:14px;color:#9ca3af;margin-top:12px;line-height:1.6;">${detail}</div>` : ""}
        </td></tr>

        <!-- Diff snippet -->
        <tr><td style="padding:24px 32px 0;">
          <div style="font-size:11px;font-weight:600;color:#6b7280;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;">What Changed</div>
          <div style="background:#0f0f0f;border:1px solid #2a2a2a;border-radius:8px;padding:16px;font-family:'Courier New',monospace;font-size:12px;line-height:1.7;overflow:hidden;max-height:300px;">
            ${diffSnippet
              .split("\n")
              .slice(0, 30)
              .map((line) => {
                if (line.startsWith("+"))
                  return `<div style="color:#4ade80;background:#4ade8011;">${escapeHtml(line)}</div>`;
                if (line.startsWith("-"))
                  return `<div style="color:#f87171;background:#f8717111;">${escapeHtml(line)}</div>`;
                return `<div style="color:#6b7280;">${escapeHtml(line)}</div>`;
              })
              .join("")}
          </div>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:28px 32px 32px;">
          <a href="${dashboardUrl}" style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">View Full Diff →</a>
          <div style="margin-top:20px;padding-top:20px;border-top:1px solid #2a2a2a;font-size:12px;color:#4b5563;">
            You're receiving this because you have alerts enabled in Visa Monitor.
            <a href="${process.env.AUTH_URL}/settings" style="color:#6b7280;">Manage preferences</a>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: process.env.RESEND_FROM ?? "onboarding@resend.dev",
    to: emails,
    subject: `[${severityLabel}] ${siteName}: ${summary.slice(0, 80)}`,
    html,
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
