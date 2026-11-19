import { notFound } from '@tanstack/react-router'

const allowed: Record<string, ReadonlySet<string>> = {
  kategori: new Set(['krypto-trading']),
  topic: new Set(['parlamentarisk-granskning']),
  entity: new Set(['helix']),
  guide: new Set(['slik-bruker-du-ai-til-markedsforing']),
  knowledge: new Set(['feasibility-valid']),
  compare: new Set(['coinbase-vs-binance']),
  intent: new Set(['feasibility-valid']),
}

export function requireKnownSlug(kind: keyof typeof allowed, slug: string) {
  if (!allowed[kind].has(slug)) {
    throw notFound()
  }
  return { kind, slug }
}
