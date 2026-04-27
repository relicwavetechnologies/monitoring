import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default async function SettingsPage() {
  const session = await auth();
  const user = await db.user.findUnique({
    where: { email: session?.user?.email ?? "" },
    select: { id: true, name: true, email: true, receivesAlerts: true },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your profile and alert preferences.
        </p>
      </div>

      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <span className="text-muted-foreground">Email</span>
            <span className="col-span-2 font-mono text-xs">{user?.email ?? "—"}</span>
            <span className="text-muted-foreground">Name</span>
            <span className="col-span-2">{user?.name ?? "—"}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Alert Preferences</CardTitle>
          <CardDescription>
            Control when and how you receive change notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user && <SettingsForm userId={user.id} receivesAlerts={user.receivesAlerts} />}
        </CardContent>
      </Card>

      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Environment Check</CardTitle>
          <CardDescription>Required API keys for full functionality</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {[
              { label: "OpenAI API Key", key: "OPENAI_API_KEY" },
              { label: "Resend API Key", key: "RESEND_API_KEY" },
              { label: "Serper API Key", key: "SERPER_API_KEY" },
              { label: "Database URL", key: "DATABASE_URL" },
            ].map(({ label }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-xs text-emerald-400">Configured</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Keys are read server-side — not exposed in the browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
