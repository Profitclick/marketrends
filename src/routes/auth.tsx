import { createFileRoute } from "@tanstack/react-router";
import Auth from "@/pages/Auth";
import { privateRouteHead } from "@/lib/routeHead";

export const Route = createFileRoute("/auth")({
  head: () => privateRouteHead("Redaksjonell innlogging"),
  component: Auth,
});
