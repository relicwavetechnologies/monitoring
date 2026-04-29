import { PrismaClient, ChangeCategory, RenderMode } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { createHash, randomBytes } from "crypto";
import { gzipSync } from "zlib";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter } as any);

function fakeGz(text: string) {
  return new Uint8Array(gzipSync(Buffer.from(text)));
}

function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function daysAgo(d: number, hours = 0) {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  dt.setHours(dt.getHours() - hours);
  return dt;
}

const SITES = [
  {
    name: "US Embassy Mumbai",
    url: "https://in.usembassy.gov/mumbai/",
    renderMode: RenderMode.STATIC,
    contentSelector: "main",
    stripPatterns: ["\\d{1,2}/\\d{1,2}/\\d{4}", "Last updated.*?\\n"],
    pollIntervalMin: 360,
    lastCheckedAt: daysAgo(0, 1),
  },
  {
    name: "VFS Global UAE → Singapore",
    url: "https://visa.vfsglobal.com/are/en/sgp/apply-visa",
    renderMode: RenderMode.JS,
    contentSelector: ".main-content",
    stripPatterns: ["session[_-]?id=\\S+", "__cf_bm=\\S+"],
    pollIntervalMin: 30,
    lastCheckedAt: daysAgo(0, 0),
  },
  {
    name: "UK Standard Visitor Visa",
    url: "https://www.gov.uk/standard-visitor/apply-standard-visitor-visa",
    renderMode: RenderMode.STATIC,
    contentSelector: ".gem-c-govspeak",
    stripPatterns: ["Last updated \\d{1,2} \\w+ \\d{4}"],
    pollIntervalMin: 120,
    lastCheckedAt: daysAgo(0, 2),
  },
  {
    name: "ICA Singapore",
    url: "https://www.ica.gov.sg/",
    renderMode: RenderMode.STATIC,
    contentSelector: ".content-area",
    stripPatterns: ["\\d{1,2} \\w+ \\d{4}"],
    pollIntervalMin: 120,
    lastCheckedAt: daysAgo(1, 3),
  },
  {
    name: "VFS Global Individuals",
    url: "https://www.vfsglobal.com/en/individuals/index.html",
    renderMode: RenderMode.JS,
    contentSelector: "main",
    stripPatterns: ["\\d+\\s+countries", "\\d+\\s+visa centres"],
    pollIntervalMin: 60,
    lastCheckedAt: daysAgo(0, 4),
  },
];

