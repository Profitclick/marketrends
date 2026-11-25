import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// The serialized root-loader timestamp keeps initial browser rendering identical to SSR.
const RenderClockContext = createContext<number | null>(null);
export function RenderClockProvider({ renderedAt, children }: { renderedAt: number; children: ReactNode }) {
  const [now, setNow] = useState(renderedAt);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [renderedAt]);
  return <RenderClockContext.Provider value={now}>{children}</RenderClockContext.Provider>;
}
export function useRenderClock(): number {
  return useContext(RenderClockContext) ?? Date.now();
}
