import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendDigest } from "@/lib/resend";

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { count } = await sendDigest(session.user.email);
    if (count === 0) {
      return NextResponse.json(
        { message: "No significant changes found (severity ≥ 3) to send." },
        { status: 200 }
      );
    }
    return NextResponse.json({ message: `Digest sent — ${count} change${count !== 1 ? "s" : ""} included.` });
  } catch (err) {
    console.error("Digest send error:", err);
    return NextResponse.json({ error: "Failed to send digest email." }, { status: 500 });
  }
}
