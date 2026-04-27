import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const { receivesAlerts } = await req.json();

  const user = await db.user.update({
    where: { id: userId },
    data: { receivesAlerts },
    select: { id: true, receivesAlerts: true },
  });

  return NextResponse.json(user);
}
