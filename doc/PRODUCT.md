# VisaWatch — product reference

A factual description of what the product does and what every page
contains. No design or styling notes.

---

## 1 · What VisaWatch is

VisaWatch monitors visa-authority and embassy websites. It fetches
each monitored URL on a schedule, detects content changes, classifies
them with rules + an LLM, and alerts subscribed users when a change
matters (fee changes, appointment availability, new document
requirements, suspended/resumed services).

The system is **multi-tenant per Site** — a "Site" is a logical
container (e.g. "US Embassy Mumbai") that owns one or more
**MonitoredUrl** rows (specific pages on that site). Snapshots,
changes, and most monitoring config are scoped to a MonitoredUrl;
policy thresholds (severity threshold, confirm window, etc.) live on
the parent Site.

Users sign in, configure sites and URLs, subscribe to alerts via
email / Slack / generic webhook, and review changes through the
dashboard. Operations (queue health, costs, classifier metadata)
are visible on a separate admin page.

---

## 2 · Authentication & access

- Auth is provided by NextAuth with both **password** (Credentials
  provider) and **magic-link email** (Resend provider) flows.
- Sign-up is gated by an `ALLOWED_EMAILS` env-var whitelist
  (comma-separated). Empty whitelist = anyone with a valid email can
  register.
- All dashboard pages require a session; unauthenticated users are
  redirected to `/login`.
- All `/api/cron/*` endpoints are protected by a `CRON_SECRET` bearer
  token instead of a session.

---

## 3 · Sitemap

| Path | Purpose |
|---|---|
| `/login` | Sign in / magic link |
| `/` | Overview — recent changes, stats, AI insights |
| `/sites` | List of all Sites |
| `/sites/new` | Wizard to add a new Site |
| `/sites/[id]` | Per-Site dashboard |
| `/urls/[id]` | Per-MonitoredUrl dashboard |
| `/changes/[id]` | Detail view of a single Change |
| `/subscriptions` | User-scoped alert subscriptions |
| `/admin` | Operational dashboard |
| `/settings` | User profile + global alert preferences |

API routes are out of scope for this document; see `RUNBOOK.md` for
operational endpoints (`/api/healthcheck`, `/api/admin/metrics`,
`/api/admin/queue`, etc.).

---

## 4 · Page-by-page reference

For each page the sections below describe:

- **Purpose** — what the page is for
- **Contents** — the fields, sections, and controls present
- **Actions** — what the user can do here

### 4.1 · `/login`

**Purpose.** Authenticate the user.

**Contents.**
- Brand mark and product name.
- A heading like "Sign in" with a one-line subtitle.
- A tab or segmented control switching between two paths:
  - **Password** — email field + password field.
  - **Magic link** — email field only.
- Submit button:
  - "Sign in" on the password tab.
  - "Send magic link" on the magic-link tab.
