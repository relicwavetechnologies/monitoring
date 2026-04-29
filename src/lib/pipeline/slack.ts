/**
 * Slack incoming-webhook delivery for Change alerts. The webhook URL is
 * per-Subscription (Subscription.webhookUrl). Format uses Slack Block Kit
 * so the alert renders nicely in modern Slack clients.
 *
 * No secret management — the webhook URL itself is the credential. Treat
 * Subscription.webhookUrl as sensitive and don't log it.
 */
import { fetch as undiciFetch } from "undici";
import { getLogger } from "@/lib/logger";

const log = getLogger("pipeline.slack");

export interface SlackDeliveryInput {
  webhookUrl: string;
  siteName: string;
  siteUrl: string;
  changeId: string;
  severity: number;
  category: string;
  summary: string;
  detail: string | null;
  evidenceQuotes: string[];
  dashboardUrl: string;
}

export async function sendSlackAlert(input: SlackDeliveryInput): Promise<"sent" | "failed"> {
  const sevEmoji =
    input.severity >= 5 ? ":rotating_light:" :
    input.severity >= 4 ? ":warning:" :
    input.severity >= 3 ? ":bell:" : ":speech_balloon:";

  const payload = {
    text: `${sevEmoji} *${input.siteName}* — ${input.summary}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${sevEmoji} ${input.siteName}`, emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*${input.summary}*` },
      },
      ...(input.detail
        ? [{ type: "section", text: { type: "mrkdwn", text: input.detail } }]
        : []),
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `*Severity* ${input.severity}/5  ·  *Category* ${input.category.replace(/_/g, " ")}` },
        ],
      },
      ...(input.evidenceQuotes.length > 0
        ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Evidence:*\n${input.evidenceQuotes
                  .slice(0, 3)
                  .map((q) => `> ${q}`)
                  .join("\n")}`,
              },
            },
          ]
        : []),
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open in dashboard" },
            url: input.dashboardUrl,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Open source" },
            url: input.siteUrl,
          },
        ],
      },
    ],
  };

  try {
    const res = await undiciFetch(input.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      log.error({ status: res.status, changeId: input.changeId }, "Slack webhook returned non-200");
      return "failed";
    }
    return "sent";
  } catch (err) {
    log.error({ err, changeId: input.changeId }, "Slack delivery threw");
    return "failed";
  }
}
