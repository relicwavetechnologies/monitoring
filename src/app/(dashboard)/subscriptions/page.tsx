import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { SubscriptionsManager } from "@/components/dashboard/subscriptions-manager";

export default async function SubscriptionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [subs, sites] = await Promise.all([
    db.subscription.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    }),
    db.site.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold">Subscriptions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose where alerts go. Each subscription is scoped to a site and a delivery channel.
        </p>
      </div>
      <SubscriptionsManager initial={subs} sites={sites} />
    </div>
  );
}
