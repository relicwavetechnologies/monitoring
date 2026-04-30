"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verify = searchParams.get("verify") === "1";
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [tab, setTab] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl,
      });
      if (res?.error) setError("Invalid email or password.");
      else {
        router.push(callbackUrl);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn("resend", { email: email.trim(), redirect: false });
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (verify || sent) {
    return (
      <div
        className="surface-raised p-8 text-center animate-scale-in"
        style={{ borderRadius: "var(--radius-lg)" }}
      >
        <div
          className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-4"
          style={{
            background: "var(--green-soft)",
            border: "1px solid color-mix(in srgb, var(--green) 22%, transparent)",
          }}
        >
          <CheckCircle2 className="h-6 w-6" style={{ color: "var(--green)" }} strokeWidth={2} />
        </div>
        <h2 className="text-title-3 mb-1.5">Check your email</h2>
        <p className="text-subhead" style={{ color: "var(--foreground-3)" }}>
          A magic link has been sent to{" "}
          <strong style={{ color: "var(--foreground)" }}>{email || "your email"}</strong>.
        </p>
        <p
          className="text-footnote mt-3"
          style={{ color: "var(--foreground-4)" }}
        >
          Link expires in 10 minutes. Check your spam folder if you don't see it.
        </p>
      </div>
    );
  }

  return (
    <div
      className="surface-raised p-7 animate-scale-in"
      style={{ borderRadius: "var(--radius-lg)" }}
    >
      {/* Segmented control */}
      <div className="segmented w-full mb-5" role="tablist">
        <button
          type="button"
          role="tab"
          data-active={tab === "password"}
          onClick={() => {
            setTab("password");
            setError("");
          }}
          className="flex-1"
        >
          Password
        </button>
        <button
          type="button"
          role="tab"
          data-active={tab === "magic"}
          onClick={() => {
            setTab("magic");
            setError("");
          }}
          className="flex-1"
        >
          Magic link
        </button>
      </div>

      {tab === "password" ? (
        <form onSubmit={handlePassword} className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-footnote-em"
              style={{ color: "var(--foreground)" }}
            >
              Email
            </label>
            <div className="relative">
              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                style={{ color: "var(--foreground-4)" }}
                strokeWidth={1.85}
                aria-hidden
              />
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-callout"
                style={{
                  background: "var(--background-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  letterSpacing: "-0.014em",
                  color: "var(--foreground)",
                }}
                required
                autoFocus
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-footnote-em"
              style={{ color: "var(--foreground)" }}
            >
              Password
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                style={{ color: "var(--foreground-4)" }}
                strokeWidth={1.85}
                aria-hidden
              />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-callout"
                style={{
                  background: "var(--background-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  letterSpacing: "-0.014em",
                  color: "var(--foreground)",
                }}
                required
              />
            </div>
          </div>
          {error && (
            <div
              className="flex items-center gap-2 px-3 py-2 text-footnote"
              style={{
                background: "var(--red-soft)",
                color: "var(--red-ink)",
                border: "1px solid color-mix(in srgb, var(--red) 22%, transparent)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              {error}
            </div>
          )}
          <button
            type="submit"
            className="btn-pill w-full mt-1"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleMagicLink} className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="email-magic"
              className="text-footnote-em"
              style={{ color: "var(--foreground)" }}
            >
              Email
            </label>
            <div className="relative">
              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                style={{ color: "var(--foreground-4)" }}
                strokeWidth={1.85}
                aria-hidden
              />
              <input
                id="email-magic"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-callout"
                style={{
                  background: "var(--background-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  letterSpacing: "-0.014em",
                  color: "var(--foreground)",
                }}
                required
                autoFocus
              />
            </div>
            <p
              className="text-footnote"
              style={{ color: "var(--foreground-3)" }}
            >
              We'll send a one-tap sign-in link to your inbox.
            </p>
          </div>
          <button
            type="submit"
            className="btn-pill w-full mt-1"
            disabled={loading || !email.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                Sending…
              </>
            ) : (
              <>
                Send magic link
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "var(--background)" }}
    >
      {/* Soft accent glow behind the card — Apple's "ambient depth" */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(800px 400px at 50% 20%, rgba(0,122,255,0.06), transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-[380px] space-y-7 animate-fade-up">
        <div className="flex flex-col items-center text-center gap-4">
          <div
            aria-hidden
            className="h-14 w-14 flex items-center justify-center"
            style={{
              borderRadius: 16,
              background:
                "linear-gradient(135deg, #007AFF 0%, #5856D6 100%)",
              boxShadow:
                "0 4px 12px rgba(0,122,255,0.25), 0 1px 2px rgba(0,0,0,0.04), inset 0 0 0 0.5px rgba(255,255,255,0.18)",
            }}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h1 className="text-large-title" style={{ fontWeight: 600 }}>
              Welcome to VisaWatch
            </h1>
            <p
              className="hero-sub mt-2"
              style={{ fontSize: 16, color: "var(--foreground-3)" }}
            >
              Sign in to continue.
            </p>
          </div>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>

        <p
          className="text-center text-footnote"
          style={{ color: "var(--foreground-4)" }}
        >
          Need access? Contact your admin.
        </p>
      </div>
    </div>
  );
}
