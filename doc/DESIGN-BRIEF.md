# VisaWatch — Design Brief

A complete handoff document for any designer (human or AI) tasked with
designing or improving the VisaWatch dashboard. This document is the
single source of truth for product intent, information architecture,
visual language, and per-page requirements. Read it end-to-end before
touching any page; jump into the per-page sections (§5) once you have
the system in your head.

---

## 1 · What VisaWatch is, in one sentence

A monitoring tool that watches embassy and visa-authority websites
daily, classifies what changed using rules + an LLM, and alerts a
small team of operators (consultants, immigration teams, a
back-office) when something matters — fees, appointment availability,
new document requirements, suspended/resumed services.

It is **not** a generic uptime monitor. Every UI choice should reflect
that the user cares about *meaning*, not *uptime*. A 200-OK fetch that
returns a Cloudflare challenge is failure; a paragraph rewrite that
changes a fee is success.

## 2 · Who uses it

Two personas:

- **The Operator** (primary): a consultant or back-office staffer who
  opens the dashboard 1–2× per day. Wants to scan recent changes,
  drill into the important ones, and get out. Will spend at most 30
  seconds on the overview page on a good day. Does not want to learn
  jargon. Reads English.

- **The Admin** (secondary): the engineer responsible for keeping the
  system running. Cares about queue depth, LLM cost, fetch failures,
  why a site auto-escalated to STEALTH. Visits the `/admin` page
  weekly, the per-URL detail when something looks off.

