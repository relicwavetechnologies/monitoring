import { diffLines, Change } from "diff";

export interface DiffResult {
  unified: string;
  addedChars: number;
  removedChars: number;
  addedLines: string[];
  removedLines: string[];
  isSignificant: boolean;
}

const MIN_DIFF_CHARS = 40;

export function computeDiff(oldText: string, newText: string): DiffResult {
  const changes: Change[] = diffLines(oldText, newText, { ignoreWhitespace: false });

  const lines: string[] = [];
  let addedChars = 0;
  let removedChars = 0;
  const addedLines: string[] = [];
  const removedLines: string[] = [];

  for (const part of changes) {
    const partLines = (part.value ?? "").split("\n").filter((l) => l.length > 0);
    if (part.added) {
      addedChars += part.value.length;
      partLines.forEach((l) => {
        lines.push(`+ ${l}`);
        addedLines.push(l);
      });
    } else if (part.removed) {
      removedChars += part.value.length;
      partLines.forEach((l) => {
        lines.push(`- ${l}`);
        removedLines.push(l);
      });
    } else {
      // context lines — only include a couple around changes
      const ctxLines = partLines.slice(0, 3);
      ctxLines.forEach((l) => lines.push(`  ${l}`));
      if (partLines.length > 6) {
        lines.push(`  ... (${partLines.length - 6} unchanged lines) ...`);
        partLines.slice(-3).forEach((l) => lines.push(`  ${l}`));
      } else {
        partLines.slice(3).forEach((l) => lines.push(`  ${l}`));
      }
    }
  }

  const totalContent = Math.max(oldText.length, newText.length, 1);
  const pctChange = (addedChars + removedChars) / totalContent;
  const isSignificant = addedChars + removedChars >= MIN_DIFF_CHARS || pctChange >= 0.01;

  return {
    unified: lines.join("\n"),
    addedChars,
    removedChars,
    addedLines,
    removedLines,
    isSignificant,
  };
}
