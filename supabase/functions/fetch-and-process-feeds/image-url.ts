/** Decode RSS/XML entities without altering percent-encoded or signed URL values. */
export function normalizeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const named: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
  let decoded = value.trim();
  for (let pass = 0; pass < 5; pass++) {
    const next = decoded.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|quot|apos|lt|gt);/gi, (entity, token: string) => {
      if (!token.startsWith('#')) return named[token.toLowerCase()] ?? entity;
      const hex = token[1]?.toLowerCase() === 'x';
      const code = Number.parseInt(token.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code) : entity;
    });
    if (next === decoded) break;
    decoded = next;
  }
  try {
    const url = new URL(decoded);
    return ['http:', 'https:'].includes(url.protocol) ? decoded : null;
  } catch {
    return null;
  }
}