The Operator is who you design for by default. The Admin's needs go in
explicit admin views (`/admin`, `/urls/[id]`'s config section) and
never bleed into the Operator's surfaces.

## 3 · Design principles (Apple-influenced, problem-specific)

### 3.1 · Clarity

- **Type is the UI.** Most VisaWatch screens are lists of text. Get the
  type hierarchy right and the screen is 80% done.
- **Use real numbers, not lorem-ipsum.** Always show tabular numerals
  (`font-variant-numeric: tabular-nums`) for any count, cost, severity,
  duration. Numbers must align vertically when stacked.
- **Severity has a color.** Severity 1–2 is grey/muted. Severity 3 is
  Apple System Orange. Severity 4–5 is Apple System Red. Don't invent
  new colors; use the tokens.

### 3.2 · Deference

- **Chrome yields to content.** Sidebar and topbar are frosted glass
  (`backdrop-filter: saturate(180%) blur(20px)`). They never compete
  with the change list.
- **No decorative imagery.** No stock photos, no illustrations, no
  hero patterns. The only visual interest comes from typography,
  micro-iconography, and very subtle color signals.
- **Restrained accent.** Apple System Blue (`#0071e3`) is used **only**
  for: primary CTAs, active nav state, link hover, AI/insight chips.
  Everything else is neutral.

### 3.3 · Depth

- **Soft shadows, not hard borders.** Cards use 1px hairline borders
  (`var(--border)`) plus a multi-layer shadow that's barely there
  (`var(--shadow-xs)` to `var(--shadow-md)`). Never use a heavy box
  shadow.
- **Hover lifts.** Interactive cards translate up 1px on hover with a
  larger shadow (`var(--shadow-md)`). Static cards never lift.
- **Apple radii.** 12px for default cards, 14px for emphasized cards,
  18px for modals, 22px for hero cards, 980px for pills. Never use 4px
  except for inline tags.

## 4 · The design system primitives

These are **already in `src/app/globals.css`**. A redesign is allowed
to refine them but should not invent new tokens; if you need a
"warning" color, use `--orange`, not a new shade.

### 4.1 · Color

| Token | Value | Use |
|---|---|---|
| `--background` | `#fbfbfd` (warm off-white) | App background |
| `--background-1` | `#ffffff` | Cards, surfaces, popovers |
| `--background-2` | `#f5f5f7` | Sub-surface, hover row tint |
| `--background-3` | `#ececef` | Inset zones, progress track |
| `--foreground` | `#1d1d1f` | Primary text |
| `--foreground-2` | `#424245` | Body text, inactive nav |
| `--foreground-3` | `#6e6e73` | Captions, placeholders |
| `--foreground-4` | `#86868b` | Quaternary, line-mono labels |
| `--primary` | `#0071e3` (System Blue) | CTAs, active states |
| `--primary-hover` | `#0077ed` | CTA hover |
| `--accent-dim` | blue at 10% alpha | Selection background |
| `--green` / `-soft` / `-ink` | System Green | Success, healthy |
| `--red` / `-soft` / `-ink` | System Red | Error, severity 4–5 |
| `--orange` / `-soft` / `-ink` | System Orange | Severity 3, EXTERNAL tier |
| `--indigo` / `-soft` / `-ink` | System Indigo | STEALTH tier, special states |
| `--border` | `#e8e8ed` | Hairline divider |
| `--border-2` | `#d2d2d7` | Stronger border (focused inputs) |

### 4.2 · Typography

The font stack is the SF Pro chain with Inter fallback:

```
font-family:
  -apple-system, BlinkMacSystemFont,
  "SF Pro Text", "SF Pro Display",
  "Helvetica Neue", var(--font-inter),
  "Segoe UI", "Roboto", sans-serif;
```

On macOS / iOS this renders as SF. Elsewhere, Inter with `ss01` + `cv11`
features picks up the closest match.

| Style | Size | Weight | Tracking | Use |
|---|---|---|---|---|
| Display H1 | clamp(28, 4vw, 40)px | 700 | -0.030em | Page titles |
| H2 | 22px | 600 | -0.022em | Section heads |
| H3 | 18px | 600 | -0.018em | Sub-section heads |
| H4 | 15px | 600 | -0.014em | Card titles |
| Body | 15px | 400 | -0.011em | Default copy |
| Body-sm | 13.5px | 400 | -0.005em | Captions, meta |
| Mono | 11–13px | 500 | -0.005em | Hostnames, mute patterns |
| Eyebrow | 11px | 500 mono UPPER | 0.06em | Section labels |

**Rules:**
- Never use weight < 400 except in `<h*>` "thin" variants which we
  don't have.
- Never use weight 700 on body text — use 600 (semibold) for emphasis.
- Tabular numerals on every number that lives in a column or stat.
- Don't use italic except in `--foreground-4` captions ("Pinpointed
  from site analysis").

### 4.3 · Spacing & rhythm

Apple's spacing is loose. The grid is **8pt** with halfsteps at 4pt
for tight composition.

- **Page padding**: `px-6 py-8` on mobile, `px-10 py-10` on desktop.
- **Hero block to first content**: `mb-10` (40px).
- **Section to section**: `mb-8` (32px) inside a page.
- **Card padding**: 18px for compact, 22px for default, 28px for hero.
- **List row padding**: 14–16px vertical, 18–20px horizontal.
- **Gap between siblings in a row**: 8px (tight), 12px (default), 16px (loose).

### 4.4 · Radii

| Element | Token | Px |
|---|---|---|
| Inline tag, code | `--radius-xs` | 6 |
| Small button, input | `--radius-sm` | 8 |
| Default card | `--radius` | 12 |
| Emphasized card | `--radius-md` | 14 |
| Modal | `--radius-lg` | 18 |
| Hero card | `--radius-xl` | 22 |
| Pill / CTA | `--radius-pill` | 980 |

### 4.5 · Shadows

```
--shadow-xs:  0 1px 1.5px rgba(0,0,0,0.04);
--shadow-sm:  0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.03);
--shadow:     0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04);
--shadow-md:  0 2px 4px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.06);
--shadow-lg:  0 6px 12px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.10);
--shadow-xl:  0 20px 60px rgba(0,0,0,0.18);
```

Default cards use `xs`. Cards that lift on hover transition `xs → md`.
Modal/dialog uses `xl`.

### 4.6 · Motion

| Easing | Use |
|---|---|
| `cubic-bezier(0.4, 0, 0.2, 1)` (standard) | All hover/state changes |
| `cubic-bezier(0.2, 0, 0, 1)` (emphasized) | Page transitions, modal entrance |
| `cubic-bezier(0.5, 1.4, 0.5, 1)` (spring) | Toast appearance, severity pulse |

Durations: 150ms for color/background changes, 180ms for
transform/lift, 250ms for entrance/exit, 320ms+ for emphasized
transitions.

### 4.7 · Reusable component classes (CSS-only)

These exist in globals.css and should be reused, not reinvented:

| Class | Use |
|---|---|
| `.glass` | Frosted-glass surface (sidebar, topbar) |
| `.surface` | Default elevated card |
| `.surface-flat` | Card with no shadow |
| `.surface-raised` | Card that lifts on hover |
| `.eyebrow` | Mono uppercase section label |
| `.label-mono` | Mono caption |
| `.tabular` | Tabular numerals |
| `.row-hover` | List row that tints on hover |
| `.subtle-link` | fg-3 → fg link hover |
| `.accent-link` | fg-3 → primary link hover |
| `.btn-pill` | Apple-style primary CTA |
| `.btn-pill-secondary` | Secondary outline CTA |
| `.pill` + `.pill-blue/-green/-red/-orange/-indigo/-muted` | Tone chips |
| `.sev-pill` + `.sev-1..5` | Severity chips |
| `.diff-added` / `.diff-removed` / `.diff-context` | Diff highlights |
| `.animate-fade-up` | Subtle entrance on mount |

### 4.8 · Icon system

Lucide-react. Stroke widths:
- 1.85 for normal icons
- 2.0 for emphasis and inline icons inside pills
- 2.4 for primary buttons / brand mark

Always set `strokeWidth` explicitly. Avoid filled icons except for the
brand mark and severity dots.

---

## 5 · Per-page design briefs

Each section below is a self-contained brief. Format:

- **Purpose** — what this page is for
- **Audience** — who arrives here, why
- **Information architecture** — what's most important down to least
- **Required sections** — the data that must appear, in order, with
  the *reason* each is there
- **States** — empty, loading, error, edge cases
- **Visual tone** — what feels different about this page vs others

### 5.1 · `/` Overview (the daily check-in)

**Purpose.** The default landing page. Answers "what changed since I
last looked, and is anything urgent?" in under 5 seconds.

**Audience.** The Operator, every morning.

**Information architecture (top to bottom):**

1. Hero (eyebrow + display title + sub) — orientation
2. Stat row — health snapshot
3. AI Insights cards (conditional) — pinpointed concerns from
   per-site analysis
4. Significant changes (severity ≥ 3) — the actual workload
5. Minor / cosmetic changes — collapsible-feeling section that
   shows up but doesn't compete

**Required sections, with reasoning:**

| Section | Fields | Why it's there |
|---|---|---|
| Hero | "Dashboard" eyebrow, "Overview" title, sub: "Every visa-related change detected across your monitored sites — sorted by what matters." | Sets expectation: signal-first list. The sub explicitly tells the user "we sort by what matters" so they don't feel they're missing a non-existent timeline view. |
| Stats grid (4 cards) | (a) Total monitored sites + active count subline, (b) Total changes ever, (c) Notable changes (severity ≥ 3), (d) Sites OK | Operators need a 1-second pulse. "Active" subline distinguishes paused from total — pausing a site is normal during investigations. "Notable" uses severity ≥ 3 (the email threshold) so the count matches "alerts that fired". |
| AI Insights cards (only if any site has aiAnalysis with notices) | Tone-pill (red/orange/muted), site-name pill with arrow, 3-line clamped text, "Visit site" footer | These come from a separate "deep AI analysis" pass that runs on demand and isn't a detected change. Calling them "Insights" with a `pinpointed from site analysis — not detected changes` qualifier prevents Operators from confusing them with real change events. |
| Significant changes list | One row per change: severity stripe (only on sev ≥ 3), category pill, site name, summary, optional detail clamped to 2 lines, mono timestamp | This is the page's reason to exist. Each row links to `/changes/[id]` where the user can verify and acknowledge. |
| Minor/cosmetic list | Same row format, no severity stripe | Operators want to be able to confirm "the system is alive and saw changes, just not important ones" without those changes shouting. |

**States.**

- **Empty**: rounded icon chip with `CheckCircle2`, "No changes detected yet", sub "Add a site and trigger a poll to get started." No illustration. No empty-page hero hijack — keep the existing hero, the empty state lives where the change list would be.
- **Loading**: skeleton stat cards (height 28, radius 12), skeleton change rows (height 24, radius 12). Stagger in 50ms increments using `animate-fade-up`.
- **Error**: never let an error replace the whole page. If stats fail, show the cards with `—` values. If the change list fails, show an inline alert pill in red-soft.

**Visual tone.** Most-trafficked page. Slightly more breathing room
than other pages (`mb-10` between stats and AI insights). Hero
animates in with `animate-fade-up`. Stat cards are `.surface-raised`
so the hover lift gives a tactile sense of "this is real data,
clickable later."

---

### 5.2 · `/sites` Sites list (the catalogue)

**Purpose.** Show every Site at a glance with health and link to the
per-site detail page.

**Audience.** Operator (when investigating a specific embassy) or
Admin (when adding/removing sites).

**Information architecture:**

1. Hero with site count + URL count
2. Primary CTA: "Add site" (Apple-pill)
3. Site list

**Required sections:**

| Section | Fields | Why |
|---|---|---|
| Hero | "Catalogue" eyebrow, "Sites" title, sub: "5 sites monitored · 7 URLs" | Two counts because Phase 2b means a Site has multiple URLs. Operators need to know what they're scanning. |
| List row (per Site) | (a) Site name 14.5px semibold, (b) Active/Paused tone-pill, (c) Hostname mono + URL count subline, (d) Last change with severity dot + summary truncated, (e) Last-checked relative timestamp (mono), (f) Total change count tabular, (g) PollButton, (h) Chevron-right (revealed on hover) | The row is dense but ranked left-to-right by glance importance. Hostname goes mono because it's reference data, not prose. Severity dot has a soft halo so it stays visible at small size. |
| Empty state | Rounded icon chip, "No sites yet", "Add your first visa site to start monitoring.", primary CTA inside the empty card | Standard pattern. Don't change. |

**Behavior.**

- Whole row is **not** a single Link — the PollButton is a sibling and
  must not bubble. Each text region has its own Link to `/sites/[id]`
  for accessibility. Hover tints the entire row via `.row-hover`.
- Active state: green pill with a small green dot inside. Paused:
  muted pill, no dot.
- Sort order: by `createdAt asc` (insertion order). Don't add a sort
  control — there are 5 sites today and likely <30 ever.

**States.**

- **Empty**: as above.
- **One site**: the list still renders as a list of one, not a special
  hero card. Consistency over personality.
- **>20 sites**: pagination is not yet needed; if we exceed 50, add a
  search filter as the only top-bar control.

**Visual tone.** Reference-list feel. Less "alive" than Overview.
Hover state on rows is the only motion.

---

### 5.3 · `/sites/[id]` Site detail (the deep dive)

**Purpose.** Everything about one Site in one scrollable page.
Operators arrive here from the Overview or Sites list when something
looks off.

**Audience.** Operator (most common entry: clicking a change card),
Admin (when configuring).

**Information architecture:**

1. Back link to `/sites` (breadcrumb-style)
2. Header: name, active/paused, hostname link, action buttons
3. 4-card stats row
4. Adapter config (collapsible details — Admin-territory)
5. **Monitored URLs section** (the most important new section
   post-Phase-2b)
6. Captured Content (collapsible) — what we actually extracted
7. AI Analysis (collapsible) — markdown blob from the on-demand
   analysis route
8. Change history list

**Required sections:**

| Section | Fields | Why |
|---|---|---|
| Header | Site name (text-xl semibold), Active/Paused pill, hostname link with external-link icon, action buttons (poll, pause, delete from a dropdown) | Identity + state + per-site actions. Hostname shown because Operators identify sites by domain. |
| Stats cards | Total Changes, Snapshots, Poll Every, Last Check | Health pulse. Poll Every clarifies cadence (e.g. "60m"). Last Check is the most important number when triaging. |
| Adapter config (collapsible) | Render Mode, Content Selector, Poll Interval, Strip Patterns | Admin-only field. Default closed. Use plain `<details>` element with mono code values. |
| **Monitored URLs** | One row per URL: URL (mono), fetchMode pill, paused/failure pills, last-checked, PollButton, Pause toggle, Chevron to /urls/[id]. AddUrlForm inline at the top right of the section. | Phase 2b's biggest addition. A Site is no longer one URL — it's many. This section is where you discover that, where you add new ones, and where you click into per-URL config. |
| Captured Content | "Snapshot from <time>", char count summary, expandable monospace block with the latest extracted text | Trust-building. Operators verify the system is reading the right portion of the page (especially after editing the contentSelector). |
| AI Analysis | Markdown rendered with the `.analysis-body` typography, "Analyze" button if not yet run | The deep-LLM-analysis output. Useful but not change-detection. Clearly labeled. |
| Change history | Reuses ChangeCard list | Continuity with overview. |

**States.**

- **Empty (no MonitoredUrls)**: should never happen in practice (we
  auto-create one on Site POST), but if it does: empty card with
  "Add a URL to start polling." inviting the inline form.
- **Empty (no changes)**: rounded icon chip + "No changes detected
  yet" + "Poll this site to take a baseline snapshot." Show the
  PollButton inside the empty state.
- **No captured content yet**: same shape, "Poll this site to capture
  its first snapshot."

**Visual tone.** This page is the most info-dense in the app. Use
`.surface` cards generously to chunk it. Don't run things together —
a `<Separator className="mb-8">` between major sections (after
config, after URLs section, before changes) keeps the eye moving.

---

### 5.4 · `/urls/[id]` URL detail (the per-page configuration)

**Purpose.** Configure and inspect a specific MonitoredUrl. This is
where Admins live during Phase 4 fetch-tier debugging.

**Audience.** Admin primarily. Operator visits when curious which URL
on a site triggered a change.

**Information architecture:**

1. Back link to parent Site
2. URL hero (the URL itself is the title)
3. Tier + state pills
4. 4-card stats row (per-URL, not per-Site)
5. Configuration form (large)
6. Changes-for-this-URL list

**Required sections:**

| Section | Fields | Why |
|---|---|---|
| Hero | "Monitored URL" eyebrow, the URL as a wrapped break-all H1, ExternalLink icon, fetchMode pill, paused pill (if), failure-streak pill (if), PollButton "Poll now" CTA on the right | URL *is* the identity of this row. Treating it as the title (not a label-value pair) makes that clear. |
| Stats grid | Changes, Snapshots, Last Check, Last Failure | Mirrors the Site detail page but scoped to this URL. Last Failure is the new one — Phase 4 produces this and it's the field Admins want when debugging. |
| Configuration form | contentSelector input, stripPatterns textarea (one regex per line), fetchMode select with descriptions, autoEscalate switch, escalateAfterFailures number, mutePatterns textarea, Save button, "Reset failure streak" secondary button | This is the heart of the Admin UX. Long-form because every field matters and inline help text prevents support tickets. |
| Changes for this URL | ChangeCard list scoped to monitoredUrlId | Helps Admins answer "did changing the selector reduce noise?" |

**Configuration form: detailed field specifications:**

- **Content selector**: input with placeholder `main`. Help: "CSS
  selector — falls back to `body` if not matched."
- **Strip patterns**: textarea, 3 rows. Help text shows two example
  regex patterns. Mono font. Newline-separated.
- **Fetch tier**: native select with descriptions in the option text:
  - STATIC — undici, fast/free
  - PLAYWRIGHT — vanilla headless
  - STEALTH — patchright (anti-Cloudflare)
  - EXTERNAL — third-party scraper API
- **Auto-escalate**: a switch (toggle) inside a labeled card.
  Auxiliary text: "Promote to the next tier after N consecutive
  BLOCKED failures."
- **Escalate after N failures**: small number input, default 3, range
  1–20.
- **Mute patterns**: textarea, 3 rows, mono. Help: "Changes whose
  summary or detail matches any pattern are auto-muted (no alerts;
  still recorded)."

**States.**

- **No changes**: dashed `.surface-flat` empty state, "No changes
  detected yet."
- **fetchMode = EXTERNAL but SCRAPER_API_URL not configured**: show
  an info pill in red-soft with a link to the runbook.
- **consecutiveFailures > 0**: prominent red-tone pill in the hero,
  also visible on the parent Site detail.

**Visual tone.** This page is utilitarian. Less typographic flourish
than Overview. The form is the screen.

---

### 5.5 · `/sites/new` Add site (the onboarding)

**Purpose.** Quick path to add a visa site with smart defaults.

**Audience.** Admin. Run once per site, ideally < 60 seconds.

**Information architecture:**

1. Hero
2. Adapter wizard (bootstrap LLM auto-suggests selector & strip
   patterns from a paste-in URL, then a confirm step)
3. Submit

**Required sections (existing AdapterWizard component handles most):**

| Section | Fields | Why |
|---|---|---|
| Hero | "Onboarding" eyebrow, "Add new site" title, sub: "Enter a URL and AI will analyse the page to suggest optimal monitoring settings." | Sets expectation that the wizard is smart, doesn't require Admins to know CSS. |
| Step 1 — URL | URL input, "Analyse" button | Single field. Don't ask for site name yet — derive from `<title>`. |
| Step 2 — Review | Suggested name (editable), suggested contentSelector (editable, mono), suggested stripPatterns (editable, mono textarea), suggested renderMode (radio: STATIC/JS), pollIntervalMin slider | Reviewer doesn't have to think, just nudge if the LLM was wrong. |
| Step 3 — Confirm | "Add site" primary button, summary of what will be created | Finality + ability to back out. |

**States.**

- **LLM analysis fails**: show inline error pill, allow manual
  configuration (skip Step 2, go to a manual form).
- **URL already exists**: surface inline error pill at the URL field
  with a link to the existing /sites/[id].

**Visual tone.** Wizardy but not bossy. Single-column layout. Big
input affordance.

---

### 5.6 · `/changes/[id]` Change detail (the verifier)

**Purpose.** This is the page email links to. The Operator arrives
here to verify the change, read the evidence, and acknowledge.

**Audience.** Operator, always. The page must work for someone who
has zero context — they came from an alert email.

**Information architecture (critical to get right):**

1. Back link to parent Site
2. **High-severity warning bar** (only when severity ≥ 4)
3. **Status pills row** (severity, category, classifier status, mute,
   email status) + timestamp on the right
4. **Summary** (the LLM-written one-liner) — large, semibold
5. **Detail paragraph** — supporting copy from the LLM
6. **Acknowledge button**
7. **Evidence quotes** card — verbatim quotes the LLM cited
8. **URL + Confidence** card — what was monitored, how confident the
   classifier was
9. **Classifier metadata** (collapsible) — model, prompt version,
   tokens, cost, raw severity
10. **Diff viewer** — the actual added/removed text

**Required sections, with reasoning:**

| Section | Fields | Why |
|---|---|---|
| Back link | "← Site name" | Operators arriving from email need a clear way "back to the site". |
| High-severity bar | Red-soft tinted strip with `AlertTriangle` icon and "This is a high-severity change that may affect visa applications." | Critical changes deserve a banner above the fold. Only shown when severity ≥ 4. |
| Pills row | severity-pill, category-pill (red/orange/muted toned), classifier-status pill (Grounded/Rule-clamped/Ungrounded/Fallback), Muted pill (if), Email status pill (Sent/Failed), timestamp on right | Status at a glance. The grounding pill is the most important: it tells the user whether the LLM's claim is backed by source text. |
| Summary | 26px, 700, line-height 1.18, tracking -0.025em | This is the "one sentence the user reads". It's not a heading — it's the focal point. |
| Detail paragraph | 15.5px, fg-2, line-height 1.55 | Supporting prose. Optional. |
| Acknowledge button | Outlined pill with check icon. Toggles to "Acknowledged" disabled state once clicked. | Operator workflow: read → ack → close tab. The button is critical for Phase 7's mute behavior. |
| Evidence quotes card | `.surface` panel, list of left-bordered (accent-line) quote blocks | The user's question is "is this real?" Showing verbatim quotes from the source answers it. Each quote is a substring of the diff (verified server-side). |
| URL + Confidence card | URL link to /urls/[id], confidence bar (0-100% with green/orange/red coloring), "Visit URL" external link | Two pieces: which URL this came from, and how sure the LLM was. The confidence bar uses the system colors based on the value. |
| Classifier metadata (collapsible) | Mono key-value grid: model, prompt, status, tokens, cost, raw severity | Admin-territory. Hidden by default. Mono because it's data, not prose. |
| Diff viewer | Monospace block with green/red highlighted lines, gutter glyphs (+/−), context lines in muted | The actual evidence. Reuses .diff-added / .diff-removed tokens. |

**States.**

- **Acknowledged**: button shows "Acknowledged" with a check, disabled.
  No other UI change. Listing pages can fade acknowledged rows in a
  later phase.
- **classifierStatus = UNGROUNDED**: the page still renders fully but
  the email path was suppressed; this is communicated by an "Ungrounded"
  pill in the row. No banner — Operators may want to see it anyway.
- **classifierStatus = FALLBACK**: muted pill "Fallback (LLM
  unavailable)". Treat the summary/detail text as best-effort, not
  authoritative.
