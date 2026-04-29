/**
 * Pure mute-pattern evaluation. A MonitoredUrl carries a list of regex
 * strings; a Change is auto-muted when its summary matches any of them.
 *
 * Used by run-poll right after the classifier returns, before the Change
 * row is inserted. Muted changes are recorded for the audit trail with
 * `muted: true` and never trigger notifications.
 */

export interface MuteCheckInput {
  summary: string;
  detail: string | null;
  category: string;
  mutePatterns: string[];
}

export function shouldMute(input: MuteCheckInput): {
  muted: boolean;
  matchedPattern: string | null;
} {
  if (input.mutePatterns.length === 0) return { muted: false, matchedPattern: null };

  // Combine summary + detail + category into one searchable string —
  // mutes can hit any of them.
  const haystack = `${input.summary}\n${input.detail ?? ""}\n${input.category}`;

  for (const p of input.mutePatterns) {
    try {
      const re = new RegExp(p, "i");
      if (re.test(haystack)) return { muted: true, matchedPattern: p };
    } catch {
      // ignore invalid regex — schema validation should catch these but
      // we'd rather skip a bad pattern than crash the pipeline.
    }
  }
  return { muted: false, matchedPattern: null };
}
