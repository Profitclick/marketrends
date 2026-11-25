import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../index.css?url";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const SITE_URL = "https://marketrends.no";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "NewsMediaOrganization",
  name: "Marketrends.no",
  alternateName: "Marketrends",
  url: SITE_URL,
  logo: {
    "@type": "ImageObject",
    url: `${SITE_URL}/logo.png`,
    width: 600,
    height: 60,
  },
  foundingDate: "2024",
  address: {
    "@type": "PostalAddress",
    addressCountry: "NO",
    addressLocality: "Oslo",
  },
  description:
    "Uavhengig norsk publikasjon om finans, fintech, teknologi, AI, krypto og investering.",
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Marketrends.no",
  url: SITE_URL,
  inLanguage: "nb-NO",
};

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">404</p>
        <h1 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">Siden finnes ikke</h1>
        <p className="mb-6 text-base text-muted-foreground">
          Lenken kan være utdatert eller feilstavet.
        </p>
        <Link
          to="/"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Til forsiden
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: unknown }) {
  console.error(error);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="mb-3 text-2xl font-semibold">Siden kunne ikke lastes</h1>
        <p className="text-muted-foreground">Prøv å laste siden på nytt.</p>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=5" },
      { name: "theme-color", content: "#1e293b" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;0,8..60,800;1,8..60,400;1,8..60,500&family=Inter:wght@300;400;500;600;700&display=swap",
      },
    ],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(organizationSchema) },
      { type: "application/ld+json", children: JSON.stringify(websiteSchema) },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="nb" dir="ltr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Outlet />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