- **muted = true**: muted pill in the row. The change is recorded but
  no notifications fired.
- **No detail**: skip the detail paragraph, increase summary→evidence
  gap by 4px.
- **No evidence quotes**: skip the evidence card. (Should be rare —
  classify path requires quotes.)

**Visual tone.** Editorial. This is the page where the user makes a
decision. Lots of breathing room, clear hierarchy, evidence always
visible above the diff.

---

### 5.7 · `/subscriptions` Subscriptions

**Purpose.** Per-user alert preferences. "Tell me how/where to be
notified."

**Audience.** Any logged-in user. Each user manages their own row only.

**Information architecture:**

1. Hero
2. Count line
3. Inline form (collapsed by default, expanded via "New subscription"
   button)
4. List of existing subscriptions

**Required sections:**

| Section | Fields | Why |
|---|---|---|
| Hero | "Subscriptions" title, sub: "Choose where alerts go. Each subscription is scoped to a site and a delivery channel." | Sets the model: site-scoped, multi-channel. |
| Inline create form | Site select, Channel select (EMAIL/SLACK/WEBHOOK), Webhook URL input (only for SLACK/WEBHOOK), Min severity number (optional, override) | Single screen of fields, no wizard. Webhook URL field is conditional. |
| Subscription row | Channel pill, Min-severity pill (if set), Paused pill (if), site name, webhook URL preview (truncated), Pause/Resume button, Trash button | Each row is one delivery target. Two actions (pause + delete) are enough. |

