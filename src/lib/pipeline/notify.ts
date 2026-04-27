import { sendChangeAlert } from "@/lib/resend";
import { db } from "@/lib/db";

const SEVERITY_THRESHOLD = 3;
const CONFIDENCE_THRESHOLD = 0.7;

export async function maybeNotify(changeId: string): Promise<void> {
  const change = await db.change.findUnique({
    where: { id: changeId },
    include: { site: true },
  });

  if (!change || change.emailSent) return;

  if (change.severity >= SEVERITY_THRESHOLD && change.confidence >= CONFIDENCE_THRESHOLD) {
    const snippetLines = change.diffText.split("\n").slice(0, 40).join("\n");

    await sendChangeAlert({
      siteName: change.site.name,
      siteUrl: change.site.url,
      changeId: change.id,
      severity: change.severity,
      category: change.category,
      summary: change.summary,
      detail: change.detail,
      diffSnippet: snippetLines,
    });

    await db.change.update({ where: { id: changeId }, data: { emailSent: true } });
  }
}
