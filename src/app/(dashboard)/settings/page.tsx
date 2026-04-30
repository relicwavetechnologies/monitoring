import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { DigestButton } from "@/components/dashboard/digest-button";

export default async function SettingsPage() {
  const session = await auth();
  const user = await db.user.findUnique({
    where: { email: session?.user?.email ?? "" },
    select: { id: true, name: true, email: true, receivesAlerts: true },
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 animate-fade-up">
        <h1 className="hero-title">Settings</h1>
        <p className="hero-sub mt-1">Manage your profile and alert preferences.</p>
      </div>

      {/* Profile */}
      <section className="surface mb-5" style={{ padding: 22 }}>
        <h2
          className="text-headline mb-1"
          style={{ color: "var(--foreground)" }}
        >
          Profile
        </h2>
        <p
          className="text-footnote mb-4"
          style={{ color: "var(--foreground-3)" }}
        >
          Your account information.
        </p>

        <dl className="grid grid-cols-[120px_1fr] gap-y-3 gap-x-4 text-subhead">
          <dt className="eyebrow" style={{ marginTop: 4 }}>Email</dt>
          <dd className="mono" style={{ color: "var(--foreground)", fontSize: 13 }}>
            {user?.email ?? "—"}
          </dd>
          <dt className="eyebrow" style={{ marginTop: 4 }}>Name</dt>
          <dd style={{ color: "var(--foreground)" }}>{user?.name ?? "—"}</dd>
        </dl>
      </section>

      {/* Alerts */}
      <section className="surface mb-5" style={{ padding: 22 }}>
        <h2
          className="text-headline mb-1"
          style={{ color: "var(--foreground)" }}
        >
          Alert preferences
        </h2>
        <p
          className="text-footnote mb-5"
          style={{ color: "var(--foreground-3)" }}
        >
          Control when and how you receive change notifications. For per-site channels see{" "}
          <a href="/subscriptions" className="accent-link" style={{ color: "var(--primary)" }}>
            Subscriptions
          </a>.
        </p>
        {user && (
          <SettingsForm
            userId={user.id}
            receivesAlerts={user.receivesAlerts}
          />
        )}

        <div
          className="mt-5 pt-5"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <DigestButton email={user?.email ?? ""} />
        </div>
      </section>

      {/* Environment */}
      <section className="surface" style={{ padding: 22 }}>
        <h2
          className="text-headline mb-1"
          style={{ color: "var(--foreground)" }}
        >
          Environment
        </h2>
        <p
          className="text-footnote mb-4"
          style={{ color: "var(--foreground-3)" }}
        >
          Required API keys. Read server-side — never exposed in the browser.
        </p>

        <div className="space-y-2.5">
          {[
            { label: "OpenAI API key" },
            { label: "Resend API key" },
            { label: "Serper API key" },
            { label: "Database URL" },
          ].map(({ label }) => (
            <div
              key={label}
              className="flex items-center justify-between text-subhead"
            >
              <span style={{ color: "var(--foreground-2)" }}>{label}</span>
              <span className="pill pill-green">
                <span className="status-dot status-dot-green" />
                Configured
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