**States.**

- **No subscriptions**: dashed empty card, "No subscriptions yet. Add
  one above to start receiving alerts."
- **Slack URL invalid**: inline error pill on the form's webhook
  field.
- **Self-removed last subscription**: just empty state. No "are you
  sure" — they can re-add.

**Visual tone.** Simple, list-driven. This is a settings page, not a
hero page. Less display type, more form polish.

---

### 5.8 · `/admin` Admin

**Purpose.** Operational pulse for the engineer. Queue health, costs,
recent changes by classifier status.

**Audience.** Admin only. Should not be linked from any
Operator-facing surface.

**Information architecture:**

1. Hero with link to raw `/api/admin/metrics`
2. DB rollups (Active Sites, Active URLs, Snapshots, Changes)
3. Queue depth (per-queue)
4. Last-7-days metrics (changes, LLM cost, tokens in/out)
5. Severity distribution (5 mini-cards, one per level)
6. Recent changes (last 10 with classifier metadata)

**Required sections:**

| Section | Fields | Why |
|---|---|---|
| Hero | "Admin" title, sub: "Operational overview. For raw Prometheus counters, see /api/admin/metrics." | Entry point + escape hatch. |
| DB rollups | 4 cards: counts as tabular numerals | Simple "is the system writing data?" check. |
| Queue depth | Card with one mini-cell per queue (`url.poll`, `email.send`, `email.sweep`, `tick.scan`) showing the queued+active count | When something feels off, the first place an Admin looks is here. |
| Last 7 days | 4 mini-cards: changes, LLM cost (USD), tokens in, tokens out | Cost surveillance. The cost card uses tabular numerals with 4 decimal places. |
| Severity distribution | 5 cards: sev 1, sev 2, …, sev 5. Total counts. | Shows the shape of the change firehose. If sev-5 is consistently 0, something's wrong in classify. |
| Recent changes | 10 rows with: severity-pill, classifier-status-pill, site mono, summary truncated, cost mono on the right | A spot-check for "is grounding working? are costs reasonable?" |

