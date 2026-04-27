import * as cheerio from "cheerio";

export function extractContent(
  html: string,
  selector: string,
  stripPatterns: string[]
): string {
  const $ = cheerio.load(html);

  // Remove common noise elements
  $("script, style, noscript, [aria-hidden='true'], .cookie-banner, #cookie-notice").remove();

  const region = selector ? $(selector) : $("body");
  let text = region.text();

  if (!text.trim() && selector !== "body") {
    // selector matched nothing — fall back to body
    text = $("body").text();
  }

  // Normalise whitespace
  text = text.replace(/\t/g, " ").replace(/  +/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  // Apply strip patterns
  for (const pattern of stripPatterns) {
    try {
      const re = new RegExp(pattern, "gi");
      text = text.replace(re, "");
    } catch {
      // ignore invalid regex
    }
  }

  return text;
}