const CHANGES: {
  siteIdx: number;
  daysAgoN: number;
  category: ChangeCategory;
  severity: number;
  confidence: number;
  summary: string;
  detail: string;
  emailSent: boolean;
  diff: string;
}[] = [
  {
    siteIdx: 0,
    daysAgoN: 1,
    category: ChangeCategory.FEE_CHANGE,
    severity: 4,
    confidence: 0.92,
    summary: "Non-immigrant visa application fee increased from $185 to $205 effective immediately.",
    detail:
      "The US Embassy Mumbai updated the MRV fee schedule. B1/B2 tourist and business visa fees rose by $20. The change affects all applications submitted on or after April 25, 2026. Expedited processing fees remain unchanged at $60.",
    emailSent: true,
    diff: `- MRV Fee (B1/B2): $185
+ MRV Fee (B1/B2): $205
  Expedited processing: $60 (unchanged)
- Valid for appointments booked before April 25, 2026
+ Valid for appointments booked on or after April 25, 2026`,
  },
  {
    siteIdx: 0,
    daysAgoN: 8,
    category: ChangeCategory.APPOINTMENT,
    severity: 3,
    confidence: 0.87,
    summary: "New appointment slots released for June–July 2026; tourist visa wait time reduced to 45 days.",
    detail:
      "The embassy announced additional appointment capacity for summer 2026. Wait times for B1/B2 visas dropped from 89 days to 45 days following the release of new slots. F1 student visa wait remains at 12 days.",
    emailSent: true,
    diff: `- Current wait time (B1/B2): 89 calendar days
+ Current wait time (B1/B2): 45 calendar days
  F1 Student: 12 calendar days (unchanged)
+ New slots available: June 1 – July 31, 2026`,
  },
  {
    siteIdx: 1,
    daysAgoN: 0,
    category: ChangeCategory.POLICY_CHANGE,
    severity: 5,
    confidence: 0.95,
    summary: "VFS UAE→SGP portal suspended: Singapore tightened entry rules for UAE-resident applicants.",
    detail:
      "Singapore's ICA announced a temporary suspension of VFS-facilitated visa applications from UAE residents pending a bilateral agreement review. Applications already submitted will be processed. New applications must be submitted directly via ICA's e-Service portal until further notice.",
    emailSent: true,
    diff: `- Applications accepted via VFS Global UAE portal
+ NOTICE: VFS portal temporarily suspended for UAE residents
+ Submit new applications directly at ica.gov.sg/e-Service
- Standard processing: 3–5 working days
+ Processing currently paused – check ICA portal for updates`,
  },
  {
    siteIdx: 1,
    daysAgoN: 14,
    category: ChangeCategory.DOCUMENT_REQUIREMENT,
    severity: 3,
    confidence: 0.81,
    summary: "Bank statement requirement extended from 3 to 6 months for Singapore tourist visa applicants.",
    detail:
      "VFS updated the supporting documents checklist. Financial proof must now cover the last 6 months instead of 3. This applies to all nationalities applying for a Singapore tourist visa through the UAE VFS centre.",
    emailSent: true,
    diff: `- Bank statements required: last 3 months
+ Bank statements required: last 6 months
  Minimum balance: SGD 1,000 (unchanged)
+ Additional note: Statements must be certified by issuing bank`,
  },
  {
    siteIdx: 2,
    daysAgoN: 3,
    category: ChangeCategory.POLICY_CHANGE,
    severity: 4,
    confidence: 0.89,
    summary: "UK Standard Visitor visa now requires proof of onward/return travel at point of entry.",
    detail:
      "The UK Home Office updated the Standard Visitor guidance to state that border officers may now request proof of onward or return travel for all visitor visa holders. Previously this was discretionary. The guidance also clarifies that electronic tickets are accepted.",
    emailSent: true,
    diff: `- Border officers may ask for return travel proof (discretionary)
+ Border officers WILL request proof of onward/return travel (mandatory)
+ Electronic tickets and e-boarding passes are accepted
  Visit duration maximum: 6 months (unchanged)`,
  },
  {
    siteIdx: 2,
    daysAgoN: 21,
    category: ChangeCategory.FEE_CHANGE,
    severity: 3,
    confidence: 0.84,
    summary: "UK Standard Visitor visa fee increased to £115, up from £100 (15% rise).",
    detail:
      "The fee increase took effect on April 9, 2026 for all applications submitted online. Priority service (5-day) remains at £220. Super Priority (next working day) increased from £800 to £860.",
    emailSent: true,
    diff: `- Standard Visitor visa fee: £100
+ Standard Visitor visa fee: £115
- Super Priority service: £800
+ Super Priority service: £860
  Priority service (5 working days): £220 (unchanged)`,
  },
  {
    siteIdx: 3,
    daysAgoN: 5,
    category: ChangeCategory.POLICY_CHANGE,
    severity: 3,
    confidence: 0.78,
    summary: "ICA Singapore extended Long-Term Visit Pass eligibility to include unmarried step-children under 21.",
    detail:
      "ICA updated the LTVP eligibility criteria to include step-children of Singapore citizens and PRs. Previously limited to biological and legally adopted children. Applicants must provide the legal marriage certificate linking the sponsor to the child's parent.",
    emailSent: false,
    diff: `  LTVP eligible dependants:
  - Legally adopted children under 21
+ - Unmarried step-children under 21 (new)
    Common-law spouses (case-by-case)
+ Required document: Marriage certificate of sponsor + child's parent`,
  },
  {
    siteIdx: 3,
    daysAgoN: 45,
    category: ChangeCategory.NAVIGATION,
    severity: 2,
    confidence: 0.91,
    summary: "ICA portal reorganised: Long-Term Pass and Short-Term Pass sections merged under new 'Passes & Permits' hub.",
    detail:
      "A site-wide navigation restructure consolidated the previously separate Long-Term Pass and Short-Term Pass landing pages into a unified 'Passes & Permits' hub. No policy content changed.",
    emailSent: false,
    diff: `- /pass/long-term → "Long-Term Passes" (top nav)
- /pass/short-term → "Short-Term Passes" (top nav)
+ /passes-and-permits → "Passes & Permits" hub (unified)
  All existing deep links redirect automatically`,
  },
  {
    siteIdx: 4,
    daysAgoN: 2,
    category: ChangeCategory.APPOINTMENT,
    severity: 2,
    confidence: 0.75,
    summary: "VFS Global added Riyadh, Saudi Arabia as a new visa centre location.",
    detail:
      "VFS Global's individuals page updated its global centre count and added Riyadh (KSA) to the supported locations list. The centre handles applications for 12 countries including Singapore, UK, and Schengen.",
    emailSent: false,
    diff: `- Total visa application centres: 3,289
+ Total visa application centres: 3,294
- Countries served: 66
+ Countries served: 67
+ New centre: Riyadh, Saudi Arabia (12 visa programmes)`,
  },
  {
    siteIdx: 4,
    daysAgoN: 60,
    category: ChangeCategory.COSMETIC,
    severity: 1,
    confidence: 0.97,
    summary: "Minor homepage banner update — promotional imagery rotated for Q2 2026.",
    detail:
      "Banner image carousel updated with Q2 2026 promotional content. No informational or policy content changed.",
    emailSent: false,
    diff: `- Hero image: 'global-travel-2025.jpg'
+ Hero image: 'q2-2026-promo.jpg'
  Tagline unchanged: "Your journey starts here"`,
  },
];