**States.**

- **Queue unreachable** (DATABASE_URL missing or pg-boss down): empty
  cells, "Queue is unreachable or not started yet." caption.
- **No changes yet**: caption "No changes yet."

**Visual tone.** Dense, dashboard-like. More data per square inch
than any other page. Less breathing room is fine here. Mono used
liberally.

---

### 5.9 · `/settings` Settings

**Purpose.** Personal preferences (currently: alerts toggle + manual
digest send).

**Audience.** Any logged-in user.

**Information architecture:**

1. Hero
2. Sections: Profile, Alerts, Operations
3. Per-section forms

**Required sections:**

| Section | Fields | Why |
|---|---|---|
| Hero | "Settings" title, sub: "Manage your account and notification preferences." | Standard. |
| Profile | Name, email (read-only), Save | Identity. Email read-only because it's the auth key. |
| Alerts | receivesAlerts toggle (legacy global), "Send digest now" CTA | Phase 7 made this mostly obsolete (Subscriptions replaces it), but keep the global flag for installs without subscriptions. |
| Operations | "Sign out" link in red-ink | Self-explanatory. |

**Visual tone.** Most boring page. That's correct.

---

### 5.10 · `/login` Login

**Purpose.** First impression for new users; routine entry for
returning ones.

**Audience.** Whoever opens the app without a session.