- A footer line indicating no public sign-up exists ("Need access?
  Contact your admin.").
- When the URL contains `?verify=1`, an inline confirmation note
  ("Check your inbox to verify your email.") is shown above the form.
- When auth fails, an inline error line is shown above the form.

**Actions.**
- Submit credentials → on success, navigate to the original
  `callbackUrl` (defaults to `/`).
- Submit magic-link request → success state shows "Email sent."

---

### 4.2 · `/` Overview

**Purpose.** Show what changed recently across all monitored sites,
plus a few aggregate stats and any AI-generated insights.

**Contents.**
- **Hero block** — page label "Dashboard", title "Overview", and a
  one-line description: *"Every visa-related change detected across
  your monitored sites — sorted by what matters."*
- **Stats grid** (four cards):
  1. Total monitored sites + a sub-label showing how many are active.
  2. Total changes ever recorded.
  3. Notable changes (severity ≥ 3) — i.e. the alert-eligible count.
  4. Sites OK — count of active sites with no recent issues.
- **AI Insights section** *(only present if at least one Site has
  `aiAnalysis` content with parsed notices)*:
  - Section label "AI Insights" with a sub-line clarifying these
    are pinpointed concerns from on-demand site analysis, not
    detected changes.
  - One card per notice. Each card contains:
    - A severity-tone label (e.g. "Important", "Notable").
    - The site name as a link.
    - The notice text (truncated to ~3 lines).
    - A "Visit site" footer link that opens the source URL in a new
      tab.
- **Significant changes section** *(visible if any change with
  severity ≥ 3 exists in the most-recent 20)*:
  - Heading "Significant" with a count.
  - One row per change. Each row contains:
    - Site name (linkable).
    - Category label (Policy / Fee / Appointment / Documents /
      Navigation / Cosmetic / Unknown).
    - Severity indication.
    - The change summary (one line, the LLM's headline).
    - Optional detail (truncated to two lines).
    - Relative timestamp.
    - The whole row links to `/changes/[id]`.
- **Minor / cosmetic section** — same row format, scoped to severity
  < 3 changes.

**Actions.**
- Click any change row → `/changes/[id]`.
- Click any site name → `/sites/[id]`.
- Click an AI-insight footer → opens source URL in new tab.

**Empty state.** When there are no changes at all, an empty placeholder
where the change list would be, with text "No changes detected yet"
and a hint ("Add a site and trigger a poll to get started").

---

### 4.3 · `/sites`

**Purpose.** Catalogue of every Site with a summary of state and a
shortcut to add new ones.

**Contents.**
- Hero block — label "Catalogue", title "Sites", a sub-line showing
  total Site count and total MonitoredUrl count.
- Primary "Add site" action linking to `/sites/new`.
- A list of Site rows. Each row contains:
  - Site name.
  - Active or Paused indicator.
  - Hostname (extracted from `Site.url`).
  - Number of MonitoredUrls under this Site.
  - The most recent Change for this Site (severity indicator + summary,
    truncated). Empty when none.
  - Relative time of last poll (`lastCheckedAt`). Shows `—` when
    never.
  - Total number of Changes for this Site.
  - Inline "Poll" button.
  - Click target on each row navigates to `/sites/[id]`.
- Empty state when no Sites exist: a placeholder with "No sites yet"
  and an inline CTA to add one.

**Actions.**
- Click a site → `/sites/[id]`.
- Click "Poll" on a row → triggers `POST /api/sites/[id]/poll`,
  showing a toast with the aggregated outcome.
- Click "Add site" → `/sites/new`.

---

### 4.4 · `/sites/new`

**Purpose.** Wizard to add a new Site (and its first MonitoredUrl)
with AI-suggested defaults.

**Contents.**
- Hero block — title "Add new site" with the explanation that AI will
  analyse the URL and suggest settings.
- **Three-step indicator** at the top of the wizard:
  1. URL
  2. AI Analysis
  3. Review & Save
- **Step 1 (URL)** — single card:
  - URL input field.
  - Help text noting the page must be publicly reachable.
  - Primary button "Analyse with AI".
- **Step 2 (analysing)** — same card with the button replaced by a
  "Analysing…" loading state. The bootstrap endpoint
  (`POST /api/sites/bootstrap`) fetches the URL once, runs the LLM
  to suggest a name + selector + strip patterns + render mode, and
  also returns a preview of what the system would extract.
- **Step 3 (review)** — appears once analysis returns successfully.
  Sections, top to bottom:
  - **JS-mode warning** *(only when the static fetch returned <3000
    chars of HTML)* — a note suggesting JS render mode.
  - **AI reasoning callout** — italic text explaining why the LLM
    chose the selector and patterns it did.
  - **Editable form fields** (all pre-populated from the LLM's
    suggestions):
    - Site Name (text).
    - Content Selector (CSS selector, helper text "CSS selector for
      the relevant region").
    - Strip Patterns (regex per line, helper text "noise to remove
      before hashing").
    - Poll Interval in minutes (number, 15–1440).
    - Render Mode (dropdown: Static, JS).
    - "Activate monitoring immediately" toggle (default on, helper
      text "First poll will run within 5 minutes of saving").
  - **Extracted text preview** — a scrollable mono block showing the
    first 2000 chars of what the system extracted using the
    suggested selector and patterns. This is the user's verification
    that the configuration captures the right region.
- **Action row**:
  - "Start over" — resets the wizard to Step 1.
  - "Save & Start Monitoring" — submits.

**Actions.**
- Submit URL → triggers AI analysis.
- Edit any suggested field before saving.
- "Save & Start Monitoring" → `POST /api/sites`, which creates the
  Site **and** auto-creates the initial MonitoredUrl with the same
  config. On success, navigates to `/sites/[new-id]`.

**Failure modes.**
- Analysis failure (network, LLM timeout) → toast with error message,
  the wizard stays on Step 2 with a retry button.
- Save failure → toast with error, the wizard stays on Step 3.

---

### 4.5 · `/sites/[id]`

**Purpose.** Everything about one Site: its meta, its URLs, its
captured content, AI analysis output, and change history.

**Contents.**
- **Back link** to `/sites`.
- **Header**:
  - Site name.
  - Active / Paused indicator.
  - The Site URL displayed as a link with an external-link icon.
  - Action menu containing: Toggle Pause / Resume, Delete site,
    Trigger poll.
- **Stats grid** (four cards):
  1. Total Changes for this Site.
  2. Total Snapshots for this Site.
  3. Poll cadence (minutes).
  4. Last check (relative time).
- **Adapter configuration** *(collapsible)* — shows the legacy
  Site-level fields: render mode, content selector, poll interval,
  strip patterns. These are now used as defaults for new
  MonitoredUrls; the runtime reads per-URL config from MonitoredUrl
  rows.
- **Monitored URLs section** — the most active section on this page.
  Contains:
  - A header with the count of URLs and an "Add URL" inline form
    trigger.
  - Inline "Add URL" form (collapsed by default, expanded via the
    button). Fields: URL, optional contentSelector. Other fields
    inherit from the Site defaults at creation time.
  - One row per MonitoredUrl. Each row shows:
    - The full URL (in mono).
    - The current `fetchMode` (STATIC / PLAYWRIGHT / STEALTH /
      EXTERNAL).
    - "Paused" indicator if applicable.
    - Failure-streak indicator (`Nx <kind>`) if `consecutiveFailures
      > 0`.
    - Relative `lastCheckedAt`.
    - Inline Poll button.
    - Pause / resume toggle.
    - A chevron link to `/urls/[id]`.
  - Empty-state placeholder if no URLs exist.
- **Captured Content section** — shows the latest extracted text from
  the most-recent snapshot:
  - "Snapshot from <time>" header.
  - A character-count summary line.
  - An expandable mono block with the full extracted text.
  - Empty placeholder if no snapshots exist yet, with a hint to poll.
- **AI Analysis section** — a separate, on-demand deep analysis run
  against the most recent snapshot (different from change-detection).
  Shows:
  - "Last run <time>" if previously run.
  - The analysis output rendered as markdown.
  - An "Analyze with AI" button.
  - Empty placeholders if not yet run, or when no snapshot exists.
- **Change history** — list of recent Changes for this Site. Each
  row uses the same change-row format as the Overview page.

**Actions.**
- Pause / Activate the Site (PATCH).
- Delete the Site (cascades to MonitoredUrls, Snapshots, Changes).
- Add a MonitoredUrl.
- Trigger a poll across all the Site's MonitoredUrls.
- Trigger an on-demand AI analysis.
- Navigate to a MonitoredUrl detail.
- Navigate to a Change detail.

---

### 4.6 · `/urls/[id]`

**Purpose.** Inspect and configure one MonitoredUrl. This is where the
operator tunes per-URL fetch behavior, escalation thresholds, and
mute patterns.

**Contents.**
- **Back link** to the parent Site.
- **Hero**:
  - Page label "Monitored URL".
  - The URL as the title, linkable to the source.
  - Tier indicator (`fetchMode`).
  - Paused indicator if applicable.
  - Failure-streak indicator if applicable.
  - Inline "Poll now" button.
- **Stats grid** (four cards):
  1. Number of Changes for this URL.
  2. Number of Snapshots.
  3. Last check (relative time).
  4. Last failure (relative time, or `—` if none).
- **Configuration form** — editable fields:
  - **Content selector** (text input). Help: "CSS selector — falls
    back to `body` if not matched."
  - **Strip patterns** (multi-line textarea, regex per line).
  - **Fetch tier** (select):
    - STATIC — undici, fast/free.
    - PLAYWRIGHT — vanilla headless.
    - STEALTH — patchright.
    - EXTERNAL — third-party scraper API.
  - **Auto-escalate** (toggle). Helper: "Promote to the next tier
    after N consecutive BLOCKED failures."
  - **Escalate after N failures** (number, 1–20).
  - **Mute patterns** (textarea, regex per line). Helper: "Changes
    whose summary or detail matches any pattern are auto-muted (no
    alerts; still recorded)."
  - **Save** primary button.
  - **Reset failure streak** secondary button.
- **Changes for this URL** — list of Changes scoped to this URL,
  using the standard change-row format. Empty placeholder if none.

**Actions.**
- Save configuration (PATCH).
- Reset the failure counter (PATCH with `resetFailures: true`).
- Trigger a single-URL poll.
- Pause / resume the URL.
- Navigate to a Change detail.

---

### 4.7 · `/changes/[id]`

**Purpose.** Verify a single detected change. This is the page email
links land on. The user reads the AI's summary, checks the cited
evidence, examines the diff, and acknowledges.

**Contents.**
- **Back link** to the parent Site.
- **High-severity warning banner** *(only when `severity >= 4`)* —
  inline strip warning that the change may affect visa applications.
- **Status row** containing pills/labels for:
  - Severity (1–5 with a label).
  - Category (Policy / Fee / Appointment / Documents / Navigation /
    Cosmetic / Unknown).
  - Classifier status: one of
    - **VALIDATED** — every evidence quote was verified against the
      diff text.
    - **CLAMPED** — the LLM's severity was outside the rule-allowed
      range and was clamped (raw severity available in metadata).
    - **UNGROUNDED** — at least one evidence quote could not be
      verified; alert delivery was suppressed.
    - **FALLBACK** — the LLM call failed; severity defaulted to the
      rule floor.
  - "Muted" indicator if the change matched a `MonitoredUrl.mutePatterns` entry.
  - Email status (Sent / Failed / Skipped).
  - Detection timestamp.
- **Summary** — the LLM-written one-line headline of the change.
- **Detail** — supporting prose (optional).
- **Acknowledge button** — once acknowledged, no further notifications
  fire for this Change. The button changes to a disabled
  "Acknowledged" state.
- **Evidence quotes card** *(present when `evidenceQuotes` is
  non-empty)*:
  - Section label "Evidence from source · <count>".
  - One quote per line, rendered with a left-border accent and
    indented.
  - Each quote is a verbatim substring of the diff text (verified
    server-side at classification time).
- **URL + Confidence card**:
  - The MonitoredUrl this Change came from, linkable to `/urls/[id]`.
  - A confidence bar showing the LLM's self-reported confidence
    (0–100%).
  - A "Visit URL" link to the source.
- **Classifier metadata** *(collapsible, advanced)*:
  - Model used.
  - Prompt version.
  - Status.
  - Token counts (in/out).
  - Estimated USD cost.
  - Raw severity (what the LLM originally returned, before any
    clamp).
- **Content diff** — the full diff between the previous snapshot and
  the new one:
  - Added lines.
  - Removed lines.
  - Context lines.

**Actions.**
- Acknowledge the change (POST).
- Click the URL → `/urls/[id]`.
- Click the source link → opens the page in a new tab.

---

### 4.8 · `/subscriptions`

**Purpose.** Per-user alert subscription management. A subscription
specifies *for which Site* (or specific MonitoredUrl) and *via which
channel* the user wants to receive notifications.

**Contents.**
- Hero block — title "Subscriptions" with a sub-line explaining the
  model: scoped to a Site (or URL) and a delivery channel.
- A line stating the active subscription count.
- "New subscription" button (toggles the inline form).
- **Inline form** (when expanded):
  - Site (required, dropdown).
  - Channel (required, dropdown):
    - EMAIL — uses the user's account email and the configured
      Resend provider.
    - SLACK — incoming-webhook delivery.
    - WEBHOOK — generic JSON POST.
  - Webhook URL (required for SLACK and WEBHOOK; hidden for EMAIL).
  - Minimum severity (optional override). Default behaviour falls
    back to the Site's `severityThreshold`.
  - Submit + Cancel.
- **List of subscriptions**. Each row shows:
  - Channel label.
  - Minimum-severity override (if set).
  - "Paused" indicator if applicable.
  - The Site name (or URL ID if URL-scoped).
  - Truncated webhook URL preview (for SLACK/WEBHOOK).
  - Pause / Resume button.
  - Delete button.
- Empty placeholder if the user has no subscriptions.

**Actions.**
- Create a new subscription (POST).
- Pause / resume an existing subscription (PATCH).
- Delete a subscription (DELETE).

---

### 4.9 · `/admin`

**Purpose.** Operational overview for the engineer responsible for
keeping the system running.

**Contents.**
- Hero block — title "Admin" with a sub-line pointing to
  `/api/admin/metrics` for raw Prometheus counters.
- **DB rollups** (four cards):
  1. Active Sites.
  2. Active MonitoredUrls.
  3. Total Snapshots.
  4. Total Changes.
- **Queue depth card** — one mini-cell per queue:
  - `url.poll`
  - `email.send`
  - `email.sweep`
  - `tick.scan`
  Each shows the sum of currently-queued + in-flight jobs from
  pg-boss. Cells display `—` when the queue is unreachable.
- **Last 7 days** card (four cells):
  1. Number of Changes detected in the past 7 days.
  2. Total LLM cost in USD (summed `classifierCostUsd`).
  3. Total prompt tokens.
  4. Total completion tokens.
- **Severity distribution** card — five cells, one per severity 1–5,
  showing all-time counts.
- **Recent changes** list — last 10 Changes, each row showing:
  - Severity.
  - Classifier status.
  - Site name.
  - Truncated summary.
  - Estimated cost (when available).

**Actions.**
- This page is read-only. There are no editing controls.

---

### 4.10 · `/settings`

**Purpose.** Per-user account preferences and global alert toggles.

**Contents.**
- Hero block — title "Settings" with a sub-line.
- **Profile section**:
  - Name field (editable).
  - Email (read-only — used as the auth key).
  - Save button.
- **Alerts section**:
  - `receivesAlerts` toggle (legacy global flag — superseded by
    `/subscriptions` rows but kept for installations without
    explicit subscriptions).
  - "Send digest now" button — triggers
    `POST /api/alerts/digest`, which sends the user a summary email
    of the most recent significant changes.
- **Operations section**:
  - "Sign out" link.

**Actions.**
- Update profile (PATCH).
- Toggle the global alert flag.
- Send the digest email on demand.
- Sign out.

---

## 5 · Cross-page elements

These appear on every dashboard page (i.e. inside the
`(dashboard)` route group):

### 5.1 · Sidebar

A vertical navigation column on the left.

- Brand mark and product name.
- Version label.
- Navigation links:
  - Overview (`/`)
  - Sites (`/sites`)
  - Subscriptions (`/subscriptions`)
  - Admin (`/admin`)
  - Settings (`/settings`)
- "Add site" CTA link to `/sites/new`.
- Footer line indicating polling status ("Polling active").

### 5.2 · Topbar

A horizontal bar across the top of every dashboard page.

- Breadcrumb starting with the brand name and following the URL
  segments. Each non-final crumb is a link.
- Right side:
  - User avatar (initials).
  - Click opens a menu containing the user's name, email, a
    "Settings" link, and a "Sign out" action.

### 5.3 · Toasts

Async actions (poll, save, delete, ack, subscribe, etc.) surface
their outcome via a transient toast at the bottom-right of the
viewport. Each toast carries a status (success / info / warning /
error) and optionally a description line.

---

## 6 · Background behaviour visible to users

A few behaviours happen automatically and surface across multiple
pages:

- **Daily polling.** Every 5 minutes pg-boss enqueues one `url.poll`
  job per due MonitoredUrl. Each job fetches, extracts, diffs,
  classifies, and persists. The user sees the result as fresh
  Snapshots and possibly new Changes appearing in lists.
- **Stability window.** A detected diff isn't immediately classified
  as a Change. It's held as `pendingDiff` on the URL until the same
  hash persists past `Site.confirmAfterHours` (default 24 h). This
  means a single transient page glitch doesn't produce a Change.
- **Auto-escalation.** When a URL receives `escalateAfterFailures`
  consecutive BLOCKED responses (default 3), its `fetchMode` is
  promoted to the next tier and the failure counter resets. Visible
  on the URL detail and Site detail pages as a tier change + reset
  failure indicator.
- **Email retry.** Every 15 minutes pg-boss runs `email.sweep` which
  picks up any Change rows with `emailStatus = FAILED` whose
  exponential backoff has elapsed and retries delivery (up to 5
  attempts before marking the row as SKIPPED).
- **Subscriber delivery.** When a Change is classified as significant
  (severity ≥ site threshold AND confidence ≥ site confidence
  threshold AND classifier status ≠ UNGROUNDED), every matching
  Subscription row fires through its configured channel.

---

*Source of truth for the system's current behaviour. Update this
file whenever a page's contents change.*
