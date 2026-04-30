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
        <span className="eyebrow inline-block mb-3">New</span>
        <h1 className="hero-title">Add site</h1>
        <p className="hero-sub mt-3">
          Enter a URL and AI will analyse the page to suggest optimal monitoring settings.
        </p>
      </div>

      <AdapterWizard />
    </div>
  );
}