**Information architecture:**

1. Centered card on a blank canvas
2. Brand mark + "Sign in to VisaWatch"
3. Tab: Password / Magic link
4. Form
5. Footer link (no password? no signup — invite-only)

**Required sections:**

| Section | Fields | Why |
|---|---|---|
| Centered card | `.surface-raised`, max-width 400px, padding 32px, vertically centered with `min-h-screen flex items-center justify-center` | Apple-style centered focus. No distractions. |
| Brand mark | The same gradient diamond from the sidebar, sized 40px | Brand recognition. |
| Title | "Sign in" 24px semibold | Clear action. |
| Sub | "Continue to VisaWatch" 13px fg-3 | Light copy. |
| Tabs | Password / Magic link toggle (segmented control) | Two paths supported by NextAuth. |
| Email input | Auto-focused, type=email | First field. |
| Password input (Password tab) or absent (Magic link tab) | type=password | Conditional. |
| Submit | Full-width Apple-pill primary button: "Sign in" or "Send magic link" | Single CTA. |
| Footer | "Need access? Contact your admin." 12px fg-3 | No signup path; invite-only. |

**States.**

- **Verify=1 query param**: show success pill above the title — "Check
  your inbox to verify your email." Gradient green.
- **Auth failed**: red-soft inline error pill above the form.

