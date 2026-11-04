import DOMPurify from "dompurify";

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "b", "em", "i", "u", "h1", "h2", "h3", "h4",
      "ul", "ol", "li", "a", "blockquote", "code", "pre", "hr", "span",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "class"],
    ALLOW_DATA_ATTR: false,
  });
}
