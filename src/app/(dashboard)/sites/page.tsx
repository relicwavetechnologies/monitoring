import { db } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeverityBadge, SeverityDot } from "@/components/dashboard/severity-badge";
import { formatDistanceToNow } from "@/lib/time";
import { Plus, Globe, CheckCircle2, XCircle, RefreshCw, ExternalLink } from "lucide-react";
import { PollButton } from "@/components/dashboard/poll-button";

export default async function SitesPage() {
  const sites = await db.site.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { changes: true, snapshots: true } },
      changes: {
        orderBy: { detectedAt: "desc" },
        take: 1,
        select: { severity: true, summary: true, detectedAt: true, category: true, id: true },
      },
    },
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Sites</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {sites.length} site{sites.length !== 1 ? "s" : ""} monitored
          </p>
        </div>
        <Link href="/sites/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Site
          </Button>
        </Link>
      </div>

      {sites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border/50 rounded-xl">
          <Globe className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-lg font-medium">No sites yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Add your first visa site to start monitoring.
          </p>
          <Link href="/sites/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Site
            </Button>
          </Link>
        </div>
      ) : (
        <div className="border border-border/50 rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 bg-muted/20 hover:bg-muted/20">
                <TableHead className="pl-4 text-xs font-medium">Site</TableHead>
                <TableHead className="text-xs font-medium">Status</TableHead>
                <TableHead className="text-xs font-medium">Last Check</TableHead>
                <TableHead className="text-xs font-medium">Last Change</TableHead>
                <TableHead className="text-xs font-medium">Changes</TableHead>
                <TableHead className="text-xs font-medium">Mode</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((site) => {
                const lastChange = site.changes[0];
                return (
                  <TableRow key={site.id} className="border-border/50 hover:bg-muted/10 group">
                    <TableCell className="pl-4">
                      <div className="flex flex-col gap-0.5">
                        <Link
                          href={`/sites/${site.id}`}
                          className="font-medium text-sm hover:text-violet-700 transition-colors"
                        >
                          {site.name}
                        </Link>
                        <a
                          href={site.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                        >
                          {new URL(site.url).hostname}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </TableCell>

                    <TableCell>
                      {site.isActive ? (
                        <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Active
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                          <XCircle className="h-3.5 w-3.5" />
                          Paused
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      {site.lastCheckedAt ? formatDistanceToNow(site.lastCheckedAt) : "—"}
                    </TableCell>

                    <TableCell>
                      {lastChange ? (
                        <div className="flex items-center gap-2">
                          <SeverityDot severity={lastChange.severity} />
                          <Link
                            href={`/changes/${lastChange.id}`}
                            className="text-xs text-muted-foreground hover:text-foreground line-clamp-1 max-w-[200px] transition-colors"
                          >
                            {lastChange.summary}
                          </Link>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{site._count.changes}</span>
                        {lastChange && (
                          <SeverityBadge severity={lastChange.severity} />
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="text-[11px] border-border/50">
                        {site.renderMode}
                      </Badge>
                    </TableCell>

                    <TableCell className="pr-4">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <PollButton siteId={site.id} />
                        <Link href={`/sites/${site.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                            View
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