**Visual tone.** Minimal, brand-led. Backdrop is plain `--background`
(no glass — there's nothing behind it).

---

## 6 · Cross-cutting patterns

### 6.1 · Empty states

Every list-style empty state follows this shape:

```
[Rounded 48×48 chip — bg-2, icon (1.6 stroke, fg-4)]
[Title — 16px semibold]
[Sub — 14px fg-3, max 1 line]
[Optional CTA — Apple-pill]
```

Container: `.surface-flat` with `borderStyle: dashed`. Padding: 56px
top/bottom, centered.

### 6.2 · Loading states

Use `Skeleton` from `@/components/ui/skeleton`. Never spinners on the
page level. Match the exact final layout — same widths, same rounded
corners, same row heights — so the layout doesn't shift when data
arrives.

### 6.3 · Error states

Inline, not page-level. Red-soft banner with `AlertTriangle`. Never
swallow the page. If a sub-component fails, render `—` or "—".

### 6.4 · Toast notifications

Sonner with `richColors`, position bottom-right. Toast duration:
- success: 3000ms
- info: 4000ms
- warning: 5000ms
- error: 6000ms (red, more time to read)

### 6.5 · Severity, category, fetchMode color mapping

This mapping is **canonical**. Any redesign must respect it:

| Severity | Color | Token | Use |
|---|---|---|---|
| 1 | Muted (border) | sev-pill .sev-1 | Cosmetic |
| 2 | Foreground-4 | sev-pill .sev-2 | Minor |
| 3 | System Orange | sev-pill .sev-3 | Notable |
| 4 | System Red | sev-pill .sev-4 | Important |
| 5 | System Red (bolder) | sev-pill .sev-5 | Critical |

| Category | Tone | Why |
|---|---|---|
| FEE_CHANGE | red (sev ≥ 4) / orange (sev 3) | Money is always serious |
| APPOINTMENT | red / orange | Time-sensitive |
| POLICY_CHANGE | red / orange | Procedural |
| DOCUMENT_REQUIREMENT | red / orange | New requirement |
| NAVIGATION | muted | Cosmetic |
| COSMETIC | muted | Cosmetic |
| UNKNOWN | muted | Punt |

| FetchMode | Tone | Why |
|---|---|---|
| STATIC | green | Healthy default |
| PLAYWRIGHT | blue | JS-rendered (neutral) |
| STEALTH | indigo | Special — requires patchright |
| EXTERNAL | orange | Costs money — visible warning |

### 6.6 · Accessibility (don't skip)

- All interactive elements have `:focus-visible` outline (defined in
  globals.css).
- Color is never the only signal — pills have text labels, severity
  has labels, dot indicators have textual companions.
- Tab order follows reading order; never use `tabIndex` to reorder.
- All icons that aren't buttons are `aria-hidden`.
- Lucide icons inside buttons must have an accessible name —
  use a wrapping `<span className="sr-only">…</span>` or `title` /
  `aria-label`.
- Contrast ratios meet WCAG AA: foreground on background-1 = 14.5:1,
  fg-2 on bg-1 = 9.1:1, fg-3 on bg-1 = 5.5:1, fg-4 on bg-1 = 3.9:1
  (use only on labels not body text).

---

## 7 · How to use this document with a design AI

Recommended prompt structure:

> You are designing a single page of VisaWatch. The product brief,
> design tokens, and reusable components are in `DESIGN-BRIEF.md` —
> read sections 1–4 and §6 fully. Then read §5.X for the page in
> question. Output a complete React component (or Figma file) that:
>
> 1. Implements every Required section in the order specified
> 2. Uses only the design tokens from §4 and reusable component classes
>    from §4.7 — no new colors, fonts, or radii
> 3. Honors the empty/loading/error states from §6
> 4. Respects the visual tone and audience for that page
> 5. Honors §6.6 accessibility constraints
>
> Constraints:
> - The page must compile as a Next.js Server Component unless it has
>   client-side interactivity, in which case extract a small client
>   component for the interactive part only
> - Never use `onMouseEnter`/`onMouseLeave`/`onClick` in a Server
>   Component
> - Use `lucide-react` icons with explicit `strokeWidth`
> - Tabular numerals on every numeric value

If you're an AI generating this output, also:

- Avoid emoji.
- Stay under 80 columns when reasonable.
- Don't add new dependencies.
- Test that the file compiles by mental-modeling the Next.js
  rendering.

---

## 8 · Out of scope (what *not* to design right now)

- Dark mode. The design tokens are light-mode-only today. A dark mode
  pass requires re-derivation of the entire color palette and isn't
  part of any open phase. Don't ship dark mode without an explicit
  brief.
- Mobile-native shell. The dashboard is built mobile-responsive but
  isn't a phone-first product. No bottom tab bar.
- Animations beyond the existing `animate-fade-up`. No spring loaders,
  no parallax, no scroll-driven motion.
- Branding refresh (new logo, new name). Out of scope without a
  separate brief.

---

*Last updated alongside commit d01932d (frontend Apple-redesign +
event-handler hotfix).*
