import { AdapterWizard } from "@/components/adapter-wizard/wizard";

export default function NewSitePage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold">Add New Site</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter a URL and AI will analyse the page to suggest optimal monitoring settings.
        </p>
      </div>
      <AdapterWizard />
    </div>
  );
}
