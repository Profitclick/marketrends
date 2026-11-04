import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404: route not found —", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Helmet>
        <title>Siden finnes ikke – Marketrends.no</title>
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <div className="text-center max-w-md">
        <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">404</p>
        <h1 className="mb-4 text-3xl md:text-4xl font-bold text-foreground">Siden finnes ikke</h1>
        <p className="mb-6 text-base text-muted-foreground">
          Lenken kan være utdatert eller feilstavet. Prøv å gå tilbake til forsiden.
        </p>
        <Link
          to="/"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          Til forsiden
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
