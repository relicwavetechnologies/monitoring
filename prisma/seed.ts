import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter } as any);

const STARTER_SITES = [
  {
    name: "US Embassy Mumbai",
    url: "https://in.usembassy.gov/mumbai/",
    renderMode: "STATIC" as const,
    contentSelector: "main",
    stripPatterns: [
      "\\d{1,2}/\\d{1,2}/\\d{4}",
      "\\d{1,2}:\\d{2}\\s*(AM|PM)",
      "Last updated.*?\\n",
      "Copyright \\d{4}",
    ],
    pollIntervalMin: 360,
  },
  {
    name: "VFS Global UAE → Singapore",
    url: "https://visa.vfsglobal.com/are/en/sgp/apply-visa",
    renderMode: "JS" as const,
    contentSelector: ".main-content",
    stripPatterns: [
      "\\d{1,2}\\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{4}",
      "session[_-]?id=\\S+",
      "__cf_bm=\\S+",
    ],
    pollIntervalMin: 30,
  },
  {
    name: "UK Standard Visitor Visa",
    url: "https://www.gov.uk/standard-visitor/apply-standard-visitor-visa",
    renderMode: "STATIC" as const,
    contentSelector: ".gem-c-govspeak",
    stripPatterns: [
      "Last updated \\d{1,2} \\w+ \\d{4}",
      "Published \\d{1,2} \\w+ \\d{4}",
    ],
    pollIntervalMin: 120,
  },
  {
    name: "VFS Global Individuals",
    url: "https://www.vfsglobal.com/en/individuals/index.html",
    renderMode: "JS" as const,
    contentSelector: "main",
    stripPatterns: [
      "\\d+\\s+countries",
      "\\d+\\s+visa centres",
    ],
    pollIntervalMin: 60,
  },
  {
    name: "ICA Singapore",
    url: "https://www.ica.gov.sg/",
    renderMode: "STATIC" as const,
    contentSelector: ".content-area",
    stripPatterns: [
      "\\d{1,2} \\w+ \\d{4}",
      "Updated:\\s*\\S+",
    ],
    pollIntervalMin: 120,
  },
];

async function main() {
  console.log("Seeding starter sites…");

  for (const site of STARTER_SITES) {
    const existing = await db.site.findFirst({ where: { url: site.url } });
    if (existing) {
      console.log(`  ⊘ ${site.name} — already exists`);
      continue;
    }

    await db.site.create({
      data: {
        ...site,
        monitoredUrls: {
          create: [
            {
              url: site.url,
              contentSelector: site.contentSelector,
              stripPatterns: site.stripPatterns ?? [],
              renderMode: site.renderMode,
            },
          ],
        },
      },
    });
    console.log(`  ✓ ${site.name}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
