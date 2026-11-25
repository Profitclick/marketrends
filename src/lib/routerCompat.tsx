import {
  useLocation as useTanStackLocation,
  useNavigate as useTanStackNavigate,
  useParams as useTanStackParams,
  useRouter,
} from "@tanstack/react-router";
import {
  forwardRef,
  useCallback,
  useEffect,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";

export type To =
  | string
  | {
      pathname?: string;
      search?: string;
      hash?: string;
    };

const toHref = (to: To): string => {
  if (typeof to === "string") return to;
  return `${to.pathname || ""}${to.search || ""}${to.hash || ""}` || "/";
};

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: To;
  replace?: boolean;
  state?: unknown;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, replace: _replace, state: _state, ...props }, ref) => (
    <a ref={ref} href={toHref(to)} {...props} />
  ),
);
Link.displayName = "Link";

export interface NavLinkRenderProps {
  isActive: boolean;
  isPending: boolean;
}

export interface NavLinkProps extends Omit<LinkProps, "className"> {
  className?: string | ((props: NavLinkRenderProps) => string | undefined);
}

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ to, className, ...props }, ref) => {
    const location = useTanStackLocation();
    const href = toHref(to);
    const targetPath = href.split(/[?#]/, 1)[0] || "/";
    const isActive =
      targetPath === "/"
        ? location.pathname === "/"
        : location.pathname === targetPath || location.pathname.startsWith(`${targetPath}/`);
    const resolvedClassName =
      typeof className === "function"
        ? className({ isActive, isPending: false })
        : className;
    return <a ref={ref} href={href} className={resolvedClassName} {...props} />;
  },
);
NavLink.displayName = "NavLink";

export const useLocation = useTanStackLocation;

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  return useTanStackParams({ strict: false }) as unknown as T;
}

export function useNavigate() {
  const navigate = useTanStackNavigate();
  const router = useRouter();

  return useCallback(
    (to: To | number, options?: { replace?: boolean; state?: unknown }) => {
      if (typeof to === "number") {
        router.history.go(to);
        return;
      }
      return navigate({
        to: toHref(to) as never,
        replace: options?.replace,
      });
    },
    [navigate, router],
  );
}

export function Navigate({ to, replace }: { to: To; replace?: boolean }) {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate(to, { replace });
  }, [navigate, replace, to]);
  return null;
}

// Legacy exports remain only so the old SPA entry files keep typechecking.
// TanStack Start does not render App.tsx/main.tsx after migration.
export function BrowserRouter({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
export function Routes({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
export function Route(_props: Record<string, unknown>) {
  return null;
}
