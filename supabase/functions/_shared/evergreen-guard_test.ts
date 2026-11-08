import { assertEquals } from "jsr:@std/assert@1";
import { evergreenGuard } from "./evergreen-guard.ts";

// Rows mirror the current guides / comparison_pages tables.
const ROWS: Record<string, { slug: string; title: string }[]> = {
  guides: [
    { slug: "slik-starter-du-en-startup-i-norge", title: "Slik starter du en startup i Norge" },
    { slug: "slik-lanserer-du-en-saas", title: "Slik lanserer du en SaaS" },
  ],
  comparison_pages: [
    { slug: "bitcoin-vs-ethereum", title: "Bitcoin vs Ethereum: En faglig sammenligning" },
    { slug: "stripe-vs-vipps", title: "Stripe vs Vipps: En faglig sammenligning" },
  ],
  knowledge_pages: [], research_reports: [], articles: [],
};

function mockDb(matches: any[] = []) {
  const writes: string[] = [];
  const q = (table: string) => {
    let rows = [...(ROWS[table] || [])];
    const b: any = {
      select: () => b,
      eq: (c: string, v: any) => { rows = rows.filter((r: any) => c === "published" || r[c] === v); return b; },
      ilike: (_c: string, v: string) => { rows = rows.filter((r) => r.title.toLowerCase() === v.toLowerCase()); return b; },
      limit: () => Promise.resolve({ data: rows }),
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null }),
      insert: () => { writes.push(table); return Promise.resolve({}); },
      upsert: () => { writes.push(table); return Promise.resolve({}); },
      then: (r: any) => r({ data: rows }),
    };
    return b;
  };
  return { writes, from: q, rpc: () => Promise.resolve({ data: matches }) };
}

const okEmbed = () => { globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({ data: [{ embedding: [0.1] }] })))) as any; };
const failEmbed = () => { globalThis.fetch = (() => Promise.resolve(new Response("payment required", { status: 402 }))) as any; };

Deno.test("existing guide slug -> SKIP_DUPLICATE, no writes", async () => {
  const db = mockDb();
  const r = await evergreenGuard(db, "k", { type: "guide", slug: "slik-lanserer-du-en-saas", title: "Slik lanserer du en SaaS" });
  assertEquals(r.decision, "SKIP_DUPLICATE"); assertEquals(r.barrier, "slug"); assertEquals(db.writes.length, 0);
});
Deno.test("analysis noAI mode makes zero embedding calls and fails closed", async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (() => { calls++; throw new Error("AI forbidden"); }) as typeof fetch;
  try {
    const db = mockDb();
    const r = await evergreenGuard(db, "", { type: "knowledge", slug: "new-pillar", title: "Unknown pillar" }, { noAI: true });
    assertEquals(r.decision, "REVIEW_REQUIRED");
    assertEquals(calls, 0);
    assertEquals(db.writes.length, 0);
  } finally { globalThis.fetch = original; }
});
Deno.test("existing slug with allow_update -> UPDATE_EXISTING", async () => {
  const r = await evergreenGuard(mockDb(), "k", { type: "guide", slug: "slik-lanserer-du-en-saas", title: "x" }, { allowUpdate: true });
  assertEquals(r.decision, "UPDATE_EXISTING");
});
Deno.test("mirrored comparison Ethereum vs Bitcoin -> SKIP_DUPLICATE", async () => {
  const r = await evergreenGuard(mockDb(), "k", { type: "comparison", slug: "ethereum-vs-bitcoin", title: "Ethereum vs Bitcoin: En faglig sammenligning", altSlugs: ["bitcoin-vs-ethereum"] });
  assertEquals(r.decision, "SKIP_DUPLICATE"); assertEquals(r.barrier, "mirror_slug");
});
Deno.test("reworded title, new slug -> SKIP_DUPLICATE by normalized title", async () => {
  const r = await evergreenGuard(mockDb(), "k", { type: "guide", slug: "startup-i-norge-slik-starter-du", title: "Startup i Norge: slik starter du en" });
  assertEquals(r.decision, "SKIP_DUPLICATE"); assertEquals(r.barrier, "normalized_title");
});
Deno.test("semantic layer down (402) -> REVIEW_REQUIRED, fail closed", async () => {
  failEmbed();
  const r = await evergreenGuard(mockDb(), "k", { type: "guide", slug: "slik-validerer-du-en-forretningside", title: "Slik validerer du en forretningsidé" });
  assertEquals(r.decision, "REVIEW_REQUIRED"); assertEquals(r.barrier, "semantic_unavailable");
});
Deno.test("cosine 0.88 with same-type guide -> UPDATE_EXISTING", async () => {
  okEmbed();
  const r = await evergreenGuard(mockDb([{ content_type: "guide", ref: "slik-lanserer-du-en-saas", title: "Slik lanserer du en SaaS", similarity: 0.88 }]), "k",
    { type: "guide", slug: "slik-starter-du-et-saas-selskap", title: "Slik starter du et SaaS-selskap" });
  assertEquals(r.decision, "UPDATE_EXISTING");
});
Deno.test("cosine 0.88 with news article -> REVIEW_REQUIRED", async () => {
  okEmbed();
  const r = await evergreenGuard(mockDb([{ content_type: "article", ref: "nyhet", title: "Nyhet", similarity: 0.88 }]), "k",
    { type: "guide", slug: "slik-bygger-du-portefolje", title: "Slik bygger du en investeringsportefølje" });
  assertEquals(r.decision, "REVIEW_REQUIRED");
});
Deno.test("cosine 0.80 -> CREATE_NEW", async () => {
  okEmbed();
  const r = await evergreenGuard(mockDb([{ content_type: "guide", ref: "slik-lanserer-du-en-saas", title: "Slik lanserer du en SaaS", similarity: 0.80 }]), "k",
    { type: "guide", slug: "slik-regner-du-ut-saas-verdsettelse", title: "Slik regner du ut SaaS-verdsettelse" });
  assertEquals(r.decision, "CREATE_NEW");
});

Deno.test("search intent: semantic unavailable -> REVIEW_REQUIRED before AI, no writes", async () => {
  failEmbed();
  const db = mockDb();
  const r = await evergreenGuard(db, "k", { type: "intent", slug: "hva-er-rentefond", title: "Hva er rentefond" });
  assertEquals(r.decision, "REVIEW_REQUIRED"); assertEquals(r.barrier, "semantic_unavailable"); assertEquals(db.writes.length, 0);
});
Deno.test("search intent with same title as an existing guide -> REVIEW_REQUIRED", async () => {
  okEmbed();
  const r = await evergreenGuard(mockDb(), "k", { type: "intent", slug: "x", title: "Slik lanserer du en SaaS" });
  assertEquals(r.decision, "REVIEW_REQUIRED"); assertEquals(r.barrier, "normalized_title");
});