async function main() {
  console.log("Seeding demo data…\n");

  // 1. Upsert sites
  const siteIds: string[] = [];
  for (const s of SITES) {
    const existing = await db.site.findFirst({ where: { url: s.url } });
    let site;
    if (existing) {
      site = await db.site.update({
        where: { id: existing.id },
        data: { lastCheckedAt: s.lastCheckedAt, isActive: true },
      });
      console.log(`  ↺  ${s.name}`);
    } else {
      site = await db.site.create({ data: s });
      console.log(`  ✓  ${s.name}`);
    }
    siteIds.push(site.id);
  }

  // 2. Create snapshot pairs and changes
  for (const c of CHANGES) {
    const siteId = siteIds[c.siteIdx];
    const detectedAt = daysAgo(c.daysAgoN);
    const beforeText = `[snapshot before — ${randomBytes(4).toString("hex")}]`;
    const afterText  = `[snapshot after  — ${randomBytes(4).toString("hex")}]`;

    const snap1 = await db.snapshot.create({
      data: {
        siteId,
        contentHash: sha256(beforeText),
        htmlGz: fakeGz(`<html>${beforeText}</html>`),
        textGz:  fakeGz(beforeText),
        fetchedAt: new Date(detectedAt.getTime() - 1000 * 60 * 30),
        httpStatus: 200,
      },
    });

    const snap2 = await db.snapshot.create({
      data: {
        siteId,
        contentHash: sha256(afterText),
        htmlGz: fakeGz(`<html>${afterText}</html>`),
        textGz:  fakeGz(afterText),
        fetchedAt: detectedAt,
        httpStatus: 200,
      },
    });

    await db.change.create({
      data: {
        siteId,
        fromSnapshotId:  snap1.id,
        toSnapshotId:    snap2.id,
        fromContentHash: snap1.contentHash,
        toContentHash:   snap2.contentHash,
        category:    c.category,
        severity:    c.severity,
        confidence:  c.confidence,
        summary:     c.summary,
        detail:      c.detail,
        diffText:    c.diff,
        emailStatus: c.emailSent ? "SENT" : "SKIPPED",
        detectedAt,
      },
    });

    const site = SITES[c.siteIdx];
    console.log(`  ✓  [sev ${c.severity}] ${site.name} — ${c.summary.slice(0, 60)}…`);
  }

  console.log("\nDone — demo data seeded.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
