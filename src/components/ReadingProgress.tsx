import { useEffect, useState } from "react";

// Slim editorial reading-progress indicator pinned to the top of the viewport.
// Pure UI, no tracking, no DB.
export const ReadingProgress = () => {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const max = (doc.scrollHeight - doc.clientHeight) || 1;
      const p = Math.min(100, Math.max(0, (scrollTop / max) * 100));
      setPct(p);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 z-[60] h-[2px] bg-transparent pointer-events-none"
    >
      <div
        className="h-full bg-destructive transition-[width] duration-150 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};
