import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/dashboard/topbar";
import { AuthSessionProvider } from "@/components/dashboard/session-provider";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <AuthSessionProvider>
      <div style={{ background: "var(--background)", minHeight: "100vh" }}>
        <Topbar />
        <main className="px-6 md:px-10 py-9 md:py-12">{children}</main>
      </div>
    </AuthSessionProvider>
  );
}
