import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdapterWizard } from "@/components/adapter-wizard/wizard";

export default function NewSitePage() {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Back */}
      <Link
        href="/sites"
        className="subtle-link inline-flex items-center gap-1.5 mb-6"
        style={{ fontSize: 13, letterSpacing: "-0.011em" }}
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        All sites
      </Link>

      {/* Hero */}
      <div className="mb-8 animate-fade-up">
        <h1 className="hero-title">Add site</h1>
        <p className="hero-sub mt-1">
          Enter a URL — AI analyses the page and suggests optimal monitoring settings.
        </p>
      </div>

      <AdapterWizard />
    </div>
  );
}
