export interface PublishEligibilityInput {
  qualityScore: number;
  scoreSource: string;
  preScore: number;
  title: string;
  metaDescription?: string | null;
  content: string;
  tagsLength: number;
  sourceName: string;
  semanticAvailable: boolean;
  semanticDecision: string;
  autoPublishEnabled: boolean;
  publishedLast24h: number;
  autoPublishedThisRun: number;
}

export interface PublishEligibilityResult {
  eligible: boolean;
  reasons: string[];
}

export const AUTO_PUBLISH_LIMITS = {
  minQualityScore: 0.88,
  minPreScore: 0.55,
  minContentWords: 450,
  maxPublishedPer24h: 6,
  maxPublishedPerRun: 2,
} as const;

const TRUSTED_AUTO_PUBLISH_SOURCES = [
  'Reuters', 'AP News', 'CNBC', 'CoinDesk', 'TechCrunch',
  'Digi.no', 'Teknisk Ukeblad', 'The Block', 'Bloomberg',
];

export function evaluatePublishEligibility(input: PublishEligibilityInput): PublishEligibilityResult {
  const reasons: string[] = [];
  const titleWords = (input.title || '').trim().split(/\s+/).filter(Boolean).length;
  const contentWords = (input.content || '').trim().split(/\s+/).filter(Boolean).length;
  const sourceTrusted = TRUSTED_AUTO_PUBLISH_SOURCES.some(
    (s) => input.sourceName.toLowerCase().includes(s.toLowerCase()),
  );

  if (!input.autoPublishEnabled) reasons.push('auto_publish_not_enabled');
  if (!sourceTrusted) reasons.push('source_not_trusted_for_auto_publish');
  if (input.scoreSource !== 'ai') reasons.push('quality_score_not_from_ai');
  if (input.qualityScore < AUTO_PUBLISH_LIMITS.minQualityScore) reasons.push('quality_score_below_threshold');
  if (input.preScore < AUTO_PUBLISH_LIMITS.minPreScore) reasons.push('pre_ai_score_below_threshold');
  if (input.title.length < 10 || input.title.length > 110 || titleWords < 2 || titleWords > 22) reasons.push('title_not_news_eligible');
  if (!input.metaDescription || input.metaDescription.length < 100 || input.metaDescription.length > 170) reasons.push('meta_description_out_of_range');
  if (contentWords < AUTO_PUBLISH_LIMITS.minContentWords) reasons.push('content_too_thin');
  if (!/norsk kontekst/i.test(input.content)) reasons.push('missing_norwegian_context');
  if (!/konsekvenser/i.test(input.content)) reasons.push('missing_consequences_section');
  if (input.tagsLength < 3) reasons.push('insufficient_tags');
  if (!input.semanticAvailable) reasons.push('semantic_dedup_unavailable');
  if (input.semanticDecision !== 'unique') reasons.push('semantic_duplicate_or_merge');
  if (input.publishedLast24h >= AUTO_PUBLISH_LIMITS.maxPublishedPer24h) reasons.push('daily_publish_cap_reached');
  if (input.autoPublishedThisRun >= AUTO_PUBLISH_LIMITS.maxPublishedPerRun) reasons.push('run_publish_cap_reached');

  return { eligible: reasons.length === 0, reasons };
}
