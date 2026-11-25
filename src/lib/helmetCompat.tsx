import type { ReactNode } from "react";

// TanStack route head() is the sole document-head owner after MIGRATE-01.
// Keeping this no-op compatibility surface lets legacy page components render
// without react-helmet mutating the hydrated head a second time.
export function Helmet(_props: { children?: ReactNode }) {
  return null;
}
