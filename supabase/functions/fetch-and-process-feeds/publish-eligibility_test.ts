import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { evaluatePublishEligibility } from "./publish-eligibility.ts";

const base = {
  qualityScore: 0.92,
  scoreSource: 'ai',
  preScore: 0.70,
  title: 'Norsk fintech vokser etter ny investeringsrunde',
  metaDescription: 'En ny investeringsrunde styrker norsk fintech og kan påvirke konkurransen, kapitaltilgangen og utviklingen i det norske markedet.',
  content: '## Ingress\n\n' + 'fakta '.repeat(470) + '\n\n### Norsk kontekst\nRelevant for norske aktører.\n\n### Konsekvenser\nDette kan endre markedet.',
  tagsLength: 5,
  sourceName: 'CNBC Top News',
  semanticAvailable: true,
  semanticDecision: 'unique',
  autoPublishEnabled: true,
  publishedLast24h: 0,
  autoPublishedThisRun: 0,
};

Deno.test("eligible article passes all hard gates", () => {
  assertEquals(evaluatePublishEligibility(base).eligible, true);
});

Deno.test("semantic failure fails closed for publishing", () => {
  const r = evaluatePublishEligibility({ ...base, semanticAvailable: false, semanticDecision: 'unavailable' });
  assertEquals(r.eligible, false);
  assertEquals(r.reasons.includes('semantic_dedup_unavailable'), true);
});

Deno.test("auto publish requires explicit opt-in", () => {
  const r = evaluatePublishEligibility({ ...base, autoPublishEnabled: false });
  assertEquals(r.eligible, false);
  assertEquals(r.reasons.includes('auto_publish_not_enabled'), true);
});

Deno.test("daily cap blocks scaled publishing", () => {
  const r = evaluatePublishEligibility({ ...base, publishedLast24h: 6 });
  assertEquals(r.eligible, false);
  assertEquals(r.reasons.includes('daily_publish_cap_reached'), true);
});
