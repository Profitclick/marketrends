// Image prompt module for AI-generated press photos
// All prompts follow strict realism guidelines:
// - Realistic press photo, documentary style
// - Neutral/muted color profile
// - 16:9 format
// - No AI faces close-up
// - No futuristic elements
// - No artistic effects

export interface ImagePromptContext {
  title: string;
  category: string;
  articleType?: string;
  tags?: string[];
}

const BASE_PROMPT =
  "Realistic editorial press photo, documentary style, neutral muted color palette, 16:9 aspect ratio, used in online newspaper. No people close-up, no artistic effects, no futuristic elements, no AI art style.";

const CATEGORY_MOTIFS: Record<string, string> = {
  "Finans & Marked":
    "Subject: Oslo stock exchange district exterior, financial buildings, screens showing market graphs, trading floor, professional office setting.",
  Marked:
    "Subject: trading floor, market data on screens, financial district skyline.",
  "Krypto & Trading":
    "Subject: cryptocurrency analysts reviewing charts on multiple monitors, server room with blinking lights, subtle blue tones.",
  "Teknologi & AI":
    "Subject: Scandinavian tech office with developers collaborating, modern data center, hardware, monitors with code.",
  "Gründer & Startups":
    "Subject: founders working in a modern coworking space, whiteboards with post-its, laptops, natural light.",
  "Penger & Karriere":
    "Subject: professional Scandinavian office environment, desk with documents and laptop, meeting room.",
  "Trender & Analyse":
    "Subject: multiple screens with graphs and data dashboards, analyst workspace, warm desk lamp.",
  "Guider & Forklart":
    "Subject: clean desk with notebook, laptop and coffee cup, educational setting, soft natural light from window.",
};

/**
 * Generate a press-photo prompt for AI image generation.
 * @param category - Marketrends category (e.g. "Finans & Marked")
 * @param title - Article title for thematic context (truncated to 80 chars)
 */
export function generateImagePrompt(category: string, title?: string): string {
  const motif = CATEGORY_MOTIFS[category] || CATEGORY_MOTIFS["Teknologi & AI"];
  let prompt = `${BASE_PROMPT} ${motif}`;

  if (title) {
    prompt += ` Theme related to: ${title.substring(0, 80)}.`;
  }

  return prompt;
}

/**
 * Higher-level helper that takes full article context.
 */
export function getImagePromptForArticle(ctx: ImagePromptContext): string {
  return generateImagePrompt(ctx.category, ctx.title);
}

export { BASE_PROMPT, CATEGORY_MOTIFS };
