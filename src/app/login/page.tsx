"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Mail, Lock, ArrowRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Suspense } from "react";

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
      if (res?.error) {
        setError("Invalid email or password.");
      } else {
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
      <Card className="bg-card border-border shadow-xl shadow-violet-900/5">
        <CardContent className="pt-8 pb-8 px-8 flex flex-col items-center text-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Check your email</h2>
            <p className="text-sm text-muted-foreground mt-1">
              A magic link has been sent to <strong>{email || "your email"}</strong>.<br />
              Click the link to sign in.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Link expires in 10 minutes. Check your spam if you don&apos;t see it.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border shadow-xl shadow-violet-900/5">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Sign in</CardTitle>
        <CardDescription>
          {tab === "password" ? "Use your email and password" : "Receive a magic link by email"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tab toggle */}
        <div className="flex rounded-lg border border-border p-1 gap-1 bg-muted/40">
          <button
            type="button"
            onClick={() => { setTab("password"); setError(""); }}
            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
              tab === "password" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => { setTab("magic"); setError(""); }}
            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
              tab === "magic" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Magic link
          </button>
        </div>

        {tab === "password" ? (
          <form onSubmit={handlePassword} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 bg-muted/40 border-border"
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 bg-muted/40 border-border"
                  required
                />
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Signing in…</> : <>Sign in<ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email-magic">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email-magic"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 bg-muted/40 border-border"
                  required
                  autoFocus
                />
              </div>
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading || !email.trim()}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</> : <>Send magic link<ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-50/60 via-transparent to-transparent pointer-events-none" />

      <div className="relative w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 shadow-md shadow-violet-300/50 ring-1 ring-violet-300/40">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-jakarta)" }}>VisaWatch</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Real-time visa policy change detection
            </p>
          </div>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
