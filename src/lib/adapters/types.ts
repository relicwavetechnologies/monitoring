import { RenderMode } from "@/generated/prisma/enums";

export interface SiteAdapter {
  id: string;
  name: string;
  url: string;
  renderMode: RenderMode;
  contentSelector: string;
  stripPatterns: string[];
  pollIntervalMin: number;
}
