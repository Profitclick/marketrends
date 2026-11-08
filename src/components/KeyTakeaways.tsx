import { useMemo } from "react";
import { Helmet } from "react-helmet";

interface Props {
  content: string;
  metaDescription?: string | null;
  title: string;
}

// Extract a TLDR + 3-5 key takeaways from article content.
// Heuristic: bullet lists, "##/### Nøkkelpunkter" sections, or first 4 strong sentences.
const extract = (content: string, fallback: string): { tldr: string; bullets: string[] } => {
  if (!content) return { tldr: fallback, bullets: [] };

  // 1) Find an explicit takeaway section
  const sections = content.split(/\n(?=#{1,3}\s)/);
  const keySection = sections.find((s) =>
    /^#{1,3}\s.*(nøkkelpunkt|hovedpunkt|kort fortalt|tldr|oppsumm|key takeaway)/i.test(s)
  );
  if (keySection) {
    const bullets = keySection
      .split("\n")
      .filter((l) => /^\s*[-*]\s+/.test(l))
      .map((l) => l.replace(/^\s*[-*]\s+/, "").replace(/\*\*/g, "").trim())
      .filter(Boolean)
      .slice(0, 5);
    if (bullets.length >= 2) return { tldr: fallback, bullets };
  }

  // 2) Use the first bullet list found anywhere
  const bulletBlocks = content.match(/(^|\n)([-*]\s+.+(?:\n[-*]\s+.+)+)/);
  if (bulletBlocks) {
    const bullets = bulletBlocks[0]
      .split("\n")
      .filter((l) => /^\s*[-*]\s+/.test(l))
      .map((l) => l.replace(/^\s*[-*]\s+/, "").replace(/\*\*/g, "").trim())
      .filter((b) => b.length > 10 && b.length < 240)
      .slice(0, 5);
    if (bullets.length >= 3) return { tldr: fallback, bullets };
  }

  // 3) Fall back to first 3-4 strong sentences from prose
  const cleaned = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/#{1,6}\s.*/g, "")
    .replace(/\*\*/g, "")
    .replace(/\n+/g, " ");
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && s.length < 220);
  const bullets = sentences.slice(0, 4);
  return { tldr: fallback, bullets };
};

export const KeyTakeaways = ({ content, metaDescription, title }: Props) => {
  const { tldr, bullets } = useMemo(
    () => extract(content, metaDescription || ""),
    [content, metaDescription]
  );

  if (!tldr && bullets.length < 2) return null;

  return (
    <>
      <aside
        className="my-8 border-y-2 border-foreground py-5"
        aria-label="Kort fortalt"
      >
        <div
          className="text-[10px] font-bold uppercase tracking-widest text-destructive mb-3"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          Kort fortalt
        </div>
        {tldr && (
          <p className="text-[15px] md:text-[16px] leading-[1.7] text-foreground mb-4 font-medium">
            {tldr}
          </p>
        )}
        {bullets.length > 0 && (
          <ul className="space-y-2.5">
            {bullets.map((b, i) => (
              <li
                key={i}
                className="text-[14px] md:text-[15px] leading-[1.65] text-foreground/85 pl-4 relative"
              >
                <span className="absolute left-0 top-2 h-1.5 w-1.5 bg-destructive" />
                {b}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </>
  );
};
